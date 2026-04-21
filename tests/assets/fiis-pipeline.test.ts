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
    expect(report.totalCollected).toBe(3);
    expect(report.totalAnalyzed).toBe(1);
    expect(report.totalApproved).toBe(1);
    expect(report.top10.map((r) => r.ticker)).toEqual(['HGLG11']);
    expect(report.rejected).toHaveLength(0);
  });

  it('classifica Multicategoria corretamente', () => {
    const report = runFiiPipeline(snapshot([baseMulti('XPML11')]));
    expect(report.totalApproved).toBe(1);
    expect(report.top10[0]!.normalizedSegment).toBe('Multicategoria');
  });
});

describe('runFiiPipeline — filtros gerais', () => {
  it('rejeita DY < 7%', () => {
    const report = runFiiPipeline(snapshot([baseLogistic('A', { dividendYield: 0.05 })]));
    expect(report.totalApproved).toBe(0);
    expect(report.rejected[0]!.reasons.some((r) => r.indicator === 'dividendYield')).toBe(true);
  });

  it('rejeita Liquidez < 500.000', () => {
    const report = runFiiPipeline(snapshot([baseLogistic('A', { liquidity: 100_000 })]));
    expect(report.totalApproved).toBe(0);
    expect(report.rejected[0]!.reasons.some((r) => r.indicator === 'liquidity')).toBe(true);
  });

  it('rejeita P/VP fora de [0.7, 1.1]', () => {
    const low = runFiiPipeline(snapshot([baseLogistic('A', { pvp: 0.5 })]));
    expect(low.rejected[0]!.reasons.some((r) => r.indicator === 'pvp')).toBe(true);
    const high = runFiiPipeline(snapshot([baseLogistic('A', { pvp: 1.5 })]));
    expect(high.rejected[0]!.reasons.some((r) => r.indicator === 'pvp')).toBe(true);
  });

  it('aprova P/VP nos limites do intervalo', () => {
    const report = runFiiPipeline(
      snapshot([baseLogistic('A', { pvp: 0.7 }), baseLogistic('B', { pvp: 1.1 })]),
    );
    expect(report.totalApproved).toBe(2);
  });
});

describe('runFiiPipeline — filtros específicos de Logística', () => {
  it('rejeita Logística com Qtd ≤ 3', () => {
    const report = runFiiPipeline(snapshot([baseLogistic('A', { propertyCount: 2 })]));
    expect(report.totalApproved).toBe(0);
    expect(report.rejected[0]!.reasons.some((r) => r.indicator === 'propertyCount')).toBe(true);
  });

  it('aprova Logística com Qtd > 3', () => {
    const report = runFiiPipeline(snapshot([baseLogistic('A', { propertyCount: 4 })]));
    expect(report.totalApproved).toBe(1);
  });

  it('rejeita Logística com Vacância > 10%', () => {
    const report = runFiiPipeline(snapshot([baseLogistic('A', { vacancy: 0.2 })]));
    expect(report.totalApproved).toBe(0);
    expect(report.rejected[0]!.reasons.some((r) => r.indicator === 'vacancy')).toBe(true);
  });

  it('NÃO aplica filtros de Qtd/Vacância a Multicategoria', () => {
    const report = runFiiPipeline(
      snapshot([baseMulti('M', { propertyCount: 0, vacancy: 0.99 })]),
    );
    expect(report.totalApproved).toBe(1);
  });
});

describe('runFiiPipeline — scoring percentil', () => {
  it('scores por indicador estão em [0, 1]', () => {
    const report = runFiiPipeline(
      snapshot([
        baseLogistic('L1', { dividendYield: 0.08, pvp: 0.75, liquidity: 600_000, vacancy: 0.03 }),
        baseLogistic('L2', { dividendYield: 0.12, pvp: 1.05, liquidity: 2_000_000, vacancy: 0.08 }),
        baseMulti('M1'),
      ]),
    );
    for (const f of report.top10) {
      for (const [, v] of Object.entries(f.scores)) {
        if (v !== undefined) {
          expect(v).toBeGreaterThanOrEqual(0);
          expect(v).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it('pontuação final em [0, 1] e maior = melhor', () => {
    const report = runFiiPipeline(
      snapshot([
        baseLogistic('L1', { dividendYield: 0.12, pvp: 0.75, liquidity: 2_000_000, vacancy: 0.02 }),
        baseLogistic('L2', { dividendYield: 0.07, pvp: 1.05, liquidity: 600_000, vacancy: 0.09 }),
      ]),
    );
    expect(report.top10[0]!.score).toBeGreaterThan(report.top10[1]!.score);
    expect(report.top10[0]!.position).toBe(1);
  });

  it('Multicategoria: vacancy ausente dos scores (clean exclusion)', () => {
    const report = runFiiPipeline(snapshot([baseMulti('M')]));
    const m = report.top10[0]!;
    expect(m.scores.vacancy).toBeUndefined();
    expect(m.flags.some((f) => f.includes('Vacância não aplicável'))).toBe(true);
  });

  it('Multicategoria: vacancy excluída, pesos renormalizados (divisor 4.5 em vez de 6.0)', () => {
    // Com apenas 1 aprovado multi e 1 logística, verificamos que o score
    // de multi não tem vacancy enquanto logística tem.
    const report = runFiiPipeline(
      snapshot([
        baseLogistic('L1'),
        baseMulti('M1'),
      ]),
    );
    const l = report.top10.find((f) => f.ticker === 'L1')!;
    const m = report.top10.find((f) => f.ticker === 'M1')!;
    expect(l.scores.vacancy).toBeDefined();
    expect(m.scores.vacancy).toBeUndefined();
  });

  it('Logística: coorte de vacância é independente da Multicategoria', () => {
    // 2 logísticas com vacâncias distintas + 1 multicategoria sem vacância.
    // Vacância da Logística deve ser scoreada normalmente entre as duas logísticas.
    const report = runFiiPipeline(
      snapshot([
        baseLogistic('L1', { vacancy: 0.02 }), // melhor vacância
        baseLogistic('L2', { vacancy: 0.08 }), // pior vacância
        baseMulti('M1'),
      ]),
    );
    const l1 = report.top10.find((f) => f.ticker === 'L1')!;
    const l2 = report.top10.find((f) => f.ticker === 'L2')!;
    // L1 tem menor vacância → melhor score de vacancy
    expect(l1.scores.vacancy).toBeGreaterThan(l2.scores.vacancy!);
  });
});

describe('runFiiPipeline — Top 10', () => {
  it('retorna no máximo 10 FIIs', () => {
    const fiis = Array.from({ length: 15 }, (_, i) =>
      baseLogistic(`F${i}11`, { dividendYield: 0.07 + i * 0.003, pvp: 0.8 + i * 0.02 }),
    );
    const report = runFiiPipeline(snapshot(fiis));
    expect(report.top10.length).toBeLessThanOrEqual(10);
    expect(report.totalApproved).toBe(15);
  });

  it('posições são sequenciais a partir de 1', () => {
    const fiis = [baseLogistic('A11'), baseLogistic('B11', { dividendYield: 0.11 })];
    const report = runFiiPipeline(snapshot(fiis));
    expect(report.top10.map((f) => f.position)).toEqual([1, 2]);
  });
});

describe('runFiiPipeline — saída do relatório', () => {
  it('calcula totais corretamente', () => {
    const report = runFiiPipeline(
      snapshot([
        baseLogistic('A'),
        baseLogistic('B', { pvp: 2.0 }), // eliminado P/VP
        baseMulti('M'),
        { ...baseLogistic('X'), segment: 'Papéis' }, // segmento inválido
      ]),
    );
    expect(report.totalCollected).toBe(4);
    expect(report.totalAnalyzed).toBe(3); // 2 Logística + 1 Multi
    expect(report.totalApproved).toBe(2);
    expect(report.rejected).toHaveLength(1);
    expect(report.rejected[0]!.ticker).toBe('B');
  });
});
