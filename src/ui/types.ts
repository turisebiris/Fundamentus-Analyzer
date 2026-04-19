export type RefreshState = 'idle' | 'fetching' | 'success' | 'error';

export type SortDirection = 'asc' | 'desc';

export interface SortState {
  key: string;
  direction: SortDirection;
}
