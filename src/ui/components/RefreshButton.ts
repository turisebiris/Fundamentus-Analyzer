import type { RefreshState } from '../types.js';

export interface RefreshButtonProps {
  state: RefreshState;
  timestamp: string | null;
  onClick: () => void;
}

export function renderRefreshButton(container: HTMLElement, props: RefreshButtonProps): void {
  container.innerHTML = '';

  const wrap = document.createElement('div');
  wrap.className = 'refresh';

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'refresh__btn';
  btn.textContent = props.state === 'fetching' ? 'Atualizando…' : 'Atualizar dados';
  btn.disabled = props.state === 'fetching';
  btn.addEventListener('click', props.onClick);
  wrap.appendChild(btn);

  const info = document.createElement('span');
  info.className = 'refresh__info';
  info.textContent = props.timestamp
    ? `Última atualização: ${formatTimestamp(props.timestamp)}`
    : 'Nunca atualizado — clique em “Atualizar dados”.';
  wrap.appendChild(info);

  container.appendChild(wrap);
}

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'medium',
  }).format(date);
}
