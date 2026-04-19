/**
 * Adapter HTML -> modelo interno para o módulo de ações do Fundamentus.
 *
 * Fontes scraping:
 *   - Lista massiva: https://fundamentus.com.br/resultado.php
 *       Tabela única <table id="resultado">. Os cabeçalhos variam entre
 *       versões do site (ex.: "Liquidez 2 meses" vs "Liq.2meses"); por isso
 *       os headers são normalizados antes do mapeamento.
 *
 *   - Detalhes por papel: https://fundamentus.com.br/detalhes.php?papel=TICKER
 *       Página com múltiplas tabelas; as primeiras células trazem "Papel",
 *       "Empresa", "Setor" e "Subsetor".
 *
 * Qualquer mudança nos nomes dos cabeçalhos do Fundamentus deve ser tratada
 * em HEADER_ALIASES abaixo — sem alterar o core do ranking.
 */

import * as cheerio from 'cheerio';
import { parseBrNumber, parseBrPercent } from '../../utils/number-br.js';
import { normalizeHeader } from '../../utils/header-normalize.js';

// Reexportado para preservar a superfície pública consumida pelos testes e
// por outros módulos que importavam normalizeHeader diretamente do adapter
// de ações antes da extração para utils/.
export { normalizeHeader };

/**
 * Nomes canônicos das colunas que o parser efetivamente lê.
 * Qualquer alias normalizado deve apontar para um destes valores.
 */
const REQUIRED_FIELDS = [
  'papel',
  'cotacao',
  'pl',
  'pvp',
  'dy',
  'mrgliq',
  'roe',
  'liq2m',
] as const;

type RequiredField = (typeof REQUIRED_FIELDS)[number];

/**
 * Mapa de alias normalizado → campo canônico.
 *
 * Para adicionar suporte a uma nova variação de nome de coluna, acrescente
 * uma linha aqui. Normalize manualmente o novo nome com normalizeHeader()
 * para confirmar o alias correto antes de adicionar.
 *
 * Exemplos verificados:
 *   normalizeHeader("Liquidez 2 meses") === "liquidez2meses"
 *   normalizeHeader("Liq.2meses")       === "liq2meses"
 *   normalizeHeader("Liq. 2 Meses")    === "liq2meses"
 *   normalizeHeader("Mrg. Líq.")       === "mrgliq"
 *   normalizeHeader("Mrg.Liq.")        === "mrgliq"
 *   normalizeHeader("Div.Yield")       === "divyield"
 *   normalizeHeader("P/L")             === "pl"
 *   normalizeHeader("P/VP")            === "pvp"
 *   normalizeHeader("Cotação")         === "cotacao"
 */
const HEADER_ALIASES: Record<string, RequiredField> = {
  // Ticker
  papel: 'papel',

  // Cotação
  cotacao: 'cotacao',
  cotac: 'cotacao',

  // P/L
  pl: 'pl',

  // P/VP
  pvp: 'pvp',

  // Dividend Yield
  divyield: 'dy',
  dy: 'dy',
  dividendyield: 'dy',

  // Margem Líquida — "Mrg. Líq." e variantes
  mrgliq: 'mrgliq',
  mrgliquidez: 'mrgliq',
  margemliquida: 'mrgliq',
  mrgliqu: 'mrgliq',

  // ROE
  roe: 'roe',

  // Liquidez 2 meses — "Liquidez 2 meses", "Liq.2meses", "Liq. 2 Meses" etc.
  liquidez2meses: 'liq2m',
  liquidez2mes: 'liq2m',
  liquidez2m: 'liq2m',
  liq2meses: 'liq2m',
  liq2mes: 'liq2m',
  liq2m: 'liq2m',
};

/**
 * Constrói um índice { campo canônico → posição na linha } a partir dos
 * cabeçalhos reais da tabela. Falha com mensagem clara se alguma coluna
 * obrigatória não for encontrada após normalização.
 */
function buildFieldIndex(headers: string[]): Record<RequiredField, number> {
  const index: Partial<Record<RequiredField, number>> = {};

  for (let i = 0; i < headers.length; i++) {
    const normalized = normalizeHeader(headers[i]!);
    const canonical = HEADER_ALIASES[normalized];
    // Primeira ocorrência vence; evita sobrescrever se houver duplicata.
    if (canonical !== undefined && !(canonical in index)) {
      index[canonical] = i;
    }
  }

  const missing = REQUIRED_FIELDS.filter((f) => !(f in index));
  if (missing.length > 0) {
    const receivedNormalized = headers.map(normalizeHeader).join(' | ');
    throw new Error(
      `Fundamentus resultado.php: colunas obrigatórias não encontradas após normalização: ` +
        `[${missing.join(', ')}]. ` +
        `Headers recebidos (normalizados): ${receivedNormalized}`,
    );
  }

  return index as Record<RequiredField, number>;
}

// ---------------------------------------------------------------------------
// Parser principal — resultado.php
// ---------------------------------------------------------------------------

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
 * Faz o parsing de resultado.php.
 * Normaliza os cabeçalhos antes de indexar as colunas para tolerar variações
 * de grafia do Fundamentus. Falha com mensagem clara se uma coluna obrigatória
 * realmente não existir.
 */
export function parseResultadoHtml(html: string): ParsedListStock[] {
  const $ = cheerio.load(html);
  const table = $('table#resultado');
  if (table.length === 0) {
    throw new Error('Fundamentus resultado.php: tabela #resultado não encontrada.');
  }

  const rawHeaders = table
    .find('thead tr th')
    .map((_, th) => $(th).text().trim())
    .get();

  const idx = buildFieldIndex(rawHeaders);

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
      netMargin: parseBrPercent(cells[idx.mrgliq] ?? null),
      roe: parseBrPercent(cells[idx.roe] ?? null),
      liquidity2m: parseBrNumber(cells[idx.liq2m] ?? null),
    });
  });

  return rows;
}

// ---------------------------------------------------------------------------
// Parser de enriquecimento — detalhes.php
// ---------------------------------------------------------------------------

export interface ParsedDetails {
  ticker: string;
  companyName: string | null;
  sector: string | null;
  subsector: string | null;
}

/**
 * Faz o parsing de detalhes.php?papel=TICKER. Extrai Empresa, Setor, Subsetor.
 *
 * A página não possui IDs estáveis nas tabelas; varremos todas as células <td>
 * procurando as labels esperadas e capturamos a célula seguinte.
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
