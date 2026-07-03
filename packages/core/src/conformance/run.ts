/**
 * The conformance runner — simulates a `Scenario` with the real engine, headless.
 *
 * Mirrors the integrator benchmark (FieldStore + Env + `step()`), with real
 * `neighbors` (class B) and a real `ScalarGridImpl` advanced each frame (class C).
 * RNG forces (thermal, jet) are made deterministic by injecting a seeded PRNG through
 * the `Env.rng` seam (no global `Math.random` monkey-patch). Returns the full trajectory plus each particle's
 * frame-0 force delta (one direct `apply`, before friction) for exact/invariant checks.
 */
import type { Body, Env, ForceRegistry, Particle } from '../core/types.ts';
import { FieldStore } from '../core/field-store.ts';
import { step } from '../core/integrator.ts';
import { netField } from '../core/streamlines.ts';
import { ScalarGridImpl } from '../core/scalar-grid.ts';
import { createRegistry } from '../core/registry.ts';
import { registerCoreForces } from '../forces/index.ts';
import { registerNaturalForces } from '../forces/natural.ts';
import { registerExtendedForces } from '../forces/extended.ts';
import { conditions } from '../core/conditions.ts';
import type { ApplyDelta, FrameState, Scenario, ScenarioResult } from './types.ts';

// A large field centred on the action: the integrator wraps toroidally at the field
// origin, so scenarios run in a big positive region where outward/long trajectories
// (repel, charge, tether, swirl, buoyancy, thermal) never reach an edge.
const W = 6000;
const H = 4000;
const CENTER = { x: 3000, y: 2000 };
// position-dependent forces (a fixed lattice / a curl-noise field) are left at their
// original coordinates — translating them would change the sampled field, and they
// don't wander far enough to wrap anyway.
const NO_OFFSET = new Set(['crystallize', 'wind', 'warp']);

/** Centre a scenario in positive space (a transparent translation — every conformance
 *  check is relative, so a uniform offset of body + particles changes nothing). */
function centerScenario(s: Scenario): Scenario {
  if (NO_OFFSET.has(s.force)) return s;
  return {
    ...s,
    body: {
      ...s.body,
      cx: (s.body.cx ?? 0) + CENTER.x,
      cy: (s.body.cy ?? 0) + CENTER.y,
      // morph's target points live in the same world space — translate them too, else the
      // shape would sit at the origin while the matter is centred (and wrap toward it).
      ...(s.body.targets
        ? { targets: s.body.targets.map((t) => ({ x: t.x + CENTER.x, y: t.y + CENTER.y })) }
        : {}),
    },
    // extra bodies share the world frame — translate their centres by the same offset.
    ...(s.extraBodies
      ? {
          extraBodies: s.extraBodies.map((e) => ({
            tokens: e.tokens,
            attrs: {
              ...e.attrs,
              cx: (e.attrs.cx ?? 0) + CENTER.x,
              cy: (e.attrs.cy ?? 0) + CENTER.y,
            },
          })),
        }
      : {}),
    particles: s.particles.map((p) => ({ ...p, x: p.x + CENTER.x, y: p.y + CENTER.y })),
  };
}

/** A seeded PRNG (mulberry32) — same family the bench uses, for reproducible RNG runs. */
function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The full force registry (canonical + natural + extended). */
export function allForces(): ForceRegistry {
  const reg = createRegistry();
  registerCoreForces(reg);
  registerNaturalForces(reg);
  registerExtendedForces(reg);
  return reg.forces;
}

/** A full `Body` from tokens + partial attrs (the engine's default shape). */
function resolvePartialBody(tokens: string[], attrs: Partial<Body>): Body {
  const angle = attrs.angle ?? 0;
  return {
    el: {} as HTMLElement,
    tokens,
    strength: 1,
    range: 300,
    absorbR: 64,
    capacity: 60,
    spin: 1,
    angle,
    ux: Math.cos(angle),
    uy: Math.sin(angle),
    when: '',
    feedback: false,
    fmin: 0,
    fmax: 0,
    opsz: '',
    M: 1,
    cx: 0,
    cy: 0,
    hw: 0,
    hh: 0,
    on: false,
    vis: true,
    accreted: 0,
    count: 0,
    d: 0,
    ...attrs,
    // keep ux/uy consistent if angle was overridden
    ...(attrs.angle != null ? { ux: Math.cos(attrs.angle), uy: Math.sin(attrs.angle) } : {}),
  };
}

/** A full `Body` from a scenario's partial attrs (the engine's default shape). */
export function resolveBody(s: Scenario): Body {
  return resolvePartialBody(s.tokens ?? [s.force], s.body);
}

function makeParticle(p: import('./types.ts').ScenarioParticle): Particle {
  return {
    x: p.x,
    y: p.y,
    vx: p.vx ?? 0,
    vy: p.vy ?? 0,
    m: 1,
    heat: p.heat ?? 0,
    size: p.size ?? 1,
    cap: null,
    ...(p.charge != null ? { charge: p.charge } : {}),
    ...(p.color != null ? { color: p.color } : {}),
    ...(p.species != null ? { species: p.species } : {}),
    ...(p.gx != null ? { gx: p.gx } : {}),
  };
}

function makeEnv(store: FieldStore, rng?: () => number): Env {
  const grids = new Map<string, ScalarGridImpl>();
  return {
    dx: 0,
    dy: 0,
    dist: 1,
    // the injected rng seam (Env.rng): forces that draw randomness (thermal, jet, spawn scatter) read
    // `e.rng ?? Math.random`, so seeding this makes a run reproducible with NO global Math.random patch.
    ...(rng ? { rng } : {}),
    form: { driftX: 0, wander: 0, orbit: 0, spread: 0, conv: 0 },
    W,
    H,
    t: 0,
    frameN: 0,
    dt: 1,
    c: 12,
    G: 1,
    spark: () => {},
    supernova: () => {},
    // class-[S] sources (spawn) create matter — wire it to the store so a source
    // experiment can observe the pool grow (and mortal matter despawn) headlessly.
    spawn: (sp) =>
      void store.add({
        x: sp.x ?? 0,
        y: sp.y ?? 0,
        vx: sp.vx ?? 0,
        vy: sp.vy ?? 0,
        m: 1,
        heat: sp.heat ?? 0,
        size: sp.size ?? 1,
        cap: null,
        ...(sp.age != null ? { age: sp.age } : {}),
      }),
    neighbors: (p, r) => store.neighbors(p, r),
    grid: (name) => {
      let g = grids.get(name);
      if (!g) {
        const mode = name.startsWith('wave') ? 'wave' : name.startsWith('memory') ? 'memory' : 'diffuse';
        g = new ScalarGridImpl(W, H, mode);
        grids.set(name, g);
      }
      return g;
    },
    // expose the grid map so the runner can advance buffers each frame
    __grids: grids,
  } as Env & { __grids: Map<string, ScalarGridImpl> };
}

const snap = (p: Particle): FrameState => ({
  x: p.x,
  y: p.y,
  vx: p.vx,
  vy: p.vy,
  heat: p.heat,
  speed: Math.hypot(p.vx, p.vy),
  cap: !!p.cap,
  // record carried pigment so a `pigment` scenario's trajectory shows the real color
  // transport (§20.8); undefined until matter is stained, so untinted runs are unaffected.
  ...(p.color != null ? { color: p.color } : {}),
});

/** Per-particle frame-0 force effect: one direct `apply` of the body's non-modifier
 *  tokens on a clone of each initial particle, with real neighbours from the store. */
function frameZeroDelta(s: Scenario, body: Body, forces: ForceRegistry, store: FieldStore, rng?: () => number): ApplyDelta[] {
  return s.particles.map((sp) => {
    const p = makeParticle(sp);
    const vx0 = p.vx;
    const vy0 = p.vy;
    const dx = body.cx - p.x;
    const dy = body.cy - p.y;
    const d = Math.hypot(dx, dy);
    // a transient env for the single apply (real neighbours, fresh grid)
    const env = makeEnv(store, rng);
    env.dx = dx;
    env.dy = dy;
    env.dist = d < 1 ? 1 : d;
    // field-following forces (`fieldflow`) read the net structure field; step() sets this
    // for the trajectory, so mirror it here so the frame-0 delta isn't a no-op.
    env.fieldAt = (x, y) => netField([body], forces, x, y);
    for (const tok of body.tokens) {
      const f = forces[tok];
      if (f && !f.modify) f.apply(body, p, env);
    }
    return { dvx: p.vx - vx0, dvy: p.vy - vy0 };
  });
}

/** Simulate a scenario with the real engine; deterministic (RNG seeded if requested). */
export function runScenario(input: Scenario, forces: ForceRegistry = allForces()): ScenarioResult {
  const s = centerScenario(input);
  const store = new FieldStore();
  for (const sp of s.particles) store.add(makeParticle(sp));
  const body = resolveBody(s);
  // cross-body scenarios (workover v0.3): extra bodies simulate alongside the main one.
  const bodies = [body, ...(s.extraBodies ?? []).map((e) => resolvePartialBody(e.tokens, e.attrs))];

  // Deterministic randomness via the INJECTED Env.rng seam (not a global Math.random monkey-patch, #981):
  // one seeded PRNG instance is threaded through the frame-0 delta env and the trajectory env, so it is
  // consumed in exactly the historical order (frame-0 apply first, then each stepped frame). Unseeded
  // scenarios pass `undefined` → forces fall back to Math.random, unchanged.
  const rng = s.seed != null ? mulberry(s.seed) : undefined;
  const env = makeEnv(store, rng) as Env & { __grids: Map<string, ScalarGridImpl> };

  // build the spatial index first so neighbour queries (class B) see the other
  // particles, then measure frame-0 deltas on pristine clones.
  store.reindex();
  const applyDelta = frameZeroDelta(s, body, forces, store, rng);

  const trajectory: FrameState[][] = [store.particles.map(snap)];
  for (let f = 0; f < s.frames; f++) {
    env.frameN = f;
    env.t = f / 60;
    store.reindex();
    step({ store, bodies, env, forces, conditions });
    if (env.dt) for (const g of env.__grids.values()) g.step();
    trajectory.push(store.particles.map(snap));
  }
  // report the centred scenario so r.scenario / r.body / r.trajectory share one frame.
  return { scenario: s, trajectory, applyDelta, body };
}
