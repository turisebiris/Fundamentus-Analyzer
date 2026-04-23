/**
 * View da aba de FIIs. Pipeline independente do módulo de ações
 * (rules_fiis.md): fetch próprio (/api/fiis), snapshot em chave separada,
 * regras próprias (config/pipeline de FIIs). NÃO reaproveita regras de ações.
 */

import { fetchFiis } from '../infra/api.js';
import { loadFiiSnapshot, saveFiiSnapshot } from '../infra/storage.js';
import { runFiiPipeline } from '../assets/fiis/pipeline.js';
import type { FiiReport, FiiSnapshot } from '../assets/fiis/types.js';
import { renderRefreshButton } from './components/RefreshButton.js';
import { renderFiiRankingTable } from './components/FiiRankingTable.js';
import { renderFiiFiltersPanel } from './components/FiiFiltersPanel.js';
import { renderFiiRejectedPanel } from './components/FiiRejectedPanel.js';
import type { RefreshState, SortDirection, SortState } from './types.js';

type DisplayMode = 'top10' | 'all';

interface FiisViewState {
  refresh: RefreshState;
  error: string | null;
  snapshot: FiiSnapshot | null;
  report: FiiReport | null;
  sort: SortState;
  displayMode: DisplayMode;
}

export interface FiisViewHandle {
  mount(root: HTMLElement): void;
  unmount(): void;
}

export function createFiisView(): FiisViewHandle {
  const state: FiisViewState = {
    refresh: 'idle',
    error: null,
    snapshot: null,
    report: null,
    sort: { key: 'position', direction: 'asc' },
    displayMode: 'top10',
  };

  const initial = loadFiiSnapshot();
  if (initial) {
    state.snapshot = initial;
    try {
      state.report = runFiiPipeline(initial);
      state.refresh = 'success';
    } catch (err) {
      state.error = err instanceof Error ? err.message : String(err);
      state.refresh = 'error';
    }
  }

  let root: HTMLElement | null = null;

  function layout(): void {
    if (!root) return;
    root.innerHTML = `
      <section id="fiis-refresh-host"></section>
      <section id="fiis-error-host"></section>
      <section id="fiis-summary-host"></section>
      <section id="fiis-filters-host"></section>
      <section id="fiis-toggle-host"></section>
      <section id="fiis-ranking-host"></section>
      <section id="fiis-rejected-host"></section>
      <footer class="app-footer">
        <p class="muted">
          Maior pontuação = melhor. Somente Logística e Multicategoria são analisados.
          Vacância excluída para Multicategoria (clean exclusion, pesos renormalizados).
          Qtd de imóveis é filtro apenas — não entra no ranking.
        </p>
      </footer>
    `;
  }

  async function handleRefresh(): Promise<void> {
    state.refresh = 'fetching';
    state.error = null;
    render();
    try {
      const snapshot = await fetchFiis();
      state.snapshot = snapshot;
      state.report = runFiiPipeline(snapshot);
      state.refresh = 'success';
      saveFiiSnapshot(snapshot);
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
    const refreshHost = root.querySelector<HTMLElement>('#fiis-refresh-host');
    const summaryHost = root.querySelector<HTMLElement>('#fiis-summary-host');
    const filtersHost = root.querySelector<HTMLElement>('#fiis-filters-host');
    const toggleHost = root.querySelector<HTMLElement>('#fiis-toggle-host');
    const rankingHost = root.querySelector<HTMLElement>('#fiis-ranking-host');
    const rejectedHost = root.querySelector<HTMLElement>('#fiis-rejected-host');
    const errorHost = root.querySelector<HTMLElement>('#fiis-error-host');
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

    renderFiiFiltersPanel(filtersHost);

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
          <span><strong>${totalAnalyzed}</strong> FIIs analisados</span>
          <span><strong>${totalApproved}</strong> aprovados</span>
          <span><strong>${rejected.length}</strong> reprovados</span>
          <span>Exibindo <strong>${exhibiting}</strong> de <strong>${totalApproved}</strong> aprovados</span>
          <span>Coletados do Fundamentus: <strong>${totalCollected}</strong></span>
        </div>
      `;

      renderToggle(toggleHost, {
        mode: state.displayMode,
        totalApproved,
        disabled: totalApproved <= 10,
        onClick: handleToggleDisplay,
      });

      renderFiiRankingTable(
        rankingHost,
        rows,
        { sort: state.sort, mode: state.displayMode },
        handleSort,
      );
      renderFiiRejectedPanel(rejectedHost, rejected);
    } else {
      summaryHost.innerHTML = '';
      toggleHost.innerHTML = '';
      rankingHost.innerHTML =
        '<p class="muted">Clique em “Atualizar dados” para coletar FIIs do Fundamentus.</p>';
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
