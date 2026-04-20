/**
 * Painel com os FIIs eliminados e os motivos de exclusão.
 */

import type { RejectedFii } from '../../assets/fiis/types.js';

export function renderFiiRejectedPanel(
  container: HTMLElement,
  rejected: RejectedFii[],
): void {
  container.innerHTML = '';

  const details = document.createElement('details');
  details.className = 'panel panel--rejected';
  const summary = document.createElement('summary');
  summary.textContent = `FIIs eliminados (${rejected.length})`;
  details.appendChild(summary);

  if (rejected.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'muted';
    empty.textContent = 'Nenhum FII eliminado nesta execução.';
    details.appendChild(empty);
    container.appendChild(details);
    return;
  }

  const table = document.createElement('table');
  table.className = 'rejected';
  const thead = document.createElement('thead');
  thead.innerHTML = `
    <tr>
      <th>Papel</th>
      <th>Segmento</th>
      <th>Motivos</th>
    </tr>
  `;
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  const sorted = [...rejected].sort((a, b) => a.ticker.localeCompare(b.ticker, 'pt-BR'));
  for (const row of sorted) {
    const tr = document.createElement('tr');
    const cells = [
      row.ticker,
      row.normalizedSegment ?? row.segment ?? '—',
      row.reasons.map((r) => r.message).join(' · '),
    ];
    for (const c of cells) {
      const td = document.createElement('td');
      td.textContent = c;
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  details.appendChild(table);

  container.appendChild(details);
}
