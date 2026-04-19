import { describe, it, expect } from 'vitest';
import { parseFiiResultadoHtml } from '../../src/assets/fiis/adapter.js';

// ---------------------------------------------------------------------------
// Helpers para gerar HTML de tabela mínimo de FIIs
// ---------------------------------------------------------------------------

function makeHtml(headers: string[], rows: string[][], tableId = 'tabelaResultado'): string {
  const ths = headers.map((h) => `<th>${h}</th>`).join('');
  const trs = rows
    .map((row) => `<tr>${row.map((c) => `<td>${c}</td>`).join('')}</tr>`)
    .join('');
  return `
    <html><body>
      <table id="${tableId}">
        <thead><tr>${ths}</tr></thead>
        <tbody>${trs}</tbody>
      </table>
    </body></html>
  `;
}

const CANONICAL_HEADERS = [
  'Papel',
  'Segmento',
  'Cotação',
  'Dividend Yield',
  'P/VP',
  'Liquidez',
  'Qtd de Imóveis',
  'Vacância Média',
];

const VARIANT_HEADERS = [
  'Papel',
  'Segmento',
  'Cotac.',
  'Div.Yield',
  'P/VP',
  'Liquidez',
  'Qtd Imóveis',
  'Vacancia',
];

function sampleRow(ticker: string, segment = 'Logística'): string[] {
  return [
    ticker,
    segment,
    '100,00',    // Cotação
    '9,00%',     // DY
    '0,90',      // P/VP
    '1.000.000', // Liquidez
    '10',        // Qtd imóveis
    '5,00%',     // Vacância
  ];
}

// ---------------------------------------------------------------------------
// parseFiiResultadoHtml
// ---------------------------------------------------------------------------

describe('parseFiiResultadoHtml', () => {
  it('parseia com headers canônicos do Fundamentus', () => {
    const html = makeHtml(CANONICAL_HEADERS, [sampleRow('HGLG11')]);
    const rows = parseFiiResultadoHtml(html);
    expect(rows).toHaveLength(1);
    const row = rows[0]!;
    expect(row.ticker).toBe('HGLG11');
    expect(row.segment).toBe('Logística');
    expect(row.price).toBe(100);
    expect(row.dividendYield).toBeCloseTo(0.09, 4);
    expect(row.pvp).toBeCloseTo(0.9, 4);
    expect(row.liquidity).toBe(1_000_000);
    expect(row.propertyCount).toBe(10);
    expect(row.vacancy).toBeCloseTo(0.05, 4);
  });

  it('parseia com headers variantes (Div.Yield, Qtd Imóveis, Vacancia)', () => {
    const html = makeHtml(VARIANT_HEADERS, [sampleRow('XPML11', 'Multicategoria')]);
    const rows = parseFiiResultadoHtml(html);
    expect(rows).toHaveLength(1);
    const row = rows[0]!;
    expect(row.ticker).toBe('XPML11');
    expect(row.segment).toBe('Multicategoria');
    expect(row.dividendYield).toBeCloseTo(0.09, 4);
    expect(row.vacancy).toBeCloseTo(0.05, 4);
    expect(row.propertyCount).toBe(10);
  });

  it('lança erro claro se uma coluna obrigatória estiver ausente', () => {
    const headersWithoutVacancy = CANONICAL_HEADERS.filter((h) => h !== 'Vacância Média');
    const html = makeHtml(
      headersWithoutVacancy,
      [sampleRow('HGLG11').slice(0, -1)],
    );
    expect(() => parseFiiResultadoHtml(html)).toThrow(/vacancia/);
  });

  it('lança erro claro se Segmento estiver ausente', () => {
    const headersWithoutSegment = CANONICAL_HEADERS.filter((h) => h !== 'Segmento');
    const row = sampleRow('HGLG11');
    row.splice(1, 1);
    const html = makeHtml(headersWithoutSegment, [row]);
    expect(() => parseFiiResultadoHtml(html)).toThrow(/segmento/);
  });

  it('lança erro se a tabela de resultado não existir', () => {
    expect(() => parseFiiResultadoHtml('<html><body></body></html>')).toThrow(
      /tabela de resultado não encontrada/,
    );
  });

  it('aceita fallback quando a tabela não tem id esperado', () => {
    const html = makeHtml(CANONICAL_HEADERS, [sampleRow('HGLG11')], 'outro-id');
    const rows = parseFiiResultadoHtml(html);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.ticker).toBe('HGLG11');
  });

  it('parseia múltiplas linhas preservando ordem', () => {
    const html = makeHtml(CANONICAL_HEADERS, [
      sampleRow('HGLG11'),
      sampleRow('XPML11', 'Multicategoria'),
      sampleRow('BRCR11', 'Lajes Corporativas'),
    ]);
    const rows = parseFiiResultadoHtml(html);
    expect(rows.map((r) => r.ticker)).toEqual(['HGLG11', 'XPML11', 'BRCR11']);
    expect(rows.map((r) => r.segment)).toEqual([
      'Logística',
      'Multicategoria',
      'Lajes Corporativas',
    ]);
  });
});
