/**
 * Ranking ordinal por indicador (rules.md).
 *
 * - Melhor valor recebe rank 1, segundo melhor rank 2, e assim por diante.
 * - "Maior é melhor" e "Menor é melhor" conforme direção do indicador.
 * - Valores iguais recebem o mesmo rank (dense rank). Isso garante que duas
 *   ações empatadas no indicador levem o mesmo peso para a soma ponderada,
 *   sem perturbação artificial do rank seguinte.
 * - AUSENTES/INVÁLIDOS (null / NaN) recebem o PIOR rank possível dentro daquele
 *   indicador, por decisão explícita do rules.md + ajustes do usuário: nunca
 *   premiar dados faltantes, sem recalibragem dinâmica de pesos.
 */

import type { Direction } from '../../shared/stocks/config.js';

export interface Rankable {
  ticker: string;
  value: number | null;
}

export interface OrdinalRankResult {
  ticker: string;
  rank: number;
  /** true se o valor original era null/NaN (rank atribuído foi o pior). */
  wasMissing: boolean;
}

/**
 * Calcula o rank ordinal dense para uma coleção de itens.
 * Ausentes/NaN ficam com o pior rank (igual para todos eles).
 */
export function rankOrdinal(items: Rankable[], direction: Direction): OrdinalRankResult[] {
  const valid: Rankable[] = [];
  const missing: Rankable[] = [];

  for (const item of items) {
    if (item.value === null || !Number.isFinite(item.value)) {
      missing.push(item);
    } else {
      valid.push(item);
    }
  }

  const sorted = [...valid].sort((a, b) => {
    const av = a.value as number;
    const bv = b.value as number;
    return direction === 'higher' ? bv - av : av - bv;
  });

  const rankByTicker = new Map<string, number>();
  let currentRank = 0;
  let lastValue: number | null = null;

  for (const item of sorted) {
    const value = item.value as number;
    if (lastValue === null || value !== lastValue) {
      currentRank += 1;
      lastValue = value;
    }
    rankByTicker.set(item.ticker, currentRank);
  }

  const worstRank = currentRank + (missing.length > 0 ? 1 : 0);

  const results: OrdinalRankResult[] = [];
  for (const item of items) {
    if (item.value === null || !Number.isFinite(item.value)) {
      results.push({ ticker: item.ticker, rank: worstRank, wasMissing: true });
    } else {
      results.push({
        ticker: item.ticker,
        rank: rankByTicker.get(item.ticker)!,
        wasMissing: false,
      });
    }
  }

  return results;
}
