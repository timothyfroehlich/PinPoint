/**
 * Minimal in-memory implementation of the DOM `Storage` interface.
 *
 * jsdom normally provides Web Storage, but on some hosts the unit-test
 * environment surfaces `localStorage` as `undefined` (an opaque-origin or
 * storage-disabled jsdom), so a suite's
 * `beforeEach(() => localStorage.clear())` throws
 * "Cannot read properties of undefined (reading 'clear')". The failure is
 * host-specific (green in CI, red on some Fedora/Bazzite machines) and cost
 * real time to re-diagnose (PP-2s37). `src/test/setup.ts` installs one of
 * these as the global `localStorage` only when a working one is missing, so it
 * can never mask a real implementation. Only `localStorage` is polyfilled — no
 * `src/` test touches `sessionStorage`; extend this the same way if that
 * changes.
 *
 * Backed by a `Map`, so `key(index)` follows insertion order — the guarantee
 * the spec gives.
 */
export function createMemoryStorage(): Storage {
  const store = new Map<string, string>();

  return {
    get length(): number {
      return store.size;
    },
    clear(): void {
      store.clear();
    },
    getItem(key: string): string | null {
      return store.get(key) ?? null;
    },
    key(index: number): string | null {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key: string): void {
      store.delete(key);
    },
    setItem(key: string, value: string): void {
      store.set(key, value);
    },
  };
}

/** Install a fallback only when jsdom does not expose localStorage. */
export function installMemoryStorageIfMissing(): void {
  const hasLocalStorage = ((): boolean => {
    try {
      return globalThis.localStorage != null;
    } catch {
      return false;
    }
  })();

  if (!hasLocalStorage) {
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      writable: true,
      value: createMemoryStorage(),
    });
  }
}
