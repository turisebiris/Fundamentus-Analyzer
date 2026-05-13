/**
 * GET /api/fiis
 *
 * Lista crua de FIIs do Fundamentus. Sem enrichment server-side: o `segmento`
 * já vem em fii_resultado.php; o `nome` vem do JSON estático
 * `public/data/fii-names.json` (carregado pelo frontend).
 */

import type { Request, Response } from 'express';
import { fetchHtml, FUNDAMENTUS_BASE } from '../lib/fetchHtml.js';
import { parseFiiResultadoHtml } from '../../src/assets/fiis/adapter.js';

export async function fiisHandler(_req: Request, res: Response): Promise<void> {
  try {
    const html = await fetchHtml(`${FUNDAMENTUS_BASE}/fii_resultado.php`);
    const list = parseFiiResultadoHtml(html);

    res
      .status(200)
      .set('Cache-Control', 'no-store')
      .json({
        timestamp: new Date().toISOString(),
        totalCollected: list.length,
        fiis: list,
      });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(502).json({ error: message });
  }
}
