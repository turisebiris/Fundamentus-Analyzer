/**
 * Pontuação por indicador via normalização min-max com clipping de outliers
 * (percentis P5 e P95). Sem ranking ordinal — score contínuo em [0, 1].
 *
 * Fluxo para cada indicador:
 *   1. Extrai valores válidos da coorte recebida.
 *   2. Calcula P5 e P95 via interpolação linear (estilo PERCENTILE.INC).
 *   3. Para cada item com valor válido: clampeia em [P5, P95] e normaliza.
 *      - higher is better: score = (v_clamped - P5) / (P95 - P5)
 *      - lower  is better: score = (P95 - v_clamped) / (P95 - P5)
 *   4. Se P5 == P95 (coorte homogênea): score = 1.0.
 *   5. Itens com null/NaN → wasExcluded = true (exclusão limpa; não penaliza).
 *
 * A coorte usada para calcular P5/P95 deve ser a mesma recebida em `items`
 * filtrada para os itens com valor válido. Coortes especiais (ex.: ML apenas
 * entre não-bancos; Vacância apenas entre Logística) devem ser pré-filtradas
 * pelo chamador antes de passar para esta função.
 */

import type { Direction } from '../../shared/stocks/config.js';

export interface PercentileItem {
  ticker: string;
  value: number | null;
}

export interface PercentileResult {
  ticker: string;
  /** Score em [0, 1]; irrelevante quando wasExcluded = true. */
  score: number;
  /** true = valor ausente/inválido; indicador excluído do score deste ativo. */
  wasExcluded: boolean;
}

/**
 * Interpola o quantil p (0–1) sobre um array ordenado de forma crescente.
 * Usa interpolação linear idêntica à fórmula PERCENTILE.INC do Excel.
 */
function interpolatedPercentile(sorted: number[], p: number): number {
  if (sorted.length === 1) return sorted[0]!;
  const idx = p * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  const frac = idx - lo;
  return sorted[lo]! + frac * (sorted[hi]! - sorted[lo]!);
}

/**
 * Computa o score min-max com clipping P5/P95 para cada item da coorte.
 *
 * @param items     Coorte de ativos (ticker + valor bruto; null = ausente).
 * @param direction Direção do indicador ('higher' | 'lower').
 * @param p5        Quantil inferior de clipping (padrão 0.05).
 * @param p95       Quantil superior de clipping (padrão 0.95).
 */
export function computeMinMaxScore(
  items: PercentileItem[],
  direction: Direction,
  p5 = 0.05,
  p95 = 0.95,
): PercentileResult[] {
  const validValues = items
    .map((i) => i.value)
    .filter((v): v is number => v !== null && Number.isFinite(v));

  const sorted = [...validValues].sort((a, b) => a - b);

  if (sorted.length === 0) {
    return items.map((i) => ({ ticker: i.ticker, score: 0, wasExcluded: true }));
  }

  const pLow = interpolatedPercentile(sorted, p5);
  const pHigh = interpolatedPercentile(sorted, p95);

  return items.map((i) => {
    if (i.value === null || !Number.isFinite(i.value)) {
      return { ticker: i.ticker, score: 0, wasExcluded: true };
    }

    if (pLow === pHigh) {
      return { ticker: i.ticker, score: 1.0, wasExcluded: false };
    }

    const clamped = Math.max(pLow, Math.min(pHigh, i.value));
    const score =
      direction === 'higher'
        ? (clamped - pLow) / (pHigh - pLow)
        : (pHigh - clamped) / (pHigh - pLow);

    return { ticker: i.ticker, score, wasExcluded: false };
  });
}
