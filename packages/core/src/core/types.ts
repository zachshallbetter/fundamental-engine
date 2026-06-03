/**
 * Core contracts for the reciprocal field.
 *
 * These types encode the spec in `docs/forces-system.md`:
 *   - the data model (§3): Particle, Body, Env
 *   - the force-registry contract (§4) generalized to agents (§22)
 *   - mass & momentum (§21), conditions (§5), formations (§7)
 *
 * Nothing here runs yet — it is the shape the engine is being refactored onto.
 */

export interface Vec2 {
  x: number;
  y: number;
}

/** A force id. Open string so the registry can be extended (§20), but the
 *  canonical set is enumerated in `config/forces.config.ts`. */
export type Token = string;

/** The three kinds of thing a force can act on (§22). A particle is the
 *  lightest agent; an element is a heavy body with a DOM consumer; an event
 *  sink is write-only. */
export type AgentKind = 'particle' | 'element' | 'event';

/**
 * A free particle — the lightest agent (§3.2, §21).
 *
 * `m` is inertial mass. Today it is nominal (always 1 — the engine integrates
 * `v += F`, §2.2). Under first-class mass (§21, Option B) it becomes `∝ size`
 * and the integrator divides by it. Mutate `vx/vy/heat/x/y` from a force.
 */
export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** inertial mass — 1 = nominal (§21). */
  m: number;
  /** ∈ [0,1]; drives colour (toward accent), size, and glow (§2.2). */
  heat: number;
  /** render-radius basis. */
  size: number;
  /** the absorb/blackhole body holding this particle, or null (§6.9). */
  cap: Body | null;
  /** stable per-particle scatter target fractions, for the `spread` formation (§7). */
  gx?: number;
  gy?: number;
  // optional attributes consumed by extended forces (§20)
  age?: number;
  /** signed charge q, for `charge` / `magnetism` (§20.10). */
  charge?: number;
  /** species tag, for `hunt` (§20.3). */
  species?: number;
  /** carried pigment, conserved colour transport (§20.8). */
  color?: string;
}

/**
 * A registered DOM element acting as a force source (§3.1). Parsed from
 * `data-*` attributes; the runtime fields are refreshed each scan/frame.
 */
export interface Body {
  el: HTMLElement;
  /** space-joined force ids from `data-body` (they compose, §4). */
  tokens: Token[];
  /** force magnitude S. */
  strength: number;
  /** influence radius d_max, px. */
  range: number;
  /** capture radius for `absorb`. */
  absorbR: number;
  /** load at which an absorber supernovas (was `maxMass`, renamed §21.2). */
  capacity: number;
  /** vortex/charge sign or spin (±). */
  spin: number;
  /** heading in radians, with its unit vector, for stream/emitter/etc. */
  angle: number;
  ux: number;
  uy: number;
  /** conditional gate id (§5); '' = always. */
  when: string;
  /** opt into two-way density write-back (§8). */
  feedback: boolean;
  fmin: number;
  fmax: number;
  opsz: string;

  // ── runtime state ────────────────────────────────────────────────────────
  /** source mass M for `gravity`/`charge` (§20.10/§21). */
  M: number;
  cx: number;
  cy: number;
  hw: number;
  hh: number;
  /** engaged (hover/focus/tap → data-active="1"). */
  on: boolean;
  /** on-screen and exerting force (§2.1). */
  vis: boolean;
  /** captured load (was `mass`, renamed §21.2). */
  accreted: number;
  /** per-frame density tally and its eased value d ∈ [0,1] (§8). */
  count: number;
  d: number;
}

/** A formation preset — a global bias on every free particle (§7). */
export interface Formation {
  driftX: number;
  wander: number;
  orbit: number;
  spread: number;
  conv: number;
}

/** A persistent scalar grid backing field-buffer forces (§20.1 class [C]). */
export interface ScalarGrid {
  sample(x: number, y: number): number;
  deposit(x: number, y: number, amount: number): void;
  gradient(x: number, y: number): Vec2;
}

/**
 * The shared per-frame environment handed to every force (§3.3), extended with
 * the services later classes need (§20.1) and the sim unit-system constants
 * (§20.10). Engines may leave the heavier services as no-ops until built.
 */
export interface Env {
  /** vector from particle to body: (b.cx − p.x, b.cy − p.y). */
  dx: number;
  dy: number;
  /** |(dx, dy)|, clamped ≥ 1. */
  dist: number;
  /** the active, eased formation (§7). */
  form: Formation;
  W: number;
  H: number;
  /** elapsed time in seconds (for time-varying terms: curl drift, resonance). */
  t: number;
  /** frame counter (for the periodic brownian jitter + scatter animation, §7). */
  frameN: number;
  /** integration step: 1 a frame, 0 under reduced motion (§2.2/§18). */
  dt: number;
  /** velocity cap / "speed of light" of the unit system (§20.10). */
  c: number;
  /** gravitational constant of the unit system (§20.10). */
  G: number;

  // ── services (filled by the engine) ──────────────────────────────────────
  /** throw a micro-reaction at a point — sparks/heat (§23). */
  spark(x: number, y: number, power: number, color?: string): void;
  /** release everything a body has captured (§6.9). */
  supernova(b: Body): void;
  /** create a particle — source forces only (§20, class [S]). */
  spawn(p: Partial<Particle>): void;
  /** neighbours within r — particle↔particle forces (§20.1 class [B]). */
  neighbors(p: Particle, r: number): Particle[];
  /** a named scalar grid — field-buffer forces (§20.1 class [C]). */
  grid(name: string): ScalarGrid;
}

/**
 * A force module (§4). The engine owns the loop and everything conserved; a
 * force owns only the math that nudges one agent given the shared `env`.
 *
 * `apply` is the common path (a free particle). A force opts into other agent
 * tiers (§22) by listing them in `targets` and the engine routes accordingly;
 * most forces need no per-tier code because the *agent's* consumer interprets
 * the influence. Default `targets` is `['particle']` — today's behaviour.
 */
export interface Force {
  token: Token;
  label: string;
  targets?: AgentKind[];
  apply(b: Body, p: Particle, env: Env): void;
  meta?: { desc?: string };
}

/** A connector between two elements for `field.threads` (§10). */
export interface ThreadLink {
  a: Element;
  b: Element;
  color?: string;
}

/** A `data-when` gate predicate (§5). Selective gates read each particle. */
export type Condition = (b: Body, p: Particle) => boolean;

/** The force registry — `token → module` (§4). */
export type ForceRegistry = Record<Token, Force>;

/** The condition registry — `id → predicate` (§5). */
export type ConditionRegistry = Record<string, Condition>;

/** Options for `createField` (§2.5 config). */
export interface FieldOptions {
  /** travelling accent colour (§9). */
  accent?: string;
  /** particle-count multiplier (§2.5). */
  density?: number;
  /** draw the background Currents (§24) — not yet implemented (Phase 3). */
  waves?: boolean;
  /** render mode (§20.6): 'dots' (default), 'trails' (light-painting), 'links' (constellation). */
  render?: 'dots' | 'trails' | 'links';
}

/** The handle returned by `createField` — the public field API (§13). */
export interface FieldHandle {
  /** (re)scan the document for `[data-body]` bodies after a layout change. */
  scan(): void;
  /** alias of `scan`. */
  rescan(): void;
  /** recolour the travelling accent (§9). */
  setAccent(hex: string): void;
  /** switch the global formation (§7). */
  setFormation(name: string): void;
  /** wire glowing connector lines between a set, or clear with null (§10). */
  threads(list: ThreadLink[] | null): void;
  /** stop the loop and release listeners. */
  destroy(): void;
}
