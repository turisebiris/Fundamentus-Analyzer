/**
 * Servidor Express local para o Fundamentus Analyzer.
 *
 * Substitui as Netlify Functions (preserva URLs, mantém compatibilidade com
 * o proxy `/api` já configurado em vite.config.ts → localhost:8888).
 *
 * Sem CORS: requisições do browser entram via proxy do Vite (mesma origem).
 * Acesso direto ao backend (curl/postman) também funciona porque não há
 * verificação de origin.
 */

import express from 'express';
import { stocksHandler } from './routes/stocks.js';
import { fiisHandler } from './routes/fiis.js';

const PORT = Number(process.env.PORT ?? 8888);

const app = express();

app.use((req, _res, next) => {
  // eslint-disable-next-line no-console
  console.log(`[debug][http] ${req.method} ${req.url}`);
  next();
});

app.get('/api/stocks', stocksHandler);
app.get('/api/fiis', fiisHandler);

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, ts: new Date().toISOString() });
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[api] backend ouvindo em http://localhost:${PORT}`);
});
