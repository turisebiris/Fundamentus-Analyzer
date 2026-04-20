/**
 * Tipos do módulo de FIIs. Independentes do módulo de ações (rules_fiis.md
 * exige pipeline próprio e não reutilizar regras/estruturas de ações).
 */

import type { FiiIndicatorKey, FiiSegment } from './config.js';

/**
 * Registro bruto após scraping de fii_resultado.php. Percentuais já em fração
 * decimal (7% → 0.07). Campos ausentes/inválidos aparecem como null.
 *
 * rules_fiis.md exige exatamente estas colunas: Papel, Segmento, Cotação,
 * Dividend Yield, P/VP, Liquidez, Qtd de imóveis, Vacância Média.
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

/**
 * FII classificado por segmento. allowedSegment = true indica que o segmento
 * é Logística ou Multicategoria (rules_fiis.md). Os demais são descartados
 * silenciosamente (não entram no painel de eliminados — saem antes do
 * pipeline de ranking).
 */
export interface ClassifiedFii extends RawFii {
  allowedSegment: boolean;
  normalizedSegment: FiiSegment | null;
}

export interface RankedFii extends ClassifiedFii {
  normalizedSegment: FiiSegment;
  ranks: Record<FiiIndicatorKey, number>;
  /** Pontuação ponderada total (menor = melhor). */
  score: number;
  /** Posição final no ranking (1 = melhor). */
  position: number;
  /** Flags explicativas (ex.: "multicategoria — rank neutro em Vacância"). */
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
  ranked: RankedFii[];
  rejected: RejectedFii[];
}
