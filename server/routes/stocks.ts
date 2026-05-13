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
  try {
    const html = await fetchHtml(`${FUNDAMENTUS_BASE}/resultado.php`);
    const list = parseResultadoHtml(html);

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

    res
      .status(200)
      .set('Cache-Control', 'no-store')
      .json({
        timestamp: new Date().toISOString(),
        totalCollected: list.length,
        stocks,
      });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(502).json({ error: message });
  }
}
