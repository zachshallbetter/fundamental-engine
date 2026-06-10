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
  /** ∈ [0,1]; drives color (toward accent), size, and glow (§2.2). */
  heat: number;
  /** render-radius basis. */
  size: number;
  /** the sink/blackhole body holding this particle, or null (§6.9). */
  cap: Body | null;
  /** stable per-particle scatter target fractions, for the `spread` formation (§7). */
  gx?: number;
  gy?: number;
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
  fmin: number;
  fmax: number;
  opsz: string;
  /** `data-pair` — selector for the body this one is wormhole-paired to (`warp`, §22.3 relocate). */
  pair?: string;
  /** `data-twist` — rotation (radians) applied to matter relocated through a `warp` throat. */
  twist?: number;
  /** `data-scale` — scale applied to the relocated local offset through a `warp` throat (default 1). */
  warpScale?: number;

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
  /** target points for `morph` (§20.3 [D]) — a sampled mark / logo / chart / shape the
   *  matter assembles into. NEVER words or letterforms (§11); words glow/grow via `--d`. */
  targets?: readonly { x: number; y: number }[];
  /** custom rectangle provider for a shadow-DOM body whose physical box is not the host
   *  box (closed roots, internal cores). The measurer prefers this over the host's own
   *  `getBoundingClientRect` (shadow-dom.md §10/§16). */
  rect?: () => DOMRect;
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
  /** recent page-scroll speed (eased, px/frame); drives the `scrolling` gate (§5).
   *  Undefined / 0 off the page, so the gate is inert under the conformance harness. */
  scrollV?: number;

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
 * Setting both (immersive) lets content sit *inside* the field. Overlay modes are the structure/vector
 * visualizations that reveal field shape without occluding text; `'off'` clears the overlay surface.
 * (Scalar overlays — `contours`/`potential` — are a planned addition; the union is additive.)
 */
export type OverlayMode = 'off' | 'streamlines' | 'force-vectors' | 'field-lines';

export interface FieldOptions {
  /** travelling accent color (§9). */
  accent?: string;
  /** particle-count multiplier (§2.5). */
  density?: number;
  /** draw the background Currents (§24); default true. Set false for the bare
   *  free-particle field with no carrier waves. */
  waves?: boolean;
  /** render mode (§20.6): 'dots' (default), 'trails' (light-painting), 'links'
   *  (constellation), 'metaballs' (a liquid iso-surface, not dots), 'streamlines'
   *  (draw the force field itself — diagnostic), 'none' (the signals-only engine,
   *  §13.7 / #297: the full simulation + feedback pipeline runs, but no canvas
   *  context is acquired, no backing store is sized, and nothing is ever drawn —
   *  the field exists purely as signals: `--d`, `--load`, `--lit`, capture
   *  events, `scrollV()`). */
  render?: 'dots' | 'trails' | 'links' | 'metaballs' | 'voronoi' | 'streamlines' | 'none';
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
   *  glow underlay and sampled to bodies as `--forces-heatmap-density`. Default false. */
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
  overlay?: OverlayMode;
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
   * `@field-ui/platform`, or the `@field-ui/{vanilla,elements,react}` entry points that wire it for
   * you; inject a custom host for a headless renderer / different document / tests.
   */
  host?: FieldHost;
}

/** Per-element feedback values the engine produces each frame (Phase D3 seam). */
export interface FeedbackChannels {
  /** the body's eased gathered density `d` ∈ [0,1] → `--d` / `--field-density` / `--forces-density`. */
  density?: number;
  /** the ambient heatmap density at the body → `--field-heatmap-density` / `--forces-heatmap-density`. */
  heatmapDensity?: number;
  /** sink accretion fill ∈ [0,1] → `--load` / `--mass`. */
  load?: number;
  /** cross-boundary lit signal ∈ [0,1] → `--lit` + thresholded `field:lit` / `field:dim`. */
  lit?: number;
}

/** Receives a body's feedback channels in place of direct DOM writes (Phase D3). */
export type FeedbackSink = (el: HTMLElement, channels: FeedbackChannels) => void;

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
   * Switch the underlay render mode (§20.6) live — the surface behind content. `'none'` is the
   * signals-only mode (§13.7 / #297): drawing stops from the next frame while the simulation and
   * its signals stay live. Switching TO `'none'` at runtime keeps an already-acquired context and
   * backing store (the no-allocation guarantee belongs to fields CREATED with `render: 'none'`);
   * switching FROM `'none'` acquires the context lazily and sizes the backing store at that moment.
   */
  setRender(mode: 'dots' | 'trails' | 'links' | 'metaballs' | 'voronoi' | 'streamlines' | 'none'): void;
  /**
   * Render a field-structure visualization on the OVERLAY surface — in front of page content (Field
   * Surfaces). Pairs with `setRender` (the underlay); set both for an immersive look. No-op unless the
   * field was created with an `overlayCanvas`. `'off'` clears the overlay surface.
   */
  setOverlay(mode: OverlayMode): void;
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
   * `energyReport(store.particles)` from `@field-ui/core/diagnostics/energy` — the function
   * already exists; this accessor exposes it through the public handle so external tools
   * (DataConsole, Inspector) don't need a reference to the internal particle array.
   */
  energy(): { kinetic: number; thermal: number; total: number; count: number };
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
  /** stop the loop and release listeners. */
  destroy(): void;
}
