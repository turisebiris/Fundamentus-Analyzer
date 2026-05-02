import { describe, it, expect, beforeEach } from 'vitest';
import {
  saveStockFilters,
  loadStockFilters,
  clearStockFilters,
  saveFiiFilters,
  loadFiiFilters,
  clearFiiFilters,
} from '../../src/infra/storage.js';
import { STOCK_FILTERS } from '../../src/shared/stocks/config.js';
import { FII_FILTERS } from '../../src/assets/fiis/config.js';

const STOCK_KEY = 'fundamentus-analyzer:stock-filters:v1';
const FII_KEY = 'fundamentus-analyzer:fii-filters:v1';

beforeEach(() => {
  localStorage.clear();
});

describe('saveStockFilters / loadStockFilters', () => {
  it('round-trip preserva valores idênticos', () => {
    const custom = {
      ...STOCK_FILTERS,
      dividendYield: { min: 0.09 },
      pl: { min: 4, max: 8 },
    };
    saveStockFilters(custom);
    const loaded = loadStockFilters();
    expect(loaded).toEqual(custom);
  });

  it('retorna null quando chave não existe', () => {
    expect(loadStockFilters()).toBeNull();
  });

  it('retorna null para JSON inválido', () => {
    localStorage.setItem(STOCK_KEY, '{not json');
    expect(loadStockFilters()).toBeNull();
  });

  it('retorna null para shape inválido (campo ausente)', () => {
    localStorage.setItem(STOCK_KEY, JSON.stringify({ pl: { min: 3, max: 10 } }));
    expect(loadStockFilters()).toBeNull();
  });

  it('rejeita DY mínimo abaixo do floor server-side (0.06)', () => {
    saveStockFilters({ ...STOCK_FILTERS, dividendYield: { min: 0.04 } });
    expect(loadStockFilters()).toBeNull();
  });

  it('rejeita P/L máximo acima do ceiling server-side (10)', () => {
    saveStockFilters({ ...STOCK_FILTERS, pl: { min: 3, max: 15 } });
    expect(loadStockFilters()).toBeNull();
  });

  it('rejeita P/VP máximo acima do ceiling server-side (10)', () => {
    saveStockFilters({ ...STOCK_FILTERS, pvp: { max: 20 } });
    expect(loadStockFilters()).toBeNull();
  });

  it('rejeita ROE mínimo abaixo do floor server-side (0.12)', () => {
    saveStockFilters({ ...STOCK_FILTERS, roe: { min: 0.05 } });
    expect(loadStockFilters()).toBeNull();
  });

  it('rejeita Liquidez mínima abaixo do floor server-side (1M)', () => {
    saveStockFilters({ ...STOCK_FILTERS, liquidity2m: { min: 100_000 } });
    expect(loadStockFilters()).toBeNull();
  });

  it('rejeita pl.min > pl.max', () => {
    saveStockFilters({ ...STOCK_FILTERS, pl: { min: 9, max: 5 } });
    expect(loadStockFilters()).toBeNull();
  });

  it('clearStockFilters remove a chave', () => {
    saveStockFilters(STOCK_FILTERS);
    expect(localStorage.getItem(STOCK_KEY)).not.toBeNull();
    clearStockFilters();
    expect(localStorage.getItem(STOCK_KEY)).toBeNull();
  });
});

describe('saveFiiFilters / loadFiiFilters', () => {
  it('round-trip preserva valores idênticos', () => {
    const custom = {
      ...FII_FILTERS,
      dividendYield: { min: 0.10 },
      vacancy: { max: 0.05 },
    };
    saveFiiFilters(custom);
    expect(loadFiiFilters()).toEqual(custom);
  });

  it('retorna null para chave ausente', () => {
    expect(loadFiiFilters()).toBeNull();
  });

  it('retorna null para JSON inválido', () => {
    localStorage.setItem(FII_KEY, 'not json');
    expect(loadFiiFilters()).toBeNull();
  });

  it('retorna null para shape inválido', () => {
    localStorage.setItem(FII_KEY, JSON.stringify({ vacancy: { max: 0.1 } }));
    expect(loadFiiFilters()).toBeNull();
  });

  it('rejeita valores negativos', () => {
    saveFiiFilters({ ...FII_FILTERS, dividendYield: { min: -0.01 } });
    expect(loadFiiFilters()).toBeNull();
  });

  it('rejeita pvp.min > pvp.max', () => {
    saveFiiFilters({ ...FII_FILTERS, pvp: { min: 1.5, max: 1.0 } });
    expect(loadFiiFilters()).toBeNull();
  });

  it('FIIs aceitam afrouxar abaixo dos defaults (sem pré-filtro server-side)', () => {
    // DY 0.05 < default 0.07 — válido para FIIs.
    saveFiiFilters({ ...FII_FILTERS, dividendYield: { min: 0.05 } });
    expect(loadFiiFilters()).not.toBeNull();
  });

  it('clearFiiFilters remove a chave', () => {
    saveFiiFilters(FII_FILTERS);
    expect(localStorage.getItem(FII_KEY)).not.toBeNull();
    clearFiiFilters();
    expect(localStorage.getItem(FII_KEY)).toBeNull();
  });
});
