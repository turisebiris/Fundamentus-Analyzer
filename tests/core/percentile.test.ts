import { describe, it, expect } from 'vitest';
import { computeMinMaxScore } from '../../src/core/ranking/percentile.js';

describe('computeMinMaxScore', () => {
  it('melhor valor (higher) recebe score 1.0', () => {
    const results = computeMinMaxScore(
      [
        { ticker: 'A', value: 10 },
        { ticker: 'B', value: 20 },
        { ticker: 'C', value: 30 },
      ],
      'higher',
    );
    const byTicker = Object.fromEntries(results.map((r) => [r.ticker, r.score]));
    expect(byTicker['C']).toBeCloseTo(1.0, 5);
    expect(byTicker['A']).toBeCloseTo(0.0, 5);
  });

  it('melhor valor (lower) recebe score 1.0', () => {
    const results = computeMinMaxScore(
      [
        { ticker: 'A', value: 10 },
        { ticker: 'B', value: 20 },
        { ticker: 'C', value: 30 },
      ],
      'lower',
    );
    const byTicker = Object.fromEntries(results.map((r) => [r.ticker, r.score]));
    expect(byTicker['A']).toBeCloseTo(1.0, 5);
    expect(byTicker['C']).toBeCloseTo(0.0, 5);
  });

  it('valor médio recebe score ~0.5', () => {
    // Três valores igualmente espaçados: 10, 20, 30
    // P5 ≈ 11, P95 ≈ 29 (interpolação linear). Valor 20 → score ≈ 0.5.
    const results = computeMinMaxScore(
      [
        { ticker: 'A', value: 10 },
        { ticker: 'B', value: 20 },
        { ticker: 'C', value: 30 },
      ],
      'higher',
    );
    const b = results.find((r) => r.ticker === 'B')!;
    expect(b.score).toBeGreaterThan(0.3);
    expect(b.score).toBeLessThan(0.7);
    expect(b.wasExcluded).toBe(false);
  });

  it('valores nulos recebem wasExcluded = true (clean exclusion)', () => {
    const results = computeMinMaxScore(
      [
        { ticker: 'A', value: 10 },
        { ticker: 'B', value: null },
        { ticker: 'C', value: 30 },
      ],
      'higher',
    );
    const b = results.find((r) => r.ticker === 'B')!;
    expect(b.wasExcluded).toBe(true);
    const a = results.find((r) => r.ticker === 'A')!;
    expect(a.wasExcluded).toBe(false);
  });

  it('coorte de 1 elemento válido: score = 1.0 (P5 == P95)', () => {
    const results = computeMinMaxScore([{ ticker: 'X', value: 42 }], 'higher');
    expect(results[0]!.score).toBe(1.0);
    expect(results[0]!.wasExcluded).toBe(false);
  });

  it('todos nulos: todos retornam wasExcluded = true', () => {
    const results = computeMinMaxScore(
      [
        { ticker: 'A', value: null },
        { ticker: 'B', value: null },
      ],
      'higher',
    );
    expect(results.every((r) => r.wasExcluded)).toBe(true);
  });

  it('clipping: valor abaixo de P5 recebe score 0, acima de P95 recebe score 1', () => {
    // 20 valores uniformes 1–20; outlier em 100 seria clampado a P95
    const items = Array.from({ length: 20 }, (_, i) => ({
      ticker: `T${i}`,
      value: i + 1,
    }));
    // Adicionamos outlier extremo que sem clipping distorceria o score do 1
    const withOutlier = [{ ticker: 'OUT', value: 1000 }, ...items];
    const results = computeMinMaxScore(withOutlier, 'higher');

    // Valor 1 (pior dos normais) deve ter score próximo de 0 apesar do outlier
    const worst = results.find((r) => r.ticker === 'T0')!;
    expect(worst.score).toBeCloseTo(0.0, 1);

    // Outlier deve ter score 1.0 (clampado a P95)
    const out = results.find((r) => r.ticker === 'OUT')!;
    expect(out.score).toBe(1.0);
  });

  it('valores homogêneos (max == min após clipping): score = 1.0', () => {
    const results = computeMinMaxScore(
      [
        { ticker: 'A', value: 5 },
        { ticker: 'B', value: 5 },
        { ticker: 'C', value: 5 },
      ],
      'higher',
    );
    expect(results.every((r) => r.score === 1.0 && !r.wasExcluded)).toBe(true);
  });
});
