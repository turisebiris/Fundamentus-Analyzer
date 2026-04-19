/**
 * Orquestrador do pipeline de análise (rules.md).
 *
 * Ordem obrigatória:
 *   1. Classificar bancos (setor/subsetor)            -> filters.classifyAndFilter
 *   2. Aplicar filtros eliminatórios                   -> filters.classifyAndFilter
 *      (Margem Líquida ignorada para bancos)
 *   3. Para cada indicador, calcular rank ordinal.     -> ranking/ordinal
 *      Margem Líquida usa rank médio neutro em bancos  -> ranking/neutral-bank
 *   4. Somar pontuação ponderada (pesos FIXOS).        -> score.computeWeightedScore
 *   5. Ordenar por menor pontuação, aplicar desempate. -> tiebreak.compareByScoreThenTiebreakers
 *   6. Atribuir posição final e limitar ao Top 10.
 */

import type { IndicatorKey } from '../shared/stocks/config.js';
import { ALL_INDICATORS, STOCK_DIRECTIONS } from '../shared/stocks/config.js';
import { classifyAndFilter } from './filters.js';
import { rankOrdinal } from './ranking/ordinal.js';
import { rankNetMarginWithNeutralBanks } from './ranking/neutral-bank.js';
import { computeWeightedScore } from './score.js';
import { compareByScoreThenTiebreakers } from './tiebreak.js';
import type { ClassifiedStock, RankedStock, Report, StockSnapshot } from './types.js';

export function runPipeline(snapshot: StockSnapshot): Report {
  const { approved, rejected } = classifyAndFilter(snapshot.stocks);

  const netMarginOutput = rankNetMarginWithNeutralBanks(approved);

  // Ranks dos demais indicadores: ordinal simples entre os aprovados.
  const otherRanks: Partial<Record<IndicatorKey, Map<string, number>>> = {};
  const missingByIndicator: Partial<Record<IndicatorKey, Set<string>>> = {};

  for (const indicator of ALL_INDICATORS) {
    if (indicator === 'netMargin') continue;
    const ranked = rankOrdinal(
      approved.map((s) => ({ ticker: s.ticker, value: indicatorValue(s, indicator) })),
      STOCK_DIRECTIONS[indicator],
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

  const scored: RankedStock[] = approved.map((s) => {
    const ranks: Record<IndicatorKey, number> = {
      roe: otherRanks.roe!.get(s.ticker)!,
      netMargin: netMarginOutput.ranks.get(s.ticker)!,
      pl: otherRanks.pl!.get(s.ticker)!,
      dividendYield: otherRanks.dividendYield!.get(s.ticker)!,
      pvp: otherRanks.pvp!.get(s.ticker)!,
      liquidity2m: otherRanks.liquidity2m!.get(s.ticker)!,
    };

    const flags: string[] = [];
    if (netMarginOutput.neutralTickers.has(s.ticker)) {
      flags.push('banco — rank médio neutro em Margem Líquida');
    }
    if (netMarginOutput.missingNonBanks.has(s.ticker)) {
      flags.push('Margem Líquida ausente — pior rank no indicador');
    }
    for (const indicator of ALL_INDICATORS) {
      if (indicator === 'netMargin') continue;
      const missing = missingByIndicator[indicator];
      if (missing?.has(s.ticker)) {
        flags.push(`${indicatorLabel(indicator)} ausente — pior rank no indicador`);
      }
    }

    const score = computeWeightedScore(ranks);

    return {
      ...s,
      ranks,
      score,
      flags,
      position: 0,
    };
  });

  scored.sort(compareByScoreThenTiebreakers);
  scored.forEach((s, idx) => {
    s.position = idx + 1;
  });

  return {
    timestamp: snapshot.timestamp,
    totalCollected: snapshot.totalCollected,
    totalAnalyzed: snapshot.stocks.length,
    totalApproved: approved.length,
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
