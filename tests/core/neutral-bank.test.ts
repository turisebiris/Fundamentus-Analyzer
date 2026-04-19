import { describe, it, expect } from 'vitest';
import { rankNetMarginWithNeutralBanks } from '../../src/core/ranking/neutral-bank.js';
import type { ClassifiedStock } from '../../src/core/types.js';

function mk(over: Partial<ClassifiedStock>): ClassifiedStock {
  return {
    ticker: 'X',
    price: 10,
    dividendYield: 0.08,
    pl: 6,
    netMargin: 0.2,
    pvp: 2,
    roe: 0.2,
    liquidity2m: 5_000_000,
    companyName: '',
    sector: '',
    subsector: '',
    isBank: false,
    ...over,
  };
}

describe('rankNetMarginWithNeutralBanks', () => {
  it('não-bancos recebem rank ordinal higher-is-better', () => {
    const out = rankNetMarginWithNeutralBanks([
      mk({ ticker: 'A', netMargin: 0.1 }),
      mk({ ticker: 'B', netMargin: 0.2 }),
      mk({ ticker: 'C', netMargin: 0.3 }),
    ]);
    expect(out.ranks.get('C')).toBe(1);
    expect(out.ranks.get('B')).toBe(2);
    expect(out.ranks.get('A')).toBe(3);
  });

  it('bancos recebem rank médio neutro calculado apenas com não-bancos VÁLIDOS', () => {
    const out = rankNetMarginWithNeutralBanks([
      mk({ ticker: 'A', netMargin: 0.1 }),
      mk({ ticker: 'B', netMargin: 0.2 }),
      mk({ ticker: 'C', netMargin: 0.3 }),
      mk({ ticker: 'ITUB4', isBank: true, netMargin: 0 }),
      mk({ ticker: 'BBAS3', isBank: true, netMargin: null }),
    ]);
    // Ranks dos não-bancos: C=1, B=2, A=3 → média = 2
    expect(out.neutralRank).toBe(2);
    expect(out.ranks.get('ITUB4')).toBe(2);
    expect(out.ranks.get('BBAS3')).toBe(2);
    expect(out.neutralTickers.has('ITUB4')).toBe(true);
    expect(out.neutralTickers.has('BBAS3')).toBe(true);
  });

  it('exclui não-bancos com ML inválida do cálculo da média neutra', () => {
    const out = rankNetMarginWithNeutralBanks([
      mk({ ticker: 'A', netMargin: 0.1 }),
      mk({ ticker: 'B', netMargin: null }), // não-banco sem ML: NÃO entra na média
      mk({ ticker: 'C', netMargin: 0.3 }),
      mk({ ticker: 'ITUB4', isBank: true, netMargin: 0 }),
    ]);
    // Ranks válidos entre não-bancos: C=1, A=2 → média = 1.5
    expect(out.neutralRank).toBeCloseTo(1.5, 6);
    expect(out.ranks.get('ITUB4')).toBeCloseTo(1.5, 6);
    expect(out.missingNonBanks.has('B')).toBe(true);
    // B (não-banco faltante) fica com pior rank (3)
    expect(out.ranks.get('B')).toBe(3);
  });

  it('fallback para rank 1 quando não existe não-banco válido', () => {
    const out = rankNetMarginWithNeutralBanks([
      mk({ ticker: 'ITUB4', isBank: true, netMargin: 0 }),
      mk({ ticker: 'BBAS3', isBank: true, netMargin: null }),
    ]);
    expect(out.neutralRank).toBe(1);
    expect(out.ranks.get('ITUB4')).toBe(1);
  });

  it('NÃO depende do valor de ML do banco para calcular o rank atribuído a ele', () => {
    const out = rankNetMarginWithNeutralBanks([
      mk({ ticker: 'A', netMargin: 0.1 }),
      mk({ ticker: 'B', netMargin: 0.3 }),
      mk({ ticker: 'ITUB4', isBank: true, netMargin: 999 }), // valor alto irrelevante
    ]);
    // Média de {A=2, B=1} = 1.5
    expect(out.ranks.get('ITUB4')).toBeCloseTo(1.5, 6);
  });
});
