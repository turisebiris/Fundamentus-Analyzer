/**
 * Desempate entre pontuações iguais (rules.md):
 *   1. Maior ROE
 *   2. Maior Dividend Yield
 *   3. Menor P/L
 *   4. Maior Liquidez
 */

import type { RankedStock } from './types.js';
import { TIEBREAKER_ORDER } from '../shared/stocks/config.js';

/**
 * Comparator para Array.prototype.sort:
 * - Primeiro ordena por score ascendente (menor = melhor).
 * - Em caso de empate, aplica a ordem de desempate do rules.md.
 * - Se ainda houver empate após todos os critérios, mantém ordem estável por ticker.
 */
export function compareByScoreThenTiebreakers(a: RankedStock, b: RankedStock): number {
  if (a.score !== b.score) return a.score - b.score;

  for (const { key, direction } of TIEBREAKER_ORDER) {
    const av = a[key];
    const bv = b[key];

    // Ausência em critério de desempate desloca para trás (consistente com "ausente = pior").
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
