/**
 * Helper de fetch HTML do Fundamentus, compartilhado por rotas e scripts.
 *
 * Comportamento idêntico às functions Netlify originais (preservado durante a
 * migração local-first):
 *   - timeout configurável (default 6s)
 *   - retry com backoff exponencial (250ms → 500ms → 1s)
 *   - decodificação de charset ISO-8859-1 (Fundamentus serve algumas páginas
 *     nesse encoding e UTF-8 corromperia "Setor", "Subsetor", "Empresa")
 *   - User-Agent de browser para evitar bloqueio defensivo
 */

import { fetch } from 'undici';

const USER_AGENT =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

export interface FetchHtmlOptions {
  timeoutMs?: number;
  maxRetries?: number;
}

export async function fetchHtml(url: string, opts: FetchHtmlOptions = {}): Promise<string> {
  const timeoutMs = opts.timeoutMs ?? 6000;
  const maxRetries = opts.maxRetries ?? 2;

  let lastErr: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
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
      const charset =
        /charset=([^;]+)/i.exec(contentType)?.[1]?.trim().toLowerCase() ?? 'utf-8';
      return new TextDecoder(charset === 'iso-8859-1' ? 'iso-8859-1' : 'utf-8').decode(
        buffer,
      );
    } catch (err) {
      lastErr = err;
      if (attempt < maxRetries) {
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

/**
 * Pool com concorrência limitada — usado para enrichment paralelo de detalhes
 * por papel (Etapa 1 da migração) e pelos scripts de scraping de meta.
 */
export async function pool<T, R>(
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

export const FUNDAMENTUS_BASE = 'https://fundamentus.com.br';
