/**
 * Gera `public/data/fii-names.json` com o nome de TODOS os FIIs do Fundamentus.
 * Use quando um novo FII aparecer ou quando quiser refresh dos nomes.
 *
 * Uso:
 *   npm run scrape:fii-names
 *
 * Tempo: ~1 min para ~400 FIIs (concorrência 6).
 * Resultado: arquivo ~15-25 KB committado no repo.
 */

import { writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchHtml, pool, FUNDAMENTUS_BASE } from '../server/lib/fetchHtml.js';
import { parseFiiResultadoHtml } from '../src/assets/fiis/adapter.js';
import { parseDetalhesHtml } from '../src/assets/stocks/adapter.js';

const CONCURRENCY = 6;

const __filename = fileURLToPath(import.meta.url);
const ROOT = dirname(dirname(__filename));
const OUT_PATH = `${ROOT}/public/data/fii-names.json`;

async function main(): Promise<void> {
  console.log('[scrape:fii-names] baixando lista fii_resultado.php…');
  const html = await fetchHtml(`${FUNDAMENTUS_BASE}/fii_resultado.php`);
  const list = parseFiiResultadoHtml(html);
  console.log(`[scrape:fii-names] ${list.length} FIIs encontrados.`);

  const tickers = list.map((f) => f.ticker).sort();

  let done = 0;
  const names: Record<string, string> = {};
  await pool(tickers, CONCURRENCY, async (ticker) => {
    try {
      const detailsHtml = await fetchHtml(
        `${FUNDAMENTUS_BASE}/detalhes.php?papel=${encodeURIComponent(ticker)}`,
      );
      const parsed = parseDetalhesHtml(detailsHtml, ticker);
      if (parsed.companyName) names[ticker] = parsed.companyName;
    } catch (err) {
      console.warn(`[scrape:fii-names] falha em ${ticker}: ${(err as Error).message}`);
    }
    done++;
    if (done % 50 === 0 || done === tickers.length) {
      console.log(`[scrape:fii-names] ${done}/${tickers.length}`);
    }
  });

  // Saída ordenada por ticker para diff estável no Git.
  const ordered: Record<string, string> = {};
  for (const ticker of tickers) {
    if (names[ticker]) ordered[ticker] = names[ticker]!;
  }

  await mkdir(dirname(OUT_PATH), { recursive: true });
  await writeFile(OUT_PATH, JSON.stringify(ordered, null, 2) + '\n', 'utf-8');
  console.log(
    `[scrape:fii-names] gravado ${OUT_PATH} (${Object.keys(ordered).length} nomes de ${tickers.length} FIIs).`,
  );
}

main().catch((err) => {
  console.error('[scrape:fii-names] erro fatal:', err);
  process.exit(1);
});
