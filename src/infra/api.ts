/**
 * Cliente HTTP para as funções serverless /api/stocks e /api/fiis.
 * O frontend NÃO acessa fundamentus.com.br diretamente (CORS).
 */

import type { RawStock, StockSnapshot } from '../core/types.js';
import type { FiiSnapshot, RawFii } from '../assets/fiis/types.js';

interface StocksApiResponse {
  timestamp: string;
  totalCollected: number;
  enrichedCount: number;
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
  const res = await fetch('/api/stocks', {
    method: 'GET',
    headers: { Accept: 'application/json' },
    signal,
  });
  if (!res.ok) {
    const detail = await extractErrorDetail(res);
    throw new Error(`Falha ao atualizar dados (HTTP ${res.status})${detail}`);
  }
  const data = (await res.json()) as StocksApiResponse;
  return {
    timestamp: data.timestamp,
    totalCollected: data.totalCollected,
    stocks: data.stocks,
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

interface FiiNameApiResponse {
  ticker: string;
  name: string | null;
}

/**
 * Resultado distinto de "sem nome" (resposta válida com nome ausente, retorna
 * `{ name: null }`) e "erro de rede/upstream" (lança). Apenas o primeiro caso
 * deve ser cacheado pelo chamador — o segundo precisa ser re-tentado depois.
 */
export async function fetchFiiName(
  ticker: string,
  signal?: AbortSignal,
): Promise<string | null> {
  const res = await fetch(`/api/fii-name?ticker=${encodeURIComponent(ticker)}`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    signal,
  });
  if (!res.ok) {
    const detail = await extractErrorDetail(res);
    throw new Error(`Falha ao buscar nome do FII ${ticker} (HTTP ${res.status})${detail}`);
  }
  const data = (await res.json()) as FiiNameApiResponse;
  return data.name ?? null;
}
