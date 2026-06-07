/**
 * field-ui formal contracts (Phase 4 — system-contracts.md §1–§18).
 *
 * The engine already *implements* its contracts (the `Force`, `Body`, `Env` shapes in
 * `core/types.ts`, the `ShadowRegistry`, the conformance framework). This module makes them
 * **explicit, declarative, and inspectable**: named contract types plus a catalog that records,
 * for each, the five questions every contract must answer —
 *
 *   What must exist?  ·  What may mutate state?  ·  What must stay side-effect free?
 *   What must be testable?  ·  What must be inspectable?
 *
 * Nothing here changes runtime behavior. The force/agent *semantics* live in `passport.ts`; the
 * runtime enforcement lives in `guards.ts`.
 */

/** The five questions every contract answers (system-contracts §Purpose). Inspectable metadata. */
export interface ContractMeta {
  /** the contract's name, e.g. "Force Contract". */
  name: string;
  /** what must exist for the contract to hold. */
  mustExist: string;
  /** what the contract is allowed to mutate. */
  mayMutate: string;
  /** what must remain side-effect free (pure). */
  sideEffectFree: string;
  /** how the contract is proven. */
  testable: string;
  /** how the contract is observed/debugged. */
  inspectable: string;
}

// ── Source / Sink Contract (§12) ────────────────────────────────────────────────────────────
/** A budgeted matter source. No unbounded creation. */
export interface SourceBudget {
  /** particles spawned per body per second (or per frame, documented by the source). */
  spawnRate: number;
  /** hard ceiling on live particles this source may sustain. */
  maxParticles: number;
  /** particle lifespan in seconds before despawn (mortal matter). */
  particleLife: number;
  /** optional energy budget; omit for unbounded-energy (still particle-capped) sources. */
  energyBudget?: number;
  /** seconds between spawn bursts. */
  cooldown?: number;
}
/** A budgeted matter sink. */
export interface SinkBudget {
  /** maximum captured particles. */
  capacity: number;
  /** what happens at capacity — release them, or stop capturing. */
  saturation: 'release' | 'hold' | 'destroy';
  /** fraction of capacity at which `forces:saturated` fires. */
  saturationThreshold: number;
}

// ── Performance Contract (§15) ──────────────────────────────────────────────────────────────
/** Every field runs within a budget. */
export interface PerformanceBudget {
  particles: number;
  bodies: number;
  localCells: number;
  fieldLines: number;
  /** heatmap cell size in px (4–8 recommended). */
  heatmapResolution: number;
  /** device-pixel-ratio cap. */
  dprCap: number;
}
/** The suggested defaults (system-contracts §15). */
export const DEFAULT_BUDGET: PerformanceBudget = {
  particles: 600,
  bodies: 80,
  localCells: 3,
  fieldLines: 256,
  heatmapResolution: 6,
  dprCap: 2,
};

// ── Event Contract (§9) ─────────────────────────────────────────────────────────────────────
/** A field event must be thresholded, debounced, inspectable, and traceable to a metric. */
export interface EventContract {
  /** the event type, e.g. `field:lit` (with its `forces:` alias). */
  type: string;
  /** the field metric that triggers it. */
  sourceMetric: string;
  /** crossing value that fires it (no per-frame firing by default). */
  threshold: number;
  /** debounce window in ms. */
  debounceMs: number;
}

// ── Feedback Contract (§10) ─────────────────────────────────────────────────────────────────
/** Feedback writes field state back to the DOM. May mutate presentation; must stay accessible. */
export interface FeedbackContract {
  /** CSS custom properties written (e.g. `--field-density`). */
  cssVars: readonly string[];
  /** data-* state attributes written. */
  dataState: readonly string[];
  /** does it require motion to convey meaning? Must be false (accessibility). */
  motionRequiredForMeaning: false;
}

// ── Visualization Contract (§11) ────────────────────────────────────────────────────────────
/** A visualization reveals state. It must not mutate physics unless declared as feedback. */
export interface VisualizationContract {
  name: string;
  /** what it reads — `field()`, particle history, scalar grid, relationship agents. */
  readsFrom: string;
  /** must be false unless reclassified as feedback/force. */
  mutatesPhysics: boolean;
}

// ── Transport Contract (§4) ─────────────────────────────────────────────────────────────────
/** A transport primitive moves matter along field geometry (fieldflow is canonical). */
export interface TransportContract {
  token: string;
  /** transport may do work. */
  doesWork: true;
  /** transport reads existing field geometry via env.fieldAt(). */
  usesFieldAt: true;
  /** behavior when there is no field to follow. */
  zeroFieldBehavior: string;
  /** behavior beyond the source's range. */
  rangeBehavior: string;
  /** transport must not replace another force's physical law. */
  replacesForceLaw: false;
}

// ── Agent Contract (§5) — base shape; agent *types* land in Phase 5 ─────────────────────────
/** Anything that can receive influence, hold state, change behavior, or affect another thing. */
export interface AgentContract {
  kind: string;
  identity: string;
  inputs: readonly string[];
  outputs: readonly string[];
  /** metrics it emits. */
  metrics: readonly string[];
  /** events it can dispatch. */
  events: readonly string[];
  /** conformance tests that prove it. */
  tests: readonly string[];
}
