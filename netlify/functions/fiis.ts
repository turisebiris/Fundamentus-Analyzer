/**
 * Função serverless para coletar dados de FIIs do Fundamentus.
 *
 * Fluxo:
 *   1. GET fii_resultado.php → tabela única com TODOS os FIIs.
 *   2. Parser devolve registros brutos; filtros/classificação/ranking são
 *      executados no cliente (src/assets/fiis/pipeline.ts).
 *
 * Diferenças em relação a /api/stocks:
 *   - Sem etapa de enriquecimento: o segmento já vem em fii_resultado.php.
 *   - Sem pool de concorrência: apenas uma requisição HTTP.
 *
 * CORS: o frontend NÃO acessa fundamentus.com.br diretamente. Esta função
 * atua como proxy server-side e expõe Access-Control-Allow-Origin no response.
 */

import type { Handler, HandlerResponse } from '@netlify/functions';
import { fetch } from 'undici';
import { parseFiiResultadoHtml } from '../../src/assets/fiis/adapter.js';
import type { RawFii } from '../../src/assets/fiis/types.js';

const FUNDAMENTUS_BASE = 'https://fundamentus.com.br';
const USER_AGENT =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

const PER_REQUEST_TIMEOUT_MS = 6000;
const MAX_RETRIES = 2;

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

export const handler: Handler = async (): Promise<HandlerResponse> => {
  try {
    const html = await fetchHtml(`${FUNDAMENTUS_BASE}/fii_resultado.php`);
    const list: RawFii[] = parseFiiResultadoHtml(html);

    const body = {
      timestamp: new Date().toISOString(),
      totalCollected: list.length,
      fiis: list,
    };

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-store',
      },
      body: JSON.stringify(body),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      statusCode: 502,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ error: message }),
    };
  }
};
