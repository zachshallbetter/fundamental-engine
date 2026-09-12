/**
 * Cross-document continuity (#679): the pure encode/decode of the pool in the `readParticles` wire
 * format, `FieldHandle.restoreParticles` (the in-place write-back), and — first — the DEFAULT-PATH PIN.
 *
 * The pin is the regression contract for this opt-in feature: a field that never calls
 * `restoreParticles` must be byte-identical to one built before the method existed. Two checks make
 * that structural rather than asserted: (1) the number of rng draws `build()` makes is an INTEGER
 * invariant of the draw order (8 per particle in a flat field: size, x, y, vx, vy, gx, gy, gz), so it
 * is pinned as a literal that no Node version's float ULPs can move; (2) `restoreParticles` itself
 * consumes zero draws and preserves every particle id (no rebuild), so calling it cannot shift the
 * stream for anything downstream.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createField } from './field.ts';
import { headlessHost } from './host-headless.ts';
import {
  CONTINUITY_MAX_BYTES,
  decodeParticlePool,
  encodeParticlePool,
  maxParticlesForBytes,
  type ParticlePoolBlob,
} from './continuity.ts';
import { PARTICLE_STRIDE, PARTICLE_WIRE_VERSION } from './types.ts';
import type { FieldHandle, FieldOptions } from './types.ts';

/** A tiny deterministic LCG (the determinism.test.ts one) with a draw counter on top. */
function countingRng(seed: number): { rng: () => number; draws: () => number } {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  let draws = 0;
  return {
    rng: () => {
      draws++;
      return (s = (s * 16807) % 2147483647) / 2147483647;
    },
    draws: () => draws,
  };
}

function openField(seed: number, width = 640, height = 480, extra: Partial<FieldOptions> = {}) {
  const host = headlessHost({ width, height });
  const c = countingRng(seed);
  const field = createField(undefined as never, { host, render: 'none', rng: c.rng, now: () => 0, ...extra });
  return { host, field, draws: c.draws };
}

function readAll(field: FieldHandle): { buf: Float32Array; n: number } {
  const buf = new Float32Array(field.particleCount() * PARTICLE_STRIDE);
  const n = field.readParticles(buf);
  return { buf: buf.subarray(0, n * PARTICLE_STRIDE), n };
}

const fingerprint = (field: FieldHandle): string => Array.from(readAll(field).buf).map((v) => v.toFixed(6)).join(',');

const ids = (field: FieldHandle): number[] => {
  const out = new Uint32Array(field.particleCount());
  const n = field.readParticleIds(out);
  return Array.from(out.subarray(0, n));
};

// ── the default-path pin ──────────────────────────────────────────────────────────────────────────

/** build() at density 1 spawns 130 particles × 8 rng draws each (flat field: no z/vz draws). This
 *  literal was measured on the tree BEFORE restoreParticles existed and must never move. */
const DEFAULT_BUILD_DRAWS = 130 * 8;

test('default-path pin: build() draws exactly 8 rng values per particle — 1040 at density 1 — with the feature unused', () => {
  const { field, draws } = openField(11);
  try {
    assert.equal(field.particleCount(), 130);
    assert.equal(draws(), DEFAULT_BUILD_DRAWS);
  } finally {
    field.destroy();
  }
});

test('default-path pin: two identically-seeded runs (30 frames, an attract body) are byte-identical in draws AND readParticles', () => {
  const run = (): { fp: string; draws: number } => {
    const { host, field, draws } = openField(11);
    field.addBody({ tokens: ['attract'], strength: 2, range: 300, rect: () => ({ left: 300, top: 220, width: 40, height: 40 }) });
    for (let i = 0; i < 30; i++) host.tick();
    const out = { fp: fingerprint(field), draws: draws() };
    field.destroy();
    return out;
  };
  const a = run();
  const b = run();
  assert.ok(a.fp.length > 0);
  assert.equal(a.fp, b.fp);
  assert.equal(a.draws, b.draws);
  assert.ok(a.draws >= DEFAULT_BUILD_DRAWS);
});

test('restoreParticles consumes ZERO rng draws and never rebuilds (every particle id survives)', () => {
  const src = openField(3);
  const dst = openField(3);
  try {
    for (let i = 0; i < 10; i++) src.host.tick();
    const { buf, n } = readAll(src.field);
    const before = dst.draws();
    const idsBefore = ids(dst.field);
    const written = dst.field.restoreParticles(buf, n);
    assert.equal(written, n);
    assert.equal(dst.draws(), before, 'no rng draw on restore');
    assert.deepEqual(ids(dst.field), idsBefore, 'no rebuild: the pool identities are untouched');
    assert.equal(fingerprint(dst.field), fingerprint(src.field), 'same coordinate space → bit-exact positions/heat/size');
  } finally {
    src.field.destroy();
    dst.field.destroy();
  }
});

// ── encode / decode ───────────────────────────────────────────────────────────────────────────────

test('encode → JSON → decode → restore round-trips the pool exactly (readParticles fingerprint)', () => {
  const src = openField(5);
  const dst = openField(6); // a DIFFERENT seed: the fresh pool is unrelated until restored
  try {
    for (let i = 0; i < 8; i++) src.host.tick();
    const blob = encodeParticlePool(src.field, { width: 640, height: 480, at: 1234 });
    assert.ok(blob);
    assert.equal(blob.v, PARTICLE_WIRE_VERSION);
    assert.equal(blob.stride, PARTICLE_STRIDE);
    assert.equal(blob.n, src.field.particleCount());
    assert.equal(blob.at, 1234);
    const wire = JSON.stringify(blob);
    assert.ok(wire.length < CONTINUITY_MAX_BYTES, `a density-1 pool is small on the wire (${wire.length} chars)`);
    const pool = decodeParticlePool(wire);
    assert.ok(pool);
    assert.equal(pool.n, blob.n);
    assert.equal(pool.W, 640);
    assert.equal(pool.H, 480);
    assert.equal(pool.at, 1234);
    assert.notEqual(fingerprint(dst.field), fingerprint(src.field), 'sanity: the two pools differ before the restore');
    const written = dst.field.restoreParticles(pool.buf, pool.n, { fromWidth: pool.W, fromHeight: pool.H });
    assert.equal(written, pool.n);
    assert.equal(fingerprint(dst.field), fingerprint(src.field));
  } finally {
    src.field.destroy();
    dst.field.destroy();
  }
});

test('decode also accepts the parsed object, and rejects every shape it cannot vouch for', () => {
  const { field } = openField(9);
  try {
    const blob = encodeParticlePool(field, { width: 640, height: 480 })!;
    assert.ok(decodeParticlePool(blob), 'the object form decodes');
    const reject = (mut: (b: Record<string, unknown>) => void, why: string): void => {
      const b = { ...blob } as Record<string, unknown>;
      mut(b);
      assert.equal(decodeParticlePool(b), null, why);
    };
    reject((b) => (b.v = PARTICLE_WIRE_VERSION + 1), 'a future wire version');
    reject((b) => (b.stride = PARTICLE_STRIDE + 1), 'a different stride');
    reject((b) => (b.n = blob.n + 1), 'a count that does not match the byte length');
    reject((b) => (b.n = 0), 'an empty pool');
    reject((b) => (b.n = 1.5), 'a fractional count');
    reject((b) => (b.W = 0), 'a zero capture width');
    reject((b) => (b.H = -1), 'a negative capture height');
    reject((b) => (b.W = Infinity), 'a non-finite capture width');
    reject((b) => delete b.data, 'no payload');
    reject((b) => (b.data = 42), 'a non-string payload');
    reject((b) => (b.data = (blob.data as string).slice(0, -4) + '!!!!'), 'a character outside the base64 alphabet');
    reject((b) => (b.data = (blob.data as string).slice(1)), 'a payload whose length is not a multiple of 4');
    assert.equal(decodeParticlePool('not json'), null);
    assert.equal(decodeParticlePool('42'), null);
    assert.equal(decodeParticlePool(null), null);
    assert.equal(decodeParticlePool(undefined), null);
    assert.equal(decodeParticlePool([]), null, 'an array is not a blob');
  } finally {
    field.destroy();
  }
});

test('decode rejects a non-finite lane (a NaN smuggled into the bytes) — never throws', () => {
  const { field } = openField(9);
  try {
    // build a blob by hand: one particle whose heat lane is NaN (little-endian float32 0x7fc00000)
    const bytes = new Uint8Array(PARTICLE_STRIDE * 4);
    const view = new DataView(bytes.buffer);
    view.setFloat32(0, 10, true);
    view.setFloat32(4, 20, true);
    view.setFloat32(8, 0, true);
    view.setFloat32(12, Number.NaN, true);
    view.setFloat32(16, 1, true);
    let bin = '';
    for (const b of bytes) bin += String.fromCharCode(b);
    const blob: ParticlePoolBlob = { v: PARTICLE_WIRE_VERSION, stride: PARTICLE_STRIDE, n: 1, W: 100, H: 100, at: 0, data: btoa(bin) };
    assert.equal(decodeParticlePool(blob), null);
    // and the same bytes with a finite heat decode fine (the codec itself is not the reason)
    view.setFloat32(12, 0.5, true);
    bin = '';
    for (const b of bytes) bin += String.fromCharCode(b);
    const ok = decodeParticlePool({ ...blob, data: btoa(bin) });
    assert.ok(ok);
    assert.deepEqual(Array.from(ok.buf), [10, 20, 0, 0.5, 1]);
    void field;
  } finally {
    field.destroy();
  }
});

test('size cap: encode truncates to the budget in pool order; decode refuses a payload over its cap', () => {
  const { field } = openField(2);
  try {
    const budget = 400; // chars
    const blob = encodeParticlePool(field, { width: 640, height: 480, maxBytes: budget })!;
    assert.ok(blob);
    assert.equal(blob.n, maxParticlesForBytes(budget));
    assert.ok(blob.n > 0 && blob.n < field.particleCount(), `truncated: ${blob.n} of ${field.particleCount()}`);
    assert.ok(blob.data.length <= budget, `payload ${blob.data.length} ≤ ${budget}`);
    // the truncated prefix is the pool prefix
    const { buf } = readAll(field);
    const pool = decodeParticlePool(blob)!;
    assert.deepEqual(Array.from(pool.buf), Array.from(buf.subarray(0, blob.n * PARTICLE_STRIDE)));
    // a decoder with a tighter cap refuses it
    assert.equal(decodeParticlePool(blob, { maxBytes: blob.data.length - 1 }), null);
    assert.equal(decodeParticlePool(JSON.stringify(blob), { maxBytes: blob.data.length - 1 }), null);
    // a zero budget captures nothing
    assert.equal(encodeParticlePool(field, { width: 640, height: 480, maxBytes: 0 }), null);
    assert.equal(maxParticlesForBytes(0), 0);
    assert.equal(maxParticlesForBytes(CONTINUITY_MAX_BYTES), Math.floor((CONTINUITY_MAX_BYTES * 3) / 4 / 20));
  } finally {
    field.destroy();
  }
});

// ── restoreParticles semantics ────────────────────────────────────────────────────────────────────

test('count mismatch: restore writes the overlap and leaves the rest of the pool as built', () => {
  const big = openField(4, 640, 480, { density: 1 }); // 130
  const small = openField(4, 640, 480, { density: 0.5 }); // 65
  try {
    const bigPool = readAll(big.field);
    const smallPool = readAll(small.field);
    // bigger capture → smaller pool: only the pool's free count is written
    const fresh = openField(8, 640, 480, { density: 0.5 });
    const w1 = fresh.field.restoreParticles(bigPool.buf, bigPool.n);
    assert.equal(w1, smallPool.n);
    assert.equal(w1, fresh.field.particleCount());
    fresh.field.destroy();
    // smaller capture → bigger pool: n written, the tail keeps its fresh state
    const fresh2 = openField(8, 640, 480, { density: 1 });
    const before = readAll(fresh2.field);
    const w2 = fresh2.field.restoreParticles(smallPool.buf, smallPool.n);
    assert.equal(w2, smallPool.n);
    const after = readAll(fresh2.field);
    assert.deepEqual(
      Array.from(after.buf.subarray(0, w2 * PARTICLE_STRIDE)),
      Array.from(smallPool.buf),
      'the head of the pool is the captured pool',
    );
    assert.deepEqual(
      Array.from(after.buf.subarray(w2 * PARTICLE_STRIDE)),
      Array.from(before.buf.subarray(w2 * PARTICLE_STRIDE)),
      'the tail is untouched',
    );
    fresh2.field.destroy();
  } finally {
    big.field.destroy();
    small.field.destroy();
  }
});

test('restore rescales positions from the capture space into the current one, and clamps into the field', () => {
  const src = openField(7, 640, 480);
  const dst = openField(7, 1280, 960);
  try {
    const { buf, n } = readAll(src.field);
    dst.field.restoreParticles(buf, n, { fromWidth: 640, fromHeight: 480 });
    const out = readAll(dst.field);
    for (let i = 0; i < n; i++) {
      const o = i * PARTICLE_STRIDE;
      assert.ok(Math.abs(out.buf[o]! - buf[o]! * 2) < 1e-3, `x doubles (row ${i})`);
      assert.ok(Math.abs(out.buf[o + 1]! - buf[o + 1]! * 2) < 1e-3, `y doubles (row ${i})`);
      assert.equal(out.buf[o + 3], buf[o + 3], 'heat is unscaled');
      assert.equal(out.buf[o + 4], buf[o + 4], 'size is unscaled');
    }
    // out-of-range input clamps into [0, W] × [0, H]; a non-positive size is ignored; heat clamps to [0,1]
    const wild = new Float32Array([-50, 5000, 0, 7, -1]);
    assert.equal(dst.field.restoreParticles(wild, 1), 1);
    const first = readAll(dst.field).buf;
    assert.equal(first[0], 0);
    assert.equal(first[1], 960);
    assert.equal(first[3], 1);
    assert.ok(first[4]! > 0, 'a non-positive size keeps the built size');
    // a zero / negative "from" size means no rescale
    assert.equal(dst.field.restoreParticles(new Float32Array([100, 100, 0, 0, 1]), 1, { fromWidth: 0, fromHeight: -1 }), 1);
    assert.equal(readAll(dst.field).buf[0], 100);
    // n beyond the buffer is bounded by the buffer; a negative n writes nothing
    assert.equal(dst.field.restoreParticles(new Float32Array(PARTICLE_STRIDE * 2), 99), 2);
    assert.equal(dst.field.restoreParticles(new Float32Array(PARTICLE_STRIDE * 2), -3), 0);
  } finally {
    src.field.destroy();
    dst.field.destroy();
  }
});

test('restore skips agents exactly like readParticles, and a flat field never materializes z', () => {
  const { field } = openField(12);
  try {
    const agent = field.addAgent({ x: 321, y: 123, report: () => {} });
    const n = field.particleCount() - 1; // free particles only
    const buf = new Float32Array(n * PARTICLE_STRIDE);
    for (let i = 0; i < n; i++) {
      const o = i * PARTICLE_STRIDE;
      buf[o] = 1 + i;
      buf[o + 1] = 2;
      buf[o + 2] = 7; // a depth lane the flat field must ignore
      buf[o + 3] = 0.25;
      buf[o + 4] = 1.5;
    }
    assert.equal(field.restoreParticles(buf, n), n);
    assert.equal(agent.particle.x, 321, 'the agent is not on the wire');
    assert.equal(agent.particle.y, 123);
    const out = readAll(field);
    assert.equal(out.n, n);
    for (let i = 0; i < n; i++) {
      const o = i * PARTICLE_STRIDE;
      assert.equal(out.buf[o], 1 + i);
      assert.equal(out.buf[o + 2], 0, 'flat field: z stays 0');
      assert.equal(out.buf[o + 3], 0.25);
      assert.equal(out.buf[o + 4], 1.5);
    }
    agent.remove();
  } finally {
    field.destroy();
  }
});

test('a depth > 0 field restores z (clamped into the volume)', () => {
  const { field } = openField(13, 640, 480, { depth: 40 });
  try {
    const buf = new Float32Array([10, 10, 25, 0, 1, 20, 20, 99, 0, 1]);
    assert.equal(field.restoreParticles(buf, 2), 2);
    const out = readAll(field).buf;
    assert.equal(out[2], 25);
    assert.equal(out[PARTICLE_STRIDE + 2], 40, 'clamped to depth');
  } finally {
    field.destroy();
  }
});
