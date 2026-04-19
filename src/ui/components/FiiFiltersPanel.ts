/**
 * Painel que lista os filtros eliminatórios aplicados ao módulo FIIs
 * (rules_fiis.md). Exibição estática baseada em FII_FILTERS.
 */

import { FII_FILTERS, FII_WEIGHTS } from '../../assets/fiis/config.js';

export function renderFiiFiltersPanel(container: HTMLElement): void {
  container.innerHTML = '';

  const details = document.createElement('details');
  details.className = 'panel';
  const summary = document.createElement('summary');
  summary.textContent = 'Filtros aplicados e pesos (FIIs)';
  details.appendChild(summary);

  const list = document.createElement('ul');
  list.className = 'panel__list';
  list.innerHTML = `
    <li>Segmento ∈ {Logística, Multicategoria}</li>
    <li>Dividend Yield ≥ ${pct(FII_FILTERS.dividendYield.min)}</li>
    <li>Liquidez ≥ ${new Intl.NumberFormat('pt-BR').format(FII_FILTERS.liquidity.min)}</li>
    <li>P/VP entre ${fmt(FII_FILTERS.pvp.min)} e ${fmt(FII_FILTERS.pvp.max)}</li>
    <li>Qtd de imóveis &gt; ${FII_FILTERS.propertyCount.min} <em>(somente Logística)</em></li>
    <li>Vacância Média ≤ ${pct(FII_FILTERS.vacancy.max)} <em>(somente Logística)</em></li>
  `;
  details.appendChild(list);

  const weights = document.createElement('div');
  weights.className = 'panel__weights';
  weights.innerHTML = `
    <strong>Pesos (menor pontuação = melhor):</strong>
    P/VP ${FII_WEIGHTS.pvp.toFixed(1)} · Dividend Yield ${FII_WEIGHTS.dividendYield.toFixed(1)} ·
    Vacância ${FII_WEIGHTS.vacancy.toFixed(1)} · Liquidez ${FII_WEIGHTS.liquidity.toFixed(1)}
    · <span class="muted">Qtd de imóveis é filtro apenas — não entra no ranking.</span>
  `;
  details.appendChild(weights);

  container.appendChild(details);
}

function pct(fraction: number): string {
  return `${(fraction * 100).toFixed(0)}%`;
}

function fmt(value: number): string {
  return value.toFixed(1).replace('.', ',');
}
