/**
 * Tabela do Top 10 de FIIs com ordenação por coluna.
 */

import type { RankedFii } from '../../assets/fiis/types.js';
import type { FiiIndicatorKey } from '../../assets/fiis/config.js';
import { formatCurrency, formatDecimal, formatInteger, formatPercent } from '../../utils/number-br.js';
import { normalizeFiiName } from '../../utils/fii-name-normalize.js';
import type { SortDirection, SortState } from '../types.js';

type ColumnKey =
  | 'position'
  | 'ticker'
  | 'name'
  | 'segment'
  | 'price'
  | 'dividendYield'
  | 'pvp'
  | 'liquidity'
  | 'propertyCount'
  | 'vacancy'
  | 'score';

interface Column {
  key: ColumnKey;
  label: string;
  scoreKey?: FiiIndicatorKey;
  get: (f: RankedFii, ctx: ColumnContext) => string | number | null;
  format: (value: unknown) => string;
  numeric: boolean;
}

interface ColumnContext {
  resolvedNames?: Record<string, string | null>;
}

const COLUMNS: Column[] = [
  {
    key: 'position',
    label: '#',
    get: (f) => f.position,
    format: (v) => String(v),
    numeric: true,
  },
  {
    key: 'ticker',
    label: 'Papel',
    get: (f) => f.ticker,
    format: (v) => String(v ?? '—'),
    numeric: false,
  },
  {
    key: 'name',
    label: 'Nome',
    // Normalização puramente visual — o cache continua armazenando o nome
    // completo retornado pelo Fundamentus.
    get: (f, ctx) => ctx.resolvedNames?.[f.ticker] ?? null,
    format: (v) => (v == null || v === '' ? '—' : normalizeFiiName(String(v))),
    numeric: false,
  },
  {
    key: 'segment',
    label: 'Segmento',
    get: (f) => f.normalizedSegment,
    format: (v) => (v == null || v === '' ? '—' : String(v)),
    numeric: false,
  },
  {
    key: 'price',
    label: 'Cotação',
    get: (f) => f.price,
    format: (v) => formatCurrency(v as number | null),
    numeric: true,
  },
  {
    key: 'dividendYield',
    label: 'DY',
    scoreKey: 'dividendYield',
    get: (f) => f.dividendYield,
    format: (v) => formatPercent(v as number | null),
    numeric: true,
  },
  {
    key: 'pvp',
    label: 'P/VP',
    scoreKey: 'pvp',
    get: (f) => f.pvp,
    format: (v) => formatDecimal(v as number | null),
    numeric: true,
  },
  {
    key: 'liquidity',
    label: 'Liquidez',
    scoreKey: 'liquidity',
    get: (f) => f.liquidity,
    format: (v) => formatInteger(v as number | null),
    numeric: true,
  },
  {
    key: 'propertyCount',
    label: 'Qtd imóveis',
    get: (f) => f.propertyCount,
    format: (v) => formatInteger(v as number | null),
    numeric: true,
  },
  {
    key: 'vacancy',
    label: 'Vacância',
    scoreKey: 'vacancy',
    get: (f) => f.vacancy,
    format: (v) => formatPercent(v as number | null),
    numeric: true,
  },
  {
    key: 'score',
    label: 'Pontuação',
    get: (f) => f.score,
    format: (v) =>
      typeof v === 'number' ? `${(v * 100).toFixed(1).replace('.', ',')}%` : '—',
    numeric: true,
  },
];

export interface FiiRankingTableState {
  sort: SortState;
  /** 'top10' mostra "Top 10 FIIs aprovados"; 'all' mostra "Todos os FIIs aprovados (N)". */
  mode?: 'top10' | 'all';
  /**
   * Nomes resolvidos a partir do JSON estático `public/data/fii-names.json`
   * (carregado via `loadFiiNames`). Tickers ausentes mostram "—".
   */
  resolvedNames?: Record<string, string | null>;
}

export function renderFiiRankingTable(
  container: HTMLElement,
  rows: RankedFii[],
  state: FiiRankingTableState,
  onSort: (key: string, direction: SortDirection) => void,
): void {
  const ctx: ColumnContext = { resolvedNames: state.resolvedNames };
  container.innerHTML = '';

  const heading = document.createElement('h2');
  heading.textContent =
    state.mode === 'all'
      ? `Todos os FIIs aprovados (${rows.length})`
      : 'Top 10 FIIs aprovados';
  container.appendChild(heading);

  if (rows.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'muted';
    empty.textContent = 'Nenhum FII aprovado pelos filtros.';
    container.appendChild(empty);
    return;
  }

  const sorted = [...rows].sort((a, b) =>
    compareByKey(a, b, state.sort.key, state.sort.direction, ctx),
  );

  const table = document.createElement('table');
  table.className = 'ranking';
  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  for (const col of COLUMNS) {
    const th = document.createElement('th');
    th.className = col.numeric ? 'numeric' : '';
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'ranking__sort';
    button.textContent = col.label;
    if (state.sort.key === col.key) {
      button.textContent += state.sort.direction === 'asc' ? ' ▲' : ' ▼';
    }
    button.addEventListener('click', () => {
      const nextDir: SortDirection =
        state.sort.key === col.key && state.sort.direction === 'asc' ? 'desc' : 'asc';
      onSort(col.key, nextDir);
    });
    th.appendChild(button);
    headerRow.appendChild(th);
  }
  const thObs = document.createElement('th');
  thObs.textContent = 'Observações';
  headerRow.appendChild(thObs);
  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  for (const row of sorted) {
    const tr = document.createElement('tr');
    tr.className = 'ranking__row ranking__row--top10';
    for (const col of COLUMNS) {
      const td = document.createElement('td');
      td.className = col.numeric ? 'numeric' : '';
      td.textContent = col.format(col.get(row, ctx));

      if (col.scoreKey) {
        const scoreValue = row.scores[col.scoreKey];
        if (scoreValue !== undefined) {
          const badge = document.createElement('span');
          badge.className = 'rank-badge';
          badge.textContent = `${(scoreValue * 100).toFixed(1).replace('.', ',')}%`;
          badge.title = `Percentil do indicador ${col.label} na coorte`;
          td.appendChild(document.createTextNode(' '));
          td.appendChild(badge);
        }
      }

      tr.appendChild(td);
    }

    const tdFlags = document.createElement('td');
    tdFlags.className = 'flags';
    if (row.flags.length === 0) {
      tdFlags.textContent = '—';
    } else {
      for (const flag of row.flags) {
        const chip = document.createElement('span');
        chip.className = 'chip';
        chip.textContent = flag;
        tdFlags.appendChild(chip);
      }
    }
    tr.appendChild(tdFlags);
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  container.appendChild(table);
}

function compareByKey(
  a: RankedFii,
  b: RankedFii,
  key: string,
  direction: SortDirection,
  ctx: ColumnContext,
): number {
  const col = COLUMNS.find((c) => c.key === key);
  if (!col) return 0;
  const av = col.get(a, ctx);
  const bv = col.get(b, ctx);

  const aMissing = av === null || av === '' || (typeof av === 'number' && !Number.isFinite(av));
  const bMissing = bv === null || bv === '' || (typeof bv === 'number' && !Number.isFinite(bv));
  if (aMissing && bMissing) return 0;
  if (aMissing) return 1;
  if (bMissing) return -1;

  let result = 0;
  if (typeof av === 'number' && typeof bv === 'number') {
    result = av - bv;
  } else {
    result = String(av).localeCompare(String(bv), 'pt-BR');
  }
  return direction === 'asc' ? result : -result;
}
