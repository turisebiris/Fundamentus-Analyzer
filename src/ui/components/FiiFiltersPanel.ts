/**
 * Painel interativo de filtros eliminatórios dos FIIs (rules_fiis.md).
 *
 * Diferença em relação a ações: NÃO existe pré-filtro server-side de FIIs
 * (a serverless retorna a lista bruta inteira), então os floors são apenas
 * bounds de sanidade — usuário pode afrouxar livremente.
 */

import {
  FII_FILTERS,
  FII_WEIGHTS,
  type FiiFilterConfig,
} from '../../assets/fiis/config.js';

export interface FiiFiltersPanelProps {
  current: FiiFilterConfig;
  modified: boolean;
  onChange: (next: FiiFilterConfig) => void;
  onReset: () => void;
}

interface FieldSpec {
  id: string;
  label: string;
  unit: 'percent' | 'ratio' | 'integer';
  step: number;
  read: (f: FiiFilterConfig) => number;
  floor: number;
  ceiling: number;
  apply: (f: FiiFilterConfig, value: number) => FiiFilterConfig | null;
  hint?: string;
}

const FIELDS: FieldSpec[] = [
  {
    id: 'fii-dy-min',
    label: 'DY mínimo',
    unit: 'percent',
    step: 0.5,
    read: (f) => f.dividendYield.min,
    floor: 0,
    ceiling: 0.5,
    apply: (f, v) => ({ ...f, dividendYield: { min: v } }),
  },
  {
    id: 'fii-liq-min',
    label: 'Liquidez mínima',
    unit: 'integer',
    step: 50_000,
    read: (f) => f.liquidity.min,
    floor: 0,
    ceiling: 100_000_000,
    apply: (f, v) => ({ ...f, liquidity: { min: v } }),
  },
  {
    id: 'fii-pvp-min',
    label: 'P/VP mínimo',
    unit: 'ratio',
    step: 0.1,
    read: (f) => f.pvp.min,
    floor: 0,
    ceiling: 5,
    apply: (f, v) => (v > f.pvp.max ? null : { ...f, pvp: { ...f.pvp, min: v } }),
  },
  {
    id: 'fii-pvp-max',
    label: 'P/VP máximo',
    unit: 'ratio',
    step: 0.1,
    read: (f) => f.pvp.max,
    floor: 0.1,
    ceiling: 5,
    apply: (f, v) => (v < f.pvp.min ? null : { ...f, pvp: { ...f.pvp, max: v } }),
  },
  {
    id: 'fii-vac-max',
    label: 'Vacância máxima (Logística)',
    unit: 'percent',
    step: 1,
    read: (f) => f.vacancy.max,
    floor: 0,
    ceiling: 1,
    apply: (f, v) => ({ ...f, vacancy: { max: v } }),
    hint: 'Aplicado apenas a FIIs de Logística.',
  },
  {
    id: 'fii-prop-min',
    label: 'Qtd imóveis mínima (Logística)',
    unit: 'integer',
    step: 1,
    read: (f) => f.propertyCount.min,
    floor: 0,
    ceiling: 100,
    apply: (f, v) => ({ ...f, propertyCount: { min: v } }),
    hint: 'Aplicado apenas a FIIs de Logística. Filtro puro — não entra no ranking.',
  },
];

export function renderFiiFiltersPanel(
  container: HTMLElement,
  props: FiiFiltersPanelProps,
): void {
  container.innerHTML = '';

  const details = document.createElement('details');
  details.className = 'panel';
  details.open = true;

  const summary = document.createElement('summary');
  summary.append('Filtros e pesos (FIIs)');
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
    Pesos: P/VP ${FII_WEIGHTS.pvp.toFixed(1)} · DY ${FII_WEIGHTS.dividendYield.toFixed(1)} ·
    Vacância ${FII_WEIGHTS.vacancy.toFixed(1)} · Liquidez ${FII_WEIGHTS.liquidity.toFixed(1)}.
    Qtd de imóveis é filtro apenas (não entra no ranking).
    Multicategoria: Vacância excluída; pesos renormalizados automaticamente.
  `;
  details.appendChild(note);

  // Defaults exibidos como referência
  const ref = document.createElement('p');
  ref.className = 'muted filters-form__footnote';
  ref.textContent =
    `Padrões: DY ≥ ${pct(FII_FILTERS.dividendYield.min)}, ` +
    `Liq ≥ ${formatInteger(FII_FILTERS.liquidity.min)}, ` +
    `P/VP ∈ [${decimal(FII_FILTERS.pvp.min)}; ${decimal(FII_FILTERS.pvp.max)}], ` +
    `Vacância ≤ ${pct(FII_FILTERS.vacancy.max)} (Log.), ` +
    `Qtd imóveis > ${FII_FILTERS.propertyCount.min} (Log.).`;
  details.appendChild(ref);

  container.appendChild(details);
}

function buildField(spec: FieldSpec, props: FiiFiltersPanelProps): HTMLElement {
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
  input.value = formatForInput(spec, spec.read(props.current));
  input.min = String(toInputUnits(spec, spec.floor));
  input.max = String(toInputUnits(spec, spec.ceiling));
  if (spec.unit === 'percent') input.setAttribute('data-unit', '%');
  wrapper.appendChild(input);

  if (spec.hint) {
    const hint = document.createElement('small');
    hint.className = 'filter-field__hint';
    hint.textContent = spec.hint;
    wrapper.appendChild(hint);
  }

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
      showError(input, error, 'Inconsistente com outro campo (ex: P/VP mín > máx)');
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

function pct(fraction: number): string {
  return `${(fraction * 100).toFixed(0)}%`;
}

function decimal(n: number): string {
  return n.toFixed(1).replace('.', ',');
}

function formatInteger(n: number): string {
  return new Intl.NumberFormat('pt-BR').format(n);
}
