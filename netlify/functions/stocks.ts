/**
 * Função serverless responsável por coletar dados do Fundamentus.
 *
 * Fluxo:
 *   1. GET resultado.php  -> parse da tabela única com ~500 papéis.
 *   2. Pré-filtro server-side (tudo exceto Margem Líquida, pois a identificação
 *      de bancos depende do enriquecimento) para reduzir a quantidade de papéis
 *      enviados à etapa de detalhes.
 *   3. Enriquecimento paralelo com limite de concorrência em detalhes.php?papel=
 *      para obter Empresa, Setor e Subsetor.
 *   4. Devolve JSON consolidado ao frontend. O pipeline de filtros/rank/pontuação
 *      continua sendo executado no cliente (ver src/core/pipeline.ts).
 *
 * CORS: o frontend NÃO acessa fundamentus.com.br diretamente. Esta função atua
 * como proxy server-side e expõe Access-Control-Allow-Origin no response.
 */

import type { Handler, HandlerResponse } from '@netlify/functions';
import { fetch } from 'undici';
import { parseResultadoHtml, parseDetalhesHtml, type ParsedDetails } from '../../src/assets/stocks/adapter.js';
import { STOCK_FILTERS } from '../../src/shared/stocks/config.js';
import type { RawStock } from '../../src/core/types.js';

const FUNDAMENTUS_BASE = 'https://fundamentus.com.br';
const USER_AGENT =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

const DETAILS_CONCURRENCY = 6;
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
      // Fundamentus serve algumas páginas em ISO-8859-1; decodificar corretamente
      // evita caracteres corrompidos em "Setor", "Subsetor" e "Empresa".
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

async function pool<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) return [];
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const current = next++;
      if (current >= items.length) return;
      results[current] = await worker(items[current]!);
    }
  });
  await Promise.all(workers);
  return results;
}

export const handler: Handler = async (): Promise<HandlerResponse> => {
  try {
    const resultadoHtml = await fetchHtml(`${FUNDAMENTUS_BASE}/resultado.php`);
    const list = parseResultadoHtml(resultadoHtml);

    // Pré-filtro server-side: aplica tudo EXCETO Margem Líquida, já que bancos
    // são identificados só após o enriquecimento com setor/subsetor. O objetivo
    // aqui é puramente reduzir requisições; o filtro definitivo (incluindo ML
    // para não-bancos) é aplicado no pipeline do cliente.
    const candidates = list.filter(
      (s) =>
        s.dividendYield !== null &&
        s.dividendYield >= STOCK_FILTERS.dividendYield.min &&
        s.pl !== null &&
        s.pl >= STOCK_FILTERS.pl.min &&
        s.pl <= STOCK_FILTERS.pl.max &&
        s.pvp !== null &&
        s.pvp < STOCK_FILTERS.pvp.max &&
        s.roe !== null &&
        s.roe > STOCK_FILTERS.roe.min &&
        s.liquidity2m !== null &&
        s.liquidity2m > STOCK_FILTERS.liquidity2m.min,
    );

    const enriched = await pool(candidates, DETAILS_CONCURRENCY, async (c) => {
      try {
        const html = await fetchHtml(
          `${FUNDAMENTUS_BASE}/detalhes.php?papel=${encodeURIComponent(c.ticker)}`,
        );
        return parseDetalhesHtml(html, c.ticker);
      } catch {
        return {
          ticker: c.ticker,
          companyName: null,
          sector: null,
          subsector: null,
        } satisfies ParsedDetails;
      }
    });

    const detailsMap: Record<string, ParsedDetails> = {};
    for (const d of enriched) detailsMap[d.ticker] = d;

    const stocks: RawStock[] = list.map((s) => {
      const details = detailsMap[s.ticker];
      return {
        ticker: s.ticker,
        price: s.price,
        dividendYield: s.dividendYield,
        pl: s.pl,
        netMargin: s.netMargin,
        pvp: s.pvp,
        roe: s.roe,
        liquidity2m: s.liquidity2m,
        companyName: details?.companyName ?? null,
        sector: details?.sector ?? null,
        subsector: details?.subsector ?? null,
      };
    });

    const body = {
      timestamp: new Date().toISOString(),
      totalCollected: list.length,
      enrichedCount: candidates.length,
      stocks,
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
