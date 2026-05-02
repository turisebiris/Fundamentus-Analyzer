/**
 * Configuração única de filtros, pesos e direções para o módulo de ações.
 * Importado tanto pelo frontend (pipeline) quanto pela função serverless
 * (decisão de quais papéis enriquecer com dados de detalhes.php).
 *
 * Fonte: rules.md.
 */

export type IndicatorKey =
  | 'dividendYield'
  | 'pl'
  | 'netMargin'
  | 'pvp'
  | 'roe'
  | 'liquidity2m';

export type Direction = 'higher' | 'lower';

/**
 * Shape mutável dos filtros de ações. Os pipelines aceitam qualquer
 * `StockFilterConfig` e usam `STOCK_FILTERS` como default. A UI usa este shape
 * para construir filtros customizados em tempo real.
 */
export interface StockFilterConfig {
  dividendYield: { min: number };
  pl: { min: number; max: number };
  netMargin: { min: number };
  pvp: { max: number };
  roe: { min: number };
  liquidity2m: { min: number };
}

/**
 * Filtros eliminatórios padrão (rules.md). Usados como:
 *   - default do pipeline
 *   - default da UI
 *   - floor da validação (filtros customizados não podem afrouxar abaixo
 *     destes valores; o pré-filtro server-side em /api/stocks usa exatamente
 *     STOCK_FILTERS, então afrouxar deixaria papéis sem enrichment).
 *
 * - Dividend Yield >= 6%
 * - P/L entre 3 e 10 (inclusivo)
 * - Margem Líquida > 10% (exceto bancos, seguradoras e holdings)
 * - P/VP < 10
 * - ROE > 12%
 * - Liquidez 2 meses > 1.000.000
 */
export const STOCK_FILTERS: StockFilterConfig = {
  dividendYield: { min: 0.06 },
  pl: { min: 3, max: 10 },
  netMargin: { min: 0.1 },
  pvp: { max: 10 },
  roe: { min: 0.12 },
  liquidity2m: { min: 1_000_000 },
};

/**
 * Pesos dos indicadores na pontuação final (rules.md). NÃO alterar.
 * Menor pontuação ponderada = melhor posição.
 */
export const STOCK_WEIGHTS: Record<IndicatorKey, number> = {
  roe: 2.0,
  netMargin: 2.0,
  pl: 1.5,
  dividendYield: 1.0,
  pvp: 1.0,
  liquidity2m: 1.0,
};

/**
 * Direção de preferência por indicador (rules.md).
 */
export const STOCK_DIRECTIONS: Record<IndicatorKey, Direction> = {
  dividendYield: 'higher',
  pl: 'lower',
  netMargin: 'higher',
  pvp: 'lower',
  roe: 'higher',
  liquidity2m: 'higher',
};

/**
 * Rótulos em PT-BR usados pela UI e pelos motivos de exclusão.
 */
export const INDICATOR_LABELS: Record<IndicatorKey, string> = {
  dividendYield: 'Dividend Yield',
  pl: 'P/L',
  netMargin: 'Margem Líquida',
  pvp: 'P/VP',
  roe: 'ROE',
  liquidity2m: 'Liquidez 2 meses',
};

export const ALL_INDICATORS: IndicatorKey[] = [
  'roe',
  'netMargin',
  'pl',
  'dividendYield',
  'pvp',
  'liquidity2m',
];

/**
 * Ordem de desempate (rules.md):
 * 1. Maior ROE
 * 2. Maior Dividend Yield
 * 3. Menor P/L
 * 4. Maior Liquidez
 */
export const TIEBREAKER_ORDER: Array<{ key: IndicatorKey; direction: Direction }> = [
  { key: 'roe', direction: 'higher' },
  { key: 'dividendYield', direction: 'higher' },
  { key: 'pl', direction: 'lower' },
  { key: 'liquidity2m', direction: 'higher' },
];
