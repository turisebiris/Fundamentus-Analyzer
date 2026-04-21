/**
 * Desempate entre pontuações iguais (rules.md):
 *   1. Maior ROE
 *   2. Maior Dividend Yield
 *   3. Menor P/L
 *   4. Maior liquidez
 */

import type { RankedStock } from './types.js';
import { TIEBREAKER_ORDER } from '../shared/stocks/config.js';

/**
 * Comparator para Array.prototype.sort:
 * - Primeiro ordena por score DESCENDENTE (maior = melhor).
 * - Em caso de empate, aplica a ordem de desempate do rules.md via valores brutos.
 * - Se ainda houver empate, mantém ordem estável por ticker.
 */
export function compareByScoreThenTiebreakers(a: RankedStock, b: RankedStock): number {
  // DESC: maior score é melhor
  if (a.score !== b.score) return b.score - a.score;

  for (const { key, direction } of TIEBREAKER_ORDER) {
    const av = a[key];
    const bv = b[key];

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
