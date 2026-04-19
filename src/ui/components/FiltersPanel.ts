/**
 * Painel que lista os filtros eliminatórios aplicados (rules.md).
 * Exibição estática com base em STOCK_FILTERS.
 */

import { STOCK_FILTERS, STOCK_WEIGHTS } from '../../shared/stocks/config.js';

export function renderFiltersPanel(container: HTMLElement): void {
  container.innerHTML = '';

  const details = document.createElement('details');
  details.className = 'panel';
  const summary = document.createElement('summary');
  summary.textContent = 'Filtros aplicados e pesos';
  details.appendChild(summary);

  const list = document.createElement('ul');
  list.className = 'panel__list';
  list.innerHTML = `
    <li>Dividend Yield ≥ ${pct(STOCK_FILTERS.dividendYield.min)}</li>
    <li>P/L entre ${STOCK_FILTERS.pl.min} e ${STOCK_FILTERS.pl.max}</li>
    <li>Margem Líquida &gt; ${pct(STOCK_FILTERS.netMargin.min)} <em>(exceto bancos)</em></li>
    <li>P/VP &lt; ${STOCK_FILTERS.pvp.max}</li>
    <li>ROE &gt; ${pct(STOCK_FILTERS.roe.min)}</li>
    <li>Liquidez 2 meses &gt; ${new Intl.NumberFormat('pt-BR').format(STOCK_FILTERS.liquidity2m.min)}</li>
  `;
  details.appendChild(list);

  const weights = document.createElement('div');
  weights.className = 'panel__weights';
  weights.innerHTML = `
    <strong>Pesos (menor pontuação = melhor):</strong>
    ROE ${STOCK_WEIGHTS.roe.toFixed(1)} · Margem Líquida ${STOCK_WEIGHTS.netMargin.toFixed(1)} ·
    P/L ${STOCK_WEIGHTS.pl.toFixed(1)} · Dividend Yield ${STOCK_WEIGHTS.dividendYield.toFixed(1)} ·
    P/VP ${STOCK_WEIGHTS.pvp.toFixed(1)} · Liquidez ${STOCK_WEIGHTS.liquidity2m.toFixed(1)}
  `;
  details.appendChild(weights);

  container.appendChild(details);
}

function pct(fraction: number): string {
  return `${(fraction * 100).toFixed(0)}%`;
}
