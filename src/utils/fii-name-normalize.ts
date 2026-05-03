/**
 * Normalização visual do nome de FIIs.
 *
 * Os nomes vindos do Fundamentus costumam vir com sufixos jurídicos longos
 * (ex.: "IRIDIUM FUNDO DE INVESTIMENTO IMOBILIÁRIO RESPONSABILIDADE LIMITADA").
 * Para a UI, queremos só o nome principal — truncamos a partir da primeira
 * ocorrência de uma palavra-chave estrutural.
 *
 * IMPORTANTE: usar APENAS para exibição. O cache mantém o nome completo, sem
 * perda de informação.
 */

const TRUNCATE_PATTERN = /\b(FUNDO|FII|FIAGRO|RESPONSABILIDADE\s+LIMITADA)\b/i;
const TRAILING_PUNCT = /[\s\-,;:]+$/;

/**
 * Trunca o nome do FII a partir da primeira palavra-chave estrutural.
 *
 * - "IRIDIUM FUNDO ... RESPONSABILIDADE LIMITADA" → "IRIDIUM"
 * - "CSHG LOGÍSTICA FII"                          → "CSHG LOGÍSTICA"
 * - "RB CAPITAL RENDA I"                          → "RB CAPITAL RENDA I"
 *
 * Se a truncagem produzir string vazia (ex.: o nome começa com a palavra-chave),
 * retorna o nome original — preferimos o nome completo a um vazio.
 */
export function normalizeFiiName(name: string): string {
  const trimmed = name.trim();
  const match = TRUNCATE_PATTERN.exec(trimmed);
  if (!match) return trimmed;
  const head = trimmed.slice(0, match.index).replace(TRAILING_PUNCT, '').trim();
  return head.length > 0 ? head : trimmed;
}
