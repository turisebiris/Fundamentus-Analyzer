/**
 * Tabela do ranking de FIIs com ordenação por coluna. Colunas conforme
 * rules_fiis.md (saída do relatório).
 */

import type { RankedFii } from '../../assets/fiis/types.js';
import { formatDecimal, formatInteger, formatPercent } from '../../utils/number-br.js';
import type { SortDirection, SortState } from '../types.js';

type ColumnKey =
  | 'position'
  | 'ticker'
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
  rankKey?: keyof RankedFii['ranks'];
  get: (f: RankedFii) => string | number | null;
  format: (value: unknown) => string;
  numeric: boolean;
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
    format: (v) => formatDecimal(v as number | null),
    numeric: true,
  },
  {
    key: 'dividendYield',
    label: 'DY',
    rankKey: 'dividendYield',
    get: (f) => f.dividendYield,
    format: (v) => formatPercent(v as number | null),
    numeric: true,
  },
  {
    key: 'pvp',
    label: 'P/VP',
    rankKey: 'pvp',
    get: (f) => f.pvp,
    format: (v) => formatDecimal(v as number | null),
    numeric: true,
  },
  {
    key: 'liquidity',
    label: 'Liquidez',
    rankKey: 'liquidity',
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
    rankKey: 'vacancy',
    get: (f) => f.vacancy,
    format: (v) => formatPercent(v as number | null),
    numeric: true,
  },
  {
    key: 'score',
    label: 'Pontuação',
    get: (f) => f.score,
    format: (v) => (typeof v === 'number' ? v.toFixed(2).replace('.', ',') : '—'),
    numeric: true,
  },
];

export interface FiiRankingTableState {
  sort: SortState;
}

export function renderFiiRankingTable(
  container: HTMLElement,
  rows: RankedFii[],
  state: FiiRankingTableState,
  onSort: (key: string, direction: SortDirection) => void,
): void {
  container.innerHTML = '';

  const heading = document.createElement('h2');
  heading.textContent = `Ranking de FIIs aprovados (${rows.length})`;
  container.appendChild(heading);

  if (rows.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'muted';
    empty.textContent = 'Nenhum FII aprovado pelos filtros.';
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
  a: RankedFii,
  b: RankedFii,
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
