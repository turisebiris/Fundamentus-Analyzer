/**
 * Painel interativo de filtros eliminatórios das ações (rules.md).
 *
 * O usuário ajusta thresholds em tempo real; cada mudança válida dispara
 * `onChange(filters)` na view, que recalcula o pipeline com os novos valores.
 *
 * Validação:
 *   - Cada campo tem um floor (mínimo permitido) e um ceiling (máximo permitido).
 *   - Filtros de ações NÃO podem afrouxar abaixo de STOCK_FILTERS — esses são
 *     os mesmos thresholds usados pelo pré-filtro server-side em /api/stocks.
 *     Afrouxar deixaria papéis sem enrichment de setor/subsetor, quebrando a
 *     classificação de banco/seguradora/holding.
 *   - Em vez de clamp silencioso, valores inválidos exibem erro inline e NÃO
 *     são aplicados ao pipeline (o último valor válido permanece em vigor).
 */

import {
  STOCK_FILTERS,
  STOCK_WEIGHTS,
  type StockFilterConfig,
} from '../../shared/stocks/config.js';

export interface FiltersPanelProps {
  current: StockFilterConfig;
  modified: boolean;
  onChange: (next: StockFilterConfig) => void;
  onReset: () => void;
}

/**
 * Floors e ceilings (mínimos e máximos absolutos por campo). Para ações, os
 * floors coincidem com STOCK_FILTERS — usuário pode apenas tighten.
 */
const STOCK_FLOORS = {
  dividendYieldMin: STOCK_FILTERS.dividendYield.min,   // ≥ 0.06
  plMin: STOCK_FILTERS.pl.min,                          // ≥ 3
  plMax: STOCK_FILTERS.pl.max,                          // ≤ 10
  pvpMax: STOCK_FILTERS.pvp.max,                        // ≤ 10
  roeMin: STOCK_FILTERS.roe.min,                        // ≥ 0.12
  liquidity2mMin: STOCK_FILTERS.liquidity2m.min,        // ≥ 1_000_000
} as const;

/** Ceilings de sanidade (acima disso o filtro perde sentido prático). */
const STOCK_CEILINGS = {
  dividendYieldMin: 0.5,     // 50%
  plMin: STOCK_FILTERS.pl.max,    // não pode ultrapassar pl.max
  plMax: 50,
  pvpMax: 100,
  roeMin: 1.0,               // 100%
  liquidity2mMin: 1e9,       // 1B
} as const;

interface FieldSpec {
  id: string;
  label: string;
  unit: 'percent' | 'ratio' | 'integer';
  step: number;
  /** Lê o valor numérico do filtro atual. */
  read: (f: StockFilterConfig) => number;
  /** Floor absoluto (não pode ir abaixo). */
  floor: number;
  /** Ceiling absoluto (não pode ir acima). */
  ceiling: number;
  /**
   * Aplica um novo valor a uma cópia do filtro. Pode aplicar regras de
   * coerência (ex: pl.min não pode ultrapassar pl.max). Retorna `null` se o
   * valor for inconsistente com OUTROS campos (não com floor/ceiling — esses
   * são tratados pelo input antes).
   */
  apply: (f: StockFilterConfig, value: number) => StockFilterConfig | null;
}

const FIELDS: FieldSpec[] = [
  {
    id: 'dy-min',
    label: 'DY mínimo',
    unit: 'percent',
    step: 0.5,
    read: (f) => f.dividendYield.min,
    floor: STOCK_FLOORS.dividendYieldMin,
    ceiling: STOCK_CEILINGS.dividendYieldMin,
    apply: (f, v) => ({ ...f, dividendYield: { min: v } }),
  },
  {
    id: 'pl-min',
    label: 'P/L mínimo',
    unit: 'ratio',
    step: 0.5,
    read: (f) => f.pl.min,
    floor: STOCK_FLOORS.plMin,
    ceiling: STOCK_CEILINGS.plMin,
    apply: (f, v) => (v > f.pl.max ? null : { ...f, pl: { ...f.pl, min: v } }),
  },
  {
    id: 'pl-max',
    label: 'P/L máximo',
    unit: 'ratio',
    step: 0.5,
    read: (f) => f.pl.max,
    floor: STOCK_FLOORS.plMin,
    ceiling: STOCK_FLOORS.plMax,
    apply: (f, v) => (v < f.pl.min ? null : { ...f, pl: { ...f.pl, max: v } }),
  },
  {
    id: 'pvp-max',
    label: 'P/VP máximo',
    unit: 'ratio',
    step: 0.5,
    read: (f) => f.pvp.max,
    floor: 0.5,
    ceiling: STOCK_FLOORS.pvpMax,
    apply: (f, v) => ({ ...f, pvp: { max: v } }),
  },
  {
    id: 'roe-min',
    label: 'ROE mínimo',
    unit: 'percent',
    step: 0.5,
    read: (f) => f.roe.min,
    floor: STOCK_FLOORS.roeMin,
    ceiling: STOCK_CEILINGS.roeMin,
    apply: (f, v) => ({ ...f, roe: { min: v } }),
  },
  {
    id: 'liq2m-min',
    label: 'Liquidez 2m mínima',
    unit: 'integer',
    step: 100_000,
    read: (f) => f.liquidity2m.min,
    floor: STOCK_FLOORS.liquidity2mMin,
    ceiling: STOCK_CEILINGS.liquidity2mMin,
    apply: (f, v) => ({ ...f, liquidity2m: { min: v } }),
  },
];

export function renderFiltersPanel(container: HTMLElement, props: FiltersPanelProps): void {
  container.innerHTML = '';

  const details = document.createElement('details');
  details.className = 'panel';
  details.open = true;

  const summary = document.createElement('summary');
  summary.append('Filtros e pesos');
  if (props.modified) {
    const badge = document.createElement('span');
    badge.className = 'badge--modified';
    badge.textContent = 'Filtros personalizados ativos';
    summary.append(' ', badge);
  }
  details.appendChild(summary);

  const form = document.createElement('form');
  form.className = 'filters-form';
  form.addEventListener('submit', (e) => e.preventDefault());

  for (const spec of FIELDS) {
    form.appendChild(buildField(spec, props));
  }

  const actions = document.createElement('div');
  actions.className = 'filters-form__actions';

  const reset = document.createElement('button');
  reset.type = 'button';
  reset.className = 'filter-reset';
  reset.textContent = 'Restaurar padrões';
  reset.disabled = !props.modified;
  reset.addEventListener('click', () => props.onReset());
  actions.appendChild(reset);

  form.appendChild(actions);
  details.appendChild(form);

  const note = document.createElement('div');
  note.className = 'panel__weights';
  note.innerHTML = `
    <strong>Pontuação [0–100%] — maior = melhor.</strong>
    Score por indicador via normalização min-max (clipping P5/P95 na coorte).
    Pesos: ROE ${STOCK_WEIGHTS.roe.toFixed(1)} · ML ${STOCK_WEIGHTS.netMargin.toFixed(1)} ·
    P/L ${STOCK_WEIGHTS.pl.toFixed(1)} · DY ${STOCK_WEIGHTS.dividendYield.toFixed(1)} ·
    P/VP ${STOCK_WEIGHTS.pvp.toFixed(1)} · Liquidez ${STOCK_WEIGHTS.liquidity2m.toFixed(1)}.
    Bancos, seguradoras e holdings: ML excluída; pesos renormalizados automaticamente.
  `;
  details.appendChild(note);

  const footnote = document.createElement('p');
  footnote.className = 'muted filters-form__footnote';
  footnote.textContent =
    'Filtros customizados aplicam-se ao snapshot já carregado — sem novo scraping. ' +
    'Limites de afrouxamento existem porque ações fora dos thresholds padrão não são ' +
    'enriquecidas pelo servidor (sem setor/subsetor).';
  details.appendChild(footnote);

  container.appendChild(details);
}

function buildField(spec: FieldSpec, props: FiltersPanelProps): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'filter-field';

  const label = document.createElement('label');
  label.htmlFor = spec.id;
  label.textContent = spec.label;
  wrapper.appendChild(label);

  const input = document.createElement('input');
  input.type = 'number';
  input.id = spec.id;
  input.step = spec.unit === 'percent' ? String(spec.step) : String(spec.step);
  input.value = formatForInput(spec, spec.read(props.current));
  input.min = String(toInputUnits(spec, spec.floor));
  input.max = String(toInputUnits(spec, spec.ceiling));
  if (spec.unit === 'percent') input.setAttribute('data-unit', '%');
  wrapper.appendChild(input);

  const error = document.createElement('span');
  error.className = 'filter-field__error';
  error.setAttribute('aria-live', 'polite');
  wrapper.appendChild(error);

  input.addEventListener('input', () => {
    const raw = input.value.trim();
    if (raw === '') {
      showError(input, error, 'Valor obrigatório');
      return;
    }

    const parsed = Number(raw.replace(',', '.'));
    if (!Number.isFinite(parsed)) {
      showError(input, error, 'Número inválido');
      return;
    }

    const normalized = fromInputUnits(spec, parsed);

    if (normalized < spec.floor) {
      showError(input, error, `Mínimo permitido: ${formatForInput(spec, spec.floor)}`);
      return;
    }
    if (normalized > spec.ceiling) {
      showError(input, error, `Máximo permitido: ${formatForInput(spec, spec.ceiling)}`);
      return;
    }

    const next = spec.apply(props.current, normalized);
    if (next === null) {
      showError(input, error, 'Inconsistente com outro campo (ex: P/L mín > máx)');
      return;
    }

    clearError(input, error);
    props.onChange(next);
  });

  return wrapper;
}

function showError(input: HTMLInputElement, slot: HTMLElement, message: string): void {
  input.classList.add('filter-field__input--error');
  slot.textContent = message;
}

function clearError(input: HTMLInputElement, slot: HTMLElement): void {
  input.classList.remove('filter-field__input--error');
  slot.textContent = '';
}

/** Converte valor interno (ex: 0.06 para DY) para unidade exibida no input (6). */
function toInputUnits(spec: FieldSpec, value: number): number {
  return spec.unit === 'percent' ? round(value * 100, 1) : value;
}

function fromInputUnits(spec: FieldSpec, raw: number): number {
  return spec.unit === 'percent' ? raw / 100 : raw;
}

function formatForInput(spec: FieldSpec, value: number): string {
  if (spec.unit === 'percent') return String(round(value * 100, 1));
  if (spec.unit === 'integer') return String(Math.round(value));
  return String(round(value, 2));
}

function round(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
