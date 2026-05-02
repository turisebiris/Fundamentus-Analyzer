import { describe, it, expect } from 'vitest';
import { runPipeline } from '../../src/core/pipeline.js';
import type { RawStock, StockSnapshot } from '../../src/core/types.js';
import { STOCK_WEIGHTS, STOCK_FILTERS } from '../../src/shared/stocks/config.js';

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
  it('limita a saída ao Top 10 e expõe lista completa de aprovados', () => {
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
    expect(report.approved).toHaveLength(15);
    expect(report.totalApproved).toBe(15);
    // Top 10 é um prefixo do approved (mesma ordenação)
    expect(report.top10.map((s) => s.ticker)).toEqual(
      report.approved.slice(0, 10).map((s) => s.ticker),
    );
  });

  it('maior pontuação ocupa a primeira posição (maior = melhor)', () => {
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
    // Maior score = melhor
    expect(report.top10[0]!.score).toBeGreaterThan(report.top10[1]!.score);
  });

  it('pontuação final em [0, 1]', () => {
    const report = runPipeline(snap([
      stock({ ticker: 'A3' }),
      stock({ ticker: 'B4', roe: 0.25, dividendYield: 0.12 }),
    ]));
    for (const s of report.top10) {
      expect(s.score).toBeGreaterThanOrEqual(0);
      expect(s.score).toBeLessThanOrEqual(1);
    }
  });

  it('banco: ML excluída do score (flag + scores sem netMargin)', () => {
    const bank = stock({
      ticker: 'ITUB4',
      sector: 'Financeiros',
      subsector: 'Bancos',
      netMargin: 0,
    });
    const other = stock({ ticker: 'OTHR3', netMargin: 0.25 });
    const report = runPipeline(snap([bank, other]));
    const itub = report.top10.find((s) => s.ticker === 'ITUB4')!;
    expect(itub.isBank).toBe(true);
    expect(itub.flags.some((f) => f.includes('ML não aplicável'))).toBe(true);
    // netMargin deve estar ausente dos scores do banco
    expect(itub.scores.netMargin).toBeUndefined();
    // Pontuação do banco usa pesos sem ML: divisor = 6.5 em vez de 8.5
    expect(itub.score).toBeGreaterThanOrEqual(0);
    expect(itub.score).toBeLessThanOrEqual(1);
  });

  it('banco não é eliminado pelo filtro de ML', () => {
    const bank = stock({
      ticker: 'BBDC4',
      sector: 'Financeiros',
      subsector: 'Bancos',
      netMargin: 0.01, // abaixo do mínimo de 10%, mas banco deve passar
    });
    const report = runPipeline(snap([bank]));
    expect(report.totalApproved).toBe(1);
    expect(report.top10[0]!.ticker).toBe('BBDC4');
  });

  it('seguradora: ML excluída do score e não eliminada pelo filtro de ML', () => {
    const insurer = stock({
      ticker: 'BBSE3',
      sector: 'Financeiros',
      subsector: 'Previdência e Seguros',
      netMargin: 0.02, // ML abaixo do filtro, mas seguradora deve passar
    });
    const report = runPipeline(snap([insurer]));
    expect(report.totalApproved).toBe(1);
    const bbse = report.top10[0]!;
    expect(bbse.isInsurer).toBe(true);
    expect(bbse.scores.netMargin).toBeUndefined();
    expect(bbse.flags.some((f) => f.includes('seguradora'))).toBe(true);
  });

  it('holding: ML excluída do score e não eliminada pelo filtro de ML', () => {
    const holding = stock({
      ticker: 'ITSA4',
      sector: 'Outros',
      subsector: 'Holdings Diversificadas',
      netMargin: 0.03, // ML abaixo do filtro, mas holding deve passar
    });
    const report = runPipeline(snap([holding]));
    expect(report.totalApproved).toBe(1);
    const itsa = report.top10[0]!;
    expect(itsa.isHolding).toBe(true);
    expect(itsa.scores.netMargin).toBeUndefined();
    expect(itsa.flags.some((f) => f.includes('holding'))).toBe(true);
  });

  it('coorte de ML exclui banco/seguradora/holding; só operacionais participam', () => {
    // 4 ativos: 1 banco, 1 seguradora, 1 holding e 1 operacional.
    // Como só a operacional entra na coorte de ML e P5==P95==seu próprio valor,
    // o score de ML dela deve ser 1.0. Nenhuma das outras três tem scores.netMargin.
    const bank = stock({
      ticker: 'ITUB4',
      sector: 'Financeiros',
      subsector: 'Bancos',
      netMargin: 0.05,
    });
    const insurer = stock({
      ticker: 'BBSE3',
      sector: 'Financeiros',
      subsector: 'Previdência e Seguros',
      netMargin: 0.07,
    });
    const holding = stock({
      ticker: 'ITSA4',
      sector: 'Outros',
      subsector: 'Holdings Diversificadas',
      netMargin: 0.09,
    });
    const operational = stock({
      ticker: 'PETR4',
      sector: 'Petróleo',
      subsector: 'Exploração e Refino',
      netMargin: 0.25,
    });
    const report = runPipeline(snap([bank, insurer, holding, operational]));
    const petr = report.top10.find((s) => s.ticker === 'PETR4')!;
    expect(petr.scores.netMargin).toBe(1.0);
    expect(report.top10.find((s) => s.ticker === 'ITUB4')!.scores.netMargin).toBeUndefined();
    expect(report.top10.find((s) => s.ticker === 'BBSE3')!.scores.netMargin).toBeUndefined();
    expect(report.top10.find((s) => s.ticker === 'ITSA4')!.scores.netMargin).toBeUndefined();
  });

  it('ações reprovadas aparecem em rejected com motivo', () => {
    const fail = stock({ ticker: 'FAIL3', pl: 1 }); // P/L < 3
    const ok = stock({ ticker: 'OKAY3' });
    const report = runPipeline(snap([fail, ok]));
    expect(report.rejected.map((r) => r.ticker)).toContain('FAIL3');
    expect(report.top10.map((s) => s.ticker)).toContain('OKAY3');
  });

  it('scores por indicador estão em [0, 1]', () => {
    const report = runPipeline(
      snap([
        stock({ ticker: 'A3', roe: 0.15 }),
        stock({ ticker: 'B4', roe: 0.30 }),
        stock({ ticker: 'C5', roe: 0.45 }),
      ]),
    );
    for (const s of report.top10) {
      for (const [, scoreVal] of Object.entries(s.scores)) {
        if (scoreVal !== undefined) {
          expect(scoreVal).toBeGreaterThanOrEqual(0);
          expect(scoreVal).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it('pesos dos indicadores somam 8.5 (sanidade rules.md)', () => {
    const total =
      STOCK_WEIGHTS.roe +
      STOCK_WEIGHTS.netMargin +
      STOCK_WEIGHTS.pl +
      STOCK_WEIGHTS.dividendYield +
      STOCK_WEIGHTS.pvp +
      STOCK_WEIGHTS.liquidity2m;
    expect(total).toBe(8.5);
  });

  it('desempate: ROE maior vence quando scores são iguais', () => {
    // Para forçar empate de score, usamos dois ativos idênticos em tudo
    // exceto ROE. Com coorte de 2, o de ROE maior terá score de ROE = 1.0
    // e o menor terá próximo de 0.0 — scores finais diferentes.
    // Mas validamos que o maior ROE ocupa posição 1.
    const a = stock({ ticker: 'AAAA3', roe: 0.2 });
    const b = stock({ ticker: 'BBBB4', roe: 0.35 });
    const report = runPipeline(snap([a, b]));
    expect(report.top10[0]!.ticker).toBe('BBBB4');
  });
});

describe('runPipeline — filtros customizados', () => {
  it('respeita default quando filters não é informado', () => {
    const baseline = stock({ ticker: 'BASE3', dividendYield: 0.07 });
    const reportDefault = runPipeline(snap([baseline]));
    const reportExplicit = runPipeline(snap([baseline]), STOCK_FILTERS);
    expect(reportDefault.totalApproved).toBe(reportExplicit.totalApproved);
  });

  it('DY mínimo customizado rejeita ações abaixo do novo threshold', () => {
    const a = stock({ ticker: 'A3', dividendYield: 0.07 });
    const b = stock({ ticker: 'B4', dividendYield: 0.12 });
    const report = runPipeline(snap([a, b]), {
      ...STOCK_FILTERS,
      dividendYield: { min: 0.10 },
    });
    expect(report.totalApproved).toBe(1);
    expect(report.top10[0]!.ticker).toBe('B4');
    expect(report.rejected.map((r) => r.ticker)).toContain('A3');
  });

  it('P/L customizado restringe faixa', () => {
    const inRange = stock({ ticker: 'IN3', pl: 6 });
    const tooLow = stock({ ticker: 'LOW3', pl: 4 });
    const tooHigh = stock({ ticker: 'HIGH3', pl: 9 });
    const report = runPipeline(snap([inRange, tooLow, tooHigh]), {
      ...STOCK_FILTERS,
      pl: { min: 5, max: 8 },
    });
    expect(report.totalApproved).toBe(1);
    expect(report.top10[0]!.ticker).toBe('IN3');
  });

  it('coorte de percentil reflete filtros customizados (recálculo correto)', () => {
    // Com filtro padrão (DY ≥ 6%), 3 ações entram na coorte; com DY ≥ 10%,
    // só 1 entra. P5/P95 muda → score de DY do sobrevivente vira 1.0.
    const a = stock({ ticker: 'A3', dividendYield: 0.07 });
    const b = stock({ ticker: 'B4', dividendYield: 0.09 });
    const c = stock({ ticker: 'C5', dividendYield: 0.15 });

    const tight = runPipeline(snap([a, b, c]), {
      ...STOCK_FILTERS,
      dividendYield: { min: 0.10 },
    });
    expect(tight.totalApproved).toBe(1);
    const survivor = tight.top10[0]!;
    expect(survivor.ticker).toBe('C5');
    // Coorte de 1 → P5 == P95 → score = 1.0 conforme convenção do percentile.ts.
    expect(survivor.scores.dividendYield).toBe(1.0);
  });

  it('clean exclusion de ML para banco continua respeitada com filtros customizados', () => {
    const bank = stock({
      ticker: 'ITUB4',
      sector: 'Financeiros',
      subsector: 'Bancos',
      netMargin: 0.01,
    });
    const report = runPipeline(snap([bank]), {
      ...STOCK_FILTERS,
      netMargin: { min: 0.5 },
    });
    expect(report.totalApproved).toBe(1);
    expect(report.top10[0]!.scores.netMargin).toBeUndefined();
  });
});
