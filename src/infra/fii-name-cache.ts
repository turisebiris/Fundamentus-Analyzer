/**
 * Cache de nomes de FIIs no localStorage.
 *
 * Por que não no snapshot? O snapshot é raw scraping (apenas fii_resultado.php).
 * Nomes vêm de detalhes.php?papel=TICKER e são buscados sob demanda — caching
 * separado evita re-scraping de nomes a cada refresh.
 *
 * Estados de uma entrada:
 *   undefined → nunca tentamos buscar
 *   null      → tentamos e o detalhes.php não retornou nome (resposta válida,
 *               mas sem nome) — não tentar de novo nesta sessão
 *   string    → nome conhecido
 *
 * IMPORTANTE: erros de rede NÃO devem cachear null. Esta distinção é
 * responsabilidade do chamador — o cache só registra o que recebe via
 * `upsertCachedName`.
 */

const CACHE_KEY = 'fundamentus-analyzer:fii-names:v1';
const CACHE_VERSION = 1 as const;

export interface FiiNameEntry {
  name: string | null;
  fetchedAt: string;
}

export interface FiiNameCache {
  version: typeof CACHE_VERSION;
  entries: Record<string, FiiNameEntry>;
}

function emptyCache(): FiiNameCache {
  return { version: CACHE_VERSION, entries: {} };
}

/**
 * Carrega o cache. Retorna cache vazio se:
 *   - chave ausente
 *   - JSON inválido
 *   - versão diferente da atual (invalida silenciosamente — schema breaks
 *     futuros não corrompem dados)
 *   - shape inválido
 */
export function loadFiiNameCache(): FiiNameCache {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return emptyCache();
    const parsed = JSON.parse(raw) as Partial<FiiNameCache> | null;
    if (
      !parsed ||
      parsed.version !== CACHE_VERSION ||
      typeof parsed.entries !== 'object' ||
      parsed.entries === null
    ) {
      return emptyCache();
    }
    return { version: CACHE_VERSION, entries: parsed.entries as Record<string, FiiNameEntry> };
  } catch {
    return emptyCache();
  }
}

export function saveFiiNameCache(cache: FiiNameCache): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    /* storage indisponível — silencioso por design */
  }
}

/**
 * Retorna:
 *   - undefined: ticker nunca foi consultado (precisa buscar)
 *   - null:      consultado, mas sem nome (não buscar de novo)
 *   - string:    nome em cache
 */
export function getCachedName(
  cache: FiiNameCache,
  ticker: string,
): string | null | undefined {
  const entry = cache.entries[ticker];
  if (!entry) return undefined;
  return entry.name;
}

/**
 * Insere/atualiza uma entrada. Use APENAS com respostas válidas do
 * detalhes.php — erros de rede NÃO devem chamar esta função (caso contrário
 * cacheariam null indevidamente).
 */
export function upsertCachedName(
  cache: FiiNameCache,
  ticker: string,
  name: string | null,
): void {
  cache.entries[ticker] = { name, fetchedAt: new Date().toISOString() };
}

export function clearFiiNameCache(): void {
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch {
    /* ignore */
  }
}

// ---------------------------------------------------------------------------
// Proteção contra requisições duplicadas
//
// Cenário: dois refreshes rápidos consecutivos disparam a busca pelo mesmo
// ticker. Um Set por ticker (não por requisição) garante que apenas uma
// requisição em voo existe por ticker — promessas concorrentes recebem o
// mesmo resultado.
// ---------------------------------------------------------------------------

const inFlight = new Map<string, Promise<string | null>>();

export function trackInFlight(
  ticker: string,
  factory: () => Promise<string | null>,
): Promise<string | null> {
  const existing = inFlight.get(ticker);
  if (existing) return existing;
  const promise = factory().finally(() => {
    inFlight.delete(ticker);
  });
  inFlight.set(ticker, promise);
  return promise;
}

/** Apenas para testes — limpa o estado global de in-flight. */
export function __resetInFlightForTests(): void {
  inFlight.clear();
}
