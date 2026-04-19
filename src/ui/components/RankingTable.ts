/**
 * Tabela principal do Top 10 com ordenação por coluna.
 */

import type { RankedStock } from '../../core/types.js';
import { formatDecimal, formatInteger, formatPercent } from '../../utils/number-br.js';
import type { SortDirection, SortState } from '../types.js';

type ColumnKey =
  | 'position'
  | 'ticker'
  | 'companyName'
  | 'sector'
  | 'dividendYield'
  | 'pl'
  | 'netMargin'
  | 'pvp'
  | 'roe'
  | 'liquidity2m'
  | 'score';

interface Column {
  key: ColumnKey;
  label: string;
  rankKey?: keyof RankedStock['ranks'];
  get: (s: RankedStock) => string | number | null;
  format: (value: unknown) => string;
  numeric: boolean;
}

const COLUMNS: Column[] = [
  {
    key: 'position',
    label: '#',
    get: (s) => s.position,
    format: (v) => String(v),
    numeric: true,
  },
  {
    key: 'ticker',
    label: 'Ticker',
    get: (s) => s.ticker,
    format: (v) => String(v ?? '—'),
    numeric: false,
  },
  {
    key: 'companyName',
    label: 'Empresa',
    get: (s) => s.companyName,
    format: (v) => (v == null || v === '' ? '—' : String(v)),
    numeric: false,
  },
  {
    key: 'sector',
    label: 'Setor',
    get: (s) => s.sector,
    format: (v) => (v == null || v === '' ? '—' : String(v)),
    numeric: false,
  },
  {
    key: 'dividendYield',
    label: 'DY',
    rankKey: 'dividendYield',
    get: (s) => s.dividendYield,
    format: (v) => formatPercent(v as number | null),
    numeric: true,
  },
  {
    key: 'pl',
    label: 'P/L',
    rankKey: 'pl',
    get: (s) => s.pl,
    format: (v) => formatDecimal(v as number | null),
    numeric: true,
  },
  {
    key: 'netMargin',
    label: 'Margem Líq.',
    rankKey: 'netMargin',
    get: (s) => s.netMargin,
    format: (v) => formatPercent(v as number | null),
    numeric: true,
  },
  {
    key: 'pvp',
    label: 'P/VP',
    rankKey: 'pvp',
    get: (s) => s.pvp,
    format: (v) => formatDecimal(v as number | null),
    numeric: true,
  },
  {
    key: 'roe',
    label: 'ROE',
    rankKey: 'roe',
    get: (s) => s.roe,
    format: (v) => formatPercent(v as number | null),
    numeric: true,
  },
  {
    key: 'liquidity2m',
    label: 'Liquidez 2m',
    rankKey: 'liquidity2m',
    get: (s) => s.liquidity2m,
    format: (v) => formatInteger(v as number | null),
    numeric: true,
  },
  {
    key: 'score',
    label: 'Pontuação',
    get: (s) => s.score,
    format: (v) => (typeof v === 'number' ? v.toFixed(2).replace('.', ',') : '—'),
    numeric: true,
  },
];

export interface RankingTableState {
  sort: SortState;
}

export function renderRankingTable(
  container: HTMLElement,
  rows: RankedStock[],
  state: RankingTableState,
  onSort: (key: string, direction: SortDirection) => void,
): void {
  container.innerHTML = '';

  const heading = document.createElement('h2');
  heading.textContent = 'Top 10 ações aprovadas';
  container.appendChild(heading);

  if (rows.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'muted';
    empty.textContent = 'Nenhuma ação aprovada pelos filtros.';
    container.appendChild(empty);
    return;
  }

  const sorted = [...rows].sort((a, b) => compareByKey(a, b, state.sort.key, state.sort.direction));

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
  // Coluna de flags (sem ordenação)
  const thFlags = document.createElement('th');
  thFlags.textContent = 'Observações';
  headerRow.appendChild(thFlags);

  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  for (const row of sorted) {
    const tr = document.createElement('tr');
    tr.className = 'ranking__row ranking__row--top10';
    for (const col of COLUMNS) {
      const td = document.createElement('td');
      td.className = col.numeric ? 'numeric' : '';
      td.textContent = col.format(col.get(row));

      if (col.rankKey) {
        const rankValue = row.ranks[col.rankKey];
        const rankSpan = document.createElement('span');
        rankSpan.className = 'rank-badge';
        rankSpan.textContent = `rank ${formatRank(rankValue)}`;
        rankSpan.title = `Rank ordinal do indicador ${col.label}`;
        td.appendChild(document.createTextNode(' '));
        td.appendChild(rankSpan);
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
  a: RankedStock,
  b: RankedStock,
  key: string,
  direction: SortDirection,
): number {
  const col = COLUMNS.find((c) => c.key === key);
  if (!col) return 0;
  const av = col.get(a);
  const bv = col.get(b);

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

function formatRank(rank: number): string {
  if (Number.isInteger(rank)) return String(rank);
  return rank.toFixed(2).replace('.', ',');
}
