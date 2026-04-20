import { describe, it, expect } from 'vitest';
import { runFiiPipeline } from '../../src/assets/fiis/pipeline.js';
import type { FiiSnapshot, RawFii } from '../../src/assets/fiis/types.js';

function snapshot(fiis: RawFii[]): FiiSnapshot {
  return {
    timestamp: '2025-01-01T00:00:00.000Z',
    totalCollected: fiis.length,
    fiis,
  };
}

function baseLogistic(ticker: string, overrides: Partial<RawFii> = {}): RawFii {
  return {
    ticker,
    segment: 'Logística',
    price: 100,
    dividendYield: 0.09,
    pvp: 0.9,
    liquidity: 1_000_000,
    propertyCount: 10,
    vacancy: 0.05,
    ...overrides,
  };
}

function baseMulti(ticker: string, overrides: Partial<RawFii> = {}): RawFii {
  return {
    ticker,
    segment: 'Multicategoria',
    price: 100,
    dividendYield: 0.09,
    pvp: 0.9,
    liquidity: 1_000_000,
    propertyCount: null,
    vacancy: null,
    ...overrides,
  };
}

describe('runFiiPipeline — segmento', () => {
  it('descarta segmentos fora da lista antes de qualquer filtro', () => {
    const report = runFiiPipeline(
      snapshot([
        baseLogistic('HGLG11'),
        { ...baseLogistic('BRCR11'), segment: 'Lajes Corporativas' },
        { ...baseLogistic('MXRF11'), segment: 'Títulos e Val. Mob.' },
      ]),
    );
    // Totais: coletados 3, analyzed 1 (só Logística), approved 1.
    expect(report.totalCollected).toBe(3);
    expect(report.totalAnalyzed).toBe(1);
    expect(report.totalApproved).toBe(1);
    expect(report.ranked.map((r) => r.ticker)).toEqual(['HGLG11']);
    // Segmentos fora da lista não aparecem em rejected (silencioso por design).
    expect(report.rejected.map((r) => r.ticker)).toEqual([]);
  });

  it('classifica Multicategoria corretamente sem exigir Qtd/Vacância', () => {
    const report = runFiiPipeline(snapshot([baseMulti('XPML11')]));
    expect(report.totalAnalyzed).toBe(1);
    expect(report.totalApproved).toBe(1);
    expect(report.ranked[0]!.normalizedSegment).toBe('Multicategoria');
  });
});

describe('runFiiPipeline — filtros gerais', () => {
  it('rejeita DY < 7%', () => {
    const report = runFiiPipeline(
      snapshot([baseLogistic('HGLG11', { dividendYield: 0.05 })]),
    );
    expect(report.totalApproved).toBe(0);
    expect(report.rejected[0]!.reasons.some((r) => r.indicator === 'dividendYield')).toBe(true);
  });

  it('rejeita Liquidez < 500.000', () => {
    const report = runFiiPipeline(
      snapshot([baseLogistic('HGLG11', { liquidity: 100_000 })]),
    );
    expect(report.totalApproved).toBe(0);
    expect(report.rejected[0]!.reasons.some((r) => r.indicator === 'liquidity')).toBe(true);
  });

  it('rejeita P/VP fora de [0.7, 1.1]', () => {
    const low = runFiiPipeline(snapshot([baseLogistic('AAA11', { pvp: 0.5 })]));
    expect(low.rejected[0]!.reasons.some((r) => r.indicator === 'pvp')).toBe(true);
    const high = runFiiPipeline(snapshot([baseLogistic('BBB11', { pvp: 1.5 })]));
    expect(high.rejected[0]!.reasons.some((r) => r.indicator === 'pvp')).toBe(true);
  });

  it('aprova P/VP nos limites do intervalo', () => {
    const report = runFiiPipeline(
      snapshot([
        baseLogistic('AAA11', { pvp: 0.7 }),
        baseLogistic('BBB11', { pvp: 1.1 }),
      ]),
    );
    expect(report.totalApproved).toBe(2);
  });
});

describe('runFiiPipeline — filtros específicos de Logística', () => {
  it('rejeita Logística com Qtd de imóveis ≤ 3', () => {
    const report = runFiiPipeline(
      snapshot([baseLogistic('HGLG11', { propertyCount: 2 })]),
    );
    expect(report.totalApproved).toBe(0);
    expect(
      report.rejected[0]!.reasons.some((r) => r.indicator === 'propertyCount'),
    ).toBe(true);
  });

  it('aprova Logística com Qtd > 3 (estritamente maior)', () => {
    const report = runFiiPipeline(
      snapshot([baseLogistic('HGLG11', { propertyCount: 4 })]),
    );
    expect(report.totalApproved).toBe(1);
  });

  it('rejeita Logística com Vacância > 10%', () => {
    const report = runFiiPipeline(
      snapshot([baseLogistic('HGLG11', { vacancy: 0.2 })]),
    );
    expect(report.totalApproved).toBe(0);
    expect(report.rejected[0]!.reasons.some((r) => r.indicator === 'vacancy')).toBe(true);
  });

  it('aprova Logística com Vacância no limite (10%)', () => {
    const report = runFiiPipeline(
      snapshot([baseLogistic('HGLG11', { vacancy: 0.1 })]),
    );
    expect(report.totalApproved).toBe(1);
  });

  it('NÃO aplica filtros de Qtd/Vacância a Multicategoria', () => {
    const report = runFiiPipeline(
      snapshot([
        baseMulti('XPML11', { propertyCount: 0, vacancy: 0.99 }),
      ]),
    );
    expect(report.totalApproved).toBe(1);
  });
});

describe('runFiiPipeline — ranking', () => {
  it('menor P/VP recebe rank 1 e reflete na pontuação', () => {
    const report = runFiiPipeline(
      snapshot([
        baseLogistic('AAA11', { pvp: 1.0 }),
        baseLogistic('BBB11', { pvp: 0.8 }),
      ]),
    );
    const aaa = report.ranked.find((r) => r.ticker === 'AAA11')!;
    const bbb = report.ranked.find((r) => r.ticker === 'BBB11')!;
    expect(bbb.ranks.pvp).toBe(1);
    expect(aaa.ranks.pvp).toBe(2);
    // Menor P/VP → menor pontuação → posição 1.
    expect(bbb.position).toBe(1);
    expect(aaa.position).toBe(2);
  });

  it('maior DY recebe rank 1', () => {
    const report = runFiiPipeline(
      snapshot([
        baseLogistic('AAA11', { dividendYield: 0.08 }),
        baseLogistic('BBB11', { dividendYield: 0.12 }),
      ]),
    );
    const bbb = report.ranked.find((r) => r.ticker === 'BBB11')!;
    const aaa = report.ranked.find((r) => r.ticker === 'AAA11')!;
    expect(bbb.ranks.dividendYield).toBe(1);
    expect(aaa.ranks.dividendYield).toBe(2);
  });

  it('Qtd de imóveis NÃO participa do ranking (não aparece em ranks)', () => {
    const report = runFiiPipeline(snapshot([baseLogistic('HGLG11')]));
    const ranks = report.ranked[0]!.ranks;
    expect(Object.keys(ranks).sort()).toEqual(
      ['dividendYield', 'liquidity', 'pvp', 'vacancy'],
    );
  });
});

describe('runFiiPipeline — rank neutro em vacância para Multicategoria', () => {
  it('Multicategoria recebe média arredondada dos ranks válidos de Logística', () => {
    // Três Logísticas com vacâncias distintas para gerar média fracionária.
    // Rank vacância (menor = melhor): 0.02→1, 0.05→2, 0.09→3. Média = 2.
    const report = runFiiPipeline(
      snapshot([
        baseLogistic('L1', { vacancy: 0.02 }),
        baseLogistic('L2', { vacancy: 0.05 }),
        baseLogistic('L3', { vacancy: 0.09 }),
        baseMulti('M1'),
      ]),
    );
    const m1 = report.ranked.find((r) => r.ticker === 'M1')!;
    expect(m1.ranks.vacancy).toBe(2);
    expect(m1.flags.some((f) => f.includes('multicategoria'))).toBe(true);
  });

  it('arredonda para o inteiro mais próximo quando a média é fracionária', () => {
    // 4 logísticas: ranks 1,2,3,4 → média 2.5 → arredonda para 3 (half-up).
    const report = runFiiPipeline(
      snapshot([
        baseLogistic('L1', { vacancy: 0.01 }),
        baseLogistic('L2', { vacancy: 0.03 }),
        baseLogistic('L3', { vacancy: 0.05 }),
        baseLogistic('L4', { vacancy: 0.09 }),
        baseMulti('M1'),
      ]),
    );
    const m1 = report.ranked.find((r) => r.ticker === 'M1')!;
    expect(m1.ranks.vacancy).toBe(3);
  });
});

describe('runFiiPipeline — desempate', () => {
  it('empate em score é resolvido por menor P/VP', () => {
    // Configura dois aprovados iguais em tudo, exceto P/VP idêntico; forço
    // um cenário de empate via rank de liquidez/DY.
    const report = runFiiPipeline(
      snapshot([
        baseLogistic('AAA11', { pvp: 0.8, dividendYield: 0.1, liquidity: 1_000_000, vacancy: 0.05 }),
        baseLogistic('BBB11', { pvp: 1.0, dividendYield: 0.1, liquidity: 1_000_000, vacancy: 0.05 }),
      ]),
    );
    expect(report.ranked[0]!.ticker).toBe('AAA11');
  });
});

describe('runFiiPipeline — saída do relatório', () => {
  it('calcula totais corretamente com mistura de segmentos', () => {
    const report = runFiiPipeline(
      snapshot([
        baseLogistic('A1'),                               // aprovado
        baseLogistic('A2', { pvp: 2.0 }),                 // eliminado P/VP
        baseMulti('M1'),                                  // aprovado
        { ...baseLogistic('X1'), segment: 'Papéis' },     // silenciosamente descartado
      ]),
    );
    expect(report.totalCollected).toBe(4);
    expect(report.totalAnalyzed).toBe(3); // 2 Logística + 1 Multi
    expect(report.totalApproved).toBe(2);
    expect(report.rejected).toHaveLength(1);
    expect(report.rejected[0]!.ticker).toBe('A2');
    expect(report.ranked.map((r) => r.position)).toEqual([1, 2]);
  });
});
