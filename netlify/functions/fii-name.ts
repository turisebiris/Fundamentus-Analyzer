/**
 * Função serverless para buscar o nome de UM FII via detalhes.php.
 *
 * Diferente de /api/fiis (lista bruta) e /api/stocks (lista + enrichment em
 * lote), esta função é per-ticker. O frontend mantém um cache em localStorage
 * e só chama esta função para tickers ainda não cacheados.
 *
 * Cache HTTP: NO CACHE em todas as respostas. O cache de nomes é mantido
 * exclusivamente pelo frontend (localStorage). Cachear no CDN do Netlify
 * causou respostas 304 que impediam a execução da função.
 *
 * CORS: o frontend NÃO acessa fundamentus.com.br diretamente.
 */

import type { Handler, HandlerResponse } from '@netlify/functions';
import { fetch } from 'undici';
import { parseDetalhesHtml } from '../../src/assets/stocks/adapter.js';

const FUNDAMENTUS_BASE = 'https://fundamentus.com.br';
const USER_AGENT =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

const PER_REQUEST_TIMEOUT_MS = 5000;
const MAX_RETRIES = 1;
const TICKER_PATTERN = /^[A-Z0-9]{4,8}$/;

const NO_CACHE_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Access-Control-Allow-Origin': '*',
  'Cache-Control': 'no-store, no-cache, must-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
};

async function fetchHtml(url: string): Promise<string> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PER_REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': USER_AGENT,
          'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
          Accept: 'text/html,application/xhtml+xml,*/*;q=0.8',
        },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} ao requisitar ${url}`);
      const buffer = await res.arrayBuffer();
      const contentType = res.headers.get('content-type') ?? '';
      const charset = /charset=([^;]+)/i.exec(contentType)?.[1]?.trim().toLowerCase() ?? 'utf-8';
      return new TextDecoder(charset === 'iso-8859-1' ? 'iso-8859-1' : 'utf-8').decode(buffer);
    } catch (err) {
      lastErr = err;
      if (attempt < MAX_RETRIES) {
        const backoff = 250 * 2 ** attempt;
        await new Promise((resolve) => setTimeout(resolve, backoff));
        continue;
      }
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(`Falha ao buscar ${url}`);
}

export const handler: Handler = async (event): Promise<HandlerResponse> => {
  const tickerParam = event.queryStringParameters?.ticker?.toUpperCase() ?? '';

  if (!TICKER_PATTERN.test(tickerParam)) {
    return {
      statusCode: 400,
      headers: { ...NO_CACHE_HEADERS },
      body: JSON.stringify({ error: 'Parâmetro ticker ausente ou inválido.' }),
    };
  }

  try {
    const html = await fetchHtml(
      `${FUNDAMENTUS_BASE}/detalhes.php?papel=${encodeURIComponent(tickerParam)}`,
    );
    const details = parseDetalhesHtml(html, tickerParam);

    return {
      statusCode: 200,
      headers: { ...NO_CACHE_HEADERS },
      body: JSON.stringify({
        ticker: tickerParam,
        name: details.companyName,
      }),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      statusCode: 502,
      headers: { ...NO_CACHE_HEADERS },
      body: JSON.stringify({ error: message }),
    };
  }
};
