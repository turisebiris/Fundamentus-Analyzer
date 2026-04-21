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

interface FiisViewState {
  refresh: RefreshState;
  error: string | null;
  snapshot: FiiSnapshot | null;
  report: FiiReport | null;
  sort: SortState;
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

  function render(): void {
    if (!root) return;
    const refreshHost = root.querySelector<HTMLElement>('#fiis-refresh-host');
    const summaryHost = root.querySelector<HTMLElement>('#fiis-summary-host');
    const filtersHost = root.querySelector<HTMLElement>('#fiis-filters-host');
    const rankingHost = root.querySelector<HTMLElement>('#fiis-ranking-host');
    const rejectedHost = root.querySelector<HTMLElement>('#fiis-rejected-host');
    const errorHost = root.querySelector<HTMLElement>('#fiis-error-host');
    if (!refreshHost || !summaryHost || !filtersHost || !rankingHost || !rejectedHost || !errorHost) {
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
      summaryHost.innerHTML = `
        <div class="summary">
          <span><strong>${state.report.totalAnalyzed}</strong> FIIs analisados</span>
          <span><strong>${state.report.totalApproved}</strong> aprovados nos filtros</span>
          <span>Coletados do Fundamentus: <strong>${state.report.totalCollected}</strong></span>
        </div>
      `;
      renderFiiRankingTable(rankingHost, state.report.top10, state.report.totalApproved, { sort: state.sort }, handleSort);
      renderFiiRejectedPanel(rejectedHost, state.report.rejected);
    } else {
      summaryHost.innerHTML = '';
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
