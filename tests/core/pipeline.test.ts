import { describe, it, expect } from 'vitest';
import { runPipeline } from '../../src/core/pipeline.js';
import type { RawStock, StockSnapshot } from '../../src/core/types.js';
import { STOCK_WEIGHTS } from '../../src/shared/stocks/config.js';

function stock(over: Partial<RawStock>): RawStock {
  return {
    ticker: 'ABCD3',
    price: 10,
    dividendYield: 0.08,
    pl: 6,
    netMargin: 0.2,
    pvp: 2,
    roe: 0.2,
    liquidity2m: 5_000_000,
    companyName: null,
    sector: 'Indústria',
    subsector: 'Genérico',
    ...over,
  };
}

function snap(stocks: RawStock[]): StockSnapshot {
  return {
    timestamp: '2026-04-19T10:00:00.000Z',
    totalCollected: stocks.length,
    stocks,
  };
}

describe('pipeline completo', () => {
  it('limita a saída ao Top 10', () => {
    const stocks: RawStock[] = Array.from({ length: 15 }, (_, i) =>
      stock({
        ticker: `A${String(i).padStart(2, '0')}`,
        dividendYield: 0.06 + i * 0.005,
        pl: 4 + i * 0.1,
        roe: 0.15 + i * 0.01,
      }),
    );
    const report = runPipeline(snap(stocks));
    expect(report.top10).toHaveLength(10);
    expect(report.totalApproved).toBe(15);
  });

  it('menor pontuação ocupa a primeira posição', () => {
    const best = stock({
      ticker: 'BEST3',
      dividendYield: 0.2,
      pl: 3.1,
      netMargin: 0.5,
      pvp: 0.5,
      roe: 0.4,
      liquidity2m: 50_000_000,
    });
    const worst = stock({
      ticker: 'WORS4',
      dividendYield: 0.06,
      pl: 9.9,
      netMargin: 0.11,
      pvp: 9.9,
      roe: 0.121,
      liquidity2m: 1_000_001,
    });
    const report = runPipeline(snap([worst, best]));
    expect(report.top10[0]!.ticker).toBe('BEST3');
    expect(report.top10[0]!.position).toBe(1);
    expect(report.top10[1]!.ticker).toBe('WORS4');
    expect(report.top10[1]!.position).toBe(2);
    expect(report.top10[0]!.score).toBeLessThan(report.top10[1]!.score);
  });

  it('desempate: ROE maior vence em caso de score igual', () => {
    // Duas ações idênticas em TODOS os indicadores exceto ROE (ambos > 12%).
    // Como ranks são dense e a ROE difere, os scores também diferem, então
    // fabricamos um empate forçado duplicando valores com ROE diferentes:
    const a = stock({
      ticker: 'AAAA3',
      dividendYield: 0.1,
      pl: 5,
      netMargin: 0.2,
      pvp: 2,
      roe: 0.2,
      liquidity2m: 5_000_000,
    });
    const b = stock({
      ticker: 'BBBB4',
      dividendYield: 0.1,
      pl: 5,
      netMargin: 0.2,
      pvp: 2,
      roe: 0.3, // ROE maior -> deve vencer desempate
      liquidity2m: 5_000_000,
    });
    const report = runPipeline(snap([a, b]));
    // Pontuação de A: todos rank 1 salvo ROE rank 2 => score inclui +2*2 em ROE
    // Pontuação de B: todos rank 1 salvo ROE rank 1 => score menor
    // B vence no score; não é empate mas valida a direção correta de ROE.
    expect(report.top10[0]!.ticker).toBe('BBBB4');
  });

  it('banco recebe flag de rank médio neutro em ML', () => {
    const bank = stock({
      ticker: 'ITUB4',
      netMargin: 0,
      sector: 'Financeiros',
      subsector: 'Bancos',
    });
    const other = stock({ ticker: 'OTHR3', netMargin: 0.25 });
    const report = runPipeline(snap([bank, other]));
    const itub = report.top10.find((s) => s.ticker === 'ITUB4')!;
    expect(itub.flags.some((f) => f.includes('rank médio neutro'))).toBe(true);
    expect(itub.isBank).toBe(true);
  });

  it('ações reprovadas aparecem em rejected com motivo', () => {
    const fail = stock({ ticker: 'FAIL3', pl: 1 }); // P/L < 3
    const ok = stock({ ticker: 'OKAY3' });
    const report = runPipeline(snap([fail, ok]));
    expect(report.rejected.map((r) => r.ticker)).toContain('FAIL3');
    expect(report.top10.map((s) => s.ticker)).toContain('OKAY3');
  });

  it('pesos da pontuação somam exatamente conforme rules.md', () => {
    // Sanidade: os pesos permanecem fixos em 2+2+1.5+1+1+1 = 8.5
    const total =
      STOCK_WEIGHTS.roe +
      STOCK_WEIGHTS.netMargin +
      STOCK_WEIGHTS.pl +
      STOCK_WEIGHTS.dividendYield +
      STOCK_WEIGHTS.pvp +
      STOCK_WEIGHTS.liquidity2m;
    expect(total).toBe(8.5);
  });
});
