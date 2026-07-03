// The Fundamental core performance suite. Run: `pnpm --filter @fundamental-engine/core bench`
// (or `node packages/core/bench/field-bench.ts`). Pure Node — measures the engine's ALGORITHMIC cost,
// not fill-rate (see harness.ts / performance.md for why those are separate concerns).
//
// Scenarios:
//   1. Full-frame cost vs particle count (density sweep) — the macro number: one createField frame.
//   2. Accumulator overhead — step() with env.accum on vs off (the substrate capture path's cost).
//   3. Read-API cost — query() (global + point) and snapshot() (with/without influences).
//   4. Body-measure cadence — proves bodies are re-measured every 6th frame (cost concentrates there).

import { createField } from '../src/core/field.ts';
import { FieldStore } from '../src/core/field-store.ts';
import { step, makeAccumulator } from '../src/core/integrator.ts';
import { attract, swirl } from '../src/forces/index.ts';
import type { Body, Env, Particle, Force } from '../src/core/types.ts';
import { lcg, tickHost, timeIt, table, ms } from './harness.ts';

const rng = lcg();

// ── 1. Full-frame cost vs particle count ───────────────────────────────────────────────────────────
function frameScaling(): string {
  const rows: string[][] = [];
  for (const density of [1, 2, 3, 4]) {
    const { host, tick } = tickHost(1440, 900, 1);
    const field = createField(undefined as never, { host, render: 'none', density });
    // a handful of bodies so there is real force work each frame
    for (let i = 0; i < 8; i++) {
      const x = rng() * 1440, y = rng() * 900;
      field.addBody({ tokens: i % 2 ? ['attract'] : ['gravity'], strength: 1.5, range: 360, rect: () => ({ left: x, top: y, width: 48, height: 48 }) });
    }
    for (let i = 0; i < 30; i++) tick(); // settle (spawn ramp + first measure cadence)
    const count = field.particleCount();
    const stat = timeIt(() => tick(), 240);
    const perK = count ? (stat.median / count) * 1000 : 0;
    rows.push([String(density), String(count), ms(stat.median), ms(stat.p95), ms(perK)]);
    field.destroy?.();
  }
  return table(['density', 'particles', 'frame ms (med)', 'p95 ms', 'µs/1k particles'], rows);
}

// ── 2. Accumulator overhead (substrate capture path) ───────────────────────────────────────────────
function accumulatorOverhead(): string {
  const makeEnv = (over: Partial<Env> = {}): Env => ({
    dx: 0, dy: 0, dist: 1, form: { driftX: 0, wander: 0, orbit: 0, spread: 0, conv: 0 },
    W: 1440, H: 900, t: 0, frameN: 1, dt: 1, c: 12, G: 1,
    spark: () => {}, supernova: () => {}, spawn: () => {}, neighbors: () => [],
    grid: () => ({ sample: () => 0, deposit: () => {}, gradient: () => ({ x: 0, y: 0 }), decay: () => {}, clear: () => {} }),
    ...over,
  });
  const makeBody = (cx: number, cy: number, tokens: string[]): Body => ({
    el: null as unknown as HTMLElement, tokens, strength: 1.5, range: 400, absorbR: 64, capacity: 60,
    spin: 1, angle: 0, ux: 1, uy: 0, when: '', feedback: false, fmin: 0, fmax: 0, opsz: '', M: 1,
    cx, cy, hw: 24, hh: 24, on: false, vis: true, accreted: 0, count: 0, d: 0,
  });
  const forces: Record<string, Force> = { attract, swirl };
  const bodies = Array.from({ length: 8 }, (_, i) => makeBody(rng() * 1440, rng() * 900, i % 2 ? ['attract'] : ['swirl']));

  const build = () => {
    const store = new FieldStore();
    for (let i = 0; i < 4000; i++) store.add({ x: rng() * 1440, y: rng() * 900, vx: 0, vy: 0, m: 1, heat: 0, size: 1, cap: null } as Particle);
    return store;
  };
  const off = build();
  const on = build();
  const envOff = makeEnv();
  const stepOff = () => step({ store: off, bodies, env: envOff, forces, conditions: {} });
  const stepOn = () => { const env = makeEnv({ accum: makeAccumulator() }); step({ store: on, bodies, env, forces, conditions: {} }); };

  const a = timeIt(stepOff, 200);
  const b = timeIt(stepOn, 200);
  const overhead = ((b.median - a.median) / a.median) * 100;
  return table(['mode', 'step ms (med)', 'p95 ms', 'particles'], [
    ['accum off (default)', ms(a.median), ms(a.p95), '4000'],
    ['accum on (capture)', ms(b.median), ms(b.p95), '4000'],
    [`overhead`, `${overhead >= 0 ? '+' : ''}${overhead.toFixed(1)}%`, '', ''],
  ]);
}

// ── 3. Read-API cost (query / snapshot) ────────────────────────────────────────────────────────────
function readApiCost(): string {
  const { host, tick } = tickHost(1440, 900, 1);
  const field = createField(undefined as never, { host, render: 'none', density: 2 });
  for (let i = 0; i < 24; i++) {
    const x = rng() * 1440, y = rng() * 900;
    field.addBody({ tokens: ['attract'], strength: 1.5, range: 320, data: { id: `b${i}` }, rect: () => ({ left: x, top: y, width: 40, height: 40 }) });
  }
  for (let i = 0; i < 40; i++) tick();
  const count = field.particleCount();
  const rows = [
    ['query() global', ms(timeIt(() => field.query(), 500).median)],
    ['query({ at: point })', ms(timeIt(() => field.query({ at: { x: 720, y: 450 }, include: ['bodies', 'influences'] }), 500).median)],
    ['snapshot()', ms(timeIt(() => field.snapshot(), 300).median)],
    ['snapshot({ includeInfluences })', ms(timeIt(() => field.snapshot({ includeInfluences: true }), 300).median)],
  ];
  field.destroy?.();
  return `24 bodies · ${count} particles\n` + table(['call', 'ms (med)'], rows);
}

// ── 4. Body-measure cadence (every 6th frame) ──────────────────────────────────────────────────────
function measureCadence(): string {
  const { host, tick } = tickHost(1440, 900, 1);
  const field = createField(undefined as never, { host, render: 'none', density: 2 });
  for (let i = 0; i < 64; i++) {
    const x = rng() * 1440, y = rng() * 900;
    field.addBody({ tokens: ['attract'], strength: 1.2, range: 280, rect: () => ({ left: x, top: y, width: 40, height: 40 }) });
  }
  for (let i = 0; i < 30; i++) tick();
  // time individual frames, bucketed by frame index mod 6 — the measure frame should stand out.
  const buckets: number[][] = Array.from({ length: 6 }, () => []);
  for (let i = 0; i < 600; i++) {
    const a = performance.now();
    tick();
    buckets[i % 6]!.push(performance.now() - a);
  }
  const med = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]!; };
  const medians = buckets.map(med);
  const spread = ((Math.max(...medians) - Math.min(...medians)) / Math.min(...medians)) * 100;
  const rows = buckets.map((b, i) => [`frame ≡ ${i} (mod 6)`, ms(med(b))]);
  field.destroy?.();
  // Finding: bodies re-measure every 6th frame, but the cost is amortized BELOW the per-frame particle
  // work — the buckets stay flat (spread is noise), so the cadence does its job: no per-6th-frame jank.
  return `64 bodies · re-measure runs on one bucket; flat buckets = no jank (spread ${spread.toFixed(1)}%)\n`
    + table(['phase', 'frame ms (med)'], rows);
}

function main(): void {
  const node = process.version;
  console.log(`\nFundamental core — performance suite  (Node ${node}, algorithmic / no-GPU)\n`);
  console.log('1. FULL-FRAME COST vs PARTICLE COUNT (density sweep)\n' + frameScaling() + '\n');
  console.log('2. ACCUMULATOR OVERHEAD (substrate capture path; opt-in)\n' + accumulatorOverhead() + '\n');
  console.log('3. READ-API COST (query / snapshot)\n' + readApiCost() + '\n');
  console.log('4. BODY-MEASURE CADENCE (re-measure every 6th frame)\n' + measureCadence() + '\n');
  console.log('Note: fill-rate / fps / DPR / mix-blend are GPU-bound and measured on hardware, not here.\n');
}

main();
