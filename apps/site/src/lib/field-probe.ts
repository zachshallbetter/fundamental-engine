/**
 * Real field-line tracing for the manual's force demos.
 *
 * Instead of hand-drawing schematic arrows, this seeds probe particles around a
 * body and runs the **actual engine** (`runScenario`, the same headless runner the
 * conformance suite uses) forward N frames. The particles' real trajectories ARE
 * the field lines — magnetism traces true cyclotron arcs, attract real decaying
 * spirals, swirl real orbits, charge real +/− demixing. Nothing is faked; it's the
 * same math that moves the live particles.
 *
 * Paths come back in body-relative engine units, auto-framed to a unit box, so the
 * draw step can scale them to any canvas size without re-running the simulation.
 */
import {
  runScenario,
  polePair,
  dipoleField,
  traceFieldLines,
  type Scenario,
  type ScenarioParticle,
  type ScenarioResult,
} from 'field-ui';

export interface Pt {
  x: number;
  y: number;
}
export interface FieldTrace {
  /** polylines in body-relative units, normalized so the framed extent is ~[-1, 1]. */
  paths: Pt[][];
  /** annotation circles (normalized radius) — capture ring, rest shell, etc. */
  rings: { r: number; dash: boolean }[];
  /** a special non-traced visual (pigment has no kinematic effect). */
  special?: 'pigment';
}

type VelMode = 'orbit' | 'in' | 'out' | 'none' | 'dir' | 'against' | 'up';
type SeedMode = 'ring' | 'grid' | 'cluster' | 'cross' | 'twoRing' | 'targets';

interface ProbeCfg {
  tokens?: string[]; // body tokens (default [token]); modifiers pair with a sibling
  strength?: number;
  spin?: number;
  angle?: number; // degrees
  range?: number; // engine units (default RANGE)
  seed: SeedMode;
  vel: VelMode;
  v0?: number; // seed speed
  n?: number; // seed count (ring/cluster)
  charge?: 'all' | 'split'; // give probes a charge (for charge/magnetism)
  sizeVary?: boolean; // vary probe size across the grid (for buoyancy sorting)
  size?: number; // uniform probe radius (collide needs discs big enough to contact)
  species?: '1pred'; // first probe is predator (hunt)
  seedR?: number; // ring seed radius (engine units; default SEED_R)
  clusterR?: number; // cluster spread radius (engine units; default RANGE·0.5)
  bw?: number; // demo body half-width (gate's membrane spans the element box)
  bh?: number; // demo body half-height
  frames?: number;
  rings?: (r: number) => number[]; // annotation radii in engine units, given range
  special?: 'pigment';
}

const RANGE = 150; // the canonical reach all probes use, in engine units
const SEED_R = RANGE * 0.85; // default seed ring radius
const FRAMES = 80;

// Position-dependent forces the conformance runner leaves un-translated (their field is
// sampled in absolute space). Their body would otherwise sit at the origin — right on the
// toroidal seam — so any −x/−y motion wraps to the far corner. Seed them in safe positive
// space instead; the curl/lattice phase just shifts, which is invisible.
const NO_OFFSET = new Set(['wind', 'crystallize']);
const SAFE_ORIGIN = { x: 3000, y: 2000 };

// Per-force probe recipe. Chosen so the real trajectories read clearly in one frame.
const CFG: Record<string, ProbeCfg> = {
  // ── canonical nine ──────────────────────────────────────────────────────────
  attract: { strength: 2, seed: 'ring', vel: 'orbit', v0: 2.4, n: 14 },
  repel: { strength: 2, seed: 'ring', vel: 'none', n: 14 },
  swirl: { strength: 2, spin: 1, seed: 'twoRing', vel: 'orbit', v0: 1.2, n: 10 },
  stream: { strength: 2, angle: -90, seed: 'grid', vel: 'none' },
  viscosity: { strength: 1.5, seed: 'ring', vel: 'orbit', v0: 6, n: 14 },
  // seed a tight inner ring feeding the nozzle so probes actually reach it (<24px) and get
  // relaunched along the heading — a wide ring at weak feed never arrives within the run.
  jet: { strength: 1.6, angle: -90, seed: 'ring', vel: 'in', v0: 2, n: 16, seedR: 60, frames: 130 },
  tether: { strength: 1, seed: 'twoRing', vel: 'none', n: 12, rings: (r) => [r * 0.6] },
  wall: { strength: 1, seed: 'grid', vel: 'in', v0: 2.5 },
  sink: { strength: 0.9, tokens: ['sink', 'attract'], seed: 'ring', vel: 'in', v0: 1.2, n: 16, rings: (r) => [64] },

  // ── natural primitives ──────────────────────────────────────────────────────
  gravity: { strength: 260, seed: 'ring', vel: 'orbit', v0: 2.6, n: 14 },
  // two rings of mixed charge demix: like-sign sprays out, opposite pulls across. Rings
  // (not a blob) avoid the 1/d² singularity at the centre that rockets a few probes off-frame.
  charge: { strength: 150, seed: 'twoRing', vel: 'none', n: 12, charge: 'split', frames: 90 },
  // pure magnetism: a grid of moving charges, each curling into a real cyclotron loop of
  // radius ≈ v0/(spin·strength) ≈ 50u. range must exceed that so the loop stays in-field
  // (magnetism, unlike buoyancy/wind, has no range-0 global mode — range 0 disables it).
  magnetism: { strength: 0.05, spin: 1, range: 240, seed: 'grid', vel: 'up', v0: 3.6, charge: 'all', frames: 95 },
  thermal: { strength: 1.6, seed: 'cluster', vel: 'none', n: 26, frames: 70 },
  // disc radius 7 + a close ring driven hard inward so the probes actually reach contact before
  // friction stalls them (size-1 points at a wide ring just coast to a halt and never touch).
  collide: { strength: 1, seed: 'ring', vel: 'in', v0: 3.5, n: 16, size: 7, seedR: 50, frames: 90 },
  diffuse: { strength: 2.4, seed: 'ring', vel: 'none', n: 16 },
  // a close ring the expanding shock-train sweeps outward (the pulse model — see propagate's
  // source/apply): each ring carries the probes out, so the path reads as a real travelling wave.
  propagate: { strength: 3, seed: 'ring', vel: 'none', n: 16, seedR: 45, frames: 60 },
  memory: { strength: 2.4, seed: 'ring', vel: 'orbit', v0: 2.2, n: 12 },

  // ── designed-extended ───────────────────────────────────────────────────────
  // a short run so probes TRANSIT the lens once and bend, rather than coasting to a halt inside
  // it (friction) and spinning in place — a lens bends a passing ray, it isn't a centrifuge.
  lens: { strength: 1.2, spin: 1, seed: 'cross', vel: 'dir', v0: 3, angle: 0, frames: 26 },
  // a wide membrane (bw/bh) spanning the stage, with a grid of probes driven AGAINST the heading
  // into it: those crossing the box reflect back the way they came — the one-way pass is the path.
  gate: { strength: 1, seed: 'grid', vel: 'against', v0: 2.6, bw: 130, bh: 80 },
  // size-1 matter is neutrally buoyant; vary size so light rises and dense sinks (sorting).
  buoyancy: { strength: 0.6, range: 0, seed: 'grid', vel: 'none', sizeVary: true },
  shear: { strength: 2, angle: 0, seed: 'grid', vel: 'none' },
  // soft snap (low strength) + fast inward seed → particles travel from the rim and
  // settle onto the lattice, so the path reads (a hard snap locks them instantly).
  crystallize: { strength: 0.5, seed: 'ring', vel: 'in', v0: 8, n: 20, frames: 90 },
  // probes start with varied (tangential) headings so the flock visibly converging to one
  // shared direction is the path — seeding them already-parallel would show no alignment.
  align: { strength: 1, seed: 'ring', vel: 'orbit', v0: 2.5, n: 12 },
  // WIND_SCALE is a tiny 0.01, and the curl is divergence-free (drift stays bounded by
  // the eddy size), so it needs a large amplitude to trace a visible meander. range 0
  // (global) so every grid probe feels the curl, not just those inside a finite reach.
  wind: { strength: 90, range: 0, seed: 'grid', vel: 'none', frames: 110 },
  // seed a spread cluster so neighbours sit in the mid-range PULL band (not the short-range
  // repel core) — they then draw together into a droplet, which is the surface-tension path.
  cohesion: { strength: 1.6, seed: 'cluster', vel: 'none', n: 24, clusterR: RANGE * 0.95 },
  pressure: { strength: 1.6, seed: 'cluster', vel: 'none', n: 30 },
  hunt: { strength: 1.6, seed: 'cluster', vel: 'none', n: 14, species: '1pred' },
  spawn: { strength: 1.4, angle: -90, seed: 'ring', vel: 'none', n: 0, frames: 70 },
  link: { strength: 1.6, seed: 'cluster', vel: 'none', n: 18 },
  morph: { strength: 2.4, seed: 'targets', vel: 'none', n: 24 },
  resonate: { strength: 1.4, tokens: ['resonate', 'attract'], spin: 2, seed: 'ring', vel: 'orbit', v0: 2.2, n: 12 },
  spotlight: { strength: 2, tokens: ['spotlight', 'stream'], angle: -90, seed: 'grid', vel: 'none' },
  pigment: { strength: 0, seed: 'ring', vel: 'none', special: 'pigment' },
};

/** Build seed particles per the recipe. Positions are in engine units about (0,0).
 *  `angleDeg` is the live body heading — drives 'dir' seed velocity so the probes enter
 *  along the same axis the force pushes (lens, gate, align, etc.). */
function seedParticles(cfg: ProbeCfg, angleDeg: number): ScenarioParticle[] {
  const ps: ScenarioParticle[] = [];
  const v0 = cfg.v0 ?? 2;
  const ang = (angleDeg * Math.PI) / 180;
  const vel = (a: number): { vx: number; vy: number } => {
    switch (cfg.vel) {
      case 'orbit': return { vx: -Math.sin(a) * v0, vy: Math.cos(a) * v0 };
      case 'in': return { vx: -Math.cos(a) * v0, vy: -Math.sin(a) * v0 };
      case 'out': return { vx: Math.cos(a) * v0, vy: Math.sin(a) * v0 };
      case 'dir': return { vx: Math.cos(ang) * v0, vy: Math.sin(ang) * v0 };
      case 'against': return { vx: -Math.cos(ang) * v0, vy: -Math.sin(ang) * v0 };
      case 'up': return { vx: 0, vy: -v0 };
      default: return { vx: 0, vy: 0 };
    }
  };
  const charge = (x: number, i: number): number | undefined =>
    cfg.charge === 'all' ? 1 : cfg.charge === 'split' ? (x >= 0 ? 1 : -1) : undefined;

  if (cfg.seed === 'ring' || cfg.seed === 'twoRing') {
    const n = cfg.n ?? 14;
    const outer = cfg.seedR ?? SEED_R;
    const radii = cfg.seed === 'twoRing' ? [outer, RANGE * 0.32] : [outer];
    for (const r of radii) {
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const x = Math.cos(a) * r, y = Math.sin(a) * r;
        const v = vel(a);
        ps.push({ x, y, vx: v.vx, vy: v.vy, charge: charge(x, i), size: cfg.size });
      }
    }
  } else if (cfg.seed === 'grid') {
    const span = (cfg.range && cfg.range > 0 ? cfg.range : RANGE) * 1.1;
    const N = 6;
    for (let gx = 0; gx < N; gx++) {
      for (let gy = 0; gy < N; gy++) {
        const x = -span + (gx / (N - 1)) * span * 2;
        const y = -span + (gy / (N - 1)) * span * 2;
        const a = Math.atan2(y, x);
        const v = vel(a);
        // size 0.4 (dense → sinks) … 2.0 (light → rises) by column, for buoyancy sorting
        const size = cfg.sizeVary ? 0.4 + (gx / (N - 1)) * 1.6 : undefined;
        ps.push({ x, y, vx: v.vx, vy: v.vy, charge: charge(x, gx * N + gy), size, gx: gx / N });
      }
    }
  } else if (cfg.seed === 'cluster') {
    const n = cfg.n ?? 24;
    const spread = cfg.clusterR ?? RANGE * 0.5;
    let s = 1337;
    const rnd = () => { s = (s * 1664525 + 1013904223) & 0x7fffffff; return s / 0x7fffffff; };
    for (let i = 0; i < n; i++) {
      const r = Math.sqrt(rnd()) * spread;
      const a = rnd() * Math.PI * 2;
      const x = Math.cos(a) * r, y = Math.sin(a) * r;
      const v = vel(a);
      const species = cfg.species === '1pred' ? (i === 0 ? 1 : 0) : undefined;
      ps.push({ x, y, vx: v.vx, vy: v.vy, charge: charge(x, i), species, gx: rnd(), size: cfg.size });
    }
  } else if (cfg.seed === 'cross') {
    // a line of particles entering from the left, crossing the body
    const n = 9;
    for (let i = 0; i < n; i++) {
      const y = -RANGE * 0.7 + (i / (n - 1)) * RANGE * 1.4;
      const v = vel(0);
      ps.push({ x: -RANGE * 0.95, y, vx: v.vx, vy: v.vy });
    }
  } else if (cfg.seed === 'targets') {
    // morph: scattered seeds, each with a stable gx so the engine assigns it a target
    const n = cfg.n ?? 24;
    let s = 99;
    const rnd = () => { s = (s * 1664525 + 1013904223) & 0x7fffffff; return s / 0x7fffffff; };
    for (let i = 0; i < n; i++) {
      const r = Math.sqrt(rnd()) * RANGE * 0.9;
      const a = rnd() * Math.PI * 2;
      ps.push({ x: Math.cos(a) * r, y: Math.sin(a) * r, gx: i / n });
    }
  }
  return ps;
}

/** A simple star/asterisk target set for the morph demo (a mark, never words — §11). */
function morphTargets(): { x: number; y: number }[] {
  const pts: { x: number; y: number }[] = [];
  const R = RANGE * 0.55;
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i / 5) * Math.PI * 2;
    pts.push({ x: Math.cos(a) * R, y: Math.sin(a) * R });
    pts.push({ x: Math.cos(a) * R * 0.4, y: Math.sin(a) * R * 0.4 });
  }
  return pts;
}

/**
 * Live body attributes read off the actual demo chip (its `data-*`). The trace runs the
 * SAME force the chip configures — same tokens, strength, range, spin, heading — so the
 * traced path matches what the live particles do, not an idealized stand-in.
 */
export interface ProbeOverride {
  tokens?: string[]; // full data-body token list, e.g. ['magnetism','attract']
  strength?: number;
  range?: number;
  spin?: number;
  angleDeg?: number;
}

/** The raw engine run behind a force's demo: the full trajectory (positions + velocities),
 *  the resolved body, and the effective attrs. Shared by the drawer (`traceField`) and the
 *  per-force accuracy test, so both verify the exact same simulation the page renders. */
export interface RawTrace {
  result: ScenarioResult;
  range: number;
  angleDeg: number;
  tokens: string[];
  origin: Pt;
}

/** Resolve the live body attrs (override ?? CFG) and run the engine. Returns null for the
 *  non-kinematic `pigment` special and for unknown tokens. */
export function traceRaw(token: string, override: ProbeOverride = {}): RawTrace | null {
  const cfg = CFG[token];
  if (!cfg || cfg.special === 'pigment') return null;
  // live chip attrs win; the CFG value is the fallback when the chip omits one.
  const strength = override.strength ?? cfg.strength ?? 1.5;
  const range = override.range ?? cfg.range ?? RANGE;
  const spin = override.spin ?? cfg.spin ?? 1;
  const angleDeg = override.angleDeg ?? cfg.angle ?? -90;
  const tokens = override.tokens ?? cfg.tokens ?? [token];

  const org = NO_OFFSET.has(token) ? SAFE_ORIGIN : { x: 0, y: 0 };
  const particles = seedParticles(cfg, angleDeg).map((p) => ({ ...p, x: p.x + org.x, y: p.y + org.y }));
  const body: Scenario['body'] = {
    cx: org.x, cy: org.y,
    strength,
    // the live scanner maps data-strength → both strength AND M; resolveBody does not,
    // so set M here or gravity/charge (which source from b.M) would run at M=1 (inert).
    M: strength,
    range,
    spin,
    angle: (angleDeg * Math.PI) / 180,
    hw: cfg.bw ?? 26, hh: cfg.bh ?? 14,
    on: true, // enables propagate emission, spawn source, thermal heat — never disables a force
    ...(token === 'morph' ? { targets: morphTargets().map((t) => ({ x: t.x + org.x, y: t.y + org.y })) } : {}),
  };
  const scenario: Scenario = {
    force: token,
    tokens,
    label: `${token} field lines`,
    family: 'natural',
    klass: 'A',
    body,
    particles,
    frames: cfg.frames ?? FRAMES,
    seed: 7,
  };
  return { result: runScenario(scenario), range, angleDeg, tokens, origin: org };
}

/**
 * Auto-frame world-space polylines about `(cx, cy)`: scale so the robust extent (the `pct`
 * percentile of point radii, floored at `floor`) maps to 1, then SPLIT each line into
 * in-bounds runs at radius `clip`. Clipping must break a line, never chord across a gap — a
 * dropped middle point would otherwise join its neighbours with a straight line through the
 * body. Shared by the trajectory trace and the dipole field-line render.
 */
function autoFrame(
  lines: Pt[][],
  cx: number,
  cy: number,
  opts: { pct: number; clip: number; floor: number; empty: number },
): { paths: Pt[][]; norm: number } {
  const radii: number[] = [];
  for (const l of lines) for (const p of l) radii.push(Math.hypot(p.x - cx, p.y - cy));
  radii.sort((a, b) => a - b);
  const ext = radii.length
    ? Math.max(radii[Math.floor(radii.length * opts.pct)]!, opts.floor)
    : opts.empty;
  const norm = 1 / ext;
  const paths: Pt[][] = [];
  for (const l of lines) {
    let run: Pt[] = [];
    for (const p of l) {
      const q = { x: (p.x - cx) * norm, y: (p.y - cy) * norm };
      if (Math.hypot(q.x, q.y) < opts.clip) {
        run.push(q);
      } else {
        if (run.length > 1) paths.push(run);
        run = [];
      }
    }
    if (run.length > 1) paths.push(run);
  }
  return { paths, norm };
}

const traceCache = new Map<string, FieldTrace>();

/** Trace a force's real field lines by running the engine with the live body's attributes. */
export function traceField(token: string, override: ProbeOverride = {}): FieldTrace | null {
  const key = token + '|' + JSON.stringify(override);
  if (traceCache.has(key)) return traceCache.get(key)!;
  const cfg = CFG[token];
  if (!cfg) return null;

  if (cfg.special === 'pigment') {
    const t: FieldTrace = { paths: [], rings: [], special: 'pigment' };
    traceCache.set(key, t);
    return t;
  }

  const raw = traceRaw(token, override)!;
  const result = raw.result;
  const range = raw.range;
  const bcx = result.body.cx, bcy = result.body.cy;

  // collect per-particle trajectories in body-relative units, splitting on toroidal wraps.
  // Particle count can grow mid-run (a class-[S] source like spawn appends new matter);
  // within SPAWN_LIFE=90 frames the pool is append-only, so an index stays the same
  // particle — we just start its path on the first frame it exists (skip, don't break).
  const rawPaths: Pt[][] = [];
  const pc = Math.max(...result.trajectory.map((fr) => fr.length));
  for (let i = 0; i < pc; i++) {
    let cur: Pt[] = [];
    let prev: Pt | null = null;
    for (let f = 0; f < result.trajectory.length; f++) {
      const p = result.trajectory[f]![i];
      if (!p) {
        // particle i doesn't exist yet (spawns later) — flush any run and wait for it
        if (cur.length > 1) rawPaths.push(cur);
        cur = [];
        prev = null;
        continue;
      }
      const pt = { x: p.x - bcx, y: p.y - bcy };
      // a toroidal wrap (a jump of thousands of units) ends this particle's path — the
      // pre-wrap motion is the meaningful part; positions after a wrap are off-frame.
      if (prev && Math.hypot(pt.x - prev.x, pt.y - prev.y) > RANGE * 3) {
        if (cur.length > 1) rawPaths.push(cur);
        cur = [];
        prev = null;
        break;
      }
      cur.push(pt);
      prev = pt;
    }
    if (cur.length > 1) rawPaths.push(cur);
  }

  // auto-frame: scale so the bulk of the motion fills a unit box (95th-percentile extent so
  // one runaway particle doesn't shrink everything), splitting on clip rather than chording.
  const { paths, norm } = autoFrame(rawPaths, 0, 0, { pct: 0.95, clip: 1.6, floor: range * 0.5, empty: range });
  const rings = (cfg.rings ? cfg.rings(range) : []).map((r) => ({ r: r * norm, dash: true }));

  const trace: FieldTrace = { paths, rings };
  traceCache.set(key, trace);
  return trace;
}

const dipoleCache = new Map<string, FieldTrace>();

/**
 * A force's field-line diagram (field-systems plan, Stage B render), traced through the real
 * field with `traceFieldLines` and normalized to the same unit box `traceField` uses:
 *  - `magnetism` → the bar-magnet DIPOLE (nested N→S loops); no magnetic monopoles exist.
 *  - `charge`    → the radial MONOPOLE electric field (straight spokes, out of + / into −).
 * Returns null for any other force. This is the *structure* of the field; the trajectory
 * trace is suppressed for these two so the two representations never overlap.
 */
export function traceDipole(token: string, override: ProbeOverride = {}): FieldTrace | null {
  if (token !== 'magnetism' && token !== 'charge') return null;
  const key = token + '|' + JSON.stringify(override);
  if (dipoleCache.has(key)) return dipoleCache.get(key)!;

  const cfg = CFG[token];
  const angleDeg = override.angleDeg ?? cfg?.angle ?? -90;
  const spin = override.spin ?? cfg?.spin ?? 1;
  const a = (angleDeg * Math.PI) / 180;

  // a generous centred world box, so the diagram has room to develop before bounds clip it.
  const W = 1000;
  const H = 800;
  const cx = W / 2;
  const cy = H / 2;

  let lines: Pt[][];
  if (token === 'charge') {
    // A lone electric charge is a MONOPOLE: straight radial field lines, OUT of a + source
    // (spin ≥ 0) and IN to a −. Seed a ring close to the body and trace the radial field both
    // ways, giving clean spokes from the core to the rim — the textbook electric-field diagram.
    const sgn = spin < 0 ? -1 : 1;
    const sample = (x: number, y: number) => {
      const dx = x - cx;
      const dy = y - cy;
      const d = Math.max(Math.hypot(dx, dy), 1);
      const m = sgn / (d * d); // radial 1/d², signed by polarity
      return { x: (dx / d) * m, y: (dy / d) * m };
    };
    const N = 18;
    const r0 = 38;
    const seeds = [];
    for (let i = 0; i < N; i++) {
      const ang = (i / N) * Math.PI * 2;
      seeds.push({ x: cx + Math.cos(ang) * r0, y: cy + Math.sin(ang) * r0 });
    }
    lines = traceFieldLines(sample, seeds, { step: 7, maxSteps: 240, bounds: { w: W, h: H } });
  } else {
    // magnetism: a DIPOLE (no magnetic monopoles exist) — the bar-magnet loops. Seed along the
    // perpendicular bisector of the heading axis: each offset lies on a distinct nested field
    // line, so tracing both ways closes a clean loop from + around to −.
    const body = { cx, cy, hw: 74, hh: 28, ux: Math.cos(a), uy: Math.sin(a), spin };
    const poles = polePair(body);
    const sample = (x: number, y: number) => dipoleField(poles, x, y);
    const perp = { x: -body.uy, y: body.ux }; // unit ⟂ to the heading axis
    const RINGS = 8;
    const SPACING = 22;
    const seeds = [{ x: cx, y: cy }]; // the central axial line through both poles
    for (let i = 1; i <= RINGS; i++) {
      const off = i * SPACING;
      seeds.push({ x: cx + perp.x * off, y: cy + perp.y * off });
      seeds.push({ x: cx - perp.x * off, y: cy - perp.y * off });
    }
    lines = traceFieldLines(sample, seeds, { step: 5, maxSteps: 500, bounds: { w: W, h: H } });
  }

  // auto-frame about the body centre (robust extent so the diagram sits inside the box),
  // splitting each line on clip so an outer excursion never chords across.
  const { paths } = autoFrame(lines, cx, cy, { pct: 0.88, clip: 1.5, floor: 100, empty: 120 });

  const trace: FieldTrace = { paths, rings: [] };
  dipoleCache.set(key, trace);
  return trace;
}
