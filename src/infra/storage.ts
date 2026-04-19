/**
 * Persistência local do último snapshot. Não dispara novas coletas — apenas
 * evita que o usuário perca o último resultado ao recarregar a página.
 *
 * Snapshots de ações e FIIs são persistidos em chaves distintas porque as
 * abas são independentes.
 */

import type { StockSnapshot } from '../core/types.js';
import type { FiiSnapshot } from '../assets/fiis/types.js';

const STOCKS_KEY = 'fundamentus-analyzer:last-snapshot:v1';
const FIIS_KEY = 'fundamentus-analyzer:last-fii-snapshot:v1';

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
