/**
 * Lab saved configs (#694) — the store's contract, run against an in-memory fake of the
 * `Persisted` slot that round-trips through JSON (so the test has no dependency on a Node
 * `localStorage` global and exercises the same serialisation the browser does).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Persisted } from './persisted.ts';
import {
  createLabConfigs, pickConfig, sanitizeStore, summarize, isConfigTag,
  CONFIG_KEYS, NOTE_MAX, MAX_SAVED, LAB_CONFIGS_KEY,
  type LabConfigStore,
} from './lab-configs.ts';

/** a JSON-round-tripping fake of persisted(): `raw` is what "localStorage" holds */
function fakeStore(initial?: string): Persisted<LabConfigStore> & { raw: string | undefined } {
  const fallback: LabConfigStore = { v: 1, items: [] };
  const s = {
    raw: initial,
    get(): LabConfigStore {
      if (s.raw == null) return fallback;
      try { return JSON.parse(s.raw) as LabConfigStore; } catch { return fallback; }
    },
    set(v: LabConfigStore) { s.raw = JSON.stringify(v); },
    clear() { s.raw = undefined; },
  };
  return s;
}

const ticking = (start = 1_000) => { let t = start; return () => (t += 1_000); };

test('save → list is newest first, stamped with the injected clock', () => {
  const store = createLabConfigs(fakeStore(), { now: ticking() });
  const a = store.save({ force: 'attract', overrides: { strength: 2.2 } });
  const b = store.save({ force: 'swirl', overrides: { spin: -1 } });
  const items = store.list();
  assert.equal(items.length, 2);
  assert.deepEqual(items.map((c) => c.id), [b.id, a.id]);
  assert.equal(items[0]!.savedAt, 3_000);
  assert.equal(items[1]!.savedAt, 2_000);
  assert.notEqual(a.id, b.id);
  assert.deepEqual(items[1]!.overrides, { strength: 2.2 });
});

test('tag defaults to good; an invalid tag is coerced to good', () => {
  const store = createLabConfigs(fakeStore());
  assert.equal(store.save({ force: 'attract', overrides: {} }).tag, 'good');
  assert.equal(store.save({ force: 'attract', tag: 'bogus', overrides: {} }).tag, 'good');
  assert.equal(store.save({ force: 'attract', tag: 'edge', overrides: {} }).tag, 'edge');
  assert.equal(store.save({ force: 'attract', tag: 'bad', overrides: {} }).tag, 'bad');
  assert.ok(isConfigTag('good') && isConfigTag('bad') && isConfigTag('edge'));
  assert.ok(!isConfigTag('great') && !isConfigTag(1) && !isConfigTag(null));
});

test('note is trimmed and truncated to NOTE_MAX; missing note is empty', () => {
  const store = createLabConfigs(fakeStore());
  assert.equal(store.save({ force: 'attract', note: '  overshoots  ', overrides: {} }).note, 'overshoots');
  assert.equal(store.save({ force: 'attract', overrides: {} }).note, '');
  const long = 'x'.repeat(NOTE_MAX + 40);
  assert.equal(store.save({ force: 'attract', note: long, overrides: {} }).note.length, NOTE_MAX);
});

test('pickConfig keeps CONFIG_KEYS only — drops frames, null, NaN; keeps placement as a string', () => {
  const picked = pickConfig({
    strength: 2.2, range: 450, frames: 600, seed: 42, placement: 'scatter',
    vx: null, vy: undefined, count: NaN, angle: Infinity, spin: '1', extra: 9,
  });
  assert.deepEqual(picked, { strength: 2.2, range: 450, seed: 42, placement: 'scatter' });
  assert.ok(!('frames' in picked));
  assert.ok(!CONFIG_KEYS.includes('frames' as never));
  // placement must be a non-empty string
  assert.deepEqual(pickConfig({ placement: 7 }), {});
  assert.deepEqual(pickConfig({ placement: '' }), {});
});

test('remove returns true for a hit, false for a miss', () => {
  const store = createLabConfigs(fakeStore());
  const a = store.save({ force: 'attract', overrides: {} });
  assert.equal(store.remove(a.id), true);
  assert.equal(store.remove(a.id), false);
  assert.equal(store.remove('nope'), false);
  assert.deepEqual(store.list(), []);
});

test('the cap keeps the newest entries (max: 3)', () => {
  const store = createLabConfigs(fakeStore(), { now: ticking(), max: 3 });
  const ids = ['a', 'b', 'c', 'd', 'e'].map((f) => store.save({ force: f, overrides: {} }).id);
  const items = store.list();
  assert.equal(items.length, 3);
  assert.deepEqual(items.map((c) => c.id), [ids[4], ids[3], ids[2]]);
  assert.deepEqual(items.map((c) => c.force), ['e', 'd', 'c']);
  assert.ok(MAX_SAVED >= 3);
});

test('sanitizeStore: corrupt or foreign JSON collapses to empty; bad rows are dropped', () => {
  const empty = { v: 1, items: [] };
  assert.deepEqual(sanitizeStore(null), empty);
  assert.deepEqual(sanitizeStore('a string'), empty);
  assert.deepEqual(sanitizeStore(42), empty);
  assert.deepEqual(sanitizeStore([]), empty);
  assert.deepEqual(sanitizeStore({ v: 1, items: 'x' }), empty);
  const good = { id: 'ok', force: 'attract', tag: 'bad', note: 'n', overrides: { strength: 1, frames: 9 }, savedAt: 5 };
  const out = sanitizeStore({
    v: 1,
    items: [
      good,
      { id: 'no-tag', force: 'attract', tag: 'meh', note: '', overrides: {}, savedAt: 1 },
      { id: '', force: 'attract', tag: 'good', note: '', overrides: {}, savedAt: 1 },
      { id: 'no-force', force: 7, tag: 'good', note: '', overrides: {}, savedAt: 1 },
      { id: 'bad-ov', force: 'attract', tag: 'good', note: '', overrides: 'x', savedAt: 1 },
      'garbage',
      null,
    ],
  });
  assert.equal(out.items.length, 1);
  assert.deepEqual(out.items[0], { id: 'ok', force: 'attract', tag: 'bad', note: 'n', overrides: { strength: 1 }, savedAt: 5 });
  // a missing/non-numeric note or savedAt is normalised, not rejected
  const loose = sanitizeStore({ v: 1, items: [{ id: 'l', force: 'swirl', tag: 'edge', overrides: {}, savedAt: 'yesterday' }] });
  assert.deepEqual(loose.items[0], { id: 'l', force: 'swirl', tag: 'edge', note: '', overrides: {}, savedAt: 0 });
});

test('list() always re-reads the slot: a second store over the same slot sees the first one\'s writes', () => {
  const slot = fakeStore();
  const one = createLabConfigs(slot);
  const two = createLabConfigs(slot);
  const saved = one.save({ force: 'attract', tag: 'edge', note: 'shared', overrides: { range: 450 } });
  assert.deepEqual(two.list().map((c) => c.id), [saved.id]);
  assert.equal(two.list()[0]!.note, 'shared');
  // the persisted bytes are the sanitised store shape
  assert.deepEqual(JSON.parse(slot.raw!), { v: 1, items: [saved] });
  two.remove(saved.id);
  assert.deepEqual(one.list(), []);
  one.save({ force: 'swirl', overrides: {} });
  two.clear();
  assert.deepEqual(one.list(), []);
  assert.equal(slot.raw, undefined);
});

test('a corrupt slot never reaches list(); the next save repairs it', () => {
  const slot = fakeStore('{not json');
  const store = createLabConfigs(slot);
  assert.deepEqual(store.list(), []);
  slot.raw = JSON.stringify({ v: 1, items: [{ id: 'x' }] });
  assert.deepEqual(store.list(), []);
  store.save({ force: 'attract', overrides: {} });
  assert.equal(store.list().length, 1);
  assert.equal(JSON.parse(slot.raw!).items.length, 1);
});

test('summarize: the picked keys in CONFIG_KEYS order, or "defaults"', () => {
  assert.equal(summarize({ overrides: {} }), 'defaults');
  assert.equal(summarize({ overrides: { range: 450, strength: 2.2, placement: 'ring' } }), 'strength=2.2 · range=450 · placement=ring');
});

test('the storage key is the fui:-prefixed slot the page and the e2e spec clear', () => {
  assert.equal(LAB_CONFIGS_KEY, 'lab-configs');
});
