/**
 * Painel interativo de filtros eliminatórios das ações (rules.md).
 *
 * Estado interno (closure-local por render):
 *   currentDraft   — último draft válido (inicia em props.draft)
 *   erroredFields  — Set de IDs com erro de validação ativo
 *   applyButton    — referência direta para mutação de .disabled sem re-render
 *
 * Fluxo:
 *   input válido   → atualiza currentDraft, chama onChange, recomputa Apply
 *   input inválido → adiciona ao erroredFields, bloqueia Apply (sem onChange)
 *   Aplicar/Enter  → chama onApply apenas se botão habilitado
 *   Resetar        → chama onReset (view recria o painel com defaults)
 */

import {
  STOCK_FILTERS,
  STOCK_WEIGHTS,
  type StockFilterConfig,
} from '../../shared/stocks/config.js';

export interface FiltersPanelProps {
  draft: StockFilterConfig;
  active: StockFilterConfig;
  modified: boolean;
  onChange: (next: StockFilterConfig) => void;
  onApply: () => void;
  onReset: () => void;
}

const STOCK_FLOORS = {
  dividendYieldMin: STOCK_FILTERS.dividendYield.min,
  plMin: STOCK_FILTERS.pl.min,
  plMax: STOCK_FILTERS.pl.max,
  pvpMax: STOCK_FILTERS.pvp.max,
  roeMin: STOCK_FILTERS.roe.min,
  liquidity2mMin: STOCK_FILTERS.liquidity2m.min,
} as const;

const STOCK_CEILINGS = {
  dividendYieldMin: 0.5,
  plMin: STOCK_FILTERS.pl.max,
  plMax: 50,
  pvpMax: 100,
  roeMin: 1.0,
  liquidity2mMin: 1e9,
} as const;

interface FieldSpec {
  id: string;
  label: string;
  unit: 'percent' | 'ratio' | 'integer';
  step: number;
  read: (f: StockFilterConfig) => number;
  floor: number;
  ceiling: number;
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

function draftsEqual(a: StockFilterConfig, b: StockFilterConfig): boolean {
  return (
    a.dividendYield.min === b.dividendYield.min &&
    a.pl.min === b.pl.min &&
    a.pl.max === b.pl.max &&
    a.netMargin.min === b.netMargin.min &&
    a.pvp.max === b.pvp.max &&
    a.roe.min === b.roe.min &&
    a.liquidity2m.min === b.liquidity2m.min
  );
}

export function renderFiltersPanel(container: HTMLElement, props: FiltersPanelProps): void {
  container.innerHTML = '';

  // Closure-local editing state — survives keystrokes between renders.
  let currentDraft = props.draft;
  const erroredFields = new Set<string>();

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

  // Apply button is created before fields so updateApplyState can reference it.
  const applyButton = document.createElement('button');
  applyButton.type = 'button';
  applyButton.className = 'filter-apply';
  applyButton.textContent = 'Aplicar filtros';

  function updateApplyState(): void {
    const hasErrors = erroredFields.size > 0;
    const hasPending = !draftsEqual(currentDraft, props.active);
    applyButton.disabled = !hasPending || hasErrors;
    applyButton.title = hasErrors ? 'Corrija os campos inválidos para aplicar' : '';
  }

  applyButton.addEventListener('click', () => {
    if (!applyButton.disabled) props.onApply();
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!applyButton.disabled) props.onApply();
  });

  for (const spec of FIELDS) {
    const wrapper = document.createElement('div');
    wrapper.className = 'filter-field';

    const label = document.createElement('label');
    label.htmlFor = spec.id;
    label.textContent = spec.label;
    wrapper.appendChild(label);

    const input = document.createElement('input');
    input.type = 'number';
    input.id = spec.id;
    input.step = String(spec.step);
    input.value = formatForInput(spec, spec.read(props.draft));
    input.min = String(toInputUnits(spec, spec.floor));
    input.max = String(toInputUnits(spec, spec.ceiling));
    if (spec.unit === 'percent') input.setAttribute('data-unit', '%');
    wrapper.appendChild(input);

    const errorSlot = document.createElement('span');
    errorSlot.className = 'filter-field__error';
    errorSlot.setAttribute('aria-live', 'polite');
    wrapper.appendChild(errorSlot);

    const markError = (msg: string) => {
      showError(input, errorSlot, msg);
      erroredFields.add(spec.id);
      updateApplyState();
    };

    input.addEventListener('input', () => {
      const raw = input.value.trim();
      if (raw === '') { markError('Valor obrigatório'); return; }

      const parsed = Number(raw.replace(',', '.'));
      if (!Number.isFinite(parsed)) { markError('Número inválido'); return; }

      const normalized = fromInputUnits(spec, parsed);
      if (normalized < spec.floor) {
        markError(`Mínimo permitido: ${formatForInput(spec, spec.floor)}`);
        return;
      }
      if (normalized > spec.ceiling) {
        markError(`Máximo permitido: ${formatForInput(spec, spec.ceiling)}`);
        return;
      }

      const next = spec.apply(currentDraft, normalized);
      if (next === null) {
        markError('Inconsistente com outro campo (ex: P/L mín > máx)');
        return;
      }

      clearError(input, errorSlot);
      erroredFields.delete(spec.id);
      currentDraft = next;
      props.onChange(next);
      updateApplyState();
    });

    form.appendChild(wrapper);
  }

  const actions = document.createElement('div');
  actions.className = 'filters-form__actions';
  updateApplyState();
  actions.appendChild(applyButton);

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

function showError(input: HTMLInputElement, slot: HTMLElement, message: string): void {
  input.classList.add('filter-field__input--error');
  slot.textContent = message;
}

function clearError(input: HTMLInputElement, slot: HTMLElement): void {
  input.classList.remove('filter-field__input--error');
  slot.textContent = '';
}

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
