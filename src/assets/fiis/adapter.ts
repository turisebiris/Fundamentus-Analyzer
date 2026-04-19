/**
 * Adapter HTML -> modelo interno para o módulo de FIIs.
 *
 * Fonte scraping:
 *   - https://fundamentus.com.br/fii_resultado.php
 *     Tabela única <table id="tabelaResultado"> (identificador usado pelo
 *     Fundamentus). Cabeçalhos são normalizados antes do mapeamento para
 *     tolerar variações de grafia entre versões do site.
 *
 * Colunas obrigatórias (rules_fiis.md — exatamente estas):
 *   Papel, Segmento, Cotação, Dividend Yield, P/VP, Liquidez,
 *   Qtd de imóveis, Vacância Média.
 *
 * Se qualquer uma dessas colunas não for encontrada após normalização, o
 * parser falha com erro explícito — rules_fiis.md exige falha clara em vez
 * de suposição silenciosa.
 */

import * as cheerio from 'cheerio';
import { parseBrNumber, parseBrPercent } from '../../utils/number-br.js';
import { normalizeHeader } from '../../utils/header-normalize.js';
import type { RawFii } from './types.js';

// ---------------------------------------------------------------------------
// Mapeamento de cabeçalhos
// ---------------------------------------------------------------------------

const REQUIRED_FIELDS = [
  'papel',
  'segmento',
  'cotacao',
  'dy',
  'pvp',
  'liquidez',
  'qtdimoveis',
  'vacancia',
] as const;

type RequiredField = (typeof REQUIRED_FIELDS)[number];

/**
 * Mapa de alias normalizado → campo canônico. Para adicionar suporte a uma
 * nova variação, normalize manualmente o novo nome com normalizeHeader() e
 * adicione aqui. Valores já verificados:
 *
 *   normalizeHeader("Papel")             === "papel"
 *   normalizeHeader("Segmento")          === "segmento"
 *   normalizeHeader("Cotação")           === "cotacao"
 *   normalizeHeader("Dividend Yield")    === "dividendyield"
 *   normalizeHeader("Div.Yield")         === "divyield"
 *   normalizeHeader("P/VP")              === "pvp"
 *   normalizeHeader("Liquidez")          === "liquidez"
 *   normalizeHeader("Qtd de Imóveis")    === "qtddeimoveis"
 *   normalizeHeader("Qtd Imóveis")       === "qtdimoveis"
 *   normalizeHeader("Vacância Média")    === "vacanciamedia"
 *   normalizeHeader("Vacancia")          === "vacancia"
 */
const FII_HEADER_ALIASES: Record<string, RequiredField> = {
  // Ticker
  papel: 'papel',

  // Segmento
  segmento: 'segmento',

  // Cotação
  cotacao: 'cotacao',
  cotac: 'cotacao',

  // Dividend Yield
  dividendyield: 'dy',
  divyield: 'dy',
  dy: 'dy',

  // P/VP
  pvp: 'pvp',

  // Liquidez
  liquidez: 'liquidez',
  liquidezmedia: 'liquidez',
  liquidezmediadiaria: 'liquidez',

  // Qtd de imóveis
  qtddeimoveis: 'qtdimoveis',
  qtdimoveis: 'qtdimoveis',
  quantidadedeimoveis: 'qtdimoveis',
  quantidadeimoveis: 'qtdimoveis',

  // Vacância Média
  vacanciamedia: 'vacancia',
  vacancia: 'vacancia',
};

function buildFieldIndex(headers: string[]): Record<RequiredField, number> {
  const index: Partial<Record<RequiredField, number>> = {};

  for (let i = 0; i < headers.length; i++) {
    const normalized = normalizeHeader(headers[i]!);
    const canonical = FII_HEADER_ALIASES[normalized];
    if (canonical !== undefined && !(canonical in index)) {
      index[canonical] = i;
    }
  }

  const missing = REQUIRED_FIELDS.filter((f) => !(f in index));
  if (missing.length > 0) {
    const receivedNormalized = headers.map(normalizeHeader).join(' | ');
    throw new Error(
      `Fundamentus fii_resultado.php: colunas obrigatórias não encontradas após normalização: ` +
        `[${missing.join(', ')}]. ` +
        `Headers recebidos (normalizados): ${receivedNormalized}`,
    );
  }

  return index as Record<RequiredField, number>;
}

// ---------------------------------------------------------------------------
// Parser principal — fii_resultado.php
// ---------------------------------------------------------------------------

/**
 * Faz o parsing de fii_resultado.php. Normaliza cabeçalhos antes de indexar
 * colunas. Falha com mensagem clara se a tabela não existir ou se faltar
 * uma coluna obrigatória.
 *
 * O Fundamentus usa id="tabelaResultado" (observado em produção). Mantemos
 * um fallback via <table>:first como defesa contra renomeação.
 */
export function parseFiiResultadoHtml(html: string): RawFii[] {
  const $ = cheerio.load(html);

  let table = $('table#tabelaResultado');
  if (table.length === 0) {
    // Fallback defensivo: a página tem uma única tabela relevante.
    table = $('table').first();
  }
  if (table.length === 0) {
    throw new Error('Fundamentus fii_resultado.php: tabela de resultado não encontrada.');
  }

  const rawHeaders = table
    .find('thead tr th')
    .map((_, th) => $(th).text().trim())
    .get();

  if (rawHeaders.length === 0) {
    throw new Error(
      'Fundamentus fii_resultado.php: cabeçalho da tabela vazio ou ausente.',
    );
  }

  const idx = buildFieldIndex(rawHeaders);

  const rows: RawFii[] = [];
  table.find('tbody tr').each((_, tr) => {
    const cells = $(tr)
      .find('td')
      .map((_, td) => $(td).text().trim())
      .get();

    if (cells.length === 0) return;

    const ticker = cells[idx.papel];
    if (!ticker) return;

    const segmentRaw = cells[idx.segmento] ?? '';
    const segment = segmentRaw.trim() === '' ? null : segmentRaw.trim();

    rows.push({
      ticker: ticker.toUpperCase(),
      segment,
      price: parseBrNumber(cells[idx.cotacao] ?? null),
      dividendYield: parseBrPercent(cells[idx.dy] ?? null),
      pvp: parseBrNumber(cells[idx.pvp] ?? null),
      liquidity: parseBrNumber(cells[idx.liquidez] ?? null),
      propertyCount: parseBrNumber(cells[idx.qtdimoveis] ?? null),
      vacancy: parseBrPercent(cells[idx.vacancia] ?? null),
    });
  });

  return rows;
}

// Reexport para uso em testes — consistente com o adapter de ações.
export { normalizeHeader };
