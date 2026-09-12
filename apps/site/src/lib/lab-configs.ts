/**
 * Lab saved configs (#694) — the pure, DOM-free store behind the Tune panel's "Saved configs"
 * list: save the current force + tune overrides with a tag (good / bad / edge) and a free-text
 * note; list, load, delete. Persisted through lib/persisted.ts under `fui:lab-configs` — the
 * one storage slot this module owns. The page (`pages/lab.astro`) owns the DOM, the overrides
 * and the re-run; this module owns the record shape, the validation and the cap, so those are
 * unit-testable without a browser (the same split as `field-probe.ts`).
 *
 * A config carries exactly the Lab's shareable state — the override keys `buildHash()` puts in
 * the URL — never the transient `frames` the free-run mode grows, so loading one reproduces
 * what the share link would.
 */
import { persisted, type Persisted } from './persisted.ts';

/** storage key (under the `fui:` prefix → `localStorage["fui:lab-configs"]`) */
export const LAB_CONFIGS_KEY = 'lab-configs';

export const CONFIG_TAGS = ['good', 'bad', 'edge'] as const;
export type ConfigTag = (typeof CONFIG_TAGS)[number];

/** the override keys a config carries — mirrors `buildHash()` in lab.astro; never `frames` */
export const CONFIG_KEYS = [
  'strength', 'range', 'spin', 'angle', 'box', 'absorbR', 'vx', 'vy', 'count', 'seed', 'placement',
] as const;

/** the list cap — the oldest entry is dropped once a save would exceed it */
export const MAX_SAVED = 50;
/** the note is trimmed and truncated to this many characters */
export const NOTE_MAX = 200;

export interface SavedConfig {
  id: string;
  force: string;
  tag: ConfigTag;
  note: string;
  overrides: Record<string, number | string>;
  savedAt: number;
}

export interface LabConfigStore {
  v: 1;
  items: SavedConfig[];
}

export interface SaveInput {
  force: string;
  tag?: ConfigTag | string;
  note?: string;
  overrides: Record<string, unknown>;
}

export interface LabConfigs {
  /** newest first — always re-read from the store (another tab may have written) */
  list(): SavedConfig[];
  save(input: SaveInput): SavedConfig;
  /** true when an entry with that id existed and was deleted */
  remove(id: string): boolean;
  clear(): void;
}

export function isConfigTag(x: unknown): x is ConfigTag {
  return typeof x === 'string' && (CONFIG_TAGS as readonly string[]).includes(x);
}

const isPlainObject = (x: unknown): x is Record<string, unknown> =>
  typeof x === 'object' && x !== null && !Array.isArray(x);

/**
 * The persistable subset of the Lab's overrides: CONFIG_KEYS only, finite numbers (so a NaN or
 * a null never lands in storage), `placement` kept as its string mode. Everything else —
 * `frames`, unknown keys — is dropped.
 */
export function pickConfig(overrides: Record<string, unknown>): SavedConfig['overrides'] {
  const out: SavedConfig['overrides'] = {};
  for (const k of CONFIG_KEYS) {
    const v = overrides[k];
    if (k === 'placement') {
      if (typeof v === 'string' && v) out[k] = v;
    } else if (typeof v === 'number' && Number.isFinite(v)) {
      out[k] = v;
    }
  }
  return out;
}

/** one-line description for a list row — `strength=2.2 · range=450`, or `defaults` */
export function summarize(cfg: Pick<SavedConfig, 'overrides'>): string {
  const parts: string[] = [];
  for (const k of CONFIG_KEYS) if (cfg.overrides[k] != null) parts.push(`${k}=${cfg.overrides[k]}`);
  return parts.length ? parts.join(' · ') : 'defaults';
}

/**
 * Whatever JSON came out of storage → a well-formed store. `persisted().get()` does no shape
 * validation, so a corrupt, foreign or hand-edited value must never reach the page: a non-store
 * collapses to empty, and each item is kept only when its id/force are non-empty strings, its
 * tag is one of CONFIG_TAGS and its overrides is a plain object (re-picked through pickConfig).
 */
export function sanitizeStore(raw: unknown): LabConfigStore {
  if (!isPlainObject(raw) || !Array.isArray(raw.items)) return { v: 1, items: [] };
  const items: SavedConfig[] = [];
  for (const it of raw.items) {
    if (!isPlainObject(it)) continue;
    if (typeof it.id !== 'string' || !it.id) continue;
    if (typeof it.force !== 'string' || !it.force) continue;
    if (!isConfigTag(it.tag)) continue;
    if (!isPlainObject(it.overrides)) continue;
    items.push({
      id: it.id,
      force: it.force,
      tag: it.tag,
      note: typeof it.note === 'string' ? it.note.slice(0, NOTE_MAX) : '',
      overrides: pickConfig(it.overrides),
      savedAt: typeof it.savedAt === 'number' && Number.isFinite(it.savedAt) ? it.savedAt : 0,
    });
  }
  return { v: 1, items };
}

const EMPTY: LabConfigStore = { v: 1, items: [] };

/**
 * The store API over a `Persisted<LabConfigStore>` slot. Defaults to the real `fui:lab-configs`
 * slot; tests inject an in-memory fake. `now` and `max` are injectable for the same reason.
 */
export function createLabConfigs(
  store: Persisted<LabConfigStore> = persisted<LabConfigStore>(LAB_CONFIGS_KEY, EMPTY),
  opts: { now?: () => number; max?: number } = {},
): LabConfigs {
  const now = opts.now ?? (() => Date.now());
  const max = Math.max(1, opts.max ?? MAX_SAVED);
  let counter = 0;
  const read = (): LabConfigStore => sanitizeStore(store.get());
  return {
    list: () => read().items,
    save(input) {
      const savedAt = now();
      // time-ordered, unique within this instance (counter) and across tabs (random suffix)
      const id = `${savedAt.toString(36)}-${(counter++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;
      const cfg: SavedConfig = {
        id,
        force: String(input.force),
        tag: isConfigTag(input.tag) ? input.tag : 'good',
        note: (input.note ?? '').trim().slice(0, NOTE_MAX),
        overrides: pickConfig(input.overrides ?? {}),
        savedAt,
      };
      store.set({ v: 1, items: [cfg, ...read().items].slice(0, max) });
      return cfg;
    },
    remove(id) {
      const items = read().items;
      const next = items.filter((c) => c.id !== id);
      if (next.length === items.length) return false;
      store.set({ v: 1, items: next });
      return true;
    },
    clear() {
      store.clear();
    },
  };
}
