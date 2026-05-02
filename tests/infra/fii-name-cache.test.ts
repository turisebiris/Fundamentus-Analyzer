import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  loadFiiNameCache,
  saveFiiNameCache,
  getCachedName,
  upsertCachedName,
  clearFiiNameCache,
  trackInFlight,
  __resetInFlightForTests,
} from '../../src/infra/fii-name-cache.js';

const STORAGE_KEY = 'fundamentus-analyzer:fii-names:v1';

beforeEach(() => {
  localStorage.clear();
  __resetInFlightForTests();
});

describe('loadFiiNameCache', () => {
  it('retorna cache vazio quando a chave não existe', () => {
    const cache = loadFiiNameCache();
    expect(cache.version).toBe(1);
    expect(cache.entries).toEqual({});
  });

  it('retorna cache vazio para JSON inválido', () => {
    localStorage.setItem(STORAGE_KEY, '{not valid json');
    const cache = loadFiiNameCache();
    expect(cache.entries).toEqual({});
  });

  it('invalida silenciosamente quando a versão é diferente', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 999,
        entries: { HGLG11: { name: 'Antigo', fetchedAt: '2024-01-01T00:00:00Z' } },
      }),
    );
    const cache = loadFiiNameCache();
    expect(cache.entries).toEqual({});
  });

  it('rejeita shape inválido (entries ausente)', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1 }));
    const cache = loadFiiNameCache();
    expect(cache.entries).toEqual({});
  });

  it('carrega entradas válidas', () => {
    const stored = {
      version: 1,
      entries: {
        HGLG11: { name: 'CSHG Logística FII', fetchedAt: '2026-04-01T00:00:00Z' },
        XPML11: { name: null, fetchedAt: '2026-04-01T00:00:00Z' },
      },
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    const cache = loadFiiNameCache();
    expect(cache.entries.HGLG11).toEqual(stored.entries.HGLG11);
    expect(cache.entries.XPML11).toEqual(stored.entries.XPML11);
  });
});

describe('saveFiiNameCache + round-trip', () => {
  it('persiste e recarrega o mesmo cache', () => {
    const cache = loadFiiNameCache();
    upsertCachedName(cache, 'HGLG11', 'CSHG Logística');
    upsertCachedName(cache, 'XPML11', null);
    saveFiiNameCache(cache);

    const reloaded = loadFiiNameCache();
    expect(getCachedName(reloaded, 'HGLG11')).toBe('CSHG Logística');
    expect(getCachedName(reloaded, 'XPML11')).toBeNull();
  });
});

describe('getCachedName', () => {
  it('undefined para ticker nunca consultado', () => {
    const cache = loadFiiNameCache();
    expect(getCachedName(cache, 'NOVO11')).toBeUndefined();
  });

  it('null para ticker consultado sem nome', () => {
    const cache = loadFiiNameCache();
    upsertCachedName(cache, 'NONOM11', null);
    expect(getCachedName(cache, 'NONOM11')).toBeNull();
  });

  it('string para ticker em cache', () => {
    const cache = loadFiiNameCache();
    upsertCachedName(cache, 'HGLG11', 'CSHG Logística');
    expect(getCachedName(cache, 'HGLG11')).toBe('CSHG Logística');
  });
});

describe('upsertCachedName', () => {
  it('preserva entradas existentes ao adicionar novas', () => {
    const cache = loadFiiNameCache();
    upsertCachedName(cache, 'A11', 'A');
    upsertCachedName(cache, 'B11', 'B');
    expect(getCachedName(cache, 'A11')).toBe('A');
    expect(getCachedName(cache, 'B11')).toBe('B');
  });

  it('sobrescreve quando o mesmo ticker é atualizado', () => {
    const cache = loadFiiNameCache();
    upsertCachedName(cache, 'A11', 'Velho');
    upsertCachedName(cache, 'A11', 'Novo');
    expect(getCachedName(cache, 'A11')).toBe('Novo');
  });

  it('registra fetchedAt como ISO timestamp', () => {
    const cache = loadFiiNameCache();
    upsertCachedName(cache, 'A11', 'Nome');
    const entry = cache.entries.A11;
    expect(entry).toBeDefined();
    expect(typeof entry!.fetchedAt).toBe('string');
    expect(() => new Date(entry!.fetchedAt).toISOString()).not.toThrow();
  });
});

describe('clearFiiNameCache', () => {
  it('remove a chave do localStorage', () => {
    const cache = loadFiiNameCache();
    upsertCachedName(cache, 'A11', 'Nome');
    saveFiiNameCache(cache);
    expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull();
    clearFiiNameCache();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});

describe('trackInFlight', () => {
  it('chama factory uma única vez para o mesmo ticker em paralelo', async () => {
    const factory = vi.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      return 'NomeX';
    });

    const [a, b, c] = await Promise.all([
      trackInFlight('HGLG11', factory),
      trackInFlight('HGLG11', factory),
      trackInFlight('HGLG11', factory),
    ]);

    expect(factory).toHaveBeenCalledTimes(1);
    expect(a).toBe('NomeX');
    expect(b).toBe('NomeX');
    expect(c).toBe('NomeX');
  });

  it('fatorias diferentes para tickers distintos não colidem', async () => {
    const fA = vi.fn(async () => 'A');
    const fB = vi.fn(async () => 'B');

    const [a, b] = await Promise.all([
      trackInFlight('A11', fA),
      trackInFlight('B11', fB),
    ]);

    expect(fA).toHaveBeenCalledTimes(1);
    expect(fB).toHaveBeenCalledTimes(1);
    expect(a).toBe('A');
    expect(b).toBe('B');
  });

  it('libera o ticker após resolver — nova chamada cria nova promise', async () => {
    const factory = vi.fn(async () => 'X');
    await trackInFlight('A11', factory);
    await trackInFlight('A11', factory);
    expect(factory).toHaveBeenCalledTimes(2);
  });

  it('libera o ticker mesmo quando a promise rejeita', async () => {
    const failing = vi.fn(async () => {
      throw new Error('boom');
    });

    await expect(trackInFlight('A11', failing)).rejects.toThrow('boom');
    // após rejeição, a próxima chamada deve disparar a factory novamente
    const succeeding = vi.fn(async () => 'OK');
    const result = await trackInFlight('A11', succeeding);
    expect(result).toBe('OK');
    expect(succeeding).toHaveBeenCalledTimes(1);
  });
});
