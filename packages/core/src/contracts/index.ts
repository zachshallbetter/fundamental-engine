/**
 * field-ui contracts (Phase 4). The formal, inspectable contract layer over the engine:
 *  - `types.ts`   — named contract type definitions
 *  - `passport.ts` — every force's declarative, validated description
 *  - `guards.ts`  — dev-mode runtime enforcement (the Error Taxonomy)
 *  - `CONTRACTS`  — the inspectable catalog: each contract and the five questions it answers
 */
import type { ContractMeta } from './types.ts';

export * from './types.ts';
export * from './passport.ts';
export * from './guards.ts';

/**
 * The inspectable catalog of the foundational contracts (system-contracts §1–§16). Each records
 * the five questions every contract answers. Agent-type, visual-language, and recipe contracts
 * are formalized in later phases.
 */
export const CONTRACTS: readonly ContractMeta[] = [
  {
    name: 'Body Contract',
    mustExist: 'id, element/owner, geometry provider, field target, write-back target, behavior registration, lifecycle hooks',
    mayMutate: 'its own write-back target (CSS vars, data-state)',
    sideEffectFree: 'its geometry provider (measurement must not change layout)',
    testable: 'registry + scanner tests; the default body is the custom-element host',
    inspectable: 'the ShadowRegistry size and the per-body rect',
  },
  {
    name: 'Field Contract',
    mustExist: 'field(body, x, y, env) → vector/scalar/compound/null, declaring its kind',
    mayMutate: 'nothing',
    sideEffectFree: 'the whole function — stable values for a fixed state; mutates no particles or bodies',
    testable: 'field lines trace field(), not apply(); purity (same input → same output)',
    inspectable: 'field lines, streamlines, heatmaps, Lab probes',
  },
  {
    name: 'Force Contract',
    mustExist: 'token, label, apply(); a passport declaring its physics (passport.ts)',
    mayMutate: 'particle velocity, heat, phase, capture state, identity, life',
    sideEffectFree: 'its optional field() hook',
    testable: 'a conformance experiment per force; the passport is validated against ground truth',
    inspectable: 'the passport and the conformance verdict (the Lab)',
  },
  {
    name: 'Transport Contract',
    mustExist: 'a primitive that moves matter along field geometry; fieldflow is canonical',
    mayMutate: 'particle velocity (it does work) via env.fieldAt()',
    sideEffectFree: 'must not replace another force’s physical law',
    testable: 'fieldflow moves neutral matter along a field; magnetism alone does not',
    inspectable: 'streamlines aligned to the field it follows',
  },
  {
    name: 'Agent Contract',
    mustExist: 'identity, state, inputs, outputs, accepted influence, emitted metrics, events, tests',
    mayMutate: 'only its own outputs (DOM state for an ElementAgent; never particles unless also a body)',
    sideEffectFree: 'its metric reads',
    testable: 'per agent-kind response tests',
    inspectable: 'its metrics and dispatched events (Phase 5 expands the kinds)',
  },
  {
    name: 'Event Contract',
    mustExist: 'a thresholded, debounced event with a useful detail payload, traceable to a metric',
    mayMutate: 'nothing (it notifies)',
    sideEffectFree: 'dispatch must not run physics',
    testable: 'events are thresholded/debounced and do not fire every frame by default',
    inspectable: 'the event type, source metric, threshold, and payload',
  },
  {
    name: 'Feedback Contract',
    mustExist: 'a write-back of field state to CSS vars / data-state / ElementInternals',
    mayMutate: 'presentation (visually yes), not meaning',
    sideEffectFree: 'must not break readability or require motion for meaning',
    testable: 'density write-back sets --field-* / --d; reduced-motion holds meaning',
    inspectable: 'the CSS variables and data-state written on each body',
  },
  {
    name: 'Visualization Contract',
    mustExist: 'a layer that reads field/particle/grid/relationship state to reveal it',
    mayMutate: 'nothing — unless explicitly reclassified as feedback or force behavior',
    sideEffectFree: 'the whole read path (debug overlays must not affect integration)',
    testable: 'visualization does not alter physics; prediction mode does not mutate live state',
    inspectable: 'each layer declares what it reads and whether it mutates physics',
  },
  {
    name: 'Source/Sink Contract',
    mustExist: 'a source budget (spawn rate, max particles, life, cooldown) or sink budget (capacity, saturation)',
    mayMutate: 'particle count — within budget only',
    sideEffectFree: 'budget accounting must be deterministic',
    testable: 'no unbounded creation; a sink emits a saturation event',
    inspectable: 'the live count vs. the declared cap',
  },
  {
    name: 'Performance Contract',
    mustExist: 'a budget for particles, bodies, local cells, field lines, heatmap resolution, DPR',
    mayMutate: 'nothing (it bounds cost)',
    sideEffectFree: 'budget evaluation',
    testable: 'counts stay within budget; DPR is capped; debug overlays off in production',
    inspectable: 'the budget vs. live counts',
  },
  {
    name: 'Accessibility Contract',
    mustExist: 'a reduced-motion fallback for any motion-dependent meaning; labels for interactive fields',
    mayMutate: 'nothing physical — it constrains how feedback/visualization may present',
    sideEffectFree: 'the checks (reduced-motion gating, lint) are pure',
    testable: 'meaning survives without motion; events do not spam AT; color is not the sole carrier',
    inspectable: 'reduced-motion state, the a11y lint findings, and ARIA on interactive fields',
  },
  {
    name: 'Conformance Contract',
    mustExist: 'proof for every force, render mode, agent, source/sink, recipe',
    mayMutate: 'nothing',
    sideEffectFree: 'the runner simulates headlessly without touching live state',
    testable: 'golden math, behavioral scenario, snapshot, side-effect, threshold, reduced-motion',
    inspectable: 'the Lab MATCH/NO-MATCH verdict per check',
  },
];
