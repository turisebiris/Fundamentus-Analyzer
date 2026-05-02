/**
 * Persistência local do último snapshot. Não dispara novas coletas — apenas
 * evita que o usuário perca o último resultado ao recarregar a página.
 *
 * Snapshots de ações e FIIs são persistidos em chaves distintas porque as
 * abas são independentes.
 */

import type { StockSnapshot } from '../core/types.js';
import type { FiiSnapshot } from '../assets/fiis/types.js';
import { STOCK_FILTERS, type StockFilterConfig } from '../shared/stocks/config.js';
import { FII_FILTERS, type FiiFilterConfig } from '../assets/fiis/config.js';

const STOCKS_KEY = 'fundamentus-analyzer:last-snapshot:v1';
const FIIS_KEY = 'fundamentus-analyzer:last-fii-snapshot:v1';
const STOCK_FILTERS_KEY = 'fundamentus-analyzer:stock-filters:v1';
const FII_FILTERS_KEY = 'fundamentus-analyzer:fii-filters:v1';

export function saveSnapshot(snapshot: StockSnapshot): void {
  try {
    localStorage.setItem(STOCKS_KEY, JSON.stringify(snapshot));
  } catch {
    // Storage indisponível (modo privado etc.) — silencioso por design.
  }
}

export function loadSnapshot(): StockSnapshot | null {
  try {
    const raw = localStorage.getItem(STOCKS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StockSnapshot;
    if (
      !parsed ||
      typeof parsed.timestamp !== 'string' ||
      !Array.isArray(parsed.stocks) ||
      typeof parsed.totalCollected !== 'number'
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearSnapshot(): void {
  try {
    localStorage.removeItem(STOCKS_KEY);
  } catch {
    /* ignore */
  }
}

export function saveFiiSnapshot(snapshot: FiiSnapshot): void {
  try {
    localStorage.setItem(FIIS_KEY, JSON.stringify(snapshot));
  } catch {
    /* ignore */
  }
}

export function loadFiiSnapshot(): FiiSnapshot | null {
  try {
    const raw = localStorage.getItem(FIIS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as FiiSnapshot;
    if (
      !parsed ||
      typeof parsed.timestamp !== 'string' ||
      !Array.isArray(parsed.fiis) ||
      typeof parsed.totalCollected !== 'number'
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearFiiSnapshot(): void {
  try {
    localStorage.removeItem(FIIS_KEY);
  } catch {
    /* ignore */
  }
}

// ---------------------------------------------------------------------------
// Filtros customizados
//
// Validação:
//   - shape correto + números finitos
//   - filtros de ações NÃO podem afrouxar abaixo de STOCK_FILTERS (mesmos
//     thresholds usados pelo pré-filtro server-side; afrouxar deixaria papéis
//     sem enrichment de setor/subsetor)
//   - filtros de FIIs aceitam qualquer valor finito ≥ 0 (sem pré-filtro
//     server-side de FIIs)
//
// Em qualquer falha de validação retornamos null → views aplicam defaults.
// ---------------------------------------------------------------------------

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

export function saveStockFilters(filters: StockFilterConfig): void {
  try {
    localStorage.setItem(STOCK_FILTERS_KEY, JSON.stringify(filters));
  } catch {
    /* ignore */
  }
}

export function loadStockFilters(): StockFilterConfig | null {
  try {
    const raw = localStorage.getItem(STOCK_FILTERS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StockFilterConfig> | null;
    if (!parsed) return null;
    if (
      !parsed.dividendYield ||
      !parsed.pl ||
      !parsed.netMargin ||
      !parsed.pvp ||
      !parsed.roe ||
      !parsed.liquidity2m ||
      !isFiniteNumber(parsed.dividendYield.min) ||
      !isFiniteNumber(parsed.pl.min) ||
      !isFiniteNumber(parsed.pl.max) ||
      !isFiniteNumber(parsed.netMargin.min) ||
      !isFiniteNumber(parsed.pvp.max) ||
      !isFiniteNumber(parsed.roe.min) ||
      !isFiniteNumber(parsed.liquidity2m.min)
    ) {
      return null;
    }

    // Reject if any value is below the server-side pre-filter floor.
    // Afrouxar abaixo desses limites desalinha com o que o servidor enriquece.
    if (
      parsed.dividendYield.min < STOCK_FILTERS.dividendYield.min ||
      parsed.pl.min < STOCK_FILTERS.pl.min ||
      parsed.pl.max > STOCK_FILTERS.pl.max ||
      parsed.pvp.max > STOCK_FILTERS.pvp.max ||
      parsed.roe.min < STOCK_FILTERS.roe.min ||
      parsed.liquidity2m.min < STOCK_FILTERS.liquidity2m.min
    ) {
      return null;
    }

    if (parsed.pl.min > parsed.pl.max) return null;

    return {
      dividendYield: { min: parsed.dividendYield.min },
      pl: { min: parsed.pl.min, max: parsed.pl.max },
      netMargin: { min: parsed.netMargin.min },
      pvp: { max: parsed.pvp.max },
      roe: { min: parsed.roe.min },
      liquidity2m: { min: parsed.liquidity2m.min },
    };
  } catch {
    return null;
  }
}

export function clearStockFilters(): void {
  try {
    localStorage.removeItem(STOCK_FILTERS_KEY);
  } catch {
    /* ignore */
  }
}

export function saveFiiFilters(filters: FiiFilterConfig): void {
  try {
    localStorage.setItem(FII_FILTERS_KEY, JSON.stringify(filters));
  } catch {
    /* ignore */
  }
}

export function loadFiiFilters(): FiiFilterConfig | null {
  try {
    const raw = localStorage.getItem(FII_FILTERS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<FiiFilterConfig> | null;
    if (!parsed) return null;
    if (
      !parsed.dividendYield ||
      !parsed.liquidity ||
      !parsed.pvp ||
      !parsed.propertyCount ||
      !parsed.vacancy ||
      !isFiniteNumber(parsed.dividendYield.min) ||
      !isFiniteNumber(parsed.liquidity.min) ||
      !isFiniteNumber(parsed.pvp.min) ||
      !isFiniteNumber(parsed.pvp.max) ||
      !isFiniteNumber(parsed.propertyCount.min) ||
      !isFiniteNumber(parsed.vacancy.max)
    ) {
      return null;
    }

    if (
      parsed.dividendYield.min < 0 ||
      parsed.liquidity.min < 0 ||
      parsed.pvp.min < 0 ||
      parsed.pvp.max < 0 ||
      parsed.propertyCount.min < 0 ||
      parsed.vacancy.max < 0
    ) {
      return null;
    }

    if (parsed.pvp.min > parsed.pvp.max) return null;

    // FII_FILTERS está disponível para futuro uso — atualmente FIIs não têm
    // pré-filtro server-side, então não há floor obrigatório.
    void FII_FILTERS;

    return {
      dividendYield: { min: parsed.dividendYield.min },
      liquidity: { min: parsed.liquidity.min },
      pvp: { min: parsed.pvp.min, max: parsed.pvp.max },
      propertyCount: { min: parsed.propertyCount.min },
      vacancy: { max: parsed.vacancy.max },
    };
  } catch {
    return null;
  }
}

export function clearFiiFilters(): void {
  try {
    localStorage.removeItem(FII_FILTERS_KEY);
  } catch {
    /* ignore */
  }
}
