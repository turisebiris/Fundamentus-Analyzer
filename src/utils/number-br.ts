/**
 * Parser de números no formato pt-BR usado pelo Fundamentus.
 *
 * Exemplos:
 *   "1.234.567,89"  => 1234567.89
 *   "6,25%"         => 0.0625
 *   "12,50%"        => 0.125
 *   "-"             => null
 *   ""              => null
 *   "N/A"           => null
 */

export function parseBrNumber(raw: string | null | undefined): number | null {
  if (raw == null) return null;
  const trimmed = String(raw).trim();
  if (trimmed === '' || trimmed === '-' || trimmed === '–' || trimmed === 'N/A') return null;

  // Remove separadores de milhar e normaliza vírgula decimal.
  const normalized = trimmed
    .replace(/\./g, '')
    .replace(',', '.')
    .replace(/[^\d.\-]/g, '');

  if (normalized === '' || normalized === '-' || normalized === '.') return null;

  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

/**
 * Interpreta uma string como porcentagem e devolve a fração decimal.
 * Aceita com ou sem símbolo "%".
 */
export function parseBrPercent(raw: string | null | undefined): number | null {
  if (raw == null) return null;
  const trimmed = String(raw).trim();
  if (trimmed === '' || trimmed === '-' || trimmed === '–' || trimmed === 'N/A') return null;

  const hasPercent = trimmed.includes('%');
  const value = parseBrNumber(trimmed.replace('%', ''));
  if (value === null) return null;

  // Quando a fonte já apresenta o símbolo "%", o valor está em ponto percentual (ex.: 6,25 => 0.0625).
  // Quando não apresenta, confiamos que a fonte já trouxe a fração decimal.
  return hasPercent ? value / 100 : value;
}

/**
 * Formatadores usados na UI.
 */
export function formatPercent(value: number | null, digits = 2): string {
  if (value === null || !Number.isFinite(value)) return '—';
  return `${(value * 100).toFixed(digits).replace('.', ',')}%`;
}

export function formatDecimal(value: number | null, digits = 2): string {
  if (value === null || !Number.isFinite(value)) return '—';
  return value.toFixed(digits).replace('.', ',');
}

export function formatInteger(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(value);
}

export function formatCurrency(value: number | null, digits = 2): string {
  if (value === null || !Number.isFinite(value)) return '—';
  return `R$ ${value.toFixed(digits).replace('.', ',')}`;
}
