import { describe, it, expect } from 'vitest';
import { computeRenormalizedScore } from '../../src/core/score.js';

const WEIGHTS = { a: 2.0, b: 1.5, c: 1.0 } as const;
type K = keyof typeof WEIGHTS;

describe('computeRenormalizedScore', () => {
  it('todos os indicadores aplicáveis: média ponderada simples', () => {
    // (2.0×1.0 + 1.5×0.5 + 1.0×0.0) / (2.0 + 1.5 + 1.0) = 2.75 / 4.5 ≈ 0.6111
    const scores: Partial<Record<K, number>> = { a: 1.0, b: 0.5, c: 0.0 };
    const result = computeRenormalizedScore(scores, WEIGHTS);
    expect(result).toBeCloseTo(2.75 / 4.5, 5);
  });

  it('indicador ausente exclui o peso do divisor (renormalização)', () => {
    // Sem 'c': (2.0×1.0 + 1.5×0.5) / (2.0 + 1.5) = 2.75 / 3.5 ≈ 0.7857
    const scores: Partial<Record<K, number>> = { a: 1.0, b: 0.5 };
    const result = computeRenormalizedScore(scores, WEIGHTS);
    expect(result).toBeCloseTo(2.75 / 3.5, 5);
  });

  it('banco (apenas a e b): divisor = 2.0 + 1.5 = 3.5', () => {
    const scores: Partial<Record<K, number>> = { a: 0.8, b: 0.6 };
    const expected = (2.0 * 0.8 + 1.5 * 0.6) / (2.0 + 1.5);
    expect(computeRenormalizedScore(scores, WEIGHTS)).toBeCloseTo(expected, 5);
  });

  it('todos scores = 1.0: resultado = 1.0', () => {
    const scores: Partial<Record<K, number>> = { a: 1.0, b: 1.0, c: 1.0 };
    expect(computeRenormalizedScore(scores, WEIGHTS)).toBeCloseTo(1.0, 5);
  });

  it('todos scores = 0.0: resultado = 0.0', () => {
    const scores: Partial<Record<K, number>> = { a: 0.0, b: 0.0, c: 0.0 };
    expect(computeRenormalizedScore(scores, WEIGHTS)).toBeCloseTo(0.0, 5);
  });

  it('nenhum indicador aplicável: resultado = 0', () => {
    const scores: Partial<Record<K, number>> = {};
    expect(computeRenormalizedScore(scores, WEIGHTS)).toBe(0);
  });

  it('resultado sempre em [0, 1] com scores válidos', () => {
    const scores: Partial<Record<K, number>> = { a: 0.3, b: 0.7, c: 0.5 };
    const result = computeRenormalizedScore(scores, WEIGHTS);
    expect(result).toBeGreaterThanOrEqual(0);
    expect(result).toBeLessThanOrEqual(1);
  });
});
