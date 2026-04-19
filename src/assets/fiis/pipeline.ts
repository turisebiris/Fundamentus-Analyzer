/**
 * Orquestrador do pipeline de análise de FIIs (rules_fiis.md).
 *
 * Ordem obrigatória:
 *   1. Classificar segmento                 → somente Logística e Multicategoria
 *      continuam; os demais são descartados antes de qualquer filtro.
 *   2. Aplicar filtros eliminatórios gerais  → DY ≥ 7%, Liquidez ≥ 500 k,
 *      P/VP ∈ [0.7, 1.1].
 *   3. Aplicar filtros específicos de Logística → Qtd de imóveis > 3,
 *      Vacância Média ≤ 10%.
 *      Multicategoria NÃO usa Qtd de imóveis nem Vacância como filtro.
 *   4. Ranking ordinal dense por indicador:
 *        - DY, P/VP, Liquidez → rank sobre TODOS os aprovados.
 *        - Vacância           → rank sobre APENAS Logística com valor válido;
 *                                Multicategoria recebe rank médio neutro
 *                                arredondado ao inteiro mais próximo.
 *   5. Pontuação ponderada fixa (rules_fiis.md). Menor = melhor.
 *   6. Desempate: menor P/VP → maior DY → maior Liquidez → menor Vacância.
 *   7. Posição final (1 = melhor).
 */

import { rankOrdinal } from '../../core/ranking/ordinal.js';
import {
  FII_ALLOWED_SEGMENTS,
  FII_FILTERS,
  FII_INDICATOR_LABELS,
  FII_TIEBREAKER_ORDER,
  FII_WEIGHTS,
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
    if (normalizeSegmentText(allowed) === normalized) {
      return allowed;
    }
  }
  return null;
}

function classify(raw: RawFii): ClassifiedFii {
  const normalizedSegment = classifySegment(raw.segment);
  return {
    ...raw,
    normalizedSegment,
    allowedSegment: normalizedSegment !== null,
  };
}

// ---------------------------------------------------------------------------
// Filtros
// ---------------------------------------------------------------------------

function collectRejections(fii: ClassifiedFii): FiiRejectionReason[] {
  const reasons: FiiRejectionReason[] = [];

  // Gerais
  if (fii.dividendYield === null) {
    reasons.push(missingReason('dividendYield'));
  } else if (fii.dividendYield < FII_FILTERS.dividendYield.min) {
    reasons.push({
      indicator: 'dividendYield',
      message: `${FII_INDICATOR_LABELS.dividendYield} abaixo de 7%`,
    });
  }

  if (fii.liquidity === null) {
    reasons.push(missingReason('liquidity'));
  } else if (fii.liquidity < FII_FILTERS.liquidity.min) {
    reasons.push({
      indicator: 'liquidity',
      message: `${FII_INDICATOR_LABELS.liquidity} abaixo de 500.000`,
    });
  }

  if (fii.pvp === null) {
    reasons.push(missingReason('pvp'));
  } else if (fii.pvp < FII_FILTERS.pvp.min || fii.pvp > FII_FILTERS.pvp.max) {
    reasons.push({
      indicator: 'pvp',
      message: `${FII_INDICATOR_LABELS.pvp} fora do intervalo 0,7 a 1,1`,
    });
  }

  // Específicos de Logística
  if (fii.normalizedSegment === 'Logística') {
    if (fii.propertyCount === null) {
      reasons.push({
        indicator: 'propertyCount',
        message: 'Qtd de imóveis ausente ou inválida',
      });
    } else if (fii.propertyCount <= FII_FILTERS.propertyCount.min) {
      reasons.push({
        indicator: 'propertyCount',
        message: 'Qtd de imóveis não supera 3',
      });
    }

    if (fii.vacancy === null) {
      reasons.push(missingReason('vacancy'));
    } else if (fii.vacancy > FII_FILTERS.vacancy.max) {
      reasons.push({
        indicator: 'vacancy',
        message: `${FII_INDICATOR_LABELS.vacancy} acima de 10%`,
      });
    }
  }

  return reasons;
}

function missingReason(indicator: FiiIndicatorKey): FiiRejectionReason {
  return {
    indicator,
    message: `${FII_INDICATOR_LABELS[indicator]} ausente ou inválido`,
  };
}

// ---------------------------------------------------------------------------
// Ranking
// ---------------------------------------------------------------------------

interface VacancyRankOutput {
  ranks: Map<string, number>;
  neutralTickers: Set<string>;
  neutralRank: number;
  missingLogistics: Set<string>;
}

/**
 * Vacância Média:
 *   - Rank ordinal dense APENAS entre FIIs Logística com valor válido.
 *   - Logística sem valor válido recebe o pior rank desse subconjunto
 *     (via rankOrdinal, consistente com a política de ausentes de ações).
 *   - Multicategoria recebe o rank médio das observações válidas,
 *     arredondado ao inteiro mais próximo (rules_fiis.md).
 */
function rankVacancyWithNeutralMulti(approved: ClassifiedFii[]): VacancyRankOutput {
  const logisticFiis = approved.filter((f) => f.normalizedSegment === 'Logística');

  const logisticRanks = rankOrdinal(
    logisticFiis.map((f) => ({ ticker: f.ticker, value: f.vacancy })),
    'lower', // menor vacância é melhor
  );

  const validRanks = logisticRanks
    .filter((r) => !r.wasMissing)
    .map((r) => r.rank);

  const neutralRaw =
    validRanks.length === 0
      ? 1
      : validRanks.reduce((sum, r) => sum + r, 0) / validRanks.length;
  const neutralRank = Math.round(neutralRaw);

  const ranks = new Map<string, number>();
  const neutralTickers = new Set<string>();
  const missingLogistics = new Set<string>();

  for (const r of logisticRanks) {
    ranks.set(r.ticker, r.rank);
    if (r.wasMissing) missingLogistics.add(r.ticker);
  }

  for (const f of approved) {
    if (f.normalizedSegment === 'Multicategoria') {
      ranks.set(f.ticker, neutralRank);
      neutralTickers.add(f.ticker);
    }
  }

  return { ranks, neutralTickers, neutralRank, missingLogistics };
}

// ---------------------------------------------------------------------------
// Score e desempate
// ---------------------------------------------------------------------------

function computeWeightedScore(ranks: Record<FiiIndicatorKey, number>): number {
  let total = 0;
  for (const key of Object.keys(FII_WEIGHTS) as FiiIndicatorKey[]) {
    total += ranks[key] * FII_WEIGHTS[key];
  }
  return total;
}

function compareByScoreThenTiebreakers(a: RankedFii, b: RankedFii): number {
  if (a.score !== b.score) return a.score - b.score;

  for (const { key, direction } of FII_TIEBREAKER_ORDER) {
    const av = indicatorValue(a, key);
    const bv = indicatorValue(b, key);

    const aMissing = av === null || !Number.isFinite(av);
    const bMissing = bv === null || !Number.isFinite(bv);
    if (aMissing && !bMissing) return 1;
    if (!aMissing && bMissing) return -1;
    if (aMissing && bMissing) continue;

    if (av === bv) continue;
    if (direction === 'higher') {
      return (bv as number) - (av as number);
    }
    return (av as number) - (bv as number);
  }

  return a.ticker.localeCompare(b.ticker);
}

function indicatorValue(fii: ClassifiedFii, key: FiiIndicatorKey): number | null {
  switch (key) {
    case 'dividendYield':
      return fii.dividendYield;
    case 'pvp':
      return fii.pvp;
    case 'liquidity':
      return fii.liquidity;
    case 'vacancy':
      return fii.vacancy;
  }
}

// ---------------------------------------------------------------------------
// Pipeline
// ---------------------------------------------------------------------------

export function runFiiPipeline(snapshot: FiiSnapshot): FiiReport {
  // 1. Classifica segmento e descarta silenciosamente os fora da lista de
  //    segmentos elegíveis (rules_fiis.md: "Todos os outros segmentos devem
  //    ser excluídos"). Só entram em analyzed / approved / rejected os FIIs
  //    de Logística ou Multicategoria.
  const classifiedAll: ClassifiedFii[] = snapshot.fiis.map(classify);
  const candidates: ClassifiedFii[] = classifiedAll.filter((f) => f.allowedSegment);

  // 2 + 3. Filtros
  const approved: ClassifiedFii[] = [];
  const rejected: RejectedFii[] = [];
  for (const f of candidates) {
    const reasons = collectRejections(f);
    if (reasons.length > 0) rejected.push({ ...f, reasons });
    else approved.push(f);
  }

  // 4. Rankings
  const vacancyOutput = rankVacancyWithNeutralMulti(approved);

  const otherRanks: Partial<Record<FiiIndicatorKey, Map<string, number>>> = {};
  const missingByIndicator: Partial<Record<FiiIndicatorKey, Set<string>>> = {};
  const ordinalKeys: FiiIndicatorKey[] = ['dividendYield', 'pvp', 'liquidity'];
  const directions: Record<FiiIndicatorKey, 'higher' | 'lower'> = {
    dividendYield: 'higher',
    pvp: 'lower',
    liquidity: 'higher',
    vacancy: 'lower',
  };

  for (const indicator of ordinalKeys) {
    const ranked = rankOrdinal(
      approved.map((f) => ({ ticker: f.ticker, value: indicatorValue(f, indicator) })),
      directions[indicator],
    );
    const rankMap = new Map<string, number>();
    const missingSet = new Set<string>();
    for (const r of ranked) {
      rankMap.set(r.ticker, r.rank);
      if (r.wasMissing) missingSet.add(r.ticker);
    }
    otherRanks[indicator] = rankMap;
    missingByIndicator[indicator] = missingSet;
  }

  // 5. Score + flags
  const scored: RankedFii[] = approved.map((f) => {
    const ranks: Record<FiiIndicatorKey, number> = {
      dividendYield: otherRanks.dividendYield!.get(f.ticker)!,
      pvp: otherRanks.pvp!.get(f.ticker)!,
      liquidity: otherRanks.liquidity!.get(f.ticker)!,
      vacancy: vacancyOutput.ranks.get(f.ticker)!,
    };

    const flags: string[] = [];
    if (vacancyOutput.neutralTickers.has(f.ticker)) {
      flags.push('multicategoria — rank neutro em Vacância');
    }
    if (vacancyOutput.missingLogistics.has(f.ticker)) {
      flags.push('Vacância ausente — pior rank no indicador');
    }
    for (const indicator of ordinalKeys) {
      if (missingByIndicator[indicator]?.has(f.ticker)) {
        flags.push(
          `${FII_INDICATOR_LABELS[indicator]} ausente — pior rank no indicador`,
        );
      }
    }

    return {
      ...f,
      normalizedSegment: f.normalizedSegment as FiiSegment,
      ranks,
      score: computeWeightedScore(ranks),
      flags,
      position: 0,
    };
  });

  // 6 + 7. Ordenar e posicionar
  scored.sort(compareByScoreThenTiebreakers);
  scored.forEach((s, idx) => {
    s.position = idx + 1;
  });

  return {
    timestamp: snapshot.timestamp,
    totalCollected: snapshot.totalCollected,
    totalAnalyzed: candidates.length,
    totalApproved: approved.length,
    ranked: scored,
    rejected,
  };
}
