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

type DisplayMode = 'top10' | 'all';

interface StocksViewState {
  refresh: RefreshState;
  error: string | null;
  snapshot: StockSnapshot | null;
  report: Report | null;
  sort: SortState;
  /** Top 10 por padrão; 'all' mostra a lista completa de aprovados. */
  displayMode: DisplayMode;
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
    displayMode: 'top10',
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
      <section id="stocks-toggle-host"></section>
      <section id="stocks-ranking-host"></section>
      <section id="stocks-rejected-host"></section>
      <footer class="app-footer">
        <p class="muted">
          Maior pontuação = melhor. Score por indicador via normalização min-max
          com clipping P5/P95. Bancos, seguradoras e holdings: Margem Líquida
          excluída do cálculo; pesos renormalizados automaticamente.
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

  function handleToggleDisplay(): void {
    state.displayMode = state.displayMode === 'top10' ? 'all' : 'top10';
    render();
  }

  function render(): void {
    if (!root) return;
    const refreshHost = root.querySelector<HTMLElement>('#stocks-refresh-host');
    const summaryHost = root.querySelector<HTMLElement>('#stocks-summary-host');
    const filtersHost = root.querySelector<HTMLElement>('#stocks-filters-host');
    const toggleHost = root.querySelector<HTMLElement>('#stocks-toggle-host');
    const rankingHost = root.querySelector<HTMLElement>('#stocks-ranking-host');
    const rejectedHost = root.querySelector<HTMLElement>('#stocks-rejected-host');
    const errorHost = root.querySelector<HTMLElement>('#stocks-error-host');
    if (
      !refreshHost || !summaryHost || !filtersHost || !toggleHost ||
      !rankingHost || !rejectedHost || !errorHost
    ) {
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
      const { totalAnalyzed, totalApproved, totalCollected, approved, rejected, top10 } =
        state.report;
      const rows = state.displayMode === 'all' ? approved : top10;
      const exhibiting = rows.length;

      summaryHost.innerHTML = `
        <div class="summary">
          <span><strong>${totalAnalyzed}</strong> ações analisadas</span>
          <span><strong>${totalApproved}</strong> aprovadas</span>
          <span><strong>${rejected.length}</strong> reprovadas</span>
          <span>Exibindo <strong>${exhibiting}</strong> de <strong>${totalApproved}</strong> aprovadas</span>
          <span>Coletadas do Fundamentus: <strong>${totalCollected}</strong></span>
        </div>
      `;

      renderToggle(toggleHost, {
        mode: state.displayMode,
        totalApproved,
        disabled: totalApproved <= 10,
        onClick: handleToggleDisplay,
      });

      renderRankingTable(
        rankingHost,
        rows,
        { sort: state.sort, mode: state.displayMode },
        handleSort,
      );
      renderRejectedPanel(rejectedHost, rejected);
    } else {
      summaryHost.innerHTML = '';
      toggleHost.innerHTML = '';
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

interface ToggleProps {
  mode: DisplayMode;
  totalApproved: number;
  disabled: boolean;
  onClick: () => void;
}

function renderToggle(host: HTMLElement, props: ToggleProps): void {
  host.innerHTML = '';
  if (props.totalApproved === 0) return;

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'toggle-display';
  btn.textContent =
    props.mode === 'top10'
      ? `Mostrar todos os aprovados (${props.totalApproved})`
      : 'Mostrar apenas Top 10';
  btn.disabled = props.disabled;
  if (props.disabled) {
    btn.title = 'Menos de 10 aprovados — tudo já está exibido.';
  }
  btn.addEventListener('click', props.onClick);
  host.appendChild(btn);
}
