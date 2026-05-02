/**
 * Orquestrador do pipeline de análise de ações (rules.md).
 *
 * Ordem:
 *   1. Classificar bancos + aplicar filtros eliminatórios  (filters.ts)
 *   2. Calcular score percentil [0, 1] por indicador      (ranking/percentile.ts)
 *      - ML: coorte = apenas empresas operacionais (exclui bancos, seguradoras e holdings)
 *      - Demais: todos os aprovados com valor válido
 *   3. Pontuação final: média ponderada renormalizada      (score.ts)
 *      - Bancos/Seguradoras/Holdings: ML excluída (clean exclusion)
 *   4. Ordenar por pontuação DESC (maior = melhor); desempate por valores brutos
 *   5. Atribuir posição; retornar approved (lista completa) + top10 + reprovados
 */

import type { IndicatorKey, StockFilterConfig } from '../shared/stocks/config.js';
import {
  ALL_INDICATORS,
  STOCK_DIRECTIONS,
  STOCK_FILTERS,
  STOCK_WEIGHTS,
} from '../shared/stocks/config.js';
import { classifyAndFilter } from './filters.js';
import { computeMinMaxScore } from './ranking/percentile.js';
import { computeRenormalizedScore } from './score.js';
import { compareByScoreThenTiebreakers } from './tiebreak.js';
import type { ClassifiedStock, RankedStock, Report, StockSnapshot } from './types.js';

/**
 * `filters` opcional permite recálculo em tempo real com thresholds
 * customizados pela UI. O modelo de scoring (percentil min-max + clean
 * exclusion + renormalização) é o mesmo em qualquer caso — apenas o conjunto
 * de aprovados muda, e a coorte de percentis se ajusta automaticamente.
 */
export function runPipeline(
  snapshot: StockSnapshot,
  filters: StockFilterConfig = STOCK_FILTERS,
): Report {
  const { approved, rejected } = classifyAndFilter(snapshot.stocks, filters);

  // Scores por indicador — Map<ticker, score [0,1]>
  const indicatorScoreMap: Partial<Record<IndicatorKey, Map<string, number>>> = {};
  const indicatorExcludedSet: Partial<Record<IndicatorKey, Set<string>>> = {};

  // ML: coorte = apenas empresas onde ML é comparável (operacionais "normais").
  // Bancos, seguradoras e holdings não participam da coorte nem recebem score.
  {
    const mlEligible = approved.filter(
      (s) => !s.isBank && !s.isInsurer && !s.isHolding,
    );
    const results = computeMinMaxScore(
      mlEligible.map((s) => ({ ticker: s.ticker, value: s.netMargin })),
      'higher',
    );
    const scoreMap = new Map<string, number>();
    const excluded = new Set<string>();
    for (const r of results) {
      if (r.wasExcluded) excluded.add(r.ticker);
      else scoreMap.set(r.ticker, r.score);
    }
    indicatorScoreMap.netMargin = scoreMap;
    indicatorExcludedSet.netMargin = excluded;
  }

  // Demais indicadores: coorte = todos os aprovados
  for (const indicator of ALL_INDICATORS) {
    if (indicator === 'netMargin') continue;
    const results = computeMinMaxScore(
      approved.map((s) => ({ ticker: s.ticker, value: indicatorValue(s, indicator) })),
      STOCK_DIRECTIONS[indicator],
    );
    const scoreMap = new Map<string, number>();
    const excluded = new Set<string>();
    for (const r of results) {
      if (r.wasExcluded) excluded.add(r.ticker);
      else scoreMap.set(r.ticker, r.score);
    }
    indicatorScoreMap[indicator] = scoreMap;
    indicatorExcludedSet[indicator] = excluded;
  }

  const scored: RankedStock[] = approved.map((s) => {
    const scores: Partial<Record<IndicatorKey, number>> = {};
    const flags: string[] = [];

    for (const indicator of ALL_INDICATORS) {
      // Clean exclusion de ML para bancos, seguradoras e holdings
      if (
        indicator === 'netMargin' &&
        (s.isBank || s.isInsurer || s.isHolding)
      ) {
        continue;
      }

      const v = indicatorScoreMap[indicator]?.get(s.ticker);
      if (v !== undefined) {
        scores[indicator] = v;
      } else if (indicatorExcludedSet[indicator]?.has(s.ticker)) {
        // Valor ausente (caso raro pós-filtros): clean exclusion, não penaliza
        flags.push(`${indicatorLabel(indicator)} ausente — excluída do cálculo`);
      }
    }

    if (s.isBank) {
      flags.push('ML não aplicável (banco) — excluída do cálculo');
    } else if (s.isInsurer) {
      flags.push('ML não aplicável (seguradora) — excluída do cálculo');
    } else if (s.isHolding) {
      flags.push('ML não aplicável (holding) — excluída do cálculo');
    }

    return {
      ...s,
      scores,
      score: computeRenormalizedScore(scores, STOCK_WEIGHTS),
      flags,
      position: 0,
    };
  });

  // Ordenar por score DESC; desempate por indicadores brutos
  scored.sort(compareByScoreThenTiebreakers);
  scored.forEach((s, idx) => {
    s.position = idx + 1;
  });

  return {
    timestamp: snapshot.timestamp,
    totalCollected: snapshot.totalCollected,
    totalAnalyzed: snapshot.stocks.length,
    totalApproved: approved.length,
    approved: scored,
    top10: scored.slice(0, 10),
    rejected,
  };
}

function indicatorValue(stock: ClassifiedStock, indicator: IndicatorKey): number | null {
  switch (indicator) {
    case 'dividendYield':
      return stock.dividendYield;
    case 'pl':
      return stock.pl;
    case 'netMargin':
      return stock.netMargin;
    case 'pvp':
      return stock.pvp;
    case 'roe':
      return stock.roe;
    case 'liquidity2m':
      return stock.liquidity2m;
  }
}

function indicatorLabel(indicator: IndicatorKey): string {
  const labels: Record<IndicatorKey, string> = {
    dividendYield: 'Dividend Yield',
    pl: 'P/L',
    netMargin: 'Margem Líquida',
    pvp: 'P/VP',
    roe: 'ROE',
    liquidity2m: 'Liquidez 2 meses',
  };
  return labels[indicator];
}
