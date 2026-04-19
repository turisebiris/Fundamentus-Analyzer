import { describe, it, expect } from 'vitest';
import { rankOrdinal } from '../../src/core/ranking/ordinal.js';

describe('rankOrdinal', () => {
  it('atribui 1 ao melhor (higher is better)', () => {
    const result = rankOrdinal(
      [
        { ticker: 'A', value: 10 },
        { ticker: 'B', value: 20 },
        { ticker: 'C', value: 30 },
      ],
      'higher',
    );
    const byTicker = Object.fromEntries(result.map((r) => [r.ticker, r.rank]));
    expect(byTicker).toEqual({ A: 3, B: 2, C: 1 });
  });

  it('atribui 1 ao melhor (lower is better)', () => {
    const result = rankOrdinal(
      [
        { ticker: 'A', value: 10 },
        { ticker: 'B', value: 20 },
        { ticker: 'C', value: 30 },
      ],
      'lower',
    );
    const byTicker = Object.fromEntries(result.map((r) => [r.ticker, r.rank]));
    expect(byTicker).toEqual({ A: 1, B: 2, C: 3 });
  });

  it('dá o mesmo rank para valores iguais (dense rank)', () => {
    const result = rankOrdinal(
      [
        { ticker: 'A', value: 10 },
        { ticker: 'B', value: 10 },
        { ticker: 'C', value: 20 },
      ],
      'higher',
    );
    const byTicker = Object.fromEntries(result.map((r) => [r.ticker, r.rank]));
    expect(byTicker).toEqual({ A: 2, B: 2, C: 1 });
  });

  it('coloca valores ausentes no pior rank, sinalizando wasMissing', () => {
    const result = rankOrdinal(
      [
        { ticker: 'A', value: 10 },
        { ticker: 'B', value: null },
        { ticker: 'C', value: 20 },
      ],
      'higher',
    );
    const a = result.find((r) => r.ticker === 'A')!;
    const b = result.find((r) => r.ticker === 'B')!;
    const c = result.find((r) => r.ticker === 'C')!;
    expect(c.rank).toBe(1);
    expect(a.rank).toBe(2);
    expect(b.rank).toBe(3);
    expect(b.wasMissing).toBe(true);
    expect(a.wasMissing).toBe(false);
  });

  it('múltiplos ausentes dividem o mesmo pior rank', () => {
    const result = rankOrdinal(
      [
        { ticker: 'A', value: 10 },
        { ticker: 'B', value: null },
        { ticker: 'C', value: null },
      ],
      'higher',
    );
    const b = result.find((r) => r.ticker === 'B')!;
    const c = result.find((r) => r.ticker === 'C')!;
    expect(b.rank).toBe(c.rank);
    expect(b.wasMissing).toBe(true);
  });
});
