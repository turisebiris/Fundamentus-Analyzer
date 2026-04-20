/**
 * Shell da aplicação. Gerencia apenas a troca entre as abas
 * "Ações" e "FIIs". Cada aba mantém seu próprio estado (refresh, snapshot,
 * pipeline) em módulos independentes.
 */

import { createStocksView, type StocksViewHandle } from './stocks-view.js';
import { createFiisView, type FiisViewHandle } from './fiis-view.js';

type TabKey = 'stocks' | 'fiis';

interface Tab {
  key: TabKey;
  label: string;
  mount: (host: HTMLElement) => void;
}

export function createApp(root: HTMLElement): void {
  const stocksView: StocksViewHandle = createStocksView();
  const fiisView: FiisViewHandle = createFiisView();

  const tabs: Tab[] = [
    { key: 'stocks', label: 'Ações', mount: (host) => stocksView.mount(host) },
    { key: 'fiis', label: 'FIIs', mount: (host) => fiisView.mount(host) },
  ];

  let active: TabKey = 'stocks';

  renderShell(root);
  renderTabs();
  renderActive();

  function renderShell(el: HTMLElement): void {
    el.innerHTML = `
      <header class="app-header">
        <h1>Fundamentus Analyzer</h1>
        <p class="muted">
          Ranking de ativos brasileiros com dados do Fundamentus. Atualização
          só via botão — sem refresh automático.
        </p>
      </header>
      <nav id="tabs-host" class="tabs" role="tablist"></nav>
      <section id="tab-content" class="tab-content"></section>
    `;
  }

  function renderTabs(): void {
    const host = document.getElementById('tabs-host');
    if (!host) return;
    host.innerHTML = '';
    for (const tab of tabs) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `tab ${active === tab.key ? 'tab--active' : ''}`.trim();
      btn.textContent = tab.label;
      btn.setAttribute('role', 'tab');
      btn.setAttribute('aria-selected', String(active === tab.key));
      btn.addEventListener('click', () => {
        if (active === tab.key) return;
        active = tab.key;
        renderTabs();
        renderActive();
      });
      host.appendChild(btn);
    }
  }

  function renderActive(): void {
    const content = document.getElementById('tab-content');
    if (!content) return;
    // Unmonta ambos antes de montar o ativo, para garantir que só um view
    // esteja ligado ao DOM por vez.
    stocksView.unmount();
    fiisView.unmount();
    const tab = tabs.find((t) => t.key === active)!;
    tab.mount(content);
  }
}
