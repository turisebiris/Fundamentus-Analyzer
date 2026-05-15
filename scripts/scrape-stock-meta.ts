/**
 * Gera `public/data/stock-meta.json` com companyName/sector/subsector de TODAS
 * as ações do Fundamentus. Use quando uma nova ação aparecer ou quando quiser
 * garantir setor/subsetor atualizados.
 *
 * Uso:
 *   npm run scrape:stock-meta
 *
 * Tempo: ~3-5 min para ~700 ações (concorrência 6).
 * Resultado: arquivo ~30-80 KB committado no repo.
 */

import { writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchHtml, pool, FUNDAMENTUS_BASE } from '../server/lib/fetchHtml.js';
import {
  parseResultadoHtml,
  parseDetalhesHtml,
} from '../src/assets/stocks/adapter.js';

const CONCURRENCY = 6;

const __filename = fileURLToPath(import.meta.url);
const ROOT = dirname(dirname(__filename));
const OUT_PATH = `${ROOT}/public/data/stock-meta.json`;

interface StockMeta {
  companyName: string | null;
  sector: string | null;
  subsector: string | null;
}

async function main(): Promise<void> {
  console.log('[scrape:stock-meta] baixando lista resultado.php…');
  const html = await fetchHtml(`${FUNDAMENTUS_BASE}/resultado.php`);
  const list = parseResultadoHtml(html);
  console.log(`[scrape:stock-meta] ${list.length} ações encontradas.`);

  const tickers = list.map((s) => s.ticker).sort();

  let done = 0;
  const meta: Record<string, StockMeta> = {};
  await pool(tickers, CONCURRENCY, async (ticker) => {
    try {
      const detailsHtml = await fetchHtml(
        `${FUNDAMENTUS_BASE}/detalhes.php?papel=${encodeURIComponent(ticker)}`,
      );
      const parsed = parseDetalhesHtml(detailsHtml, ticker);
      meta[ticker] = {
        companyName: parsed.companyName,
        sector: parsed.sector,
        subsector: parsed.subsector,
      };
    } catch (err) {
      console.warn(`[scrape:stock-meta] falha em ${ticker}: ${(err as Error).message}`);
      meta[ticker] = { companyName: null, sector: null, subsector: null };
    }
    done++;
    if (done % 50 === 0 || done === tickers.length) {
      console.log(`[scrape:stock-meta] ${done}/${tickers.length}`);
    }
  });

  // Saída ordenada por ticker para diff estável no Git.
  const ordered: Record<string, StockMeta> = {};
  for (const ticker of tickers) ordered[ticker] = meta[ticker]!;

  await mkdir(dirname(OUT_PATH), { recursive: true });
  await writeFile(OUT_PATH, JSON.stringify(ordered, null, 2) + '\n', 'utf-8');
  console.log(`[scrape:stock-meta] gravado ${OUT_PATH} (${tickers.length} entradas).`);
}

main().catch((err) => {
  console.error('[scrape:stock-meta] erro fatal:', err);
  process.exit(1);
});
