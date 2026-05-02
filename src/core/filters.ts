/**
 * Filtros eliminatórios do módulo de ações (rules.md).
 *
 * Ordem exigida:
 *   1. Classificar cada papel como banco (via setor/subsetor) ANTES de avaliar
 *      o filtro de Margem Líquida.
 *   2. Aplicar todos os filtros numéricos. Para bancos, o critério de Margem
 *      Líquida é ignorado; os demais continuam sendo avaliados normalmente.
 */

import type { RawStock, ClassifiedStock, RejectedStock, RejectionReason } from './types.js';
import { STOCK_FILTERS, INDICATOR_LABELS, type StockFilterConfig } from '../shared/stocks/config.js';
import { classifyCompanyType } from '../utils/company-type.js';

export interface FilterOutcome {
  approved: ClassifiedStock[];
  rejected: RejectedStock[];
}

export function classifyAndFilter(
  stocks: RawStock[],
  filters: StockFilterConfig = STOCK_FILTERS,
): FilterOutcome {
  const approved: ClassifiedStock[] = [];
  const rejected: RejectedStock[] = [];

  for (const raw of stocks) {
    const classified: ClassifiedStock = {
      ...raw,
      ...classifyCompanyType({ sector: raw.sector, subsector: raw.subsector }),
    };

    const reasons = collectRejections(classified, filters);
    if (reasons.length > 0) {
      rejected.push({ ...classified, reasons });
    } else {
      approved.push(classified);
    }
  }

  return { approved, rejected };
}

function collectRejections(
  stock: ClassifiedStock,
  filters: StockFilterConfig,
): RejectionReason[] {
  const reasons: RejectionReason[] = [];

  // Dividend Yield >= mínimo configurado
  if (stock.dividendYield === null) {
    reasons.push(missingReason('dividendYield'));
  } else if (stock.dividendYield < filters.dividendYield.min) {
    reasons.push({
      indicator: 'dividendYield',
      message: `${INDICATOR_LABELS.dividendYield} abaixo de ${pct(filters.dividendYield.min)}`,
    });
  }

  // P/L dentro do intervalo configurado (inclusivo)
  if (stock.pl === null) {
    reasons.push(missingReason('pl'));
  } else if (stock.pl < filters.pl.min || stock.pl > filters.pl.max) {
    reasons.push({
      indicator: 'pl',
      message: `${INDICATOR_LABELS.pl} fora do intervalo ${filters.pl.min} a ${filters.pl.max}`,
    });
  }

  // Margem Líquida > mínimo configurado (exceto bancos, seguradoras e
  // holdings — clean exclusion: ML não é comparável para esses tipos, então
  // nem o filtro nem o scoring aplicam).
  //
  // Só aplicamos o filtro quando o papel foi enriquecido com setor/subsetor.
  // Papéis não-enriquecidos são aqueles já excluídos pelo pré-filtro
  // server-side por OUTRO critério (DY, P/L, P/VP, ROE ou Liquidez); sem
  // setor, não dá para confirmar tipo de empresa. Nesse caso, suprimir o motivo
  // de ML evita ruído indevido no painel de eliminados sem alterar o núcleo
  // do ranking (o papel já foi eliminado pelo motivo real).
  const enriched = stock.sector !== null || stock.subsector !== null;
  const mlApplies = !stock.isBank && !stock.isInsurer && !stock.isHolding;
  if (mlApplies && enriched) {
    if (stock.netMargin === null) {
      reasons.push(missingReason('netMargin'));
    } else if (stock.netMargin <= filters.netMargin.min) {
      reasons.push({
        indicator: 'netMargin',
        message: `${INDICATOR_LABELS.netMargin} não supera ${pct(filters.netMargin.min)}`,
      });
    }
  }

  // P/VP < máximo configurado
  if (stock.pvp === null) {
    reasons.push(missingReason('pvp'));
  } else if (stock.pvp >= filters.pvp.max) {
    reasons.push({
      indicator: 'pvp',
      message: `${INDICATOR_LABELS.pvp} igual ou acima de ${filters.pvp.max}`,
    });
  }

  // ROE > mínimo configurado
  if (stock.roe === null) {
    reasons.push(missingReason('roe'));
  } else if (stock.roe <= filters.roe.min) {
    reasons.push({
      indicator: 'roe',
      message: `${INDICATOR_LABELS.roe} não supera ${pct(filters.roe.min)}`,
    });
  }

  // Liquidez 2 meses > mínimo configurado
  if (stock.liquidity2m === null) {
    reasons.push(missingReason('liquidity2m'));
  } else if (stock.liquidity2m <= filters.liquidity2m.min) {
    reasons.push({
      indicator: 'liquidity2m',
      message: `${INDICATOR_LABELS.liquidity2m} não supera ${formatInteger(filters.liquidity2m.min)}`,
    });
  }

  return reasons;
}

function pct(fraction: number): string {
  const value = fraction * 100;
  return Number.isInteger(value) ? `${value}%` : `${value.toFixed(1).replace('.', ',')}%`;
}

function formatInteger(n: number): string {
  return new Intl.NumberFormat('pt-BR').format(n);
}

function missingReason(indicator: keyof typeof INDICATOR_LABELS): RejectionReason {
  return {
    indicator,
    message: `${INDICATOR_LABELS[indicator]} ausente ou inválido`,
  };
}
