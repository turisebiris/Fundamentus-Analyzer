import { describe, it, expect } from 'vitest';
import {
  classifyCompanyType,
  isBank,
  isHolding,
  isInsurer,
} from '../../src/utils/company-type.js';

describe('isBank', () => {
  it('identifica por subsetor "Intermediários Financeiros"', () => {
    expect(isBank({ sector: 'Financeiros', subsector: 'Intermediários Financeiros' })).toBe(true);
  });

  it('identifica por subsetor "Bancos"', () => {
    expect(isBank({ sector: 'Financeiros', subsector: 'Bancos' })).toBe(true);
  });

  it('tolera acentos e caixa mista', () => {
    expect(isBank({ sector: 'FINANCEIROS', subsector: 'intermediários FINANCEIROS' })).toBe(true);
    expect(isBank({ sector: 'Financeiros', subsector: 'Intermediarios Financeiros' })).toBe(true);
  });

  it('falso para empresas operacionais', () => {
    expect(isBank({ sector: 'Petróleo, Gás e Biocombustíveis', subsector: 'Exploração e Refino' })).toBe(false);
    expect(isBank({ sector: 'Mineração', subsector: 'Minerais Metálicos' })).toBe(false);
  });

  it('falso para strings vazias ou nulas', () => {
    expect(isBank({ sector: null, subsector: null })).toBe(false);
    expect(isBank({ sector: '', subsector: '' })).toBe(false);
  });
});

describe('isInsurer', () => {
  it('identifica por subsetor "Previdência e Seguros"', () => {
    expect(isInsurer({ sector: 'Financeiros', subsector: 'Previdência e Seguros' })).toBe(true);
  });

  it('identifica por subsetor contendo "Seguradoras"', () => {
    expect(isInsurer({ sector: 'Financeiros', subsector: 'Seguradoras' })).toBe(true);
  });

  it('tolera variantes sem acento e caixa diferente', () => {
    expect(isInsurer({ sector: 'Financeiros', subsector: 'previdencia e seguros' })).toBe(true);
    expect(isInsurer({ sector: 'FINANCEIROS', subsector: 'SEGUROS' })).toBe(true);
  });

  it('banco NÃO é classificado como seguradora', () => {
    expect(isInsurer({ sector: 'Financeiros', subsector: 'Intermediários Financeiros' })).toBe(false);
    expect(isInsurer({ sector: 'Financeiros', subsector: 'Bancos' })).toBe(false);
  });

  it('falso para operacionais', () => {
    expect(isInsurer({ sector: 'Petróleo', subsector: 'Refino' })).toBe(false);
  });
});

describe('isHolding', () => {
  it('identifica por subsetor "Holdings Diversificadas"', () => {
    expect(isHolding({ sector: 'Outros', subsector: 'Holdings Diversificadas' })).toBe(true);
  });

  it('identifica por setor contendo "Holding"', () => {
    expect(isHolding({ sector: 'Holdings Diversificadas', subsector: 'Holdings' })).toBe(true);
  });

  it('tolera caixa e acentos', () => {
    expect(isHolding({ sector: 'OUTROS', subsector: 'HOLDINGS DIVERSIFICADAS' })).toBe(true);
  });

  it('banco e seguradora NÃO são holdings', () => {
    expect(isHolding({ sector: 'Financeiros', subsector: 'Intermediários Financeiros' })).toBe(false);
    expect(isHolding({ sector: 'Financeiros', subsector: 'Previdência e Seguros' })).toBe(false);
  });

  it('falso para operacionais', () => {
    expect(isHolding({ sector: 'Mineração', subsector: 'Minerais Metálicos' })).toBe(false);
  });
});

describe('classifyCompanyType', () => {
  it('exatamente um bit ligado por tipo exclusivo', () => {
    const bank = classifyCompanyType({ sector: 'Financeiros', subsector: 'Bancos' });
    expect(bank).toEqual({ isBank: true, isInsurer: false, isHolding: false });

    const insurer = classifyCompanyType({ sector: 'Financeiros', subsector: 'Previdência e Seguros' });
    expect(insurer).toEqual({ isBank: false, isInsurer: true, isHolding: false });

    const holding = classifyCompanyType({ sector: 'Outros', subsector: 'Holdings Diversificadas' });
    expect(holding).toEqual({ isBank: false, isInsurer: false, isHolding: true });
  });

  it('todos false para operacionais', () => {
    const op = classifyCompanyType({ sector: 'Petróleo', subsector: 'Refino' });
    expect(op).toEqual({ isBank: false, isInsurer: false, isHolding: false });
  });

  it('todos false para input vazio', () => {
    const none = classifyCompanyType({ sector: null, subsector: null });
    expect(none).toEqual({ isBank: false, isInsurer: false, isHolding: false });
  });
});
