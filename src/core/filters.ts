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
import { STOCK_FILTERS, INDICATOR_LABELS } from '../shared/stocks/config.js';
import { isBank } from '../utils/bank-detect.js';

export interface FilterOutcome {
  approved: ClassifiedStock[];
  rejected: RejectedStock[];
}

export function classifyAndFilter(stocks: RawStock[]): FilterOutcome {
  const approved: ClassifiedStock[] = [];
  const rejected: RejectedStock[] = [];

  for (const raw of stocks) {
    const classified: ClassifiedStock = {
      ...raw,
      isBank: isBank({ sector: raw.sector, subsector: raw.subsector }),
    };

    const reasons = collectRejections(classified);
    if (reasons.length > 0) {
      rejected.push({ ...classified, reasons });
    } else {
      approved.push(classified);
    }
  }

  return { approved, rejected };
}

function collectRejections(stock: ClassifiedStock): RejectionReason[] {
  const reasons: RejectionReason[] = [];

  // Dividend Yield >= 6%
  if (stock.dividendYield === null) {
    reasons.push(missingReason('dividendYield'));
  } else if (stock.dividendYield < STOCK_FILTERS.dividendYield.min) {
    reasons.push({
      indicator: 'dividendYield',
      message: `${INDICATOR_LABELS.dividendYield} abaixo de 6%`,
    });
  }

  // P/L entre 3 e 10 (inclusivo)
  if (stock.pl === null) {
    reasons.push(missingReason('pl'));
  } else if (stock.pl < STOCK_FILTERS.pl.min || stock.pl > STOCK_FILTERS.pl.max) {
    reasons.push({
      indicator: 'pl',
      message: `${INDICATOR_LABELS.pl} fora do intervalo 3 a 10`,
    });
  }

  // Margem Líquida > 10%  (exceto bancos — identificados ANTES deste filtro)
  if (!stock.isBank) {
    if (stock.netMargin === null) {
      reasons.push(missingReason('netMargin'));
    } else if (stock.netMargin <= STOCK_FILTERS.netMargin.min) {
      reasons.push({
        indicator: 'netMargin',
        message: `${INDICATOR_LABELS.netMargin} não supera 10%`,
      });
    }
  }

  // P/VP < 10
  if (stock.pvp === null) {
    reasons.push(missingReason('pvp'));
  } else if (stock.pvp >= STOCK_FILTERS.pvp.max) {
    reasons.push({
      indicator: 'pvp',
      message: `${INDICATOR_LABELS.pvp} igual ou acima de 10`,
    });
  }

  // ROE > 12%
  if (stock.roe === null) {
    reasons.push(missingReason('roe'));
  } else if (stock.roe <= STOCK_FILTERS.roe.min) {
    reasons.push({
      indicator: 'roe',
      message: `${INDICATOR_LABELS.roe} não supera 12%`,
    });
  }

  // Liquidez 2 meses > 1.000.000
  if (stock.liquidity2m === null) {
    reasons.push(missingReason('liquidity2m'));
  } else if (stock.liquidity2m <= STOCK_FILTERS.liquidity2m.min) {
    reasons.push({
      indicator: 'liquidity2m',
      message: `${INDICATOR_LABELS.liquidity2m} não supera 1.000.000`,
    });
  }

  return reasons;
}

function missingReason(indicator: keyof typeof INDICATOR_LABELS): RejectionReason {
  return {
    indicator,
    message: `${INDICATOR_LABELS[indicator]} ausente ou inválido`,
  };
}
