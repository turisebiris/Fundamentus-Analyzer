/**
 * Pontuação ponderada renormalizada.
 *
 * Apenas os indicadores presentes em `scores` (aplicáveis ao ativo) entram
 * na soma. O divisor é a soma dos pesos desses indicadores — exclusão limpa
 * de indicadores não-aplicáveis sem recalibragem dinâmica adicional.
 *
 * Resultado em [0, 1]. Maior = melhor.
 */
export function computeRenormalizedScore<K extends string>(
  scores: Partial<Record<K, number>>,
  weights: Record<K, number>,
): number {
  let weightedSum = 0;
  let totalWeight = 0;

  for (const key of Object.keys(weights) as K[]) {
    const s = scores[key];
    if (s !== undefined) {
      weightedSum += weights[key] * s;
      totalWeight += weights[key];
    }
  }

  return totalWeight === 0 ? 0 : weightedSum / totalWeight;
}
