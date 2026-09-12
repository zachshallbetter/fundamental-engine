/**
 * Height-aware fields (#443, FieldKit gap #6) — the coupling half.
 *
 * `addField` shipped the INPUT half in 0.5.1: a host could hand the engine a terrain sampler and read
 * it back. Nothing could read it as a *cause* — `Env` carried no channel accessor at all. `relief` is
 * that coupling: the channel admitted as a scalar potential Φ = G·h, rasterised into a held grid,
 * transported as −∇Φ.
 *
 * The suite is built around the three things most likely to be wrong:
 *
 *  1. **Registration must not couple.** The shipped docs promise `addField` is structure, not cause.
 *     The proof here is a SAME-PROCESS reference-vs-treatment comparison — two fields stepped side by
 *     side under one seed — not a committed fingerprint of a run captured on some other machine. A
 *     bit-exact hash over a long run is environment-fragile (a single-apply golden already drifts at
 *     the ULP level across Node majors), so it would be testing the runtime, not this change. Two
 *     fields in one process cannot diverge for environmental reasons: any difference is ours.
 *  2. **Held state must never be stale or frame-phase dependent.** Every event that changes what the
 *     host sampler answers is exercised — and each is checked to take effect on the VERY NEXT FRAME,
 *     which is what a measure-cadence refresh would fail: registering a channel after the body is
 *     declared (the common ordering), `set()`, `remove()`, and resize.
 *  3. **A held grid must never step.** Nothing may blur or decay a terrain the host declared.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createField } from './engine/field.ts';
import { seededRng } from './record/rng.ts';
import { ScalarGridImpl } from './engine/scalar-grid.ts';
import { relief } from './forces/extended.ts';
import type { FieldHost } from './engine/host.ts';
import type { Body, Env, FieldHandle, FieldOptions, Particle, ScalarGrid } from './engine/types.ts';

const noopCtx = new Proxy({}, { get: () => () => {} }) as unknown as CanvasRenderingContext2D;

function fakeCanvas(): HTMLCanvasElement {
  return {
    width: 0, height: 0, style: {} as Record<string, string>,
    getContext: () => noopCtx,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600, right: 800, bottom: 600, x: 0, y: 0, toJSON: () => ({}) }),
  } as unknown as HTMLCanvasElement;
}

/** A manual-clock host (the #1110 idiom): `tick(n)` runs n frames by re-invoking the engine's raf cb. */
function makeHost(): { host: FieldHost; tick: (n: number) => void; resize: (w: number, h: number) => void } {
  let cb: ((t: number) => void) | null = null;
  let resizeCb: (() => void) | null = null;
  let t = 0;
  let W = 800;
  let H = 600;
  const off = (): void => {};
  const host: FieldHost = {
    root: { querySelectorAll: () => [], querySelector: () => null } as unknown as ParentNode,
    viewport: () => ({ width: W, height: H, dpr: 1 }),
    scrollY: () => 0,
    scrollHeight: () => 800,
    reducedMotion: () => false,
    hidden: () => false,
    raf: (f) => { cb = f; return 1; },
    cancelRaf: off,
    createCanvas: fakeCanvas,
    onResize: (f: () => void) => { resizeCb = f; return off; },
    onScroll: () => off,
    onVisibility: () => off,
    onInput: () => off,
    onBodyEvent: () => off,
  };
  const tick = (n: number): void => {
    for (let i = 0; i < n; i++) {
      t += 1000 / 60;
      const f = cb;
      cb = null;
      f?.(t);
    }
  };
  const resize = (w: number, h: number): void => { W = w; H = h; resizeCb?.(); };
  return { host, tick, resize };
}

/** A bare probe env — nothing opted in, exactly as `applyForce` sees on the default hot path. */
function probeEnv(over: Partial<Env> = {}): Env {
  return {
    dx: 0, dy: 0, dist: 1,
    form: { driftX: 0, wander: 0, orbit: 0, spread: 0, conv: 0 },
    W: 800, H: 600, t: 0, frameN: 0, dt: 1, c: 12, G: 1,
    spark: () => {}, supernova: () => {}, spawn: () => {},
    neighbors: () => [], grid: () => new ScalarGridImpl(800, 600),
    ...over,
  } as Env;
}

function reliefBody(over: Partial<Body> = {}): Body {
  return {
    el: {} as HTMLElement, tokens: ['relief'], strength: 1, range: 0, absorbR: 64, capacity: 60,
    spin: 1, angle: 0, ux: 1, uy: 0, when: '', feedback: false, fmin: 0, fmax: 0, opsz: '',
    M: 1, cx: 0, cy: 0, hw: 0, hh: 0, on: false, vis: true, accreted: 0, count: 0, d: 0,
    ...over,
  } as Body;
}

const particle = (x = 0, y = 0): Particle => ({ x, y, vx: 0, vy: 0, m: 1, heat: 0, size: 1, cap: null });

/** A held grid over a sampler, the way the engine builds one. */
function heldOver(sampler: (x: number, y: number) => number, W = 800, H = 600): ScalarGrid {
  const g = new ScalarGridImpl(W, H, 'held');
  g.fillFrom(sampler);
  return g;
}

/** Mean x of the live pool — the "has matter drained downhill?" readout. */
function meanX(field: FieldHandle): number {
  const n = field.particleCount();
  const out = new Float32Array(n * 5);
  const c = field.readParticles(out);
  let sum = 0;
  for (let i = 0; i < c; i++) sum += out[5 * i]!;
  return sum / c;
}

/** An idle field: nothing drawn, no waves, the ambient drift stilled — so relief is the only cause. */
const IDLE = { render: 'none', waves: false, ambientWander: 0, ambientOrbit: 0, density: 1 } as const;

/** A seeded, idle, headless field on `host` — the #1110 idiom. */
function idleField(host: FieldHost): FieldHandle {
  return createField(fakeCanvas(), { ...IDLE, host, rng: seededRng(1) } as FieldOptions);
}

/** A global relief body at the centre, declared programmatically (no DOM needed). */
function declareRelief(field: FieldHandle, potential?: string): void {
  field.addBody({
    tokens: 'relief',
    strength: 1,
    range: 0, // global — relief is a property of the whole field, not a neighbourhood
    ...(potential ? { potential } : {}),
    rect: () => ({ left: 400, top: 300, width: 1, height: 1 }),
  });
}

// ── 1. the force ───────────────────────────────────────────────────────────────────────────────

test('relief transports matter DOWN the declared potential, by the declared law', () => {
  const phi = heldOver((x) => 0.01 * x); // h rises with x ⇒ −∇Φ points in −x
  const p = particle(400, 300);
  relief.apply(reliefBody(), p, probeEnv({ potential: () => phi }));
  assert.ok(p.vx < 0, `expected downhill (−x), got vx=${p.vx}`);
  assert.ok(Math.abs(p.vy) < 1e-6, 'a slope in x alone must not push in y');
  assert.ok(Math.abs(p.vx + 0.01) < 5e-5, `Δvx = ${p.vx}, expected −0.01 (= −∇Φ·S·G)`);
});

test('data-spin < 0 climbs the potential instead (wind over a ridge)', () => {
  const p = particle(400, 300);
  relief.apply(reliefBody({ spin: -1 }), p, probeEnv({ potential: () => heldOver((x) => 0.01 * x) }));
  assert.ok(p.vx > 0, `expected uphill (+x) under spin < 0, got vx=${p.vx}`);
});

test('relief is a pure no-op with no accessor, and with no such channel', () => {
  const p1 = particle(400, 300);
  relief.apply(reliefBody(), p1, probeEnv()); // the default hot path: no Env.potential at all
  assert.deepEqual([p1.vx, p1.vy], [0, 0], 'a bare env moved matter');

  const p2 = particle(400, 300);
  relief.apply(reliefBody(), p2, probeEnv({ potential: () => undefined })); // absent / removed
  assert.deepEqual([p2.vx, p2.vy], [0, 0], 'an unregistered channel moved matter');
});

test('a hostile channel cannot produce a non-finite or superluminal velocity', () => {
  // NaN is the real exposure: a NaN velocity slips a `speed > c` test, because the comparison is
  // false. It is clamped at the raster boundary, so it never reaches the integrator.
  const p = particle(400, 300);
  relief.apply(reliefBody(), p, probeEnv({ potential: () => heldOver((x) => (x > 400 ? Number.NaN : 0.01 * x)) }));
  assert.ok(Number.isFinite(p.vx) && Number.isFinite(p.vy), 'NaN reached the velocity');

  // A cliff has an unbounded gradient — which is exactly why the c-cap is in the force, not deferred.
  const q = particle(400, 300);
  relief.apply(reliefBody({ strength: 1000 }), q, probeEnv({ potential: () => heldOver((x) => (x > 400 ? 1e9 : 0)) }));
  assert.ok(Math.hypot(q.vx, q.vy) <= 12 + 1e-6, `speed ${Math.hypot(q.vx, q.vy)} exceeded c`);
});

test('flat ground produces no impulse at all', () => {
  const p = particle(400, 300);
  relief.apply(reliefBody(), p, probeEnv({ potential: () => heldOver(() => 7) }));
  assert.deepEqual([p.vx, p.vy], [0, 0], 'a constant potential has no gradient');
});

// ── 2. the held grid ───────────────────────────────────────────────────────────────────────────

test('a held grid NEVER steps — a declared terrain must not blur or decay', () => {
  const held = new ScalarGridImpl(320, 320, 'held');
  held.fillFrom((x) => 0.01 * x);
  const before = held.sample(160, 160);
  for (let i = 0; i < 200; i++) held.step();
  assert.equal(held.sample(160, 160), before, 'held cells moved under step()');

  // the control: the same raster in the DEFAULT mode does erode — which is what a conformance
  // harness opening a `potential:` grid as diffuse would have silently done to a declared slope.
  const diffusing = new ScalarGridImpl(320, 320, 'diffuse');
  diffusing.fillFrom((x) => 0.01 * x);
  const d0 = diffusing.sample(160, 160);
  for (let i = 0; i < 200; i++) diffusing.step();
  assert.notEqual(diffusing.sample(160, 160), d0, 'the diffuse control did not erode — the test is vacuous');
});

test('fillFrom reproduces the sampler at cell centres and clamps non-finite to 0', () => {
  const g = new ScalarGridImpl(320, 320, 'held');
  g.fillFrom((x, y) => (x === 64 && y === 64 ? Number.POSITIVE_INFINITY : x + y));
  assert.ok(Math.abs(g.sample(96, 32) - 128) < 1e-3, `sample=${g.sample(96, 32)}`);
  assert.ok(Number.isFinite(g.sample(64, 64)), 'infinity survived the raster');
});

// ── 3. registration must not couple ────────────────────────────────────────────────────────────

test('addField alone changes NOTHING: reference and treatment agree, in one process', () => {
  // The claim the shipped docs make, and the one this change most threatens. Both fields run HERE,
  // under one seed, so the comparison cannot drift for environmental reasons — unlike a committed
  // cross-machine fingerprint, which would be testing Node's math library rather than this branch.
  const a = makeHost();
  const b = makeHost();
  const reference = idleField(a.host);
  const treatment = idleField(b.host);
  treatment.addField('height', (x) => 0.01 * x); // structure, with nothing declaring it

  a.tick(30);
  b.tick(30);
  const snap = (f: FieldHandle): number[] => {
    const out = new Float32Array(f.particleCount() * 5);
    const n = f.readParticles(out);
    return [...out.slice(0, n * 5)];
  };
  assert.deepEqual(snap(treatment), snap(reference), 'addField alone moved the field');
  reference.destroy();
  treatment.destroy();
});

test('sampleField is still uncached on every read, and set/remove are still live', () => {
  const { host } = makeHost();
  const f = idleField(host);
  let calls = 0;
  const ch = f.addField('height', (x) => { calls++; return 0.01 * x; });
  f.sampleField('height', 10, 10);
  f.sampleField('height', 10, 10);
  assert.equal(calls, 2, 'sampleField cached — the unamended half of the promise broke');

  ch.set(() => 42);
  assert.equal(f.sampleField('height', 0, 0), 42, 'set() did not swap the sampler live');
  ch.remove();
  assert.equal(f.sampleField('height', 0, 0), 0, 'remove() did not unregister the channel');
  f.destroy();
});

// ── 4. the invalidation set — never stale, never frame-phase dependent ──────────────────────────

test('a declared potential drains matter downhill (the ticket acceptance)', () => {
  const ctl = makeHost();
  const trt = makeHost();
  const control = idleField(ctl.host);
  const terrain = idleField(trt.host);
  declareRelief(control); // declared in BOTH, so the only difference is the host channel
  declareRelief(terrain);
  terrain.addField('height', (x) => 0.01 * x);

  ctl.tick(60);
  trt.tick(60);
  assert.ok(meanX(terrain) < meanX(control) - 0.5,
    `matter did not drain downhill: terrain ${meanX(terrain)} vs control ${meanX(control)}`);
  control.destroy();
  terrain.destroy();
});

test('a channel registered AFTER the body couples on the very next frame (not on a cadence)', () => {
  // THE ordering that matters: a DOM scan runs before the host registers its channels, so
  // "body first, channel second" is the common case — and a measure-cadence refresh would leave
  // this inert for up to five frames, making trajectories depend on which frame you registered on.
  const { host, tick } = makeHost();
  const f = idleField(host);
  declareRelief(f);
  tick(20); // no channel yet: relief is a no-op, matter just sits
  const before = meanX(f);
  f.addField('height', (x) => 0.01 * x);
  tick(1); // ONE frame — a cadence-based refresh would still read an empty raster here
  assert.ok(meanX(f) < before - 1e-4, `no coupling on the frame after addField (${before} → ${meanX(f)})`);
  f.destroy();
});

test('set() re-rasters on the next frame, and remove() stops transport immediately', () => {
  const { host, tick } = makeHost();
  const f = idleField(host);
  declareRelief(f);
  const ch = f.addField('height', (x) => 0.01 * x);
  tick(10);

  // a steeper surface must bite on the very next frame
  const x0 = meanX(f);
  tick(1);
  const gentleStep = x0 - meanX(f);
  ch.set((x) => 0.2 * x);
  const x1 = meanX(f);
  tick(1);
  const steepStep = x1 - meanX(f);
  assert.ok(steepStep > gentleStep, `set() did not re-raster on the next frame (${gentleStep} → ${steepStep})`);

  // and a withdrawn channel must stop CONTRIBUTING at once — the acceleration ends, so the
  // frame-over-frame displacement decays under friction instead of growing.
  ch.remove();
  tick(1);
  const a = meanX(f);
  tick(1);
  const b = meanX(f);
  tick(1);
  const c = meanX(f);
  assert.ok(a - b > b - c - 1e-9, 'matter kept accelerating after remove() — the raster outlived its channel');
  f.destroy();
});

test('resize invalidates the raster (resize preserves nothing, so a stale stamp would flatten it)', () => {
  const { host, tick, resize } = makeHost();
  const f = idleField(host);
  declareRelief(f);
  f.addField('height', (x) => 0.01 * x);
  tick(10);
  resize(1000, 700); // rebuilds every grid buffer, zeroing it
  const before = meanX(f);
  tick(1);
  assert.ok(meanX(f) < before - 1e-4, 'transport stopped after a resize — the raster was not refilled');
  f.destroy();
});

test('a named channel is honoured, and an unregistered name stays inert', () => {
  const { host, tick } = makeHost();
  const f = idleField(host);
  declareRelief(f, 'elevation'); // data-potential="elevation"
  f.addField('height', (x) => 0.01 * x); // a DIFFERENT channel — must not couple
  tick(20);
  const x0 = meanX(f);
  f.addField('elevation', (x) => 0.01 * x);
  tick(20);
  assert.ok(meanX(f) < x0 - 1e-4, 'the named channel did not couple');
  f.destroy();
});
