/**
 * Setup global do Vitest. Roda antes de cada arquivo de teste.
 *
 * Polyfill de localStorage: o ambiente padrão do Vitest é Node, sem APIs do
 * browser. Em vez de adicionar uma dependência (happy-dom/jsdom), provemos
 * um Storage em memória — suficiente para os testes que tocam
 * `src/infra/*` que usam apenas o subset getItem/setItem/removeItem/clear.
 */

class MemoryStorage implements Storage {
  private store = new Map<string, string>();

  get length(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }
}

if (typeof globalThis.localStorage === 'undefined') {
  Object.defineProperty(globalThis, 'localStorage', {
    value: new MemoryStorage(),
    writable: true,
  });
}
