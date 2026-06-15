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
 * A registered DOM element acting as a force source (§3.1). Parsed from
 * `data-*` attributes; the runtime fields are refreshed each scan/frame.
 */
export interface Body {
  el: HTMLElement;
  /** space-joined force ids from `data-body` (they compose, §4). */
  tokens: Token[];
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

/** A full surface-state description for {@link FieldHandle.setSurfaces} — matter, readings, and the
 *  accumulation layer as one plan. An omitted key means its default. */
export interface SurfacePlan {
  /** the matter surface BEHIND content — the render mode; default `'dots'`. */
  underlay?: 'dots' | 'trails' | 'links' | 'metaballs' | 'voronoi' | 'streamlines' | 'flow' | 'none';
  /** the readings surface IN FRONT of content — one mode or an additive stack; default none (`'off'`). */
  overlay?: OverlayInput;
  /** the density accumulation layer; default `false`. */
  heatmap?: boolean;
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
  /** draw the background Currents (§24); default true. Set false for the bare
   *  free-particle field with no carrier waves. */
  waves?: boolean;
  /** substrate background: `'opaque'` (default) paints the near-black substrate each frame;
   *  `'transparent'` clears to transparent instead, so the underlay can sit OVER light content
   *  (a 3D scene, an image, a light page) without blanking it out. The bright matter survives;
   *  no `mix-blend-mode` workaround needed. Trails light-paint and fade to transparent rather
   *  than to black. Purely additive — the default is unchanged. */
  background?: 'opaque' | 'transparent';
  /** render mode (§20.6): 'dots' (default), 'trails' (light-painting), 'links'
   *  (constellation), 'metaballs' (a liquid iso-surface, not dots), 'streamlines'
   *  (draw the force field itself — diagnostic, REPLACES the dots), 'flow' (the dots
   *  AND the streamlines drawn together in the one underlay canvas — particles
   *  drifting along the visible flow, with no separate front surface and no
   *  `mix-blend`, so it stays a single cheap layer), 'none' (the signals-only engine,
   *  §13.7 / #297: the full simulation + feedback pipeline runs, but no canvas
   *  context is acquired, no backing store is sized, and nothing is ever drawn —
   *  the field exists purely as signals: `--d`, `--load`, `--lit`, capture
   *  events, `scrollV()`). */
  render?: 'dots' | 'trails' | 'links' | 'metaballs' | 'voronoi' | 'streamlines' | 'flow' | 'none';
  /** first-class mass (§21.3): when true, particle mass ∝ size and body forces
   *  accelerate by `a = F/m` (heavier matter moves less). Default false (unit mass). */
  mass?: boolean;
  /** color template for the travelling accent (§9): a built-in name
   *  (`'ours'` · `'heatmap'` · `'infrared'` · `'spectrum'`) or custom hex stops. */
  palette?: string | readonly string[];
  /** conserved attention (§2.4): one finite strength budget — engaging a body
   *  pulls force off every other. Default false; rest-neutral until engaged. */
  attention?: boolean;
  /** cross-boundary causality (Concept 4): a saturated body spills density to its
   *  neighbours (writing `--lit` + firing `field:lit`/`field:dim`). Default false. */
  causality?: boolean;
  /** density heatmap (field-systems H1): a scalar buffer of where matter pools, drawn as a
   *  glow underlay and sampled to bodies as `--field-heatmap-density`. Default false. */
  heatmap?: boolean;
  /**
   * Field Surfaces (overlay placement): a caller-provided canvas for the OVERLAY surface, drawn in
   * front of page content. Core sizes its backing store (matching the main canvas dpr) and draws the
   * `overlay` mode onto it each frame; the caller owns the element and its CSS placement (fixed,
   * full-viewport, `pointer-events:none`, above content / below nav). Keeps core DOM-free — the host
   * provides the canvas, core only draws. Default unset → no overlay surface.
   */
  overlayCanvas?: HTMLCanvasElement;
  /** initial overlay visualization mode (Field Surfaces); default `'off'`. */
  overlay?: OverlayInput;
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
   * `@fundamental-engine/platform`, or the `@fundamental-engine/{vanilla,elements,react}` entry points that wire it for
   * you; inject a custom host for a headless renderer / different document / tests.
   */
  host?: FieldHost;
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
  /** remove the body from the field. */
  remove(): void;
}

/** The handle returned by `createField` — the public field API (§13). */
export interface FieldHandle {
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
  /** toggle conserved attention (§2.4) live — one finite strength budget. */
  setAttention(on: boolean): void;
  /** toggle cross-boundary causality (Concept 4) live — density spills to neighbours. */
  setCausality(on: boolean): void;
  /** toggle the density heatmap layer (field-systems H1) live. */
  setHeatmap(on: boolean): void;
  /**
   * Set the **whole surface state** in one declarative call — the field draws on three surfaces and
   * this is the one verb that names them as one concept: `underlay` (matter behind content, the
   * render mode), `overlay` (readings in front, an additive stack), `heatmap` (the density
   * accumulation layer). The plan is the entire truth: an **omitted key resets to its default**
   * (`'dots'` / none / `false`), exactly like a recipe — so it's idempotent, snapshot-able, and
   * restorable. The single-surface verbs (`setRender`/`setOverlay`/`setHeatmap`) remain for surgical
   * pokes. Pair with `getSurfaces()` for round-trip save/restore. (#385)
   */
  setSurfaces(plan: SurfacePlan): void;
  /** The current surface state — the inverse of `setSurfaces`. `setSurfaces(getSurfaces())` is a no-op. */
  getSurfaces(): Required<SurfacePlan>;
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
