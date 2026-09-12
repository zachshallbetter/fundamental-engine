/**
 * Streamlines / vector-field render (§20.6, diagnostic) — instead of the matter, draw
 * the *forces themselves*. At a grid of probe points we measure the net push a still test particle
 * would feel and draw a short arrow along it, so the invisible field a layout creates becomes
 * visible. Invaluable in the Lab: place forces, then see the field they make.
 *
 * `forceAt` mirrors the integrator's body-force loop (same range cull), minus the per-particle
 * modifier pass — a faithful-enough probe for a diagnostic.
 *
 * PURITY (#1155). A probe is an instrument, not matter: it may READ the field and must never write
 * to it. That contract used to be incidental rather than structural — the loop ran each body's real
 * `apply()` against the CALLER'S LIVE ENV, so `sink` advanced a real body's accretion budget and
 * could fire the live `supernova` from a drawing, `diffuse`/`memory` wore the real scalar grids, a
 * source could spawn, and every sample advanced the simulation's seeded rng. Now every sample runs
 * under this module's own `probeEnv`, whose writing services are inert.
 *
 * The two halves are inseparable. `sink`'s guard is `if (p.cap || …) return`, so while the shared
 * probe carried `cap` between samples the leak was self-limiting BY ACCIDENT: a body was
 * over-accreted exactly once, and every later `sink`/`warp` sample silently short-circuited (the
 * drawn field going quietly wrong downstream of the first sink). Clearing `cap` per sample WITHOUT
 * an inert path first would convert that one-off into one accretion per probe point per frame —
 * hundreds a second, racing a real body to capacity. The path is inert first; `cap` is cleared
 * because it is.
 */
import type { Body, Env, Formation, ForceRegistry, Particle, ScalarGrid } from './types.ts';

const probe: Particle = { x: 0, y: 0, vx: 0, vy: 0, m: 1, heat: 0, size: 1, cap: null };

/** The probe's OWN noise, never the simulation's (mulberry32 — the engine's stream shape). Reseeded
 *  at the top of every sample, so a stochastic force (`jet`'s nozzle cone, `thermal`'s kick) reads the
 *  same at the same point however many samples came before it, and a seeded run a host is recording
 *  is never advanced by drawing a diagnostic. */
const PROBE_SEED = 0x9e3779b9;
let noise = PROBE_SEED;
function probeRng(): number {
  noise = (noise + 0x6d2b79f5) | 0;
  let t = Math.imul(noise ^ (noise >>> 15), 1 | noise);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** The live env this sample mirrors — the source behind the read-through services below. */
let live: Env | null = null;

/** A read-through, write-DROPPING view of a live scalar grid: `diffuse`/`memory` still read the real
 *  field (an honest diagnostic reading), but their deposits never wear it. Cached per grid name, so a
 *  whole frame's grid walk allocates nothing. */
const gridViews = new Map<string, ScalarGrid>();
function probeGrid(name: string): ScalarGrid {
  let v = gridViews.get(name);
  if (!v) {
    v = {
      sample: (x, y) => live?.grid(name).sample(x, y) ?? 0,
      gradient: (x, y) => live?.grid(name).gradient(x, y) ?? { x: 0, y: 0 },
      deposit: () => {},
      decay: () => {},
      clear: () => {},
    };
    gridViews.set(name, v);
  }
  return v;
}

/** Copied, never aliased, so no force can write through it back into the live env. */
const probeForm: Formation = { driftX: 0, wander: 0, orbit: 0, spread: 0, conv: 0 };

/**
 * The one env every probe sample runs under. Its per-frame SCALARS mirror the caller's live env (so
 * the reading is of the field as it is right now); every service that WRITES is inert —
 * `spark`/`supernova`/`spawn` are no-ops, grids drop deposits, `rng` is the probe's own stream. The
 * `probe` marker tells a force that writes engine state outside the probe particle (today only
 * `sink`'s accretion) that this pass is a reading, not a capture.
 */
const probeEnv: Env = {
  dx: 0,
  dy: 0,
  dz: 0,
  dist: 1,
  form: probeForm,
  W: 0,
  H: 0,
  t: 0,
  frameN: 0,
  dt: 1,
  c: 12,
  G: 1,
  probe: true,
  rng: probeRng,
  spark: () => {},
  supernova: () => {},
  spawn: () => {},
  neighbors: (p, r) => live?.neighbors(p, r) ?? [],
  grid: probeGrid,
};

/** Point the probe env at this sample's live env: mirror the read-only per-frame state and reseed the
 *  probe's noise. The writing services are never re-pointed. */
function syncProbeEnv(env: Env): Env {
  live = env;
  probeEnv.W = env.W;
  probeEnv.H = env.H;
  probeEnv.D = env.D;
  probeEnv.t = env.t;
  probeEnv.frameN = env.frameN;
  probeEnv.dt = env.dt;
  probeEnv.c = env.c;
  probeEnv.G = env.G;
  probeEnv.scrollV = env.scrollV;
  probeEnv.integrator = env.integrator;
  probeEnv.fieldAt = env.fieldAt; // a pure read (netField over the live bodies)
  probeEnv.accum = undefined; // attribution belongs to the integrator's pass, not to a drawing
  probeEnv.kinTouch = undefined;
  // the probe sits on the body plane, so the z leg of every force vanishes — and is never the stale
  // value the integrator happened to leave on the live env.
  probeEnv.dz = 0;
  Object.assign(probeForm, env.form);
  noise = PROBE_SEED;
  return probeEnv;
}

/** Net force a zero-velocity test particle would feel at (x, y) — the field vector.
 *  A force that defines a `field()` (its visual/structure field) contributes that instead
 *  of its `apply`, so velocity- and charge-dependent forces (magnetism, charge) appear here
 *  even though they no-op on a still, neutral probe.
 *
 *  READ-ONLY: `env` supplies the per-frame reading only — the forces run against `probeEnv`, so this
 *  never writes to the simulation (#1155). */
export function forceAt(
  bodies: readonly Body[],
  forces: ForceRegistry,
  env: Env,
  x: number,
  y: number,
): { fx: number; fy: number } {
  probe.x = x;
  probe.y = y;
  probe.vx = 0;
  probe.vy = 0;
  probe.heat = 0;
  probe.cap = null; // a fresh instrument every sample — safe ONLY because the path is inert (header)
  const pe = syncProbeEnv(env);
  let fxField = 0; // field() contributions, accumulated apart from the apply probe
  let fyField = 0;
  for (const b of bodies) {
    if (!b.vis || b.tokens.length === 0) continue;
    // mirror the integrator's shaped reference (§ Stage C): a shaped body warps the field from the
    // nearest point on its BOX, not its centre — so the grid / streamlines bend around an element's
    // whole outline (a button, a wide headline), not a single point. Clamp inlined (no alloc); inside
    // the box dx=dy=0 → no directional pull, the right no-op.
    let dx: number;
    let dy: number;
    if (b.shaped) {
      const lx = b.cx - b.hw;
      const rx = b.cx + b.hw;
      const ty = b.cy - b.hh;
      const by = b.cy + b.hh;
      dx = (x < lx ? lx : x > rx ? rx : x) - x;
      dy = (y < ty ? ty : y > by ? by : y) - y;
    } else {
      dx = b.cx - x;
      dy = b.cy - y;
    }
    const d2 = dx * dx + dy * dy;
    if (b.range > 0 && d2 >= b.range * b.range * 2.56) continue; // same cull as the integrator
    const d = Math.sqrt(d2);
    pe.dx = dx;
    pe.dy = dy;
    pe.dist = d < 1 ? 1 : d;
    for (const tok of b.tokens) {
      const f = forces[tok];
      if (!f || f.modify) continue;
      if (f.field) {
        const v = f.field(b, x, y);
        fxField += v.x;
        fyField += v.y;
      } else {
        f.apply(b, probe, pe);
      }
    }
  }
  return { fx: probe.vx + fxField, fy: probe.vy + fyField };
}

/** The net *structure* field at (x, y): the superposition of every visible body's `field()`
 *  contribution (the dipoles and monopoles only — no apply-probe), with the same range cull
 *  as the integrator. This is the field the streamlines view draws and the vector matter
 *  follows under `fieldflow`. Pure: same inputs, same output, no `env` mutation (the `field()`
 *  hooks read only `b` and the point, so it is safe to call mid-integration). */
export function netField(
  bodies: readonly Body[],
  forces: ForceRegistry,
  x: number,
  y: number,
): { x: number; y: number } {
  let fx = 0;
  let fy = 0;
  for (const b of bodies) {
    if (!b.vis || b.tokens.length === 0) continue;
    if (b.range > 0) {
      const dx = b.cx - x;
      const dy = b.cy - y;
      if (dx * dx + dy * dy >= b.range * b.range * 2.56) continue; // same cull as the integrator
    }
    for (const tok of b.tokens) {
      const f = forces[tok];
      if (f?.field) {
        const v = f.field(b, x, y);
        fx += v.x;
        fy += v.y;
      }
    }
  }
  return { x: fx, y: fy };
}
