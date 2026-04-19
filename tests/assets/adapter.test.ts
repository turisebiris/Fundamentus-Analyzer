import { describe, it, expect } from 'vitest';
import { normalizeHeader, parseResultadoHtml, parseDetalhesHtml } from '../../src/assets/stocks/adapter.js';

// ---------------------------------------------------------------------------
// normalizeHeader
// ---------------------------------------------------------------------------

describe('normalizeHeader', () => {
  it('remove pontos e espaços', () => {
    expect(normalizeHeader('Mrg. Líq.')).toBe('mrgliq');
    expect(normalizeHeader('Div.Yield')).toBe('divyield');
    expect(normalizeHeader('Liq.2meses')).toBe('liq2meses');
  });

  it('remove acentos/diacríticos', () => {
    expect(normalizeHeader('Cotação')).toBe('cotacao');
    expect(normalizeHeader('Liquidez 2 meses')).toBe('liquidez2meses');
  });

  it('normaliza barra e maiúsculas', () => {
    expect(normalizeHeader('P/L')).toBe('pl');
    expect(normalizeHeader('P/VP')).toBe('pvp');
    expect(normalizeHeader('ROE')).toBe('roe');
  });
});

// ---------------------------------------------------------------------------
// Helpers para gerar HTML de tabela mínimo
// ---------------------------------------------------------------------------

function makeResultadoHtml(headers: string[], rows: string[][]): string {
  const ths = headers.map((h) => `<th>${h}</th>`).join('');
  const trs = rows
    .map((row) => `<tr>${row.map((c) => `<td>${c}</td>`).join('')}</tr>`)
    .join('');
  return `
    <html><body>
      <table id="resultado">
        <thead><tr>${ths}</tr></thead>
        <tbody>${trs}</tbody>
      </table>
    </body></html>
  `;
}

const CANONICAL_HEADERS = [
  'Papel', 'Cotação', 'P/L', 'P/VP', 'PSR',
  'Div.Yield', 'P/Ativo', 'P/Cap.Giro', 'P/EBIT',
  'P/Ativ Circ.Liq', 'EV/EBIT', 'EV/EBITDA', 'Mrg Ebit',
  'Mrg. Líq.', 'Liq. Corr.', 'ROIC', 'ROE',
  'Liquidez 2 meses', 'Patrim. Líq', 'Dív.Brut/ Patrim.', 'Cresc. Rec.5a',
];

const VARIANT_HEADERS = [
  'Papel', 'Cotac.', 'P/L', 'P/VP', 'PSR',
  'DivYield', 'P/Ativo', 'P/Cap.Giro', 'P/EBIT',
  'P/Ativ Circ.Liq', 'EV/EBIT', 'EV/EBITDA', 'Mrg Ebit',
  'Mrg.Liq.', 'Liq. Corr.', 'ROIC', 'ROE',
  'Liq.2meses', 'Patrim. Líq', 'Dív.Brut/ Patrim.', 'Cresc. Rec.5a',
];

function sampleRow(ticker: string): string[] {
  // 21 colunas correspondendo a CANONICAL_HEADERS / VARIANT_HEADERS
  return [
    ticker,      // Papel
    '25,50',     // Cotação
    '7,00',      // P/L
    '2,00',      // P/VP
    '1,00',      // PSR
    '8,00%',     // Div.Yield
    '0,50',      // P/Ativo
    '1,00',      // P/Cap.Giro
    '5,00',      // P/EBIT
    '1,00',      // P/Ativ Circ.Liq
    '6,00',      // EV/EBIT
    '7,00',      // EV/EBITDA
    '15,00%',    // Mrg Ebit
    '20,00%',    // Mrg. Líq.
    '1,50',      // Liq. Corr.
    '15,00%',    // ROIC
    '18,00%',    // ROE
    '5000000',   // Liquidez 2 meses
    '1000000',   // Patrim. Líq
    '0,50',      // Dív.Brut/ Patrim.
    '10,00%',    // Cresc. Rec.5a
  ];
}

// ---------------------------------------------------------------------------
// parseResultadoHtml
// ---------------------------------------------------------------------------

describe('parseResultadoHtml', () => {
  it('parseia com headers canônicos do Fundamentus', () => {
    const html = makeResultadoHtml(CANONICAL_HEADERS, [sampleRow('ABCD3')]);
    const rows = parseResultadoHtml(html);
    expect(rows).toHaveLength(1);
    const row = rows[0]!;
    expect(row.ticker).toBe('ABCD3');
    expect(row.dividendYield).toBeCloseTo(0.08, 4);
    expect(row.roe).toBeCloseTo(0.18, 4);
    expect(row.netMargin).toBeCloseTo(0.20, 4);
    expect(row.liquidity2m).toBe(5_000_000);
    expect(row.pl).toBe(7);
    expect(row.pvp).toBe(2);
  });

  it('parseia com headers variantes (Liq.2meses, Mrg.Liq., DivYield etc.)', () => {
    const html = makeResultadoHtml(VARIANT_HEADERS, [sampleRow('EFGH4')]);
    const rows = parseResultadoHtml(html);
    expect(rows).toHaveLength(1);
    const row = rows[0]!;
    expect(row.ticker).toBe('EFGH4');
    expect(row.dividendYield).toBeCloseTo(0.08, 4);
    expect(row.liquidity2m).toBe(5_000_000);
    expect(row.netMargin).toBeCloseTo(0.20, 4);
  });

  it('lança erro claro se coluna obrigatória estiver ausente', () => {
    const headersWithoutROE = CANONICAL_HEADERS.filter((h) => h !== 'ROE');
    const html = makeResultadoHtml(headersWithoutROE, [sampleRow('XPTO3').slice(0, -1)]);
    expect(() => parseResultadoHtml(html)).toThrow(/roe/);
  });

  it('lança erro claro se coluna de liquidez estiver ausente', () => {
    const headersWithoutLiq = CANONICAL_HEADERS.filter((h) => h !== 'Liquidez 2 meses');
    const html = makeResultadoHtml(headersWithoutLiq, [sampleRow('XPTO3').slice(0, -1)]);
    expect(() => parseResultadoHtml(html)).toThrow(/liq2m/);
  });

  it('lança erro se a tabela #resultado não existir', () => {
    expect(() => parseResultadoHtml('<html><body></body></html>')).toThrow(
      /tabela #resultado não encontrada/,
    );
  });

  it('parseia múltiplas linhas preservando ordem', () => {
    const html = makeResultadoHtml(CANONICAL_HEADERS, [
      sampleRow('AAA3'),
      sampleRow('BBB4'),
      sampleRow('CCC11'),
    ]);
    const rows = parseResultadoHtml(html);
    expect(rows.map((r) => r.ticker)).toEqual(['AAA3', 'BBB4', 'CCC11']);
  });
});

// ---------------------------------------------------------------------------
// parseDetalhesHtml
// ---------------------------------------------------------------------------

describe('parseDetalhesHtml', () => {
  function makeDetalhesHtml(empresa: string, setor: string, subsetor: string): string {
    return `
      <html><body>
        <table>
          <tr><td>Papel</td><td>ABCD3</td></tr>
          <tr><td>Empresa</td><td>${empresa}</td></tr>
          <tr><td>Setor</td><td>${setor}</td></tr>
          <tr><td>Subsetor</td><td>${subsetor}</td></tr>
        </table>
      </body></html>
    `;
  }

  it('extrai empresa, setor e subsetor', () => {
    const result = parseDetalhesHtml(
      makeDetalhesHtml('Empresa Teste SA', 'Financeiros', 'Bancos'),
      'ABCD3',
    );
    expect(result.companyName).toBe('Empresa Teste SA');
    expect(result.sector).toBe('Financeiros');
    expect(result.subsector).toBe('Bancos');
    expect(result.ticker).toBe('ABCD3');
  });

  it('retorna null para campos ausentes', () => {
    const result = parseDetalhesHtml('<html><body><table></table></body></html>', 'XXXX3');
    expect(result.companyName).toBeNull();
    expect(result.sector).toBeNull();
    expect(result.subsector).toBeNull();
  });
});
