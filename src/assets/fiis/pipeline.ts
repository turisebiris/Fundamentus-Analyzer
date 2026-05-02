/**
 * Orquestrador do pipeline de análise de FIIs (rules_fiis.md).
 *
 * Ordem:
 *   1. Classificar segmento — descarta silenciosamente os fora da lista.
 *   2. Filtros eliminatórios gerais (DY ≥ 7%, Liq ≥ 500k, P/VP ∈ [0.7, 1.1]).
 *   3. Filtros específicos de Logística (Qtd > 3, Vacância ≤ 10%).
 *   4. Score percentil [0, 1] por indicador:
 *      - DY, P/VP, Liquidez → coorte = todos os aprovados.
 *      - Vacância           → coorte = somente Logística aprovados.
 *        Multicategoria: Vacância excluída (clean exclusion, sem penalidade).
 *   5. Pontuação renormalizada. Maior = melhor.
 *   6. Ordenar DESC; desempate por valores brutos.
 *   7. Posição; retornar Top 10.
 */

import { computeMinMaxScore } from '../../core/ranking/percentile.js';
import { computeRenormalizedScore } from '../../core/score.js';
import {
  FII_FILTERS,
  FII_INDICATOR_LABELS,
  FII_TIEBREAKER_ORDER,
  FII_WEIGHTS,
  FII_ALLOWED_SEGMENTS,
  type FiiFilterConfig,
  type FiiIndicatorKey,
  type FiiSegment,
} from './config.js';
import type {
  ClassifiedFii,
  FiiReport,
  FiiRejectionReason,
  FiiSnapshot,
  RankedFii,
  RawFii,
  RejectedFii,
} from './types.js';

// ---------------------------------------------------------------------------
// Classificação de segmento
// ---------------------------------------------------------------------------

function normalizeSegmentText(raw: string | null | undefined): string {
  if (!raw) return '';
  return raw
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .toLowerCase();
}

function classifySegment(raw: string | null): FiiSegment | null {
  const normalized = normalizeSegmentText(raw);
  if (!normalized) return null;
  for (const allowed of FII_ALLOWED_SEGMENTS) {
    if (normalizeSegmentText(allowed) === normalized) return allowed;
  }
  return null;
}

function classify(raw: RawFii): ClassifiedFii {
  const normalizedSegment = classifySegment(raw.segment);
  return { ...raw, normalizedSegment, allowedSegment: normalizedSegment !== null };
}

// ---------------------------------------------------------------------------
// Filtros
// ---------------------------------------------------------------------------

function collectRejections(
  fii: ClassifiedFii,
  filters: FiiFilterConfig,
): FiiRejectionReason[] {
  const reasons: FiiRejectionReason[] = [];

  if (fii.dividendYield === null) {
    reasons.push(missingReason('dividendYield'));
  } else if (fii.dividendYield < filters.dividendYield.min) {
    reasons.push({
      indicator: 'dividendYield',
      message: `${FII_INDICATOR_LABELS.dividendYield} abaixo de ${pct(filters.dividendYield.min)}`,
    });
  }

  if (fii.liquidity === null) {
    reasons.push(missingReason('liquidity'));
  } else if (fii.liquidity < filters.liquidity.min) {
    reasons.push({
      indicator: 'liquidity',
      message: `${FII_INDICATOR_LABELS.liquidity} abaixo de ${formatInteger(filters.liquidity.min)}`,
    });
  }

  if (fii.pvp === null) {
    reasons.push(missingReason('pvp'));
  } else if (fii.pvp < filters.pvp.min || fii.pvp > filters.pvp.max) {
    reasons.push({
      indicator: 'pvp',
      message: `${FII_INDICATOR_LABELS.pvp} fora do intervalo ${decimal(filters.pvp.min)} a ${decimal(filters.pvp.max)}`,
    });
  }

  if (fii.normalizedSegment === 'Logística') {
    if (fii.propertyCount === null) {
      reasons.push({ indicator: 'propertyCount', message: 'Qtd de imóveis ausente ou inválida' });
    } else if (fii.propertyCount <= filters.propertyCount.min) {
      reasons.push({
        indicator: 'propertyCount',
        message: `Qtd de imóveis não supera ${filters.propertyCount.min}`,
      });
    }

    if (fii.vacancy === null) {
      reasons.push(missingReason('vacancy'));
    } else if (fii.vacancy > filters.vacancy.max) {
      reasons.push({
        indicator: 'vacancy',
        message: `${FII_INDICATOR_LABELS.vacancy} acima de ${pct(filters.vacancy.max)}`,
      });
    }
  }

  return reasons;
}

function pct(fraction: number): string {
  const value = fraction * 100;
  return Number.isInteger(value) ? `${value}%` : `${value.toFixed(1).replace('.', ',')}%`;
}

function decimal(n: number): string {
  return n.toFixed(1).replace('.', ',');
}

function formatInteger(n: number): string {
  return new Intl.NumberFormat('pt-BR').format(n);
}

function missingReason(indicator: FiiIndicatorKey): FiiRejectionReason {
  return { indicator, message: `${FII_INDICATOR_LABELS[indicator]} ausente ou inválido` };
}

// ---------------------------------------------------------------------------
// Desempate
// ---------------------------------------------------------------------------

function indicatorValue(fii: ClassifiedFii, key: FiiIndicatorKey): number | null {
  switch (key) {
    case 'dividendYield': return fii.dividendYield;
    case 'pvp':           return fii.pvp;
    case 'liquidity':     return fii.liquidity;
    case 'vacancy':       return fii.vacancy;
  }
}

function compareByScoreThenTiebreakers(a: RankedFii, b: RankedFii): number {
  if (a.score !== b.score) return b.score - a.score; // DESC

  for (const { key, direction } of FII_TIEBREAKER_ORDER) {
    const av = indicatorValue(a, key);
    const bv = indicatorValue(b, key);

    const aMissing = av === null || !Number.isFinite(av);
    const bMissing = bv === null || !Number.isFinite(bv);
    if (aMissing && !bMissing) return 1;
    if (!aMissing && bMissing) return -1;
    if (aMissing && bMissing) continue;

    if (av === bv) continue;
    return direction === 'higher' ? (bv as number) - (av as number) : (av as number) - (bv as number);
  }

  return a.ticker.localeCompare(b.ticker);
}

// ---------------------------------------------------------------------------
// Pipeline
// ---------------------------------------------------------------------------

/**
 * `filters` opcional permite recálculo em tempo real com thresholds
 * customizados pela UI. Modelo de scoring inalterado — só muda o conjunto
 * aprovado e, consequentemente, as coortes de percentil.
 */
export function runFiiPipeline(
  snapshot: FiiSnapshot,
  filters: FiiFilterConfig = FII_FILTERS,
): FiiReport {
  // 1. Classifica e descarta segmentos não elegíveis silenciosamente
  const candidates = snapshot.fiis.map(classify).filter((f) => f.allowedSegment);

  // 2+3. Filtros
  const approved: ClassifiedFii[] = [];
  const rejected: RejectedFii[] = [];
  for (const f of candidates) {
    const reasons = collectRejections(f, filters);
    if (reasons.length > 0) rejected.push({ ...f, reasons });
    else approved.push(f);
  }

  // 4. Scores percentis por indicador
  const scoreMap: Partial<Record<FiiIndicatorKey, Map<string, number>>> = {};
  const excludedSet: Partial<Record<FiiIndicatorKey, Set<string>>> = {};

  // Vacância: coorte = somente Logística aprovados
  {
    const logistica = approved.filter((f) => f.normalizedSegment === 'Logística');
    const results = computeMinMaxScore(
      logistica.map((f) => ({ ticker: f.ticker, value: f.vacancy })),
      'lower',
    );
    const m = new Map<string, number>();
    const ex = new Set<string>();
    for (const r of results) {
      if (r.wasExcluded) ex.add(r.ticker);
      else m.set(r.ticker, r.score);
    }
    scoreMap.vacancy = m;
    excludedSet.vacancy = ex;
  }

  // DY, P/VP, Liquidez: coorte = todos os aprovados
  const cohortIndicators: Array<{ key: FiiIndicatorKey; direction: 'higher' | 'lower' }> = [
    { key: 'dividendYield', direction: 'higher' },
    { key: 'pvp',           direction: 'lower'  },
    { key: 'liquidity',     direction: 'higher' },
  ];
  for (const { key, direction } of cohortIndicators) {
    const results = computeMinMaxScore(
      approved.map((f) => ({ ticker: f.ticker, value: indicatorValue(f, key) })),
      direction,
    );
    const m = new Map<string, number>();
    const ex = new Set<string>();
    for (const r of results) {
      if (r.wasExcluded) ex.add(r.ticker);
      else m.set(r.ticker, r.score);
    }
    scoreMap[key] = m;
    excludedSet[key] = ex;
  }

  // 5. Montar RankedFii
  const scored: RankedFii[] = approved.map((f) => {
    const scores: Partial<Record<FiiIndicatorKey, number>> = {};
    const flags: string[] = [];

    for (const key of ['dividendYield', 'pvp', 'liquidity'] as FiiIndicatorKey[]) {
      const v = scoreMap[key]?.get(f.ticker);
      if (v !== undefined) {
        scores[key] = v;
      } else if (excludedSet[key]?.has(f.ticker)) {
        flags.push(`${FII_INDICATOR_LABELS[key]} ausente — excluída do cálculo`);
      }
    }

    // Vacância: somente Logística
    if (f.normalizedSegment === 'Logística') {
      const v = scoreMap.vacancy?.get(f.ticker);
      if (v !== undefined) {
        scores.vacancy = v;
      } else if (excludedSet.vacancy?.has(f.ticker)) {
        flags.push(`${FII_INDICATOR_LABELS.vacancy} ausente — excluída do cálculo`);
      }
    } else {
      // Multicategoria: Vacância não aplicável
      flags.push('Vacância não aplicável (Multicategoria) — excluída do cálculo');
    }

    return {
      ...f,
      normalizedSegment: f.normalizedSegment as FiiSegment,
      scores,
      score: computeRenormalizedScore(scores, FII_WEIGHTS),
      flags,
      position: 0,
    };
  });

  // 6+7. Ordenar DESC e posicionar
  scored.sort(compareByScoreThenTiebreakers);
  scored.forEach((s, idx) => {
    s.position = idx + 1;
  });

  return {
    timestamp: snapshot.timestamp,
    totalCollected: snapshot.totalCollected,
    totalAnalyzed: candidates.length,
    totalApproved: approved.length,
    approved: scored,
    top10: scored.slice(0, 10),
    rejected,
  };
}
