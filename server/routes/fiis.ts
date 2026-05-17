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
  const t0 = Date.now();
  // eslint-disable-next-line no-console
  console.log('[debug][fiis] entrada GET /api/fiis');
  try {
    // eslint-disable-next-line no-console
    console.log('[debug][fiis] antes fetchHtml(fii_resultado.php)');
    const html = await fetchHtml(`${FUNDAMENTUS_BASE}/fii_resultado.php`);
    // eslint-disable-next-line no-console
    console.log(
      `[debug][fiis] depois fetchHtml ok (${html.length} chars, ${Date.now() - t0}ms)`,
    );

    const list = parseFiiResultadoHtml(html);
    // eslint-disable-next-line no-console
    console.log(
      `[debug][fiis] depois parseFiiResultadoHtml (${list.length} itens, ${Date.now() - t0}ms)`,
    );

    // eslint-disable-next-line no-console
    console.log(`[debug][fiis] antes res.json (${Date.now() - t0}ms)`);
    res
      .status(200)
      .set('Cache-Control', 'no-store')
      .json({
        timestamp: new Date().toISOString(),
        totalCollected: list.length,
        fiis: list,
      });
    // eslint-disable-next-line no-console
    console.log(`[debug][fiis] resposta enviada (${Date.now() - t0}ms)`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // eslint-disable-next-line no-console
    console.error(`[debug][fiis] ERRO após ${Date.now() - t0}ms: ${message}`);
    res.status(502).json({ error: message });
  }
}
