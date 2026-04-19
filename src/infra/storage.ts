/**
 * Persistência local do último snapshot. Não dispara novas coletas — apenas
 * evita que o usuário perca o último resultado ao recarregar a página.
 */

import type { StockSnapshot } from '../core/types.js';

const STORAGE_KEY = 'fundamentus-analyzer:last-snapshot:v1';

export function saveSnapshot(snapshot: StockSnapshot): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // Storage indisponível (modo privado etc.) — silencioso por design.
  }
}

export function loadSnapshot(): StockSnapshot | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
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
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
