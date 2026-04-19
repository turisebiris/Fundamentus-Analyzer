/**
 * Cliente HTTP para a função serverless /api/stocks.
 * O frontend NÃO acessa fundamentus.com.br diretamente (CORS).
 */

import type { RawStock, StockSnapshot } from '../core/types.js';

interface ApiResponse {
  timestamp: string;
  totalCollected: number;
  enrichedCount: number;
  stocks: RawStock[];
}

export async function fetchStocks(signal?: AbortSignal): Promise<StockSnapshot> {
  const res = await fetch('/api/stocks', {
    method: 'GET',
    headers: { Accept: 'application/json' },
    signal,
  });
  if (!res.ok) {
    let detail = '';
    try {
      const body = (await res.json()) as { error?: string };
      detail = body?.error ? ` — ${body.error}` : '';
    } catch {
      /* ignore */
    }
    throw new Error(`Falha ao atualizar dados (HTTP ${res.status})${detail}`);
  }
  const data = (await res.json()) as ApiResponse;
  return {
    timestamp: data.timestamp,
    totalCollected: data.totalCollected,
    stocks: data.stocks,
  };
}
