import type { IndicatorKey } from '../shared/stocks/config.js';

/**
 * Registro bruto vindo do scraping de resultado.php + enriquecimento de detalhes.php.
 * Valores numéricos já normalizados (percentuais em fração decimal: 6% => 0.06).
 * Campos ausentes/inválidos aparecem como null.
 */
export interface RawStock {
  ticker: string;
  price: number | null;
  dividendYield: number | null;
  pl: number | null;
  netMargin: number | null;
  pvp: number | null;
  roe: number | null;
  liquidity2m: number | null;
  companyName: string | null;
  sector: string | null;
  subsector: string | null;
}

export interface StockSnapshot {
  timestamp: string;
  stocks: RawStock[];
  /** Quantidade total de papéis coletados do resultado.php (antes de qualquer filtro). */
  totalCollected: number;
}

export type RejectionReason = {
  indicator: IndicatorKey | 'data';
  message: string;
};

export interface ClassifiedStock extends RawStock {
  isBank: boolean;
}

export interface RankedStock extends ClassifiedStock {
  /**
   * Score percentil por indicador, em [0, 1] (1 = melhor da coorte).
   * Indicadores não-aplicáveis (ex.: ML para bancos) estão ausentes.
   */
  scores: Partial<Record<IndicatorKey, number>>;
  /** Pontuação final ponderada renormalizada, em [0, 1]. Maior = melhor. */
  score: number;
  /** Posição final no ranking (1 = melhor). */
  position: number;
  /** Flags explicativas (ex.: "ML não aplicável (banco)"). */
  flags: string[];
}

export interface RejectedStock extends ClassifiedStock {
  reasons: RejectionReason[];
}

export interface Report {
  timestamp: string;
  totalCollected: number;
  totalAnalyzed: number;
  totalApproved: number;
  top10: RankedStock[];
  rejected: RejectedStock[];
}
