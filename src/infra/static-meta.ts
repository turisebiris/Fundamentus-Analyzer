/**
 * Carregamento dos JSONs estáticos servidos por `public/data/`.
 *
 * Substitui o enrichment ao vivo (stocks: companyName/sector/subsector via
 * /api/stocks paralelo) e o per-ticker /api/fii-name. Single fetch + cache em
 * memória — uma chamada por sessão do app.
 *
 * Robustez:
 *   - Tickers ausentes do JSON retornam meta vazio (companyName/sector/subsector
 *     null) ou nome ausente. Pipeline e UI já tratam null gracefully.
 *   - Erro de rede no carregamento → cache resolvido com {} (não bloqueia o app);
 *     a próxima chamada não tentará novamente nesta sessão (basta dar refresh
 *     da página para retentar).
 */

export interface StockMeta {
  companyName: string | null;
  sector: string | null;
  subsector: string | null;
}

let stockMetaPromise: Promise<Record<string, StockMeta>> | null = null;
let fiiNamesPromise: Promise<Record<string, string>> | null = null;

async function safeFetchJson<T>(url: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) {
      console.warn(`[static-meta] ${url} retornou HTTP ${res.status}; usando fallback vazio.`);
      return fallback;
    }
    return (await res.json()) as T;
  } catch (err) {
    console.warn(`[static-meta] falha ao carregar ${url}:`, err);
    return fallback;
  }
}

export function loadStockMeta(): Promise<Record<string, StockMeta>> {
  stockMetaPromise ??= safeFetchJson<Record<string, StockMeta>>('/data/stock-meta.json', {});
  return stockMetaPromise;
}

export function loadFiiNames(): Promise<Record<string, string>> {
  fiiNamesPromise ??= safeFetchJson<Record<string, string>>('/data/fii-names.json', {});
  return fiiNamesPromise;
}

/** Apenas para testes — limpa o cache em memória. */
export function __resetStaticMetaForTests(): void {
  stockMetaPromise = null;
  fiiNamesPromise = null;
}
