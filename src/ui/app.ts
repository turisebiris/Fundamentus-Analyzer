/**
 * Shell da aplicação. Gerencia estado de atualização e renderização.
 * Coleta só acontece via botão "Atualizar dados" (rules.md).
 */

import { fetchStocks } from '../infra/api.js';
import { loadSnapshot, saveSnapshot } from '../infra/storage.js';
import { runPipeline } from '../core/pipeline.js';
import type { Report, StockSnapshot } from '../core/types.js';
import { renderRefreshButton } from './components/RefreshButton.js';
import { renderRankingTable } from './components/RankingTable.js';
import { renderFiltersPanel } from './components/FiltersPanel.js';
import { renderRejectedPanel } from './components/RejectedPanel.js';
import type { RefreshState, SortDirection, SortState } from './types.js';

interface AppState {
  refresh: RefreshState;
  error: string | null;
  snapshot: StockSnapshot | null;
  report: Report | null;
  sort: SortState;
}

export function createApp(root: HTMLElement): void {
  const state: AppState = {
    refresh: 'idle',
    error: null,
    snapshot: null,
    report: null,
    sort: { key: 'position', direction: 'asc' },
  };

  const initial = loadSnapshot();
  if (initial) {
    state.snapshot = initial;
    state.report = runPipeline(initial);
    state.refresh = 'success';
  }

  renderLayout(root);
  render();

  async function handleRefresh(): Promise<void> {
    state.refresh = 'fetching';
    state.error = null;
    render();
    try {
      const snapshot = await fetchStocks();
      state.snapshot = snapshot;
      state.report = runPipeline(snapshot);
      state.refresh = 'success';
      saveSnapshot(snapshot);
    } catch (err) {
      state.refresh = 'error';
      state.error = err instanceof Error ? err.message : String(err);
    } finally {
      render();
    }
  }

  function render(): void {
    const refreshHost = document.getElementById('refresh-host')!;
    const summaryHost = document.getElementById('summary-host')!;
    const filtersHost = document.getElementById('filters-host')!;
    const rankingHost = document.getElementById('ranking-host')!;
    const rejectedHost = document.getElementById('rejected-host')!;
    const errorHost = document.getElementById('error-host')!;

    renderRefreshButton(refreshHost, {
      state: state.refresh,
      timestamp: state.snapshot?.timestamp ?? null,
      onClick: handleRefresh,
    });

    renderFiltersPanel(filtersHost);

    if (state.error) {
      errorHost.innerHTML = '';
      const box = document.createElement('div');
      box.className = 'error-box';
      box.textContent = state.error;
      errorHost.appendChild(box);
    } else {
      errorHost.innerHTML = '';
    }

    if (state.report) {
      summaryHost.innerHTML = `
        <div class="summary">
          <span><strong>${state.report.totalAnalyzed}</strong> ações analisadas</span>
          <span><strong>${state.report.totalApproved}</strong> aprovadas nos filtros</span>
          <span>Coletadas do Fundamentus: <strong>${state.report.totalCollected}</strong></span>
        </div>
      `;
      renderRankingTable(rankingHost, state.report.top10, { sort: state.sort }, handleSort);
      renderRejectedPanel(rejectedHost, state.report.rejected);
    } else {
      summaryHost.innerHTML = '';
      rankingHost.innerHTML =
        '<p class="muted">Clique em “Atualizar dados” para coletar do Fundamentus.</p>';
      rejectedHost.innerHTML = '';
    }
  }

  function handleSort(key: string, direction: SortDirection): void {
    state.sort = { key, direction };
    render();
  }
}

function renderLayout(root: HTMLElement): void {
  root.innerHTML = `
    <header class="app-header">
      <h1>Fundamentus Analyzer</h1>
      <p class="muted">
        Ranking de ações brasileiras com dados do Fundamentus. Atualização só
        via botão — sem refresh automático.
      </p>
    </header>
    <section id="refresh-host"></section>
    <section id="error-host"></section>
    <section id="summary-host"></section>
    <section id="filters-host"></section>
    <section id="ranking-host"></section>
    <section id="rejected-host"></section>
    <footer class="app-footer">
      <p class="muted">
        Menor pontuação = melhor. Bancos ignoram o filtro de Margem Líquida e
        recebem rank médio neutro no indicador.
      </p>
    </footer>
  `;
}
