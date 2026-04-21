/**
 * Tipos do módulo de FIIs. Independentes do módulo de ações (rules_fiis.md
 * exige pipeline próprio e não reutilizar regras/estruturas de ações).
 */

import type { FiiIndicatorKey, FiiSegment } from './config.js';

/**
 * Registro bruto após scraping de fii_resultado.php. Percentuais já em fração
 * decimal (7% → 0.07). Campos ausentes/inválidos aparecem como null.
 */
export interface RawFii {
  ticker: string;
  segment: string | null;
  price: number | null;
  dividendYield: number | null;
  pvp: number | null;
  liquidity: number | null;
  propertyCount: number | null;
  vacancy: number | null;
}

export interface FiiSnapshot {
  timestamp: string;
  fiis: RawFii[];
  /** Total de FIIs lidos de fii_resultado.php antes de qualquer filtro. */
  totalCollected: number;
}

export type FiiRejectionReason = {
  indicator: FiiIndicatorKey | 'segment' | 'propertyCount' | 'data';
  message: string;
};

export interface ClassifiedFii extends RawFii {
  allowedSegment: boolean;
  normalizedSegment: FiiSegment | null;
}

export interface RankedFii extends ClassifiedFii {
  normalizedSegment: FiiSegment;
  /**
   * Score percentil por indicador, em [0, 1] (1 = melhor da coorte).
   * Vacância ausente para Multicategoria (clean exclusion).
   */
  scores: Partial<Record<FiiIndicatorKey, number>>;
  /** Pontuação final ponderada renormalizada, em [0, 1]. Maior = melhor. */
  score: number;
  /** Posição final no ranking (1 = melhor). */
  position: number;
  /** Flags explicativas. */
  flags: string[];
}

export interface RejectedFii extends ClassifiedFii {
  reasons: FiiRejectionReason[];
}

export interface FiiReport {
  timestamp: string;
  totalCollected: number;
  totalAnalyzed: number;
  totalApproved: number;
  /** Top 10 FIIs aprovados (maior score = melhor). */
  top10: RankedFii[];
  /** Todos os FIIs de segmentos elegíveis que foram eliminados pelos filtros. */
  rejected: RejectedFii[];
}
