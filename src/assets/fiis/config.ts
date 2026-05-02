/**
 * Configuração única de filtros, pesos, direções e segmentos para o módulo
 * de FIIs. Fonte: rules_fiis.md. NÃO reaproveita nada do módulo de ações —
 * valores e regras são independentes.
 */

export type FiiIndicatorKey =
  | 'dividendYield'
  | 'pvp'
  | 'liquidity'
  | 'vacancy';

export type FiiDirection = 'higher' | 'lower';

/**
 * Segmentos elegíveis (rules_fiis.md). Qualquer FII fora desta lista é
 * descartado antes de qualquer outro filtro, sem entrar nos reprovados por
 * indicador.
 */
export const FII_ALLOWED_SEGMENTS = ['Logística', 'Multicategoria'] as const;
export type FiiSegment = (typeof FII_ALLOWED_SEGMENTS)[number];

/**
 * Shape mutável dos filtros de FIIs. O pipeline aceita qualquer
 * `FiiFilterConfig` e usa `FII_FILTERS` como default.
 */
export interface FiiFilterConfig {
  dividendYield: { min: number };
  liquidity: { min: number };
  pvp: { min: number; max: number };
  propertyCount: { min: number };
  vacancy: { max: number };
}

/**
 * Filtros eliminatórios padrão (rules_fiis.md):
 *   - Dividend Yield ≥ 7%
 *   - Liquidez ≥ 500.000
 *   - P/VP entre 0.7 e 1.1 (inclusivo)
 *
 * Filtros específicos de Logística:
 *   - Qtd de imóveis > 3
 *   - Vacância Média ≤ 10%
 *
 * Multicategoria NÃO usa Qtd de imóveis nem Vacância Média como filtro.
 */
export const FII_FILTERS: FiiFilterConfig = {
  dividendYield: { min: 0.07 },
  liquidity: { min: 500_000 },
  pvp: { min: 0.7, max: 1.1 },
  propertyCount: { min: 3 }, // somente Logística, regra: > 3
  vacancy: { max: 0.1 }, // somente Logística, regra: ≤ 10%
};

/**
 * Pesos dos indicadores na pontuação final (rules_fiis.md). FIXOS.
 *   DY = 1.5
 *   P/VP = 2.0
 *   Liquidez = 1.0
 *   Vacância Média = 1.5
 *
 * Qtd de imóveis NÃO entra no ranking — é filtro puro para logística.
 */
export const FII_WEIGHTS: Record<FiiIndicatorKey, number> = {
  dividendYield: 1.5,
  pvp: 2.0,
  liquidity: 1.0,
  vacancy: 1.5,
};

/**
 * Direção de preferência por indicador (rules_fiis.md).
 */
export const FII_DIRECTIONS: Record<FiiIndicatorKey, FiiDirection> = {
  dividendYield: 'higher',
  pvp: 'lower',
  liquidity: 'higher',
  vacancy: 'lower',
};

/**
 * Rótulos em PT-BR usados pela UI e motivos de exclusão.
 */
export const FII_INDICATOR_LABELS: Record<FiiIndicatorKey, string> = {
  dividendYield: 'Dividend Yield',
  pvp: 'P/VP',
  liquidity: 'Liquidez',
  vacancy: 'Vacância Média',
};

export const FII_ALL_INDICATORS: FiiIndicatorKey[] = [
  'dividendYield',
  'pvp',
  'liquidity',
  'vacancy',
];

/**
 * Ordem de desempate (rules_fiis.md):
 *   1. Menor P/VP
 *   2. Maior Dividend Yield
 *   3. Maior Liquidez
 *   4. Menor Vacância
 */
export const FII_TIEBREAKER_ORDER: Array<{ key: FiiIndicatorKey; direction: FiiDirection }> = [
  { key: 'pvp', direction: 'lower' },
  { key: 'dividendYield', direction: 'higher' },
  { key: 'liquidity', direction: 'higher' },
  { key: 'vacancy', direction: 'lower' },
];
