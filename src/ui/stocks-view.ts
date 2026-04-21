/**
 * View da aba de ações. Mantém todo o comportamento anterior (atualização
 * manual, snapshot persistido, ranking + eliminados) isolado para conviver
 * com a aba de FIIs sob o mesmo shell.
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

interface StocksViewState {
  refresh: RefreshState;
  error: string | null;
  snapshot: StockSnapshot | null;
  report: Report | null;
  sort: SortState;
}

export interface StocksViewHandle {
  mount(root: HTMLElement): void;
  unmount(): void;
}

export function createStocksView(): StocksViewHandle {
  const state: StocksViewState = {
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

  let root: HTMLElement | null = null;

  function layout(): void {
    if (!root) return;
    root.innerHTML = `
      <section id="stocks-refresh-host"></section>
      <section id="stocks-error-host"></section>
      <section id="stocks-summary-host"></section>
      <section id="stocks-filters-host"></section>
      <section id="stocks-ranking-host"></section>
      <section id="stocks-rejected-host"></section>
      <footer class="app-footer">
        <p class="muted">
          Maior pontuação = melhor. Score por indicador via normalização min-max
          com clipping P5/P95. Bancos: Margem Líquida excluída do cálculo;
          pesos renormalizados automaticamente.
        </p>
      </footer>
    `;
  }

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

  function handleSort(key: string, direction: SortDirection): void {
    state.sort = { key, direction };
    render();
  }

  function render(): void {
    if (!root) return;
    const refreshHost = root.querySelector<HTMLElement>('#stocks-refresh-host');
    const summaryHost = root.querySelector<HTMLElement>('#stocks-summary-host');
    const filtersHost = root.querySelector<HTMLElement>('#stocks-filters-host');
    const rankingHost = root.querySelector<HTMLElement>('#stocks-ranking-host');
    const rejectedHost = root.querySelector<HTMLElement>('#stocks-rejected-host');
    const errorHost = root.querySelector<HTMLElement>('#stocks-error-host');
    if (!refreshHost || !summaryHost || !filtersHost || !rankingHost || !rejectedHost || !errorHost) {
      return;
    }

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

  return {
    mount(el) {
      root = el;
      layout();
      render();
    },
    unmount() {
      if (root) root.innerHTML = '';
      root = null;
    },
  };
}
