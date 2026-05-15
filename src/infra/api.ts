/**
 * Cliente HTTP para as rotas locais /api/stocks e /api/fiis.
 * O frontend NÃO acessa fundamentus.com.br diretamente.
 *
 * Após a migração local-first: as listas vêm crus do backend Express e o
 * enriquecimento (companyName/sector/subsector para ações; name para FIIs)
 * é mesclado a partir dos JSONs estáticos em public/data/.
 */

import type { RawStock, StockSnapshot } from '../core/types.js';
import type { FiiSnapshot, RawFii } from '../assets/fiis/types.js';
import { loadStockMeta } from './static-meta.js';

interface StocksApiResponse {
  timestamp: string;
  totalCollected: number;
  enrichedCount?: number;
  stocks: RawStock[];
}

interface FiisApiResponse {
  timestamp: string;
  totalCollected: number;
  fiis: RawFii[];
}

async function extractErrorDetail(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: string };
    return body?.error ? ` — ${body.error}` : '';
  } catch {
    return '';
  }
}

export async function fetchStocks(signal?: AbortSignal): Promise<StockSnapshot> {
  const [res, meta] = await Promise.all([
    fetch('/api/stocks', {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal,
    }),
    loadStockMeta(),
  ]);
  if (!res.ok) {
    const detail = await extractErrorDetail(res);
    throw new Error(`Falha ao atualizar dados (HTTP ${res.status})${detail}`);
  }
  const data = (await res.json()) as StocksApiResponse;

  // Merge: backend retorna lista crua; companyName/sector/subsector vêm do
  // JSON estático. Tickers ausentes do JSON ficam com null (pipeline trata).
  const merged: RawStock[] = data.stocks.map((s) => {
    const m = meta[s.ticker];
    return {
      ...s,
      companyName: s.companyName ?? m?.companyName ?? null,
      sector: s.sector ?? m?.sector ?? null,
      subsector: s.subsector ?? m?.subsector ?? null,
    };
  });

  return {
    timestamp: data.timestamp,
    totalCollected: data.totalCollected,
    stocks: merged,
  };
}

export async function fetchFiis(signal?: AbortSignal): Promise<FiiSnapshot> {
  const res = await fetch('/api/fiis', {
    method: 'GET',
    headers: { Accept: 'application/json' },
    signal,
  });
  if (!res.ok) {
    const detail = await extractErrorDetail(res);
    throw new Error(`Falha ao atualizar dados de FIIs (HTTP ${res.status})${detail}`);
  }
  const data = (await res.json()) as FiisApiResponse;
  return {
    timestamp: data.timestamp,
    totalCollected: data.totalCollected,
    fiis: data.fiis,
  };
}

