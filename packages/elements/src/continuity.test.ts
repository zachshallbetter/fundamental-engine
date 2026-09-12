/**
 * `<field-root continuity="session">` — the sessionStorage/pagehide seam (#679), driven against a
 * fake window + Map-backed storage (no DOM), plus the element-level contract: the attribute is opt-in
 * (absent = nothing installed, nothing written), a live change never rebuilds the field, and every
 * missing platform piece degrades to a no-op.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FieldField } from './index.ts';
import { CONTINUITY_STORAGE_KEY, installSessionContinuity, type ContinuityWindow } from './continuity.ts';
import { PARTICLE_STRIDE, PARTICLE_WIRE_VERSION, encodeParticlePool } from '@fundamental-engine/core';

type PageHide = (e: { persisted?: boolean }) => void;

function fakeField(count = 3) {
  const calls: string[] = [];
  return {
    calls,
    particleCount: () => count,
    readParticles: (out: Float32Array) => {
      const n = Math.min(count, Math.floor(out.length / PARTICLE_STRIDE));
      for (let i = 0; i < n * PARTICLE_STRIDE; i++) out[i] = i + 1;
      calls.push(`read:${n}`);
      return n;
    },
    restoreParticles: (buf: Float32Array, n: number, opts?: { fromWidth?: number; fromHeight?: number }) => {
      calls.push(`restore:${n}:${opts?.fromWidth}x${opts?.fromHeight}:${Array.from(buf.subarray(0, 3)).join('/')}`);
      return n;
    },
  };
}

function fakeWindow(opts: { storage?: Map<string, string> | 'throw' | null; width?: number; height?: number } = {}) {
  const listeners: PageHide[] = [];
  const store = opts.storage === undefined ? new Map<string, string>() : opts.storage;
  const win = {
    get sessionStorage() {
      if (store === 'throw') throw new Error('SecurityError: storage blocked');
      if (store === null) return null;
      return {
        getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
        setItem: (k: string, v: string) => void store.set(k, v),
        removeItem: (k: string) => void store.delete(k),
      };
    },
    innerWidth: opts.width ?? 800,
    innerHeight: opts.height ?? 600,
    addEventListener: (_t: 'pagehide', l: PageHide) => void listeners.push(l),
    removeEventListener: (_t: 'pagehide', l: PageHide) => {
      const i = listeners.indexOf(l);
      if (i >= 0) listeners.splice(i, 1);
    },
  } satisfies ContinuityWindow;
  return { win, listeners, store: store instanceof Map ? store : new Map<string, string>() };
}

test('no window (SSR) / blocked storage / null storage / no addEventListener → a no-op, nothing touched', () => {
  const f = fakeField();
  assert.equal(installSessionContinuity(f, undefined).restored, 0);
  assert.equal(installSessionContinuity(f, fakeWindow({ storage: 'throw' }).win).restored, 0);
  assert.equal(installSessionContinuity(f, fakeWindow({ storage: null }).win).restored, 0);
  const bare = { ...fakeWindow().win, addEventListener: undefined } as unknown as ContinuityWindow;
  assert.equal(installSessionContinuity(f, bare).restored, 0);
  assert.deepEqual(f.calls, [], 'the field is never read or written');
});

test('fresh session: nothing restored; a non-bfcache pagehide writes ONE decodable blob under the key', () => {
  const f = fakeField(3);
  const { win, listeners, store } = fakeWindow({ width: 1024, height: 768 });
  const c = installSessionContinuity(f, win, { now: () => 777 });
  assert.equal(c.restored, 0);
  assert.equal(listeners.length, 1, 'one pagehide listener');
  assert.equal(store.size, 0, 'nothing written at install');
  listeners[0]!({ persisted: true }); // bfcache: the document stays alive
  assert.equal(store.size, 0, 'bfcache pagehide writes nothing');
  listeners[0]!({ persisted: false });
  const raw = store.get(CONTINUITY_STORAGE_KEY);
  assert.ok(raw, 'the blob is under the path-agnostic key');
  const blob = JSON.parse(raw);
  assert.equal(blob.v, PARTICLE_WIRE_VERSION);
  assert.equal(blob.stride, PARTICLE_STRIDE);
  assert.equal(blob.n, 3);
  assert.equal(blob.W, 1024);
  assert.equal(blob.H, 768);
  assert.equal(blob.at, 777);
  assert.deepEqual(f.calls, ['read:3']);
  c.teardown();
  assert.equal(listeners.length, 0, 'teardown removes the listener');
  c.teardown(); // idempotent
});

test('next document: a stored blob is consumed (key removed) and restored exactly once', () => {
  const src = fakeField(4);
  const blob = encodeParticlePool(src, { width: 500, height: 400, at: 1 })!;
  const { win, store } = fakeWindow();
  store.set(CONTINUITY_STORAGE_KEY, JSON.stringify(blob));
  const dst = fakeField(4);
  const c = installSessionContinuity(dst, win);
  assert.equal(c.restored, 4);
  assert.deepEqual(dst.calls, ['restore:4:500x400:1/2/3']);
  assert.equal(store.has(CONTINUITY_STORAGE_KEY), false, 'one-shot: the key is consumed');
  // a rebuild in the same document (a second install) finds nothing
  const again = installSessionContinuity(dst, win);
  assert.equal(again.restored, 0);
  assert.equal(dst.calls.length, 1);
  c.teardown();
  again.teardown();
});

test('a blob this build does not recognize is consumed and ignored (the fresh pool boots)', () => {
  const { win, store } = fakeWindow();
  store.set(CONTINUITY_STORAGE_KEY, JSON.stringify({ v: 99, stride: 5, n: 1, W: 1, H: 1, at: 0, data: 'AAAA' }));
  const f = fakeField();
  assert.equal(installSessionContinuity(f, win).restored, 0);
  assert.equal(store.has(CONTINUITY_STORAGE_KEY), false);
  store.set(CONTINUITY_STORAGE_KEY, '{not json');
  assert.equal(installSessionContinuity(f, win).restored, 0);
  assert.deepEqual(f.calls, []);
});

test('a setItem that throws (quota) is swallowed — pagehide never throws into the page', () => {
  const f = fakeField();
  const { win, listeners } = fakeWindow();
  const broken = {
    ...win,
    get sessionStorage() {
      return { getItem: () => null, setItem: () => { throw new Error('QuotaExceededError'); }, removeItem: () => {} };
    },
  } as ContinuityWindow;
  installSessionContinuity(f, broken);
  assert.doesNotThrow(() => listeners[0]!({ persisted: false }));
});

test('a custom key + size cap are honoured', () => {
  const f = fakeField(3);
  const { win, listeners, store } = fakeWindow();
  installSessionContinuity(f, win, { key: 'x:y', maxBytes: 40 }); // 40 chars → 1 particle
  listeners[0]!({});
  assert.ok(store.has('x:y'));
  assert.equal(JSON.parse(store.get('x:y')!).n, 1);
});

// ── the element contract (prototype stubs, no DOM — the option-attrs / field-root-surface approach) ──

function stubEl(attrs: Record<string, string | null>) {
  const calls: string[] = [];
  const el = Object.create(FieldField.prototype) as FieldField & Record<string, unknown>;
  Object.assign(el, {
    reflecting: false,
    field: { destroy: () => calls.push('destroy'), restoreParticles: (_b: Float32Array, n: number) => (calls.push(`restore:${n}`), n) },
    getAttribute: (k: string) => attrs[k] ?? null,
    hasAttribute: (k: string) => attrs[k] != null,
    start: () => calls.push('start'),
  });
  return { el, calls };
}

test('the continuity attribute is opt-in: absent / "off" → undefined; "session" or bare → "session"', () => {
  assert.equal(stubEl({}).el.continuity, undefined);
  assert.equal(stubEl({ continuity: 'off' }).el.continuity, undefined);
  assert.equal(stubEl({ continuity: 'false' }).el.continuity, undefined);
  assert.equal(stubEl({ continuity: 'session' }).el.continuity, 'session');
  assert.equal(stubEl({ continuity: '' }).el.continuity, 'session');
});

test('continuity is observed, but a live change never rebuilds the field (not the construction-time default branch)', () => {
  assert.ok(FieldField.observedAttributes.includes('continuity'));
  const { el, calls } = stubEl({ continuity: 'session' });
  el.attributeChangedCallback('continuity', null, 'session');
  assert.deepEqual(calls, [], 'no destroy/start: the attribute re-syncs the seam in place (no window here → no-op)');
  el.attributeChangedCallback('continuity', 'session', null);
  assert.deepEqual(calls, []);
});

test('restoreParticles is proxied on the element and returns 0 before mount', () => {
  const { el, calls } = stubEl({});
  assert.equal(el.restoreParticles(new Float32Array(10), 2), 2);
  assert.deepEqual(calls, ['restore:2']);
  const bare = Object.create(FieldField.prototype) as FieldField;
  assert.equal(bare.restoreParticles(new Float32Array(10), 2), 0);
});
