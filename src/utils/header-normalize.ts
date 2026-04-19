/**
 * Normalização de cabeçalhos de tabela para tolerar variações de grafia
 * entre versões do Fundamentus. Utilitário compartilhado entre adapters
 * de ações e FIIs — é função pura de parsing, não depende de regra de
 * negócio de nenhum módulo.
 *
 * Exemplos:
 *   "Liquidez 2 meses" → "liquidez2meses"
 *   "Liq.2meses"       → "liq2meses"
 *   "Mrg. Líq."        → "mrgliq"
 *   "Vacância Média"   → "vacanciamedia"
 *   "Qtd de Imóveis"   → "qtddeimoveis"
 *   "P/VP"             → "pvp"
 *   "Cotação"          → "cotacao"
 */
export function normalizeHeader(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]/gi, '')
    .toLowerCase();
}
