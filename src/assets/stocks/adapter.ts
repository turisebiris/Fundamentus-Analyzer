/**
 * Adapter HTML -> modelo interno para o módulo de ações do Fundamentus.
 *
 * Fontes scraping:
 *   - Lista massiva: https://fundamentus.com.br/resultado.php
 *       Tabela única <table id="resultado"> com cabeçalhos:
 *         Papel | Cotação | P/L | P/VP | PSR | Div.Yield | P/Ativo | P/Cap.Giro |
 *         P/EBIT | P/Ativ Circ.Liq | EV/EBIT | EV/EBITDA | Mrg Ebit | Mrg. Líq. |
 *         Liq. Corr. | ROIC | ROE | Liquidez 2 meses | Patrim. Líq |
 *         Dív.Brut/ Patrim. | Cresc. Rec.5a
 *
 *   - Detalhes por papel: https://fundamentus.com.br/detalhes.php?papel=TICKER
 *       Página com múltiplas tabelas; as primeiras células trazem "Papel", "Empresa",
 *       "Setor" e "Subsetor".
 *
 * Qualquer mudança na estrutura do HTML do Fundamentus deve ser tratada aqui.
 */

import * as cheerio from 'cheerio';
import { parseBrNumber, parseBrPercent } from '../../utils/number-br.js';
import type { RawStock } from '../../core/types.js';

const EXPECTED_HEADERS = [
  'Papel',
  'Cotação',
  'P/L',
  'P/VP',
  'PSR',
  'Div.Yield',
  'P/Ativo',
  'P/Cap.Giro',
  'P/EBIT',
  'P/Ativ Circ.Liq',
  'EV/EBIT',
  'EV/EBITDA',
  'Mrg Ebit',
  'Mrg. Líq.',
  'Liq. Corr.',
  'ROIC',
  'ROE',
  'Liquidez 2 meses',
  'Patrim. Líq',
  'Dív.Brut/ Patrim.',
  'Cresc. Rec.5a',
];

export interface ParsedListStock {
  ticker: string;
  price: number | null;
  pl: number | null;
  pvp: number | null;
  dividendYield: number | null;
  netMargin: number | null;
  roe: number | null;
  liquidity2m: number | null;
}

/**
 * Faz o parsing de resultado.php. Valida os cabeçalhos para falhar cedo caso a
 * estrutura da página mude.
 */
export function parseResultadoHtml(html: string): ParsedListStock[] {
  const $ = cheerio.load(html);
  const table = $('table#resultado');
  if (table.length === 0) {
    throw new Error('Fundamentus resultado.php: tabela #resultado não encontrada.');
  }

  const headers = table
    .find('thead tr th')
    .map((_, th) => $(th).text().trim())
    .get();

  validateHeaders(headers);

  const idx = {
    papel: headers.indexOf('Papel'),
    cotacao: headers.indexOf('Cotação'),
    pl: headers.indexOf('P/L'),
    pvp: headers.indexOf('P/VP'),
    dy: headers.indexOf('Div.Yield'),
    mrgLiq: headers.indexOf('Mrg. Líq.'),
    roe: headers.indexOf('ROE'),
    liq2m: headers.indexOf('Liquidez 2 meses'),
  };

  const rows: ParsedListStock[] = [];
  table.find('tbody tr').each((_, tr) => {
    const cells = $(tr)
      .find('td')
      .map((_, td) => $(td).text().trim())
      .get();

    if (cells.length === 0) return;

    const ticker = cells[idx.papel];
    if (!ticker) return;

    rows.push({
      ticker: ticker.toUpperCase(),
      price: parseBrNumber(cells[idx.cotacao] ?? null),
      pl: parseBrNumber(cells[idx.pl] ?? null),
      pvp: parseBrNumber(cells[idx.pvp] ?? null),
      dividendYield: parseBrPercent(cells[idx.dy] ?? null),
      netMargin: parseBrPercent(cells[idx.mrgLiq] ?? null),
      roe: parseBrPercent(cells[idx.roe] ?? null),
      liquidity2m: parseBrNumber(cells[idx.liq2m] ?? null),
    });
  });

  return rows;
}

function validateHeaders(actual: string[]): void {
  const missing = EXPECTED_HEADERS.filter((expected) => !actual.includes(expected));
  if (missing.length > 0) {
    throw new Error(
      `Fundamentus resultado.php: cabeçalhos esperados ausentes: ${missing.join(', ')}. ` +
        `Recebido: ${actual.join(' | ')}`,
    );
  }
}

export interface ParsedDetails {
  ticker: string;
  companyName: string | null;
  sector: string | null;
  subsector: string | null;
}

/**
 * Faz o parsing de detalhes.php?papel=TICKER. Extrai Empresa, Setor, Subsetor.
 *
 * A página não possui IDs estáveis nas tabelas; por isso varremos todas as
 * células <td> procurando as labels esperadas e capturamos a célula seguinte.
 */
export function parseDetalhesHtml(html: string, ticker: string): ParsedDetails {
  const $ = cheerio.load(html);

  const labelValuePairs: Array<{ label: string; value: string }> = [];
  $('td').each((_, td) => {
    const cell = $(td);
    const label = cell.text().trim();
    if (!label) return;
    const value = cell.next('td').text().trim();
    if (!value) return;
    labelValuePairs.push({ label, value });
  });

  const find = (candidates: string[]): string | null => {
    for (const pair of labelValuePairs) {
      const normalized = pair.label.replace(/\s+/g, ' ').trim();
      if (candidates.includes(normalized)) {
        return pair.value || null;
      }
    }
    return null;
  };

  return {
    ticker: ticker.toUpperCase(),
    companyName: find(['?Empresa', 'Empresa']),
    sector: find(['?Setor', 'Setor']),
    subsector: find(['?Subsetor', 'Subsetor']),
  };
}
