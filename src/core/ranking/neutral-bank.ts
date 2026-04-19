/**
 * Rank médio neutro em Margem Líquida para bancos (rules.md).
 *
 * Regra explícita:
 *   - Bancos NÃO são eliminados pelo filtro de Margem Líquida.
 *   - No ranking de Margem Líquida, bancos recebem rank médio neutro.
 *   - O rank médio é calculado APENAS a partir das empresas não-bancárias que
 *     possuem valor válido de Margem Líquida.
 *   - O peso de Margem Líquida permanece normal (2.0) na pontuação final.
 *
 * Observação: caso não exista nenhuma empresa não-bancária com Margem Líquida
 * válida (cenário improvável), o fallback é rank 1 (média vazia = 1). Isso
 * mantém o sistema operável sem inflar nem penalizar bancos.
 */

import type { ClassifiedStock } from '../types.js';
import { rankOrdinal, type OrdinalRankResult } from './ordinal.js';

export interface NetMarginRankOutput {
  /** Rank de Margem Líquida por ticker (todos os aprovados presentes). */
  ranks: Map<string, number>;
  /** Tickers que receberam o rank médio neutro (bancos). */
  neutralTickers: Set<string>;
  /** Rank médio aplicado aos bancos (para debugging/exibição). */
  neutralRank: number;
  /** Tickers de não-bancos cujo valor de ML era null/NaN (receberam pior rank). */
  missingNonBanks: Set<string>;
}

export function rankNetMarginWithNeutralBanks(
  approved: ClassifiedStock[],
): NetMarginRankOutput {
  const nonBanks = approved.filter((s) => !s.isBank);

  // Rank ordinal "higher is better" apenas entre não-bancos. Valores ausentes
  // entre não-bancos recebem o pior rank (vide ordinal.ts).
  const nonBankRanks: OrdinalRankResult[] = rankOrdinal(
    nonBanks.map((s) => ({ ticker: s.ticker, value: s.netMargin })),
    'higher',
  );

  // Rank médio neutro considera apenas não-bancos com valor VÁLIDO de ML.
  const validRanks = nonBankRanks
    .filter((r) => !r.wasMissing)
    .map((r) => r.rank);

  const neutralRank =
    validRanks.length === 0
      ? 1
      : validRanks.reduce((sum, r) => sum + r, 0) / validRanks.length;

  const ranks = new Map<string, number>();
  const neutralTickers = new Set<string>();
  const missingNonBanks = new Set<string>();

  for (const r of nonBankRanks) {
    ranks.set(r.ticker, r.rank);
    if (r.wasMissing) missingNonBanks.add(r.ticker);
  }

  for (const s of approved) {
    if (s.isBank) {
      ranks.set(s.ticker, neutralRank);
      neutralTickers.add(s.ticker);
    }
  }

  return { ranks, neutralTickers, neutralRank, missingNonBanks };
}
