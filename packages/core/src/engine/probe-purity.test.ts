/**
 * Render-probe purity (#1155) — drawing a diagnostic must never move the simulation.
 *
 * `forceAt` measures the field with a fictitious test particle. It used to run every body's real
 * `apply()` against the CALLER'S LIVE ENV, with a module-level probe whose `cap` was never cleared:
 *
 *   - `sink.apply` advanced a real body's accretion budget (`b.accreted += 1`) and could fire the
 *     live `e.supernova(b)` — a body detonating because the field was DRAWN;
 *   - once `p.cap` was set it stayed set, so `sink` and `warp` short-circuited for the life of the
 *     process and every later sample was poisoned: the same point read differently depending on
 *     what had been sampled before it;
 *   - the probe drew from the simulation's seeded `rng`, so drawing moved the record/replay stream.
 *
 * The probe now runs under its OWN env (inert `spark`/`supernova`/`spawn`, write-dropping grids, its
 * own per-sample reseeded rng, `probe: true`) — which is precisely what makes clearing `cap` per
 * sample SAFE. Clearing `cap` without an inert path is strictly worse than the bug it fixes: `sink`'s
 * `if (p.cap || …) return` guard stops short-circuiting, and a one-time over-accretion becomes one
 * accretion per probe point per frame.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seededRng } from '../record/rng.ts';
import { forceAt } from './streamlines.ts';
import { coreForces } from '../forces/index.ts';
import { naturalForces } from '../forces/natural.ts';
import { extendedForces } from '../forces/extended.ts';
import type { Body, Env } from './types.ts';

const forces = Object.fromEntries(
  [...coreForces, ...naturalForces, ...extendedForces].map((f) => [f.token, f]),
);

// ── engine-level harness: the render loop's own grid walk ────────────────────────────────────────

const W = 800;
const H = 600;
const GRID = 46; // field.ts's streamlines/flow grid pitch

const body = (tokens: string[], cx: number, cy: number, over: Partial<Body> = {}): Body => ({
  el: {} as HTMLElement, tokens, strength: 1.5, range: 240, absorbR: 120, capacity: 60,
  spin: 1, angle: 0, ux: 1, uy: 0, when: '', feedback: false, fmin: 0, fmax: 0, opsz: '',
  M: 1, cx, cy, hw: 30, hh: 14, on: true, vis: true, accreted: 0, count: 0, d: 0, attn: 1,
  ...over,
});

/** A LIVE env — real services, exactly what every `forceAt` call site passes in. */
function liveEnv(over: Partial<Env> = {}): Env {
  return {
    dx: 0, dy: 0, dz: 0, dist: 1,
    form: { driftX: 0, wander: 0, orbit: 0, spread: 0, conv: 0 },
    W, H, t: 0, frameN: 0, dt: 1, c: 12, G: 1,
    spark: () => {}, supernova: () => {}, spawn: () => {}, neighbors: () => [],
    grid: () => ({ sample: () => 0, deposit: () => {}, gradient: () => ({ x: 0, y: 0 }), decay: () => {}, clear: () => {} }),
    ...over,
  };
}

/** One frame of the streamlines underlay: the grid walk field.ts:2413 performs verbatim. */
function drawOneFrame(bodies: Body[], env: Env): void {
  for (let gx = GRID / 2; gx < W; gx += GRID) {
    for (let gy = GRID / 2; gy < H; gy += GRID) {
      forceAt(bodies, forces, env, gx, gy);
    }
  }
}

// ── 1. the accretion budget is UNCHANGED, not merely "incremented once" ──────────────────────────

test('drawing streamlines over a sink leaves its accretion untouched, frame after frame', () => {
  const sink = body(['sink'], W / 2, H / 2, { absorbR: 150, capacity: 4 });
  let supernovas = 0;
  let sparks = 0;
  const env = liveEnv({ supernova: () => { supernovas++; }, spark: () => { sparks++; } });

  for (let frame = 0; frame < 12; frame++) {
    env.frameN = frame;
    env.t = frame / 60;
    drawOneFrame([sink], env);
    // asserted EVERY frame: a leak that is self-limiting by accident (cap never cleared) and a leak
    // that accretes on every sample both fail here, and they fail differently.
    assert.equal(sink.accreted, 0, `frame ${frame}: drawing must not accrete (accreted = ${sink.accreted})`);
  }
  assert.equal(supernovas, 0, 'drawing must never detonate a real body');
  assert.equal(sparks, 0, 'drawing must never throw sparks into the live field');
});

// ── 2. a sample is a function of its point, not of the sampling history ──────────────────────────

test('two probe samples at the same point agree, whatever was sampled between them', () => {
  // `jet` at its nozzle relaunches the probe along a randomly jittered heading drawn from `e.rng`.
  // Threading the simulation's live env into the probe made a reading depend on how many samples had
  // been taken before it: the same point read a different vector every time it was drawn. (A `sink`
  // sits in the field too, so the `cap` carry-over — the other half of #1155 — is exercised by the
  // in-between sweep; that its accretion stays put is test 1.)
  const nozzle = body(['jet'], 200, 150, { range: 300 });
  const sink = body(['sink'], 600, 450, { absorbR: 150, capacity: 1_000_000 });
  const bodies = [nozzle, sink];
  const env = liveEnv({ rng: seededRng(7) });

  const first = forceAt(bodies, forces, env, 210, 150); // inside the nozzle (dist < 24)
  assert.ok(Math.hypot(first.fx, first.fy) > 0, 'the probe point reads a live jet relaunch');

  // …sample the rest of the field in between — a full frame's grid walk, plus more nozzle points.
  drawOneFrame(bodies, env);
  forceAt(bodies, forces, env, 196, 152);
  forceAt(bodies, forces, env, 204, 144);

  const second = forceAt(bodies, forces, env, 210, 150);
  assert.deepEqual(second, first, 'the same point must read the same vector after any other sampling');
});

// ── 3. drawing does not consume the simulation's seeded rng (record/replay determinism) ──────────

test('drawing does not draw from the simulation rng stream', () => {
  const jet = body(['jet'], W / 2, H / 2, { range: 900 }); // jet jitters through e.rng
  let draws = 0;
  const env = liveEnv({ rng: () => { draws++; return 0.5; } });

  drawOneFrame([jet], env);

  assert.equal(draws, 0, `a diagnostic must not advance the seeded stream (drew ${draws} values)`);
});
