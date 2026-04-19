/**
 * Soma ponderada dos ranks por indicador (rules.md).
 *
 *   Pontuação total =
 *     (rank_ROE         × 2.0) +
 *     (rank_MargemLiq.  × 2.0) +
 *     (rank_PL          × 1.5) +
 *     (rank_DY          × 1.0) +
 *     (rank_PVP         × 1.0) +
 *     (rank_Liquidez    × 1.0)
 *
 * Pesos são FIXOS. Não há recalibragem dinâmica por soma de pesos em nenhuma
 * situação (banco, dado ausente etc.).
 */

import type { IndicatorKey } from '../shared/stocks/config.js';
import { STOCK_WEIGHTS } from '../shared/stocks/config.js';

export function computeWeightedScore(ranks: Record<IndicatorKey, number>): number {
  let total = 0;
  for (const key of Object.keys(STOCK_WEIGHTS) as IndicatorKey[]) {
    total += ranks[key] * STOCK_WEIGHTS[key];
  }
  return total;
}
