// localStorage, hand-rolled twenty-seven times across six features — with three competing
// key conventions (`fui:*`, `fieldui-*`, `fieldui:*`). One helper, one prefix, graceful
// private-mode degradation, and legacy-key migration so existing visitors keep their state.

const PREFIX = "fui:";

export interface Persisted<T> {
  get(): T;
  set(value: T): void;
  clear(): void;
}

/**
 * A JSON-serialized localStorage slot under the canonical `fui:` prefix. Reads fall back to
 * `fallback` on absence, parse failure, or storage unavailability (private mode degrades to
 * in-memory session behavior — `set` simply stops persisting). `legacyKeys` are consulted
 * once on first read and migrated forward, so renamed keys keep their users' state.
 */
export function persisted<T>(key: string, fallback: T, opts?: { legacyKeys?: string[] }): Persisted<T> {
  const full = PREFIX + key;
  let memory = fallback;
  let migrated = false;
  const read = (k: string): T | undefined => {
    try {
      const raw = localStorage.getItem(k);
      return raw == null ? undefined : (JSON.parse(raw) as T);
    } catch {
      return undefined;
    }
  };
  return {
    get(): T {
      const own = read(full);
      if (own !== undefined) return (memory = own);
      if (!migrated && opts?.legacyKeys) {
        migrated = true;
        for (const legacy of opts.legacyKeys) {
          const old = read(legacy);
          if (old !== undefined) {
            this.set(old);
            try {
              localStorage.removeItem(legacy);
            } catch {
              /* best effort */
            }
            return (memory = old);
          }
        }
      }
      return memory;
    },
    set(value: T): void {
      memory = value;
      try {
        localStorage.setItem(full, JSON.stringify(value));
      } catch {
        /* private mode — in-memory only */
      }
    },
    clear(): void {
      memory = fallback;
      try {
        localStorage.removeItem(full);
      } catch {
        /* ignore */
      }
    },
  };
}
