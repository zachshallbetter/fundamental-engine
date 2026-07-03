/**
 * Core contracts for the reciprocal field.
 *
 * These types encode the spec in `docs/engine-reference/forces-system.md`:
 *   - the data model (§3): Particle, Body, Env
 *   - the force-registry contract (§4) generalized to agents (§22)
 *   - mass & momentum (§21), conditions (§5), formations (§7)
 *
 * This is the contract the engine implements: `createField`, the force registry,
 * the integrator, and the conformance harness all build on these shapes.
 */
import type { FlowOptions } from './flow.ts';
import type { FieldHost } from './host.ts';
import type { ClassifiedTokens } from '../config/forces.config.ts';
import type { FieldEventType, FieldEventMap } from './events.ts';

/** Wire-format version for the readParticles() output buffer.
 *  Version 0 — current layout, stride 5: [x, y, z, heat, size] per particle (all Float32).
 *  A renderer should assert PARTICLE_WIRE_VERSION === 0 before consuming readParticles output.
 *  Bumped on any stride or channel-order change; old renderers must update.
 */
export const PARTICLE_WIRE_VERSION = 0 as const;

/** Elements per particle in the readParticles() Float32Array.
 *  Layout: [x, y, z, heat, size]. Index: particle[i] starts at i * PARTICLE_STRIDE.
 */
export const PARTICLE_STRIDE = 5 as const;

export interface Vec2 {
  x: number;
  y: number;
}

/** A 3D vector — the optional z lane (a `depth > 0` field) and the accumulator's linear channel. */
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** An axis-aligned rectangle in field coordinates, `DOMRect`-shaped (x/y/width/height) so a caller
 *  can pass `el.getBoundingClientRect()` straight into a {@link FieldQuery}'s `at`. (Distinct from the
 *  engine-internal {@link Rect} in geometry, which is centre + half-extents.) */
export interface FieldRect {
  x: number;
  y: number;
  width: number;
  height: number;
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
  /** Stable per-particle identity, assigned once at creation and unique for this particle's life in
   *  the pool (a recycled slot gets a fresh id). Lets a host track a specific particle across frames —
   *  a seeded entity (a wind-borne seed, a tagged mote) read back through `readParticleIds`, with the
   *  host owning any opaque payload keyed by id. Optional only for back-compat with hand-built
   *  fixtures; the engine always sets it. */
  id?: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /**
   * OPTIONAL Z LANE (docs/engine-reference/z-axis.md): position/velocity along the
   * depth axis. Undefined ⇒ 0 ⇒ the flat field — every formula reduces to the 2D
   * engine exactly. Only a field created with `depth > 0` ever moves these; authors
   * never have to supply them. Bodies (DOM elements) always live on the z = 0 plane.
   */
  z?: number;
  vz?: number;
  /**
   * OPTIONAL ORIENTATION LANE (substrate doc 04 §Step 6): `orient` is the particle's angle (radians,
   * about the z axis) and `spin` its angular velocity. Undefined ⇒ no orientation ⇒ byte-identical to
   * the spin-less engine — exactly the z-lane discipline. Only a `torque`-style force ever writes
   * `spin`; the integrator advances `orient += spin · dt` (and damps) only when `spin` is defined.
   * Renderers may ignore it; nothing in the base field depends on a particle facing a direction.
   */
  orient?: number;
  spin?: number;
  /**
   * OPTIONAL ACCELERATION LANE (velocity-Verlet, #659): the previous step's acceleration
   * a(t) = Δv/dt, stored so the next position full-step can take `x += v·dt + ½·a·dt²` and the
   * velocity half-step can average `½·(a + a′)·dt`. Only the `'velocity-verlet'` integrator ever
   * writes these; undefined ⇒ 0 ⇒ the default engine never materializes them (the z-lane
   * discipline — byte-identical when unused).
   */
  ax?: number;
  ay?: number;
  az?: number;
  /** inertial mass — 1 = nominal (§21). */
  m: number;
  /** ∈ [0,1]; drives color (toward accent), size, and glow (§2.2). */
  heat: number;
  /** render-radius basis. */
  size: number;
  /** the sink/blackhole body holding this particle, or null (§6.9). */
  cap: Body | null;
  /** stable per-particle scatter target fractions, for the `spread` formation (§7). */
  gx?: number;
  gy?: number;
  /** scatter fraction along z — only meaningful in a `depth > 0` field. */
  gz?: number;
  // optional attributes consumed by extended forces (§20)
  /** frames-to-live for *mortal* (spawned) matter — decremented each tick, despawned at
   *  ≤ 0 (the [S] source sink). Undefined ⇒ immortal (the conserved base field). */
  age?: number;
  /** signed charge q, for `charge` / `magnetism` (§20.10). */
  charge?: number;
  /** species tag, for `hunt` (§20.3). */
  species?: number;
  /** carried pigment, conserved color transport (§20.8). */
  color?: string;
  /** an opaque data record bound to this particle by `FieldHandle.seed` (e.g. a "project atom"). */
  atom?: AtomPayload;
  // ── agent lane (FieldHandle.addAgent) ────────────────────────────────────
  /** top speed in field px/frame — the integrator clamps |v| to this each step. Agents only. */
  maxSpeed?: number;
  /** an agent's per-step report: called with this particle after it integrates, so an external
   *  transform (a mesh) can follow it. Its presence marks the particle an AGENT — the integrator
   *  skips ambient wander and edge-bounces instead of toroidally wrapping it, and `readParticles`
   *  omits it (an agent draws as its own object, not a swarm dot). It still feels every force the
   *  swarm feels (body forces AND particle-level `hunt`/`align`/`cohesion`) — that's the point. */
  report?: (p: Particle) => void;
}

/**
 * A data record bindable to a particle (`FieldHandle.seed`). Opaque to the engine except `weight`
 * (0..1), which scales the particle's mass + size — so richer records read as heavier, more central
 * matter. Picked back out with `FieldHandle.atomAt(x, y)`.
 */
export interface AtomPayload {
  readonly weight?: number;
  readonly [key: string]: unknown;
}

/**
 * Who owns a body's position (substrate doc 04 §body-authority). `anchored` (default) — the DOM/host
 * rect is authoritative, re-measured each frame (today's behavior for all bodies). `kinematic` — the
 * engine writes the body's visual transform while the DOM stays the rendered object (the shipped
 * `data-move` / transform pattern). `dynamic` — the engine owns position/velocity: the body integrates
 * under the net field each frame and moves (recoil / field-to-body coupling, doc 04 §Step 5). Anchored
 * and kinematic behave exactly as before. (Literal momentum-recoil from the body's own emission, torque,
 * and conservation are later refinements.)
 */
export type BodyAuthority = 'anchored' | 'kinematic' | 'dynamic';

/**
 * A body's FIRST-CLASS IDENTITY (substrate critical path). A stable, structured handle for referring to
 * a body across frames, snapshots, diffs, and relationships — decoupled from object reference and from
 * display text. `id` is the stable primary key: it MUST be unique within a field and MUST NOT change for
 * the life of the body. The rest is optional metadata that lets a consumer group / route bodies (e.g. a
 * bridge keying host meshes off `host`, or an agent filtering by `kind`).
 *
 * DOCTRINE — identity is NOT:
 *   · display text (a heading's words are not its identity — they can change while identity holds);
 *   · necessarily a DOM `id` (a DOM id is one *source* of a stable id, not the concept);
 *   · an object reference (references don't survive a rescan or a serialize/replay round-trip).
 * Snapshots, diffs, and relationships key on `identity.id`. When a body carries no supplied identity, the
 * engine DERIVES a stable one deterministically (the element's DOM id, else a monotonic `body-N` counter —
 * never `Math.random`, which is banned on the reproducible paths) so identity is always present and stable.
 */
export interface FieldBodyIdentity {
  /** the stable primary key — unique within the field, constant for the body's life. Equals the reading's
   *  top-level `id` (back-compat). Snapshot/diff/replay/relationships key on this. */
  id: string;
  /** optional grouping namespace (e.g. an app/module the body belongs to). Free-form; opaque to the engine. */
  namespace?: string;
  /** optional kind/type tag (e.g. `'card'`, `'heading'`, `'agent'`). Free-form; opaque to the engine. */
  kind?: string;
  /** optional host/owner tag (e.g. a renderer or view that owns the body's rendered object). Free-form. */
  host?: string;
}

/**
 * A registered DOM element acting as a force source (§3.1). Parsed from
 * `data-*` attributes; the runtime fields are refreshed each scan/frame.
 */
export interface Body {
  el: HTMLElement;
  /** FIRST-CLASS IDENTITY (see {@link FieldBodyIdentity}). Supplied via `addBody({ identity })` or the
   *  `identify` field option, else lazily DERIVED and cached the first time the body is keyed. Once
   *  resolved it is stable for the body's life; snapshots/diff/replay/relationships key on `identity.id`. */
  identity?: FieldBodyIdentity;
  /** space-joined force ids from `data-body` (they compose, §4). */
  tokens: Token[];
  /** who owns this body's position (`data-authority`); default `'anchored'`. See {@link BodyAuthority}. */
  authority?: BodyAuthority;
  /** engine-owned position + velocity for a `dynamic` body (substrate doc 04 §Step 5 — recoil). Lazily
   *  initialized from the body's first measured centre, then integrated under the net field each frame
   *  and written back to `cx`/`cy` (so `measureBodies`' per-frame rect overwrite doesn't reset it).
   *  Untouched for anchored/kinematic bodies. */
  bx?: number;
  by?: number;
  bvx?: number;
  bvy?: number;
  /** `tokens` split into `{ modifiers, forces, sources }` per the modifier contract
   *  (workover v0.3). The scanner fills it at parse time; the integrator memoizes it
   *  lazily for bodies built elsewhere (conformance, tests). Modifiers carry the
   *  formalized order `spotlight → screen → resonate`. */
  classified?: ClassifiedTokens;
  /** force magnitude S. */
  strength: number;
  /** influence radius d_max, px. */
  range: number;
  /** capture radius for `sink`. */
  absorbR: number;
  /** load at which a sink supernovas (was `maxMass`, renamed §21.2). */
  capacity: number;
  /** swirl/charge sign or spin (±). */
  spin: number;
  /** heading in radians, with its unit vector, for stream/jet/etc. */
  angle: number;
  ux: number;
  uy: number;
  /** conditional gate id (§5); '' = always. */
  when: string;
  /** opt into two-way density write-back (§8). */
  feedback: boolean;
  /** the body's tint from `data-color`, for `pigment` color transport (§20.8). */
  tint?: string;
  /** shaped source (`data-shaped`): forces reference the nearest point on the element's
   *  box, not its centre, so matter gathers in a shell around the shape (field-systems
   *  Stage C). Undefined ⇒ point source (the default). */
  shaped?: boolean;
  /** `data-charge-gated` (opt-in, #711) — restrict `fieldflow` to *charged* matter (`charge ≠ 0`),
   *  modelling magnetized plasma tied to the field line. Undefined/false ⇒ the default neutral-medium
   *  advection (fieldflow transports ALL matter). Only read by the `fieldflow` force. */
  chargeGated?: boolean;
  /** `data-species` — the species tag this body stamps on matter it *emits* (a `spawn` source),
   *  so multiple ecologies (pollen vs seeds vs spores) can share one field. Undefined ⇒ 0. */
  species?: number;
  /** `data-affects` — the species this body's forces act on (a selective body). Undefined ⇒ acts
   *  on ALL matter (the default, back-compat); set ⇒ matter whose `species` is not in the set is
   *  skipped entirely (no force, no density sample). Parsed from a comma-separated list. */
  affects?: ReadonlySet<number>;
  fmin: number;
  fmax: number;
  opsz: string;
  /** `data-pair` — selector for the body this one is wormhole-paired to (`warp`, §22.3 relocate). */
  pair?: string;
  /** `data-twist` — rotation (radians) applied to matter relocated through a `warp` throat. */
  twist?: number;
  /** `data-scale` — scale applied to the relocated local offset through a `warp` throat (default 1). */
  warpScale?: number;
  /** `data-life` — frames each particle this body's [S] source emits lives (the mortal `age`).
   *  Undefined ⇒ the source's own default lifespan. Part of the source budget contract. */
  life?: number;
  /** `data-cap` — the most live particles this body's [S] source may sustain; the emission
   *  rate is clamped to `cap / life` per frame. Undefined ⇒ rate-limited by lifespan only. */
  cap?: number;
  /** the [S] budget contract is satisfied — the author declared at least one of
   *  `data-life` / `data-cap` / `data-budget` / `data-sink` (workover §"Source and sink rules").
   *  False on a source body ⇒ the scanner's dev guard warns and applies the safe defaults. */
  budgeted?: boolean;
  /** `data-screen-min` — the floor of the `screen` modifier's attenuation factor (default 0:
   *  full cancellation at the core is allowed). Only read on bodies carrying `screen`. */
  screenMin?: number;

  // ── runtime state ────────────────────────────────────────────────────────
  /** the resolved paired body for `warp` (set each scan from `pair`); undefined if unpaired. */
  pairBody?: Body;
  /** the paired throat's live centre, refreshed each frame from `pairBody` (the relocate target). */
  warpX?: number;
  warpY?: number;
  /** whether a relocate target is currently resolved (the `warp` force no-ops without one). */
  warpHas?: boolean;
  /** source mass M for `gravity`/`charge` (§20.10/§21). */
  M: number;
  /** INERTIAL mass (substrate momentum, #872) — how hard the body is to *move*, distinct from `M` (how
   *  strongly it *emits*). Undefined ⇒ nominal 1 ⇒ byte-identical. Populated (∝ rendered area, clamped)
   *  only under `mass: 'area'`; the dynamic-body recoil integrator divides by `inertia ?? M`. */
  inertia?: number;
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
  /** conserved-attention effective-strength multiplier (§2.4); 1 = neutral. */
  attn?: number;
  /** fractional-emission accumulator for a budgeted [S] source (`spawn`) — carries the
   *  sub-1/frame remainder when the rate is clamped to `cap / life`. Runtime state. */
  emitAcc?: number;
  /** prior engagement state, for the attention-gated discharge edge (#365). Runtime state. */
  wasOn?: boolean;
  /** per-frame local thermodynamic accumulators (workover §"Metrics") — sums over the same
   *  `range/2` sample window as `count`, reset each step, only on `data-feedback` bodies:
   *  n samples, Σvx, Σvy, Σ|v|, Σ|v|², Σheat. Allocated lazily on first sample. */
  thermo?: { n: number; sx: number; sy: number; ss: number; ss2: number; sh: number };
  /** the eased measured metrics (workover §"Metrics"): entropy / coherence / temperature
   *  ∈ [0,1], exported as `--entropy` / `--coherence` / `--temperature`. Lazily allocated. */
  metrics?: { entropy: number; coherence: number; temperature: number };
  /** target points for `morph` (§20.3 [D]) — a sampled mark / logo / chart / shape the
   *  matter assembles into. NEVER words or letterforms (§11); words glow/grow via `--d`. */
  targets?: readonly { x: number; y: number }[];
  /** custom rectangle provider for a shadow-DOM body whose physical box is not the host
   *  box (closed roots, internal cores). The measurer prefers this over the host's own
   *  `getBoundingClientRect` (shadow-dom.md §10/§16). Also the position source for a
   *  programmatic body (`addBody`), which has no real element. */
  rect?: () => DOMRect;
  /** a host-attached data record carried by a programmatic body (`addBody`) — the Body-level
   *  analog of `Particle.atom`, extending the Field Agent Consumption Model (sources carry
   *  records, not just matter). Opaque to the engine; surfaced on the `BodyHandle`. */
  data?: unknown;
  /** per-body feedback for a programmatic body (`addBody`): receives this body's channels each
   *  frame, demultiplexed from the global sink, so a non-DOM host reads one body's readout
   *  directly instead of off a CSS variable. */
  onFeedback?: (channels: FeedbackChannels) => void;
  /** element that receives the field's CSS-variable write-back, when it differs from the
   *  body's element (shadow-dom.md §11). Defaults to `el`. */
  writeTarget?: HTMLElement;
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
  /** Bilinear-sampled value at a pixel point. */
  sample(x: number, y: number): number;
  /** Add `amount` to the nearest cell (the host or a force deposits here). */
  deposit(x: number, y: number, amount: number): void;
  /** Central-difference gradient ∇ (points up-slope), in 1/px. */
  gradient(x: number, y: number): Vec2;
  /** Fade every cell toward zero by `rate` ∈ [0,1] (`1` = clear) — a host-authored decay applied
   *  on top of the grid's own per-frame mode stepping. */
  decay(rate: number): void;
  /** Zero the whole grid. */
  clear(): void;
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
  /**
   * z component of the particle→body vector (z-axis.md). OPTIONAL — undefined reads
   * as 0. Bodies live on the z = 0 plane, so this is `0 − (p.z ?? 0)` — always 0 in a
   * flat field, where every force's z term vanishes and the 2D behavior is exact.
   */
  dz?: number;
  /** |(dx, dy, dz)|, clamped ≥ 1 (= the 2D distance in a flat field). */
  dist: number;
  /** the active, eased formation (§7). */
  form: Formation;
  W: number;
  H: number;
  /** depth of the simulation volume (z-axis.md). OPTIONAL; 0/undefined = the flat field. */
  D?: number;
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
  /** recent page-scroll speed (eased, px/frame); drives the `scrolling` gate (§5).
   *  Undefined / 0 off the page, so the gate is inert under the conformance harness. */
  scrollV?: number;
  /** the engine's random source (#371) — forces and the integrator draw jitter from here so a
   *  seeded rng makes a run reproducible (record/replay). Optional for fixture back-compat;
   *  call sites fall back to Math.random. */
  rng?: () => number;

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
  /** the net *structure* field at a world point — the superposition of every body's
   *  `field()` hook (the dipoles and monopoles, field-systems Stage B). The vector matter
   *  follows under `fieldflow`. Set by the integrator each step from the live bodies; absent
   *  in bare/probe envs, where a field-following force simply no-ops. */
  fieldAt?(x: number, y: number): Vec2;
  /**
   * OPT-IN impulse accumulator (substrate critical path, doc 04). When present, the
   * integrator's central `applyForce` records each force's per-particle contribution here
   * (net + per-force attribution) WITHOUT changing the integration math — the force still
   * updates velocity as before. Absent on the default hot path (zero overhead, byte-identical
   * behavior); a diagnostic / Field-Query probe sets it to read structured attribution. The
   * shape is dimension-aware from day one so orientation/time/semantic channels are not painted
   * into a corner, even though only `linear` is populated today. Read-only contract: setting
   * `accum` never alters how matter moves. */
  accum?: FieldImpulseAccumulator;
  /** The integration scheme (substrate doc 04 §Step 3). `undefined`/`'legacy'` is the shipped
   * semi-implicit Euler with per-frame decay (the default — unchanged). `'fixed'` is the opt-in
   * fixed-timestep integrator: additive force impulses and the `FRICTION`/`HEAT_DECAY` decays scale
   * with `dt`, so motion is frame-rate independent. At `dt === 1` (the reference rate, and every
   * golden/conformance run) the two are byte-identical, so opting in never moves the golden.
   * `'velocity-verlet'` (#659) is the opt-in second-order scheme: the position full-step uses the
   * previous step's stored acceleration, the force pass evaluates a′ at the updated position, and
   * the velocity takes the half-step average — see the integrator for the exact math and the
   * velocity-dependence / kinematic-force approximations. It changes trajectories BY DESIGN once
   * opted into; the default path never engages it. */
  integrator?: IntegratorMode;
  /** INTERNAL (velocity-Verlet only): set by the central `applyForce` when a *kinematic*
   * (velocity-REPLACING) force actually changed the current particle's velocity, and reset by the
   * integrator at the top of each particle's force pass. A reflection / relaunch / teleport is a
   * discontinuity, not an acceleration — the Verlet half-step average is skipped for that particle
   * that step. Never touched on the `'legacy'`/`'fixed'` paths. */
  kinTouch?: boolean;
}

/** The integration scheme for the field (see {@link Env.integrator}). */
export type IntegratorMode = 'legacy' | 'fixed' | 'velocity-verlet';

/**
 * A single force's contribution to one agent in one step, in one channel (substrate doc 04).
 * The unit the diagnostics (`causality`/`prediction`), Field Query, and Causal Replay consume:
 * "this matter moved 0.42 in linear x because of `attract`."
 */
export interface ForceAttribution {
  /** the contributing force token (`Force.token`). */
  force: Token;
  /** which channel the contribution lands in. Only `linear` is populated today. */
  channel: 'linear' | 'angular' | 'thermal' | 'temporal' | 'semantic' | 'constraint';
  /** the contribution value — a `{x,y,z}` Δv for `linear`; a scalar for `thermal`. */
  contribution: { x: number; y: number; z: number } | number;
  /** dimensions this force couples, if any (the coupling passport, doc 04 / dimensional-coupling). */
  couplesDimensions?: string[];
}

/**
 * A dimension-aware impulse accumulator (substrate doc 04). Collects per-force contributions for
 * one agent so cause can be attributed before/independent of integration. `linear` is the running
 * net Δv; `attribution` is the per-force breakdown. The optional channels (`angular`/`thermal`/
 * `temporal`/`semantic`) are declared now so the contract does not assume all force is `vx/vy` —
 * they are not populated until those dimensions are restored.
 */
export interface FieldImpulseAccumulator {
  /** running net linear Δv (x/y, plus z when the lane is engaged). */
  linear: { x: number; y: number; z: number };
  /** angular Δω contribution (θx/θy/θz) — populated when a force writes `Particle.spin` (doc 04 §Step 6). */
  angular?: { x: number; y: number; z: number };
  /** thermal (heat) contribution — populated when a force changes `Particle.heat` (doc 04 §Step 6). */
  thermal?: number;
  /** temporal contribution (delay/decay/phase) — `decay` populated when a force changes mortal matter's
   *  `Particle.age` (frames-to-live); delay/phase reserved (doc 04 §Step 6). */
  temporal?: { delay?: number; decay?: number; phase?: number };
  /** semantic-channel contributions (attention/confidence/memory) — `attention` populated with the body's
   *  conserved-attention multiplier (`Body.attn`) when active; confidence/memory reserved (doc 04 §Step 6). */
  semantic?: Record<string, number>;
  /** per-force breakdown — preserves explainability (Paper 31 §6). */
  attribution: ForceAttribution[];
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
  /**
   * This force *replaces* velocity (a reflection, rotation, or relaunch) rather than
   * *adding* an acceleration, so first-class mass (§21.3) must not scale its effect: a
   * bounce reflects and a lens bends regardless of inertia. Additive forces leave this
   * unset and have their Δv scaled by `1/m`. Set on `wall`, `jet`, `lens`, `gate`.
   */
  kinematic?: boolean;
  /**
   * Optional *modifier* hook (§20.3 `resonate`/`spotlight`). Run before the body's
   * other tokens apply, for this particle: a returned `strength` multiplies the
   * sibling forces' strength for this frame; `gate: true` skips them entirely. A
   * pure modifier (e.g. `spotlight`) can leave `apply` a no-op.
   */
  modify?(b: Body, p: Particle, env: Env): { strength?: number; gate?: boolean };
  /**
   * Optional *source* hook (§20.1 class [S], e.g. `spawn`). Run once per body per frame
   * — not per particle — after the per-particle force pass, so a body can *create*
   * matter via `env.spawn`. A pure source leaves `apply` a no-op. Sources break
   * conservation by design and must self-budget (a lifespan `age` plus the engine's
   * pool ceiling keep the count bounded).
   */
  source?(b: Body, env: Env): void;
  /**
   * Optional *visual field* hook (field-systems plan, Stage B). The in-plane field vector
   * the body projects at a world point, with no particle and no velocity. Renders field
   * lines and makes velocity- or charge-dependent forces (whose `apply` is a no-op on a
   * still probe) visible in the field-flow view. For `magnetism` this is the dipole
   * structure of B — particles still curve perpendicular, they do not follow it; for
   * `charge` it is the electric field the force pushes along. Pure: same input, same output.
   */
  field?(b: Body, x: number, y: number): Vec2;
  /**
   * Optional *scalar field* hook (system-contracts §2 — a field may be vector, scalar, or compound).
   * Returns a scalar value at a world point (e.g. a potential `Φ`, a density, a temperature) for
   * contour / potential / heatmap rendering, with no particle. Pure: same input, same output. A
   * force may own a vector `field()`, a `scalarField()`, both, or neither.
   */
  scalarField?(b: Body, x: number, y: number): number;
  meta?: { desc?: string };
}

/** A connector between two elements for `field.threads` (§10). */
export interface ThreadLink {
  a: Element;
  b: Element;
  color?: string;
}

/** A `data-when` gate predicate (§5). Selective gates read each particle; the engine
 *  also passes the shared `env`, so a gate can read frame state (e.g. `scrolling`). */
export type Condition = (b: Body, p: Particle, env?: Env) => boolean;

/** The force registry — `token → module` (§4). */
export type ForceRegistry = Record<Token, Force>;

/** The condition registry — `id → predicate` (§5). */
export type ConditionRegistry = Record<string, Condition>;

/** Options for `createField` (§2.5 config). */
/**
 * Field Surfaces — *where* a field visualization composites relative to page content:
 *   · the UNDERLAY (behind content) is the default `<field-root>` canvas, driven by `render`/setRender;
 *   · the OVERLAY (in front of content) is an optional second surface driven by `overlay`/setOverlay.
 * Setting both (immersive) lets content sit *inside* the field. Overlay modes are READINGS — line/text
 * diagnostics that reveal what the field is doing without occluding text; `'off'` clears the overlay
 * surface. The vocabulary (each: what it draws · which quantity it reads):
 *   · `streamlines` — arrows along the net push a still probe would feel · vector flow (felt)
 *   · `force-vectors` — the same arrows scaled by raw magnitude · vector flow (absolute)
 *   · `field-lines` — arrows along the structure-only field (dipoles/monopoles) · field geometry
 *   · `grid` — a reference lattice displaced by the local field · deformation
 *   · `temperature` — iso-contour lines of accumulated particle heat · thermal scalar
 *   · `energy` — iso-contour lines of kinetic energy (½m|v|²) · energy scalar
 *   · `path` — streamline curves integrated from seeded probes · vector flow, traced over distance
 *   · `data` — numeric density readouts at each measuring body · per-body measurement
 * Readings are ADDITIVE: `setOverlay` accepts one mode or a stack (array), drawn in order on the one
 * front surface — so matter (underlay) + heatmap + several readings compose into one legible picture.
 */
export type OverlayMode =
  | 'off'
  | 'streamlines'
  | 'force-vectors'
  | 'field-lines'
  | 'grid'
  | 'temperature'
  | 'energy'
  | 'path'
  | 'data';

/** One reading, or an additive stack of readings, for `setOverlay` / `FieldOptions.overlay`. */
export type OverlayInput = OverlayMode | readonly OverlayMode[];

/**
 * Consumable field-resource budgets — upper bounds a host/session/user/app sets on what the field is
 * PERMITTED to spend, distinct from what doctrine *allows* (that is governance — static lint). Each is
 * optional; an unset budget means "unbounded / engine default". Values are normalized `0..1` unless the
 * one-line note says otherwise. Carried on {@link FieldPolicy.budgets}.
 *
 * WIRED today: `motion` (folds into the effective motion allowance alongside reduced-motion + perf
 * pressure) and `privacy` (gates body `data` in snapshots). The rest are DECLARED-not-yet-enforced —
 * accepted and carried on the policy for host/tooling introspection, wired as their consumers land.
 */
export interface FieldBudgets {
  /** WIRED. `0..1` cap on how much motion the field may express; `0` behaves as reduced-motion (frozen). */
  motion?: number;
  /** DECLARED. `0..1` cap on applied force magnitude — the share of the impulse budget matter may absorb. */
  force?: number;
  /** DECLARED. `0..1` cap on conserved-attention spend (§2.4) — the finite focus budget. */
  attention?: number;
  /** DECLARED. `0..1` cap on thermal/heat accumulation the field may carry. */
  thermal?: number;
  /** DECLARED. `0..1` cap on render cost the field may spend (draw layers / fill). */
  render?: number;
  /** WIRED. `0..1` privacy budget; below the `PRIVACY_DATA_THRESHOLD` (0.5) snapshots withhold body `data`. */
  privacy?: number;
  /** DECLARED. `0..1` accessibility floor — the minimum non-motion legibility the field must preserve. */
  accessibility?: number;
  /** DECLARED. `0..1` cap on how much field state agent readers (query/snapshot/agent-json) may consume. */
  agentRead?: number;
}

/**
 * Runtime FIELD POLICY — what THIS host / session / user / app PERMITS, evaluated live. Distinct lane
 * from GOVERNANCE (what doctrine allows — static lint): policy can only tighten, never loosen, the
 * accessibility floor (reduced-motion always wins; a policy can lower motion but never raise it above
 * what the host/user reduced-motion state allows). Set at creation via {@link FieldOptions.policy} and
 * live via {@link FieldHandle.setPolicy}; read via {@link FieldHandle.policy}. Purely additive — a field
 * with no policy behaves exactly as before.
 */
export interface FieldPolicy {
  /** permit body `data` to appear in snapshots (default: fall through to `FieldSnapshotOptions.includeData`). */
  allowBodyDataInSnapshots?: boolean;
  /** permit motion-expressing projections/animation at all; `false` pins the effective motion budget to 0. */
  allowMotionProjection?: boolean;
  /** `0..1` host/session cap on motion; folded (via `min`) with reduced-motion + perf pressure into the
   *  effective motion allowance the integrator/easing path reads. Reduced-motion can only lower it. */
  maxMotionBudget?: number;
  /** consumable-resource budgets (see {@link FieldBudgets}). */
  budgets?: Partial<FieldBudgets>;
}

export interface FieldOptions {
  /** travelling accent color (§9). */
  accent?: string;
  /** particle-count multiplier (§2.5). */
  density?: number;
  /**
   * OPT-IN Z VOLUME (docs/engine-reference/z-axis.md): depth of the simulation volume
   * in px. 0 — the default — is the flat field, byte-identical to the 2D engine. > 0
   * lets matter seed, wander, and wrap through a shallow z volume behind the surface;
   * bodies stay on the z = 0 plane and their forces pull matter back toward it. The
   * render projects z as a size/alpha recession. Purely additive: no API requires z.
   */
  depth?: number;
  /** the integration scheme (substrate doc 04 §Step 3); default `'legacy'`. `'fixed'` opts into the
   *  frame-rate-independent fixed-timestep integrator (additive impulses and decay scale with `dt`);
   *  identical to legacy at the reference frame rate. `'velocity-verlet'` (#659) opts into the
   *  second-order velocity-Verlet scheme (higher positional accuracy; trajectories differ by
   *  design). See {@link Env.integrator}. */
  integrator?: IntegratorMode;
  /** draw the background Currents (§24); default **false** (opt-in, #979 — the signals-first
   *  companion to `render: 'none'`). A bare field has no carrier waves; set true for the ambient
   *  resting structure + the bound shimmer reservoir. */
  waves?: boolean;
  /** wave layout style: `'linear'` (default horizontal lines) or `'circular'` (concentric orbits around a center). */
  waveStyle?: 'linear' | 'circular';
  /** wave center coordinate for circular waves. If omitted, tracks the star body or defaults to viewport center. */
  waveCenter?: { x: number; y: number } | (() => { x: number; y: number }) | null;
  /** substrate background: `'opaque'` (default) paints the near-black substrate each frame;
   *  `'transparent'` clears to transparent instead, so the underlay can sit OVER light content
   *  (a 3D scene, an image, a light page) without blanking it out. The bright matter survives;
   *  no `mix-blend-mode` workaround needed. Trails light-paint and fade to transparent rather
   *  than to black. Purely additive — the default is unchanged. */
  background?: 'opaque' | 'transparent';
  /** render mode (§20.6): 'none' (the DEFAULT since #538 — the signals-only engine,
   *  §13.7 / #297: the full simulation + feedback pipeline runs, but no canvas context
   *  is acquired, no backing store is sized, and nothing is ever drawn — the field
   *  exists purely as signals: `--d`, `--load`, `--lit`, capture events, `scrollV()`).
   *  Opt into a drawing surface explicitly: 'dots' (the particle surface), 'trails'
   *  (light-painting), 'links' (constellation), 'metaballs' (a liquid iso-surface, not
   *  dots), 'streamlines' (draw the force field itself — diagnostic, REPLACES the dots),
   *  'flow' (the dots AND the streamlines drawn together in the one underlay canvas —
   *  particles drifting along the visible flow, with no separate front surface and no
   *  `mix-blend`, so it stays a single cheap layer). */
  render?: 'dots' | 'trails' | 'links' | 'metaballs' | 'voronoi' | 'streamlines' | 'flow' | 'none';
  /** first-class mass (§21.3): when true, particle mass ∝ size and body forces accelerate by `a = F/m`
   *  (heavier matter moves less). Also gives DYNAMIC bodies inertial mass ∝ rendered area (#872), so a
   *  big heading recoils slowly and a small tag snaps. Default false (unit mass, byte-identical). */
  mass?: boolean;
  /** Newtonian own-emission reaction (substrate momentum, #873): when true, a DYNAMIC body feels the
   *  equal-and-opposite of the net impulse it imparts to nearby matter (a directional emitter recoils
   *  like a rocket; reciprocity closes through *motion*, not just feedback). Best paired with `mass`
   *  (recoil ÷ inertial mass). Default false ⇒ byte-identical. **Experimental.** */
  reaction?: boolean;
  /** strength of particle-to-particle separation/repulsion force (0 to 1, default 0). */
  separation?: number;
  /** color template for the travelling accent (§9): a built-in name
   *  (`'ours'` · `'heatmap'` · `'infrared'` · `'spectrum'`) or custom hex stops. */
  palette?: string | readonly string[];
  /** ambient THEME (#529) — a named preset (`'warm'` (default) · `'cool'` · `'mono'`) for the
   *  free-particle heat ramp + the background-wave baseline. `accent`/`palette` drive the travelling
   *  accent; `theme` drives the resting palette. Override individual lanes with the three below. */
  theme?: string;
  /** the resting (cool) end of the free-particle heat ramp, as hex — overrides the theme's. */
  gradientCool?: string;
  /** the energized (warm) end of the free-particle heat ramp, as hex — overrides the theme's. */
  gradientWarm?: string;
  /** the background-wave baseline colors, as hex stops — overrides the theme's wave palette. */
  waveBaseline?: readonly string[];
  /** conserved attention (§2.4): one finite strength budget — engaging a body
   *  pulls force off every other. Default false; rest-neutral until engaged. */
  attention?: boolean;
  /** cross-boundary causality (Concept 4): a saturated body spills density to its
   *  neighbours (writing `--lit` + firing `field:lit`/`field:dim`). Default false. */
  causality?: boolean;
  /** density heatmap (field-systems H1): a scalar buffer of where matter pools, drawn as a
   *  glow underlay and sampled to bodies as `--field-heatmap-density`. Default false. */
  heatmap?: boolean;
  /** backing-store device-pixel-ratio ceiling (#410); default 2. The dominant fill-rate lever —
   *  the ambient field is soft, so capping at ~1.5 buys ~1.8× headroom on retina for a small
   *  softening. The effective DPR is `min(devicePixelRatio, dprCap)`. Runtime-settable via
   *  `setDprCap`. */
  dprCap?: number;
  /**
   * Field Surfaces (overlay placement): a caller-provided canvas for the OVERLAY surface, drawn in
   * front of page content. Core sizes its backing store (matching the main canvas dpr) and draws the
   * `overlay` mode onto it each frame; the caller owns the element and its CSS placement (fixed,
   * full-viewport, `pointer-events:none`, above content / below nav). Keeps core DOM-free — the host
   * provides the canvas, core only draws. Default unset → no overlay surface.
   */
  overlayCanvas?: HTMLCanvasElement;
  /**
   * Field Surfaces (overlay placement, #676): a lazy alternative to `overlayCanvas`. When no
   * `overlayCanvas` is bound, core calls this provider ONCE — the first time an overlay reading actually
   * becomes active (a non-`off` `setOverlay`, or `setRender` leaving `'none'` with a reading already
   * set) — to obtain the surface. This lets a host (e.g. `<field-root>`) defer creating its
   * full-viewport, mix-blend light-DOM canvas until an overlay is switched on, so the common
   * `overlay: off` path never puts a canvas into the compositing tree at boot. Return `null` to decline
   * (stays surface-less). Ignored when `overlayCanvas` is set. Keeps core DOM-free — the host still owns
   * the element and its CSS placement.
   */
  overlayCanvasProvider?: () => HTMLCanvasElement | null;
  /** initial overlay visualization mode (Field Surfaces); default `'off'`. */
  overlay?: OverlayInput;
  /**
   * Distortion multiplier for the `grid` overlay (the reference lattice displaced by the field).
   * The lattice deflects each node by up to a fixed, deliberately-legible amount at the strongest
   * sample; `gridWarp` scales that deflection so the deformation reads more strongly. `1` (default)
   * is the calibrated "legible, never chaotic" amount; `2`–`3` exaggerates it to make the effect
   * obvious in a demo; `0` flattens the lattice to an undistorted grid. Only affects the `grid`
   * overlay mode. */
  gridWarp?: number;
  /**
   * Stroke opacity ∈ [0,1] for the `grid` overlay lines. `0.16` (default) is the calibrated faint
   * diagnostic that never overpowers content; raise it (≈`0.5`) to make the warped lattice a
   * deliberate visual centerpiece (the spacetime-curvature hero). Pairs with `gridWarp` (how much the
   * lattice deflects) — intensity is how strongly it reads. Only affects the `grid` overlay mode. */
  gridIntensity?: number;
  /** the drawing backend for the overlay surface (#373) — defaults to the Canvas 2D
   *  implementation over `overlayCanvas`. The structural seam a WebGL/WebGPU surface
   *  implements; see render-backend.ts. */
  overlayBackend?: import('./render-backend.ts').RenderBackend;
  /** the random source for ALL engine randomness — particle seeding, spawn scatter, jitter,
   *  release angles (#371). Defaults to Math.random; supply a seeded generator and a run
   *  becomes reproducible (the record/replay seam). */
  rng?: () => number;
  /** the wall-clock source for input-idle tracking (#371) — defaults to performance.now.
   *  One of the three clocks (wall / frame / simulation); see temporal.ts for the others. */
  now?: () => number;
  /**
   * Feedback seam (Phase D3): when set, the engine routes its per-body feedback channels to this
   * sink each frame *instead of* writing CSS variables / dispatching events directly — so the
   * platform's FeedbackRegistry can own the write phase. The simulation (the eased density value) is
   * unchanged; only the write target moves. Default unset → the engine installs an internal default
   * sink (#228) whose direct writes are identical to the historical behavior (same variables, same
   * three-decimal formatting, same `field:lit`/`field:dim` hysteresis) — the sink contract is the
   * one write path either way. Font-variation weight is a typographic render effect and stays in
   * the engine.
   */
  feedbackSink?: FeedbackSink;
  /**
   * The environment seam (frontier): the {@link FieldHost} the engine drives the DOM through. REQUIRED
   * by `createField` (core imports zero DOM). In the browser, use `browserHost()` from
   * `@fundamental-engine/dom`, or the `@fundamental-engine/{vanilla,elements,react}` entry points that wire it for
   * you; inject a custom host for a headless renderer / different document / tests.
   */
  host?: FieldHost;
  /**
   * Initial runtime {@link FieldPolicy} — what this host/session/user/app PERMITS (runtime rules),
   * distinct from governance (what doctrine allows). Change it live with {@link FieldHandle.setPolicy}.
   * Purely additive — omit for the unbounded default. */
  policy?: FieldPolicy;
  /**
   * FIRST-CLASS IDENTITY resolver (substrate critical path): derive a {@link FieldBodyIdentity} for a
   * DOM-scanned body from its element. Called once per body, the first time the body is keyed; the
   * returned identity is cached and used for query/snapshot/diff/replay/relationship keying. Return
   * `undefined` (or omit the option) to fall back to the default derivation (the element's DOM `id`,
   * else a monotonic `body-N`). The `id` a resolver returns MUST be unique within the field and stable
   * for the body's life. Programmatic `addBody({ identity })` overrides this. Purely additive — a field
   * with no `identify` behaves exactly as before.
   */
  identify?: (el: HTMLElement) => FieldBodyIdentity | undefined;
}

/** Per-element feedback values the engine produces each frame (Phase D3 seam). */
export interface FeedbackChannels {
  /** the body's eased gathered density `d` ∈ [0,1] → `--d` / `--field-density`. */
  density?: number;
  /** the ambient heatmap density at the body → `--field-heatmap-density`. */
  heatmapDensity?: number;
  /** sink accretion fill ∈ [0,1] → `--load` / `--mass`. */
  load?: number;
  /** cross-boundary lit signal ∈ [0,1] → `--lit` + thresholded `field:lit` / `field:dim`. */
  lit?: number;
  /** measured local disorder ∈ [0,1] (workover §"Metrics") → `--entropy`. Engine-measured
   *  thermodynamics — distinct from the platform's inferred `--field-entropy` pipeline lane. */
  entropy?: number;
  /** measured local order ∈ [0,1] (= 1 − entropy) → `--coherence`. Engine-measured;
   *  distinct from the platform's `--field-coherence` lane AND from the `--coherence`
   *  palette *color* token `cssTokens()` sets on `:root`. */
  coherence?: number;
  /** measured local agitation ∈ [0,1] (heat + kinetic) → `--temperature`. */
  temperature?: number;
}

/** Receives a body's feedback channels in place of direct DOM writes (Phase D3). */
export type FeedbackSink = (el: HTMLElement, channels: FeedbackChannels) => void;

/** Spec for an engine-stepped agent (`FieldHandle.addAgent`). */
export interface AgentSpec {
  /** initial position in field-pixel space. */
  x: number;
  y: number;
  /** initial depth (optional; a `depth > 0` field moves it, else it stays on the plane). */
  z?: number;
  /** inertial mass — heavier agents accelerate less under a force (a = F/m). Default 1. */
  mass?: number;
  /** top speed in field px/frame; the integrator clamps |v| to it each step. Default uncapped. */
  maxSpeed?: number;
  /** species tag — lets tagged bodies (`data-affects`) and `hunt` act on this agent selectively. */
  species?: number;
  /** called every step with the agent's live particle after it integrates — drive a mesh from here. */
  report: (p: Particle) => void;
}

/** Handle for an agent added via `FieldHandle.addAgent`. */
export interface AgentHandle {
  /** the live pool entry — read `x/y/z/vx/vy/heat`; write `x/y` to teleport, `vx/vy` to nudge. */
  readonly particle: Particle;
  /** retire the agent (remove it from the pool). */
  remove(): void;
}

/** Spec for a programmatic body — see {@link FieldHandle.addBody}. */
export interface BodySpec {
  /** the force ids this body emits (space-joined string or array), e.g. `'attract swirl'`. */
  tokens: string | readonly string[];
  /** FIRST-CLASS IDENTITY for this programmatic body (see {@link FieldBodyIdentity}). Supply a stable
   *  `id` (unique in the field) plus optional `namespace`/`kind`/`host`, so snapshots/diff/replay and a
   *  bridge can reference this body by identity rather than the returned handle. A bare string is shorthand
   *  for `{ id }`. Omitted ⇒ the engine derives a stable synthetic `body-N`. */
  identity?: FieldBodyIdentity | string;
  /** who owns this body's position; default `'anchored'`. See {@link BodyAuthority}. */
  authority?: BodyAuthority;
  /** overall force magnitude (scales every token). */
  strength?: number;
  /** radius of influence, in field px. */
  range?: number;
  /** rotation sign/scale for `swirl`/`lens` (default 1). */
  spin?: number;
  /** heading in degrees, for directional forces (`stream`, `jet`, …). */
  angle?: number;
  /** tint for `pigment` color transport. */
  color?: string;
  /** the body's box in field-pixel space, sampled each frame — the position source (a non-DOM
   *  host projects its mesh/view position through here). */
  rect: () => { left: number; top: number; width: number; height: number };
  /** an arbitrary record carried with the body, surfaced on the handle (opaque to the engine). */
  data?: unknown;
  /** receives this body's feedback channels each frame (demultiplexed from the global sink). */
  onFeedback?: (channels: FeedbackChannels) => void;
}

/** The handle to a programmatic body created by {@link FieldHandle.addBody}. */
export interface BodyHandle {
  /** the carried record (`BodySpec.data`). */
  data: unknown;
  /** this body's latest feedback channels — updated in place each frame. */
  readonly channels: FeedbackChannels;
  /**
   * Mutate this body's force params live — applied within a frame on the measure cadence, with **no
   * `rescan()`** (the reactive-param path DOM and three bodies already use). For a fading lure, a fox
   * getting hungrier, a wind gust strengthening: cheaper and steadier than remove + re-add. `angle` is
   * in degrees. Only the keys you pass change; `color` re-tints the carried pigment. A *structural*
   * change (different `tokens`) still needs remove + `addBody` — tokens are classified once, not reactive.
   */
  set(params: { strength?: number; range?: number; angle?: number; spin?: number; color?: string }): void;
  /** remove the body from the field. */
  remove(): void;
}

/** The handle to a programmatic relationship created by {@link FieldHandle.addEdge}. */
export interface EdgeHandle {
  /** mutate the edge live: `strength` ∈ [0,1] (the active coupling), `type` (the relationship kind). */
  set(params: { strength?: number; type?: string }): void;
  /** remove the edge from the field. */
  remove(): void;
}

/** A live view of a programmatic edge, returned by {@link FieldHandle.readEdges}. */
export interface EdgeView {
  /** the `data` record of the source body (the first `addBody` handle passed to `addEdge`). */
  from: unknown;
  /** the `data` record of the target body. */
  to: unknown;
  /** the relationship kind (`'related'` by default). */
  type: string;
  /** active coupling strength ∈ [0,1] — strengthens while the source is salient, decays while idle. */
  strength: number;
  /** slow-moving accumulated familiarity ∈ [0,1] — the longitudinal "warmth" of the relationship. */
  memory: number;
  /** whether the relationship was exercised this tick (its source body was salient). */
  active: boolean;
}

// ── Field Query API (substrate doc 04 / critical-path 02) ─────────────────────────────────────────
// A read-only, structured way to ask the live field for its state — bodies, metrics, relationships,
// and per-force influence — without a render surface. EXPERIMENTAL until stabilized; not yet part of
// the frozen API surface. See docs/planning/critical-path/02-field-query-api.md.

/** What a {@link FieldQuery} should return. Omitted ⇒ a sensible default (`bodies`, `metrics`,
 *  `relationships`, plus `influences` when the query targets a point/region). */
export type FieldQueryInclude = 'bodies' | 'metrics' | 'relationships' | 'influences';

/** A user-defined interpretation lens over a query/snapshot reading (substrate query phase 2) — a
 *  declarative scope, NOT an opinionated preset catalog: the caller supplies the lens, the field/`applyLens`
 *  filters by it. Each clause is an allow-list; omitting a clause keeps everything in that dimension.
 *  Pure metadata — a lens never changes field state. **EXPERIMENTAL.** */
export interface FieldLens {
  /** lens id, echoed onto the result as `FieldQueryResult.lens`. */
  id: string;
  label?: string;
  /** keep only these metric keys (applied to global metrics + each body's metrics/dimensions). */
  metrics?: readonly string[];
  /** keep only influences in these accumulator channels (a missing `channel` counts as `'linear'`). */
  channels?: readonly ForceAttribution['channel'][];
  /** keep only bodies carrying at least one of these tokens. */
  tokens?: readonly Token[];
}

/** A structured question put to the live field (read-only; never mutates state). */
export interface FieldQuery {
  /** where to look: a point (`{x, y}`) or a rectangle (`{x, y, width, height}` — `DOMRect`-shaped).
   *  Omitted ⇒ a global query over the whole field. */
  at?: Vec2 | FieldRect;
  /** for a point `at`, the query radius in field px (default 240). Ignored for a rect or global query. */
  radius?: number;
  /** which sections to include; omitted ⇒ the default set (see {@link FieldQueryInclude}). */
  include?: readonly FieldQueryInclude[];
  /** interpret the result through a lens (substrate query phase 2) — scopes metrics/influences/bodies.
   *  Equivalent to calling `applyLens(result, lens)` on the answer. **EXPERIMENTAL.** */
  lens?: FieldLens;
}

/** A body as seen by a query — identity, box, active tokens, and its measured metrics/dimensions. */
export interface FieldBodyReading {
  /** stable id: the element's `id` when present, else a per-field synthetic (`body-N`). Equals
   *  `identity.id`. Kept as the top-level field for back-compat; new consumers may read `identity`. */
  id: string;
  /** the body's resolved FIRST-CLASS IDENTITY (see {@link FieldBodyIdentity}). `identity.id === id`;
   *  `namespace`/`kind`/`host` carry any supplied structured metadata. Always present. */
  identity: FieldBodyIdentity;
  /** the body's box in field coordinates, when measured. */
  rect?: FieldRect;
  /** the composed force ids (the `data-body` tokens). */
  tokens: Token[];
  /** scalar readings (lane: metric) — e.g. `density`, `load`, `attention`, `engaged`. */
  metrics: Record<string, number>;
  /** measured field dimensions (lane: metric) — e.g. `entropy`, `coherence`, `temperature`. */
  dimensions: Record<string, number>;
  /** the Field Formation(s) biasing this body right now (the field's active formation). */
  activeFormations?: string[];
  /** who owns this body's position (see {@link BodyAuthority}); `'anchored'` by default. */
  authority?: BodyAuthority;
}

/** A relationship (edge) as seen by a query. */
export interface FieldRelationshipReading {
  /** source / target body ids (see {@link FieldBodyReading.id}). */
  from: string;
  to: string;
  /** the relationship kind (`'related'` by default). */
  type: string;
  /** active coupling ∈ [0,1]. */
  strength: number;
  /** slow accumulated familiarity ∈ [0,1]. */
  memory?: number;
  /** exercised this tick. */
  active: boolean;
  /** whether the edge carried causal influence this frame (today: equal to `active`). */
  causal: boolean;
}

/** A single force's influence at the query point/region — which body's which force contributed how
 *  much (from the impulse accumulator; lane: force). */
export interface FieldInfluenceReading {
  /** the body whose force exerted the influence. */
  source: string;
  /** the influenced target, when the query has one (the query point/region). */
  target?: string;
  /** the contributing force token. */
  force: Token;
  /** which accumulator channel this contribution is in (`'linear'` Δv, `'thermal'` heat, …). Default
   *  `'linear'` for back-compat with readers written before the thermal channel (doc 04 §Step 6). */
  channel?: ForceAttribution['channel'];
  /** the contribution — a Δv vector for `'linear'`, a scalar heat delta for `'thermal'`. */
  contribution: number | Vec2 | Vec3;
  /** optional human-readable note (lane: diagnostic). */
  reason?: string;
}

/** The structured answer to a {@link FieldQuery}. Plain data; safe to serialize. */
export interface FieldQueryResult {
  /** the query that produced this reading (echoed back). */
  query: FieldQuery;
  /** the frame this reading was taken on. */
  frame: number;
  /** the field clock at read time. */
  time: number;
  /** the resolved region (for a point/rect query). */
  region?: FieldRect;
  bodies: FieldBodyReading[];
  metrics: Record<string, number>;
  relationships: FieldRelationshipReading[];
  influences: FieldInfluenceReading[];
  /** the projections registered on the field (substrate 05) — metadata only; read-only. */
  projections: FieldProjectionInfo[];
  /** the lens id this reading was scoped through, when a `lens` was supplied (substrate query phase 2). */
  lens?: string;
}

// ── Field Snapshot + Diff (substrate critical-path 03) ────────────────────────────────────────────
// A snapshot captures *what the field was doing* at a frame (vs a screenshot's *what it looked like*);
// a diff compares two snapshots. EXPERIMENTAL — not in the frozen surface. Causal Replay is a later
// step. See docs/planning/critical-path/03-field-snapshot-causal-replay.md.

/**
 * A named **snapshot profile** — a concrete inclusion preset for {@link FieldHandle.snapshot}, resolved
 * to the TIGHTEST (most private) combination of its base inclusions, any explicit `include*` flags, and
 * the runtime {@link FieldPolicy} privacy budget. A profile can only tighten a call; it never widens past
 * what policy allows.
 *
 * - `'debug'` — everything: particles, relationships, influences, and body `data` (still gated by policy).
 * - `'agent'` — the Software-Agent read: stable ids + metrics + relationships + influence attribution +
 *   projections, but NO opaque body `data` (raw/user-identifying payloads withheld regardless of `includeData`).
 * - `'bug-report'` — structural + versions (relationships + influences), no user data.
 * - `'public'` — minimal: ids + shape (bodies/metrics/projections), no relationships, influences, or data.
 */
export type SnapshotProfile = 'debug' | 'agent' | 'bug-report' | 'public';

/** Options for {@link FieldHandle.snapshot}. */
export interface FieldSnapshotOptions {
  /** include the raw particle pool (heavier; off by default for lightweight exports). */
  includeParticles?: boolean;
  /** include the relationship (edge) graph (default true). */
  includeRelationships?: boolean;
  /** include each body's opaque `data` record (default false — privacy-preserving). */
  includeData?: boolean;
  /** include per-body force attribution (each body's own forces at its centre, via the impulse
   *  accumulator) so a later `replay()` can derive `cause: 'force'` steps. Off by default. */
  includeInfluences?: boolean;
  /** apply a named {@link SnapshotProfile} preset. Composes with the explicit `include*` flags and the
   *  {@link FieldPolicy} privacy budget, always resolving to the TIGHTEST (most private) result — a
   *  profile can never widen past what policy or an explicit deny allows. */
  profile?: SnapshotProfile;
}

/**
 * A scoped read CAPABILITY an {@link AgentFieldView} grants. Each names one dimension of the field's
 * read surface; a capability set is an allow-list — a dimension the caps don't include is stripped from
 * every reading (it tightens, never widens). Read-only throughout — there is no write capability, because
 * *agent-readable is not agent-writable* (see `docs/canonical/agent-consumption-model.md`).
 */
export type AgentCapability =
  | 'read:metrics'
  | 'read:relationships'
  | 'read:influences'
  | 'read:snapshots'
  | 'read:body-data'
  | 'read:projections'
  | 'read:diagnostics'
  | 'read:replay';

/** Options for {@link FieldHandle.forAgent} — the capability grant + optional redaction list. */
export interface AgentViewOptions {
  /** the capabilities this agent view grants. An allow-list: any dimension not listed is stripped from
   *  every reading. An empty set yields the most-restricted view (ids + shape only). */
  capabilities: AgentCapability[];
  /** dotted paths stripped from every reading AFTER capability scoping (e.g. `'body.data'`, `'host.user'`,
   *  `'metrics.temperature'`). `body.*` / `relationship.*` / `influence.*` / `projection.*` prefixes address
   *  the per-entry shape of each list; a bare top-level key addresses the result/snapshot itself. */
  redactions?: string[];
}

/**
 * A READ-ONLY facade over a field, scoped to a set of {@link AgentCapability}s — the surface a Software
 * Agent uses to read the field safely. It exposes ONLY scoped `query()` / `snapshot()` (and `replay()`
 * when `read:replay` is granted). It has NO mutation methods — no `applyForce`, no `addBody`, no
 * `setPolicy` — enforced by the facade's very shape: *agent-readable is not agent-writable*. Every
 * reading is tightened to the granted capabilities, then any `redactions` paths are stripped, and the
 * result can never widen past what the field's {@link FieldPolicy} already permits.
 */
export interface AgentFieldView {
  /** the granted capabilities (a frozen copy). */
  readonly capabilities: readonly AgentCapability[];
  /** the redaction paths (a frozen copy). */
  readonly redactions: readonly string[];
  /** a capability-scoped, redacted {@link FieldQueryResult}. Dimensions the caps don't grant are absent
   *  (no `read:influences` → no influences; no `read:relationships` → no relationships; etc.). */
  query(q?: FieldQuery): FieldQueryResult;
  /** a capability-scoped, redacted {@link FieldSnapshot}. Body `data` is withheld unless `read:body-data`
   *  is granted (and policy permits it); a `profile`/`include*` request can only tighten from here. */
  snapshot(opts?: FieldSnapshotOptions): FieldSnapshot;
  /** narrate how the field changed between two snapshots — present ONLY when `read:replay` is granted
   *  (otherwise `undefined`, so the facade's shape reflects the grant). */
  replay?(a: FieldSnapshot, b: FieldSnapshot, opts?: ReplayOptions): CausalReplay;
}

/** A body captured in a {@link FieldSnapshot}. */
export interface FieldBodySnapshot {
  /** stable id — equals `identity.id`; snapshot/diff/replay key on it. */
  id: string;
  /** the body's resolved FIRST-CLASS IDENTITY (see {@link FieldBodyIdentity}). Always present. */
  identity: FieldBodyIdentity;
  /** who owns this body's position (see {@link BodyAuthority}); `'anchored'` by default. */
  authority?: BodyAuthority;
  /** the body's box in field coordinates (anchored bodies). */
  rect?: FieldRect;
  /** the body's centre in field coordinates (z = 0 for an anchored body). */
  position?: Vec3;
  tokens: Token[];
  metrics: Record<string, number>;
  dimensions: Record<string, number>;
  /** the body's opaque record, only when `includeData` was set. */
  data?: unknown;
}

/** One particle captured in a {@link FieldSnapshot} (only when `includeParticles`). */
export interface FieldParticleSnapshot {
  x: number;
  y: number;
  z: number;
  heat: number;
  size: number;
}

/** A portable capture of field state at a moment in time — inspect, compare, test, export, or hand to
 *  an agent. Plain data; safe to serialize. Format is versioned via {@link FieldSnapshot.version}. */
export interface FieldSnapshot {
  /** a per-field unique id (`snap-<frame>-<n>`). */
  id: string;
  /** the field clock at capture (`env.t`). */
  createdAt: number;
  /** the frame captured. */
  frame: number;
  /** the engine build (`FIELD_VERSION`) — the snapshot-format version. */
  version: string;
  /** the active Field Formation id(s) at capture. */
  formations: string[];
  bodies: FieldBodySnapshot[];
  relationships: FieldRelationshipReading[];
  metrics: Record<string, number>;
  /** per-body force attribution at capture (only when `includeInfluences`) — each body's own forces at
   *  its centre, by channel; lets `replay()` derive `cause: 'force'` steps. */
  influences?: FieldInfluenceReading[];
  /** the projections registered on the field at capture (substrate 05) — metadata only. */
  projections: FieldProjectionInfo[];
  particles?: FieldParticleSnapshot[];
}

/** A change to one body between two snapshots. */
export interface BodyChange {
  id: string;
  kind: 'added' | 'removed' | 'changed';
  /** per-metric `{ from, to }` for the metrics that changed (kind `'changed'`). */
  metrics?: Record<string, { from: number; to: number }>;
}

/** A change to one relationship between two snapshots. */
export interface RelationshipChange {
  from: string;
  to: string;
  type: string;
  kind: 'added' | 'removed' | 'changed';
  strength?: { from: number; to: number };
  active?: { from: boolean; to: boolean };
}

/** A change to one field-level metric between two snapshots. */
export interface MetricChange {
  key: string;
  from: number;
  to: number;
}

/** A Field Formation that activated or deactivated between two snapshots. */
export interface FormationChange {
  id: string;
  kind: 'activated' | 'deactivated';
}

/** The structured comparison of two {@link FieldSnapshot}s — what changed in the field, by lane. */
export interface FieldDiff {
  /** the `id`s of the two snapshots compared. */
  from: string;
  to: string;
  bodyChanges: BodyChange[];
  relationshipChanges: RelationshipChange[];
  metricChanges: MetricChange[];
  formationChanges: FormationChange[];
}

// ── Projection Registry (substrate critical-path 05) ──────────────────────────────────────────────
// A projection maps field STATE into an output surface (CSS, an annotation, agent-readable JSON, a
// reduced-motion equivalent, …). Governance principle: *projection reveals state; coupling changes
// state — do not confuse them.* A projection never mutates the field (no forces). EXPERIMENTAL — not in
// the frozen surface; governance lint is a later step. See docs/planning/critical-path/05-*.md.

/** The kinds of output surface a {@link FieldProjection} can target. */
export type FieldProjectionSurface =
  | 'css'
  | 'dom-attribute'
  | 'svg'
  | 'canvas'
  | 'typography'
  | 'annotation'
  | 'sound'
  | 'haptic'
  | 'native'
  | 'spatial'
  | 'agent-json';

/** Where a projection writes — a minimal, DOM-shaped sink (an element's style / attributes), but open
 *  so non-DOM surfaces (native, agent-json) can pass their own target. */
export interface FieldProjectionTarget {
  style?: { setProperty(key: string, value: string): void };
  setAttribute?(key: string, value: string): void;
  [key: string]: unknown;
}

/** A named mapping from field state to an output surface. `apply` is the (optional) writer; the rest is
 *  declarative metadata governance + tooling read. A projection must NOT change field state. */
export interface FieldProjection {
  id: string;
  label: string;
  /** the field channels this projection reads (e.g. `['density','confidence']`). */
  channels: string[];
  /** the surface(s) it writes to. */
  surfaces: FieldProjectionSurface[];
  /** the non-motion equivalent, for `prefers-reduced-motion` (governance: motion must translate). */
  reducedMotionEquivalent?: string;
  /** the accessibility equivalent — an alternate projection of the same state, not a fallback. */
  accessibilityEquivalent?: string;
  /** write the reading onto the target (read-only w.r.t. the field). */
  apply?(reading: Record<string, number>, target: FieldProjectionTarget): void;
}

/** A live reading source for an auto-applied projection — called once per write phase to produce the
 *  reading handed to the projection's `apply`. The field never reads it for simulation. */
export type ProjectionSource = () => Record<string, number>;

/** A {@link FieldProjectionTarget} for the `agent-json` surface: it captures the last reading written to
 *  it as a plain object, serializable for agent / tooling consumption. Build one with `agentJsonTarget()`
 *  and pair it with `agentJsonProjection()`. **EXPERIMENTAL.** */
export interface AgentJsonTarget extends FieldProjectionTarget {
  /** receive a reading (called by the projection's `apply`). */
  receive(reading: Record<string, number>): void;
  /** the last received reading, or null before the first write. */
  value(): Record<string, number> | null;
  /** the last received reading serialized as JSON (`"null"` before the first write). */
  json(): string;
}

/** Serializable metadata about a registered projection (no `apply`) — what `query()`/`snapshot()` and
 *  governance tooling read. */
export interface FieldProjectionInfo {
  id: string;
  label: string;
  channels: string[];
  surfaces: FieldProjectionSurface[];
  reducedMotionEquivalent?: string;
  accessibilityEquivalent?: string;
}

/** The field's projection registry ({@link FieldHandle.projections}) — register named projections and
 *  apply them. Read/output only; registering a projection never changes how matter moves. */
export interface ProjectionRegistry {
  /** register a projection (replacing any with the same id); returns an unregister fn. */
  register(projection: FieldProjection): () => void;
  /** remove a registered projection by id. */
  unregister(id: string): void;
  /** the full projection (incl. `apply`) for an id, or undefined. */
  get(id: string): FieldProjection | undefined;
  /** serializable metadata for every registered projection. */
  list(): FieldProjectionInfo[];
  /** apply a registered projection's writer to a target (no-op if the id/`apply` is absent). */
  apply(id: string, reading: Record<string, number>, target: FieldProjectionTarget): void;
  /** bind a registered projection to a target + a live reading source — the field auto-applies it once
   *  per write phase (after feedback), read-only w.r.t. the field. Returns an unbind fn. Multiple
   *  bindings (even of the same id) coexist; binding an unknown/`apply`-less id is inert. **EXPERIMENTAL.** */
  bind(id: string, target: FieldProjectionTarget, source: ProjectionSource): () => void;
  /** governance lint over the registered projections (substrate 05 §governance) — flags accessibility
   *  gaps (a motion-capable projection with no reduced-motion equivalent; any projection with no
   *  accessibility equivalent). Pure; the standalone `lintProjections` is also exported. */
  lint(): GovernanceWarning[];
}

// ── Governance lint (substrate critical-path 05 §governance) ──────────────────────────────────────
// Rules that keep powerful field behavior explainable + accessible. MVP: the projection-accessibility
// rules (the lane-separation / coupling-passport / relationship-force rules are a later step).

/** A governance lint finding. `rule` is a stable `field/...` id (see doc 05 §field-lint-rules). The
 *  severity scale matches the visual `LintSeverity` (info / warning / error / fatal). */
export interface GovernanceWarning {
  rule: string;
  severity: 'info' | 'warning' | 'error' | 'fatal';
  /** the offending subject — e.g. a projection id. */
  subject: string;
  message: string;
}

// ── Causal Replay (substrate critical-path 03 phase 2) ────────────────────────────────────────────
// Explain HOW the field changed between two snapshots — an ordered, narrated sequence of causes
// (formation activations, relationship shifts, body measurements/metrics). Derived purely from two
// snapshots (it reads the diff); preserves attribution. EXPERIMENTAL — not in the frozen surface.

/** The lane a {@link CausalReplayStep} belongs to. */
export type CausalCause = 'force' | 'relationship' | 'metric' | 'formation' | 'measurement';

/** Options for {@link FieldHandle.replay}. */
export interface ReplayOptions {
  /** restrict the replay to steps touching this body id (its metrics, or a relationship endpoint). */
  focus?: string;
}

/** One narrated cause in a {@link CausalReplay}. */
export interface CausalReplayStep {
  frame: number;
  time: number;
  cause: CausalCause;
  /** the body/edge the cause originates from (a body id, or a relationship's `from`). */
  source?: string;
  /** the affected target, when the cause is a relationship. */
  target?: string;
  /** a human-readable account of the change (lane: diagnostic). */
  description: string;
  /** the structured before/after behind the description (e.g. `{ from, to }`). */
  contribution?: unknown;
}

/** An explanation of how the field changed between two snapshots — the ordered causal steps. Pure
 *  (derived from the two snapshots); plain data, safe to serialize. */
export interface CausalReplay {
  /** the `id`s of the two snapshots replayed. */
  from: string;
  to: string;
  /** the focus body id, if the replay was scoped to one. */
  focus?: string;
  steps: CausalReplayStep[];
}

/** A registered **field channel** (`FieldHandle.addField`) — an external scalar field sampled on the
 *  engine's read path. The open *input* analog of the render surfaces. */
export interface FieldChannelHandle {
  /** the channel name (the key passed to `addField`). */
  readonly name: string;
  /** swap the sampler live (e.g. a season changes the moisture map). */
  set(sampler: (x: number, y: number) => number): void;
  /** unregister the channel; `sampleField(name, …)` returns 0 afterward. */
  remove(): void;
}

/** The handle returned by `createField` — the public field API (§13). */
export interface FieldHandle {
  /** the running engine version (`FIELD_VERSION`) — which build this field is on. */
  readonly version: string;
  /** the field's projection registry (substrate 05) — register named projections that reveal field
   *  state on an output surface (CSS / annotation / agent-json / reduced-motion …). Read/output only:
   *  a projection never changes how matter moves. See {@link ProjectionRegistry}. **EXPERIMENTAL.** */
  readonly projections: ProjectionRegistry;
  /** (re)scan the document for `[data-body]` bodies after a layout change. */
  scan(): void;
  /** alias of `scan`. */
  rescan(): void;
  /** recolor the travelling accent (§9). */
  setAccent(hex: string): void;
  /** swap the accent's color template live: a built-in name or custom hex stops (§9). */
  setPalette(palette: string | readonly string[]): void;
  /** switch the global formation (§7). */
  setFormation(name: string): void;
  /** switch the wave current layout style. */
  setWaveStyle(style: 'linear' | 'circular'): void;
  /** set the custom wave center coordinate (or function). */
  setWaveCenter(center: { x: number; y: number } | (() => { x: number; y: number }) | null): void;
  /** set particle-to-particle separation/repulsion force strength. */
  setSeparation(strength: number): void;
  /** toggle conserved attention (§2.4) live — one finite strength budget. */
  setAttention(on: boolean): void;
  /** toggle cross-boundary causality (Concept 4) live — density spills to neighbours. */
  setCausality(on: boolean): void;
  /** toggle the density heatmap layer (field-systems H1) live. */
  setHeatmap(on: boolean): void;
  /** Lower (or raise) the backing-store **device-pixel-ratio ceiling** at runtime — the dominant
   *  fill-rate lever (#410). The ambient field is soft, so a cap of ~1.5 buys ~1.8× headroom on a
   *  retina display for a small softening. Re-sizes the surfaces immediately. Default 2. */
  setDprCap(cap: number): void;
  /** Apply an adaptive **quality tier** `0–3` (#413) — the QualityGovernor's signal, mapped to the
   *  engine's own levers: a tier caps the effective backing-store DPR (1 → 1.5 → 1.25 → 1) and, at
   *  `2+`, skips the heaviest ambient layer (the heatmap glow). Reversible — `0` restores the configured
   *  quality. The platform runtime forwards the governor's tier automatically; call it directly for a
   *  custom quality policy. */
  setQualityTier(tier: number): void;
  /** the field's current runtime {@link FieldPolicy} (a frozen copy). `{}` when none was set. */
  readonly policy: FieldPolicy;
  /** Replace the runtime {@link FieldPolicy} live — what this host/session/user/app PERMITS. This is a
   *  REPLACE (not a merge): pass the full policy you want in effect (`{}` clears to the unbounded
   *  default). Takes effect from the next frame. The motion budget it carries folds (via `min`) with
   *  reduced-motion + perf pressure — reduced-motion always wins, so a policy can lower motion but never
   *  raise it. The privacy budget gates body `data` in `snapshot()`. */
  setPolicy(policy: FieldPolicy): void;
  /**
   * Derive a READ-ONLY {@link AgentFieldView} scoped to a set of {@link AgentCapability}s — the safe
   * surface a Software Agent uses to read the field. The returned facade exposes ONLY scoped
   * `query()` / `snapshot()` (and `replay()` when `read:replay` is granted); it has NO mutation methods.
   * Readings are tightened to the granted capabilities, then any `redactions` paths are stripped, and the
   * result can never widen past what the field's {@link FieldPolicy} already permits. Purely additive —
   * `forAgent` reads the same live field; it does not fork or copy it.
   */
  forAgent(opts: AgentViewOptions): AgentFieldView;
  /**
   * Switch the underlay render mode (§20.6) live — the surface behind content. `'none'` is the
   * signals-only mode (§13.7 / #297): drawing stops from the next frame while the simulation and
   * its signals stay live. Switching TO `'none'` at runtime keeps an already-acquired context and
   * backing store (the no-allocation guarantee belongs to fields CREATED with `render: 'none'`);
   * switching FROM `'none'` acquires the context lazily and sizes the backing store at that moment.
   */
  setRender(mode: 'dots' | 'trails' | 'links' | 'metaballs' | 'voronoi' | 'streamlines' | 'flow' | 'none'): void;
  /**
   * Render field READINGS on the OVERLAY surface — in front of page content (Field Surfaces). Pairs
   * with `setRender` (the underlay); set both for an immersive look. No-op unless the field was created
   * with an `overlayCanvas`. Accepts one reading or an additive stack (drawn in order); `'off'` (or an
   * empty stack) clears the overlay surface.
   */
  setOverlay(mode: OverlayInput): void;
  /** wire glowing connector lines between a set, or clear with null (§10). */
  threads(list: ThreadLink[] | null): void;
  /** a discrete one-shot: shove + heat matter near (x, y), optionally tinting it (§11). */
  burst(x: number, y: number, hex?: string): void;
  /**
   * Place or move a dynamic flow focus at `(x, y)` — a movable target the field bends toward: it
   * pulls free matter in, curves the streamlines, and eases the wave spine to it. Call repeatedly to
   * retarget it (follow the pointer, track an element, animate a path); clear with `clearFlow()`.
   */
  flowTo(x: number, y: number, opts?: FlowOptions): void;
  /** Remove the flow focus — the field relaxes back to its bodies-only shape. */
  clearFlow(): void;
  /**
   * Bind a data record to each base particle, round-robin (so every dot carries a piece of meaning).
   * Each record's `weight` (0..1) scales that particle's mass + size — richer records read as heavier,
   * more central matter. Re-applied across resize/density rebuilds. Pick them back with `atomAt`.
   */
  seed(atoms: readonly AtomPayload[]): void;
  /**
   * Add an **agent** — a mesh-bound participant the engine *moves*. Unlike `sample()` (where a caller
   * integrates a mesh itself), an agent lives in the particle pool, so the integrator steps it and it
   * feels every force the swarm feels — body forces AND the particle-level ones (`hunt`/`align`/
   * `cohesion`/`diffuse`). Each step its `report(p)` fires with the agent's live state so an external
   * transform (a `THREE.Object3D`) can follow it; `maxSpeed` caps it; `species` lets tagged bodies
   * (`data-affects`) act on it selectively. Returns a handle — `remove()` retires it; `particle` is
   * the live pool entry (read `x/y/z/vx/vy`, write to teleport). Agents are edge-bounced (not wrapped)
   * and excluded from `readParticles`. The creatures primitive `@fundamental-engine/three`'s
   * `layer.addAgent` binds over.
   */
  addAgent(spec: AgentSpec): AgentHandle;
  /**
   * Add a **programmatic body** — a source the engine measures and runs forces from, created from a
   * spec instead of a scanned `[data-body]` element. The sanctioned alternative to the DOM scan for a
   * non-DOM host (a Three.js mesh, a native view): no fake document, no `querySelectorAll` duck-typing.
   * `tokens` (space-joined or array) + `strength` / `range` / `spin` / `angle` / `color` define the
   * emitter; `rect()` is sampled each frame for its box in field-pixel space (project a mesh's world
   * position through here). The body **carries a data record** (`data`, surfaced on the handle — the
   * Body-level analog of a particle's atom) and can take **per-body feedback** (`onFeedback`, this
   * body's channels each frame, demultiplexed from the global sink). It persists across `rescan()`.
   * Returns a {@link BodyHandle} — `data`, the live `channels`, and `remove()`.
   */
  addBody(spec: BodySpec): BodyHandle;
  /**
   * Relate two programmatic bodies — the non-DOM counterpart of the relationship graph (`addEdge` is to
   * relationships what `addBody` is to bodies). `a` and `b` are handles returned by `addBody` on this
   * field. The edge carries a live `RelationshipAgent`: it **strengthens while its source body is
   * salient** (gathering matter) and decays while idle, accumulating `memory` — so a non-visual consumer
   * (an agent modelling file ↔ meeting ↔ app) gets the relationship layer + its longitudinal warmth, with
   * no DOM. Read it back with {@link readEdges}. Returns an {@link EdgeHandle} to mutate/remove it.
   * Shipped-but-unfrozen.
   */
  addEdge(a: BodyHandle, b: BodyHandle, opts?: { type?: string; strength?: number; direction?: 'from-to' | 'to-from' | 'bidirectional' }): EdgeHandle;
  /** A live snapshot of the programmatic edges (`addEdge`) — the relationship read-out for a non-visual
   *  consumer: each edge's endpoint `data`, type, live `strength`/`memory`, and whether it's active this
   *  tick. Pure, read-only. Shipped-but-unfrozen. */
  readEdges(): ReadonlyArray<EdgeView>;
  /** Ask the live field a structured question and get back plain, serializable data — bodies,
   *  metrics, relationships, and per-force influence — for a point, a rect, or the whole field.
   *  Read-only and render-agnostic (works headless). The substrate's agent-/tool-readable surface;
   *  see {@link FieldQuery}. **EXPERIMENTAL** — not yet in the frozen API set. */
  query(q?: FieldQuery): FieldQueryResult;
  /** Capture *what the field is doing* right now — a portable, serializable {@link FieldSnapshot}
   *  (bodies, metrics, relationships, active formations; optionally particles). Read-only; works
   *  headless. Pair with {@link FieldHandle.diff} to compare two snapshots. **EXPERIMENTAL.** */
  snapshot(opts?: FieldSnapshotOptions): FieldSnapshot;
  /** Compare two snapshots and report what changed in the field — body, relationship, metric, and
   *  formation changes. Pure (takes two snapshots; ignores live state). **EXPERIMENTAL.** */
  diff(a: FieldSnapshot, b: FieldSnapshot): FieldDiff;
  /** Explain how the field changed between two snapshots — an ordered, narrated sequence of causes
   *  (formation activations, relationship shifts, body measurements/metrics). Pure (derived from the
   *  two snapshots). Pass `{ focus }` to scope it to one body. **EXPERIMENTAL.** */
  replay(a: FieldSnapshot, b: FieldSnapshot, opts?: ReplayOptions): CausalReplay;
  /**
   * Register a named **field channel** — a read-back substrate the host samples via `sampleField`; the
   * engine does not (yet) couple it into forces. The open *input* analog of the render surfaces
   * (`setRender`/`setOverlay` are bundled output
   * surfaces; `addField` is an on-demand input channel): instead of bolting a parallel grid alongside
   * the field, hand the engine a sampler `(x, y) => number` (terrain height, soil moisture, a heat map)
   * and read it back through `sampleField(name, x, y)`, so a consumer queries **one** field, not two.
   * The sampler is pull-based — called on demand, never cached — so keep it cheap. The returned
   * {@link FieldChannelHandle} swaps the sampler live or removes the channel. (Force coupling — a force
   * reading a channel as a potential — is a separate, opt-in step; this is the read substrate.)
   */
  addField(name: string, sampler: (x: number, y: number) => number): FieldChannelHandle;
  /** Sample a registered field channel at `(x, y)`. Returns 0 for an unregistered channel. */
  sampleField(name: string, x: number, y: number): number;
  /** The seeded record on the nearest particle to (x, y) within ~24px, or null. For hover-to-inspect. */
  atomAt(x: number, y: number): AtomPayload | null;
  /**
   * Focus the nearest seeded particle to (x, y) within ~24px: hold it still and light it up, and
   * return its record (or null + clear focus if none). The dwell affordance before a click — call
   * on hover-dwell, then `clearFocus()` when the pointer moves on.
   */
  focusAt(x: number, y: number): AtomPayload | null;
  /** Release the focused particle (it resumes drifting). */
  clearFocus(): void;
  /**
   * Live particle count — the current size of the particle pool. Equivalent to `store.size`
   * inside the engine. Use for external budget monitors and debug overlays that need the count
   * without walking the particle array (which `inspectBudget` does internally).
   */
  particleCount(): number;
  /**
   * Snapshot of kinetic, thermal, and total energy for the current frame. Thin forward to
   * `energyReport(store.particles)` from `@fundamental-engine/core/diagnostics/energy` — the function
   * already exists; this accessor exposes it through the public handle so external tools
   * (DataConsole, Inspector) don't need a reference to the internal particle array.
   */
  energy(): { kinetic: number; thermal: number; total: number; count: number };
  /**
   * Sample the live field at a point: the net force a still test particle would feel there — the
   * superposition of every visible body's influence (attract/gravity wells, charge/magnetism
   * dipole structure, flow bias, …). Returns the force vector as `{ x, y }` in field-pixel space.
   * Pure and read-only (no pool mutation), safe to call any time and at any spatial resolution —
   * the engine does not pre-bake a grid. The seam external visualizers consume to build their own
   * field geometry: vector grids, streamline tubes, mesh displacement. `@fundamental-engine/three`'s
   * `vectorField` / `streamlineTubes` are the first consumers. Thin wrapper over the existing
   * `forceAt(bodies, forces, env, x, y)`.
   */
  sample(x: number, y: number): Vec2;
  /**
   * Sample the live **density scalar** at a point ∈ [0,1]: the smooth, diffused field of where matter
   * has gathered — distinct from `sample()` (the force vector) and from a body's own `--d`. Unlike a
   * nearest-body readout, this is a true bilinear grid (the heatmap), so its gradient stays meaningful
   * right at a source — the thing forage-by-gradient needs. Requires the heatmap layer
   * (`createField({ heatmap: true })` or `setHeatmap(true)`); returns `0` when it is off. Read-only;
   * updated each frame even under `render: 'none'`. Finite-difference it for the gradient.
   */
  sampleScalar(x: number, y: number): number;
  /**
   * Sample the **smooth density scalar** at a point — the diffused heatmap grid, normalized to
   * `[0, 1]`. Unlike a nearest-body readout (which flattens to a flat top right at a source), this
   * is the per-frame particle-density field after a diffuse pass, so it has a real, non-zero
   * **gradient everywhere** — finite-difference it to climb toward where matter actually gathers
   * (forage-by-gradient). Bilinear, samplable at any resolution. Requires the heatmap layer to be on
   * (`createField({ heatmap: true })` or `setHeatmap(true)`); returns `0` when it is off. Maintained
   * even under `render: 'none'`, so it works headless. (`@fundamental-engine/three`'s `FieldLayer`
   * enables it so agents can forage out of the box.)
   */
  sampleScalar(x: number, y: number): number;
  /**
   * Sample the **gradient ∇** of the density field at a point — the `{ x, y }` direction (and
   * steepness, in 1/px) of *increasing* matter density. The analytic companion to `sampleScalar`:
   * computed from the same diffused heatmap grid, so it stays non-degenerate at a source (a real
   * uphill slope where a nearest-body density — or `sampleScalar` finite-differenced too close in —
   * flattens to zero). This is what reliable forage-/flee-by-gradient steers by: add it to a heading
   * to climb toward matter, negate it to flee crowding. Requires the heatmap layer
   * (`createField({ heatmap: true })` or `setHeatmap(true)`); returns `{ x: 0, y: 0 }` when it is off
   * or the field is empty. Pure, read-only, maintained even under `render: 'none'`.
   */
  sampleGradient(x: number, y: number): Vec2;
  /**
   * Open a named **scalar grid** — the engine's field-buffer primitive (the same one `diffuse` /
   * `memory` / `propagate` run on), promoted to a host-authorable surface. Use it to lay down and
   * read application fields the simulation can then compose with: a scent map, a wear/desire-path
   * layer, a goal-attractor field. `deposit(x,y,amount)` adds matter; `sample(x,y)` reads it back
   * bilinearly; `gradient(x,y)` gives its up-slope direction (forage-by-gradient); `decay(rate)` /
   * `clear()` fade it. The grid is created on first access (allocating nothing until then), kept
   * viewport-sized, and advanced once per frame by its mode — inferred from the name: `wave…` runs
   * the wave scheme, `memory…` decays slowly, everything else diffuses. A force of the same name
   * shares the same buffer, so a host can read what a force writes (and vice versa); pick a distinct
   * name (e.g. `'scent'`) to keep an authored field independent. Read-write, lives in field px.
   */
  grid(name: string): ScalarGrid;
  /**
   * Subscribe to a discrete **field event** — the engine's host-agnostic push bus, for reacting to
   * *occurrences* instead of polling the continuous feedback channels each frame. Returns an
   * unsubscribe function. Plain data, no DOM (distinct from the `data-on` CustomEvent bindings a DOM
   * host uses). Events: `absorb` / `release` — a `sink` body captured / let go of matter (the rising
   * / falling edge of accretion), `{ body, count }`. Detection is lazy: a type with no listener costs
   * nothing. (`contact`, `settle`, and per-particle `enter`·`exit` are the next slice — see #441.)
   */
  on<K extends FieldEventType>(type: K, cb: (e: FieldEventMap[K]) => void): () => void;
  /**
   * Copy live particle state into a caller-owned buffer and return the number of particles
   * written. Stride 5, packed `[x, y, z, heat, size, …]` in CSS-pixel field coordinates — the
   * layout maps straight onto a renderer's vertex buffer (e.g. a `THREE.BufferAttribute`), so an
   * alternative surface can draw the swarm without a 2D context and without the engine exposing
   * its internal particle objects. `z` is the optional depth lane (z-axis.md): always `0` in a flat
   * field, populated only when the field was created with `depth > 0`. Zero-allocation and
   * read-only: it never mutates the pool.
   *
   * Writes `min(particleCount(), floor(out.length / 5))` particles — pass `new Float32Array(cap *
   * 5)` sized to your cap (over-sizing is safe; the return value is the count actually written).
   * Pull-based: call once per frame after the engine has stepped, then upload the slice
   * `[0, n*5)`. The companion of `particleCount()` for renderers that need positions, not just the
   * tally; `@fundamental-engine/three`'s particle bridge is the first consumer.
   */
  readParticles(out: Float32Array): number;
  /**
   * Copy each live particle's **stable id** into a caller-owned `Uint32Array`, returning the count
   * written. Parallel to {@link readParticles} — same pool order, same agent exclusion — so the id at
   * `ids[i]` belongs to the particle whose state is at stride offset `i*5` there. Identity is the
   * piece pooled particles otherwise lack: a host that `seed`s entities (wind-borne seeds, tagged
   * motes) reads their ids back each frame to track which is which and key its own opaque payload off
   * them (the engine carries the identity, not the payload). Zero-allocation, read-only.
   */
  readParticleIds(out: Uint32Array): number;
  /** Read multiple named channels from live particles into caller-owned buffers (column-wise:
   *  all particles' first channel, then second, etc.). Returns the particle count written.
   *  Channels: 'x' | 'y' | 'z' | 'vx' | 'vy' | 'heat' | 'size' | 'm' | 'id' | 'age' | 'charge'.
   *  Unknown channels write 0. Mirrors readParticles() agent-exclusion behaviour.
   */
  readParticleChannels(channels: readonly string[], out: readonly Float32Array[]): number;
  /** Register a named custom overlay function. Called each frame when `name` is in the
   *  active overlay stack (via setOverlay). Returns an unregister function.
   *  drawFn receives the active RenderBackend, current Env, and canvas W/H.
   */
  registerOverlay(name: string, drawFn: (backend: import('./render-backend.ts').RenderBackend, env: Env, W: number, H: number) => void): () => void;
  /**
   * The engine's eased page-scroll velocity for the current frame — the same EMA value the
   * `scrolling` condition gate uses: `(prev × 0.7) + (|scrollDelta| × 0.3)` per frame.
   * Units are pixels per frame at the native rAF cadence (~1 at 60 fps per pixel/s of scroll).
   * Near 0 = user is reading/stopped; 2+ = slow deliberate scroll; 10+ = fast scan/jump.
   * CAVEAT: px/frame is refresh-rate dependent — the same physical scroll reads roughly half
   * this value on a 120 Hz display. A px/ms normalization may replace this unit before 1.0
   * (the surface is experimental); thresholds tuned on 60 Hz should treat the value as coarse.
   * Written to `--field-scroll-v` on `:root` by the platform write phase when a platform
   * runtime is active. Pull-based: read on demand, do not poll in tight loops.
   */
  scrollV(): number;
  /**
   * Element-level visibility hint. `setVisible(false)` while the canvas is hidden or offscreen
   * (`display:none`, scrolled out) skips ALL draw work — usually the dominant frame cost — while
   * the simulation and its signals stay live: `scrollV()`, feedback vars (`--d`, `--load`),
   * capture events keep flowing. Distinct from the tab-level pause (the engine already stops
   * fully on the host's visibilitychange). `<field-root>` wires this automatically from an
   * IntersectionObserver on the host element; call it yourself for custom embeddings.
   */
  setVisible(on: boolean): void;
  /**
   * Switch the substrate background live (the construction `background` option, at runtime).
   * `'transparent'` clears to transparent so the underlay composites over light content;
   * `'opaque'` restores the near-black substrate. Additive — no existing caller is affected.
   */
  setBackground(mode: 'opaque' | 'transparent'): void;
  /** stop the loop and release listeners. */
  destroy(): void;
}
