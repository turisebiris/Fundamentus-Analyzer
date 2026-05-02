import { describe, it, expect } from 'vitest';
import { classifyAndFilter } from '../../src/core/filters.js';
import { STOCK_FILTERS } from '../../src/shared/stocks/config.js';
import type { RawStock } from '../../src/core/types.js';

function mkStock(overrides: Partial<RawStock>): RawStock {
  return {
    ticker: 'ABCD3',
    price: 10,
    dividendYield: 0.08,
    pl: 6,
    netMargin: 0.2,
    pvp: 2,
    roe: 0.2,
    liquidity2m: 5_000_000,
    companyName: 'Empresa',
    sector: 'Indústria',
    subsector: 'Alimentos',
    ...overrides,
  };
}

describe('classifyAndFilter — regras do rules.md', () => {
  it('aprova ação que atende todos os critérios', () => {
    const { approved, rejected } = classifyAndFilter([mkStock({})]);
    expect(approved).toHaveLength(1);
    expect(rejected).toHaveLength(0);
  });

  it('elimina por DY abaixo de 6%', () => {
    const { approved, rejected } = classifyAndFilter([mkStock({ dividendYield: 0.05 })]);
    expect(approved).toHaveLength(0);
    expect(rejected[0]!.reasons.some((r) => r.indicator === 'dividendYield')).toBe(true);
  });

  it('elimina P/L fora do intervalo [3, 10]', () => {
    expect(classifyAndFilter([mkStock({ pl: 2.9 })]).rejected).toHaveLength(1);
    expect(classifyAndFilter([mkStock({ pl: 10.1 })]).rejected).toHaveLength(1);
  });

  it('aceita P/L exatamente em 3 e 10 (inclusivo)', () => {
    expect(classifyAndFilter([mkStock({ pl: 3 })]).approved).toHaveLength(1);
    expect(classifyAndFilter([mkStock({ pl: 10 })]).approved).toHaveLength(1);
  });

  it('elimina ROE igual ou abaixo de 12%', () => {
    expect(classifyAndFilter([mkStock({ roe: 0.12 })]).rejected).toHaveLength(1);
    expect(classifyAndFilter([mkStock({ roe: 0.1201 })]).approved).toHaveLength(1);
  });

  it('elimina Margem Líquida <= 10% para não-bancos', () => {
    const result = classifyAndFilter([mkStock({ netMargin: 0.1 })]);
    expect(result.rejected).toHaveLength(1);
    expect(result.rejected[0]!.reasons.some((r) => r.indicator === 'netMargin')).toBe(true);
  });

  it('NÃO elimina banco por Margem Líquida baixa/zerada/ausente', () => {
    const bank = mkStock({
      ticker: 'ITUB4',
      netMargin: 0,
      sector: 'Financeiros',
      subsector: 'Intermediários Financeiros',
    });
    const bankNull = mkStock({
      ticker: 'BBAS3',
      netMargin: null,
      sector: 'Financeiros',
      subsector: 'Bancos',
    });
    const r1 = classifyAndFilter([bank]);
    const r2 = classifyAndFilter([bankNull]);
    expect(r1.approved.map((s) => s.ticker)).toEqual(['ITUB4']);
    expect(r1.approved[0]!.isBank).toBe(true);
    expect(r2.approved.map((s) => s.ticker)).toEqual(['BBAS3']);
  });

  it('bancos continuam sujeitos aos demais filtros', () => {
    const bankBadDy = mkStock({
      ticker: 'BBDC4',
      dividendYield: 0.04,
      netMargin: 0,
      sector: 'Financeiros',
      subsector: 'Bancos',
    });
    const { rejected } = classifyAndFilter([bankBadDy]);
    expect(rejected).toHaveLength(1);
    expect(rejected[0]!.reasons.some((r) => r.indicator === 'dividendYield')).toBe(true);
  });

  it('trata ausência de indicador (não-banco) como eliminação com motivo explícito', () => {
    const { rejected } = classifyAndFilter([mkStock({ roe: null })]);
    expect(rejected[0]!.reasons[0]!.message).toContain('ROE');
  });

  it('não emite motivo de Margem Líquida para papel não-enriquecido (sem setor/subsetor)', () => {
    // Cenário: papel caiu no pré-filtro server-side por DY baixo e portanto
    // não foi enriquecido. Sem setor/subsetor, não dá para confirmar se é
    // banco; suprimimos o motivo de ML para não gerar ruído indevido.
    const noSectorBadMl = mkStock({
      ticker: 'NOSECT3',
      dividendYield: 0.04,
      netMargin: 0,
      sector: null,
      subsector: null,
    });
    const { rejected } = classifyAndFilter([noSectorBadMl]);
    expect(rejected).toHaveLength(1);
    const reasons = rejected[0]!.reasons;
    expect(reasons.some((r) => r.indicator === 'dividendYield')).toBe(true);
    expect(reasons.some((r) => r.indicator === 'netMargin')).toBe(false);
  });

  it('continua emitindo motivo de Margem Líquida para não-banco enriquecido', () => {
    const enrichedBadMl = mkStock({
      ticker: 'LOWML3',
      netMargin: 0.05,
      sector: 'Indústria',
      subsector: 'Alimentos',
    });
    const { rejected } = classifyAndFilter([enrichedBadMl]);
    expect(rejected[0]!.reasons.some((r) => r.indicator === 'netMargin')).toBe(true);
  });
});

describe('classifyAndFilter — filtros customizados', () => {
  it('aceita filtros customizados sem quebrar comportamento padrão', () => {
    const s = mkStock({});
    const a = classifyAndFilter([s]);
    const b = classifyAndFilter([s], STOCK_FILTERS);
    expect(a.approved.length).toBe(b.approved.length);
  });

  it('threshold customizado de DY altera resultado', () => {
    const s = mkStock({ dividendYield: 0.07 });
    const lenient = classifyAndFilter([s], { ...STOCK_FILTERS, dividendYield: { min: 0.06 } });
    const strict = classifyAndFilter([s], { ...STOCK_FILTERS, dividendYield: { min: 0.10 } });
    expect(lenient.approved).toHaveLength(1);
    expect(strict.approved).toHaveLength(0);
    expect(strict.rejected[0]!.reasons.some((r) => r.indicator === 'dividendYield')).toBe(true);
  });

  it('mensagem de rejeição reflete o threshold customizado', () => {
    const s = mkStock({ dividendYield: 0.05 });
    const { rejected } = classifyAndFilter([s], {
      ...STOCK_FILTERS,
      dividendYield: { min: 0.09 },
    });
    expect(rejected[0]!.reasons[0]!.message).toContain('9');
  });
});
