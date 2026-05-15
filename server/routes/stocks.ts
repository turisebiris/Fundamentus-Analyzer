/**
 * GET /api/stocks
 *
 * Thin proxy: pega a lista crua em resultado.php e devolve. NÃO faz enrichment
 * server-side — companyName/sector/subsector vêm do JSON estático
 * `public/data/stock-meta.json`, mesclado no frontend (src/infra/api.ts).
 *
 * Para atualizar o stock-meta.json: `npm run scrape:stock-meta`.
 */

import type { Request, Response } from 'express';
import { fetchHtml, FUNDAMENTUS_BASE } from '../lib/fetchHtml.js';
import { parseResultadoHtml } from '../../src/assets/stocks/adapter.js';
import type { RawStock } from '../../src/core/types.js';

export async function stocksHandler(_req: Request, res: Response): Promise<void> {
  const t0 = Date.now();
  // eslint-disable-next-line no-console
  console.log('[debug][stocks] entrada GET /api/stocks');
  try {
    // eslint-disable-next-line no-console
    console.log('[debug][stocks] antes fetchHtml(resultado.php)');
    const html = await fetchHtml(`${FUNDAMENTUS_BASE}/resultado.php`);
    // eslint-disable-next-line no-console
    console.log(
      `[debug][stocks] depois fetchHtml ok (${html.length} chars, ${Date.now() - t0}ms)`,
    );

    const list = parseResultadoHtml(html);
    // eslint-disable-next-line no-console
    console.log(
      `[debug][stocks] depois parseResultadoHtml (${list.length} itens, ${Date.now() - t0}ms)`,
    );

    // Backend devolve apenas o que vem da lista; companyName/sector/subsector
    // ficam null aqui — o merge com stock-meta.json acontece no cliente.
    const stocks: RawStock[] = list.map((s) => ({
      ticker: s.ticker,
      price: s.price,
      dividendYield: s.dividendYield,
      pl: s.pl,
      netMargin: s.netMargin,
      pvp: s.pvp,
      roe: s.roe,
      liquidity2m: s.liquidity2m,
      companyName: null,
      sector: null,
      subsector: null,
    }));

    // eslint-disable-next-line no-console
    console.log(`[debug][stocks] antes res.json (${Date.now() - t0}ms)`);
    res
      .status(200)
      .set('Cache-Control', 'no-store')
      .json({
        timestamp: new Date().toISOString(),
        totalCollected: list.length,
        stocks,
      });
    // eslint-disable-next-line no-console
    console.log(`[debug][stocks] resposta enviada (${Date.now() - t0}ms)`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // eslint-disable-next-line no-console
    console.error(`[debug][stocks] ERRO após ${Date.now() - t0}ms: ${message}`);
    res.status(502).json({ error: message });
  }
}
