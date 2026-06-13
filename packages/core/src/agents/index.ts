/**
 * The FieldAgent model (Phase 5 — interaction-and-relationship-model). Particles are only one kind
 * of agent: an agent is anything that can receive influence, hold state, change behavior, or affect
 * another thing. This module adds the non-particle agents (element, relationship, user, layout,
 * data) and the thresholded EventAgent runtime, plus the agent-type contracts deferred from Phase 4.
 */
import type { ContractMeta } from '../contracts/types.ts';

export * from './event-agent.ts';
export * from './relationship.ts';
export * from './element-agent.ts';
export * from './user-agent.ts';
export * from './region-agents.ts';

/** The kinds of agent that can participate in the field (definition-document). */
export type FieldAgentKind =
  | 'particle' // visual matter
  | 'element' // DOM responder
  | 'relationship' // active connection
  | 'user' // pointer / focus / selection participant
  | 'layout' // region-level responder
  | 'data' // semantic record
  | 'event'; // threshold trigger

/** The agent-type contracts (system-contracts §5–§9), formalized in Phase 5. */
export const AGENT_CONTRACTS: readonly ContractMeta[] = [
  {
    name: 'ElementAgent Contract',
    mustExist: 'a DOM element + the metrics it receives (density, attention, heat, entropy, coherence, memory, pressure, pull-x/y)',
    mayMutate: 'CSS variables and data-field-* state on its element',
    sideEffectFree: 'metric reads; it must not mutate particles unless also a registered body',
    testable: 'receives metrics → writes the matching --field-* vars and data bands; respects reduced motion',
    inspectable: 'the CSS variables and data-field-* attributes on the element',
  },
  {
    name: 'RelationshipAgent Contract',
    mustExist: 'id, from, to, type, strength, tension, memory, active',
    mayMutate: 'its own strength/tension/memory; the attention it transfers between its endpoints',
    sideEffectFree: 'its dynamics are a pure function of (active, tension, dt)',
    testable: 'strengthens with use, decays over time, transfers attention, emits thresholded events',
    inspectable: 'strength/tension/memory and the strengthen/weaken threshold edges',
  },
  {
    name: 'UserAgent Contract',
    mustExist: 'pointer position/velocity, focus, selection, scroll, reduced-motion flag',
    mayMutate: 'nothing in the DOM — it projects a field source the engine consumes',
    sideEffectFree: 'the source it derives from its input state',
    testable: 'pointer creates a wake; focus creates an accessible attention source; reduced motion drops travel',
    inspectable: 'the derived UserFieldSource (wake / focus / capture)',
  },
  {
    name: 'LayoutAgent Contract',
    mustExist: 'a region rect + the metrics aggregated over the bodies inside it',
    mayMutate: 'its own aggregated metrics (then writes back like an ElementAgent)',
    sideEffectFree: 'the aggregation',
    testable: 'aggregates contained body metrics; empty region reads zero',
    inspectable: 'the region rect and aggregated metrics',
  },
  {
    name: 'DataAgent Contract',
    mustExist: 'a record’s semantic fields + a salience that decays unless reinforced',
    mayMutate: 'its own salience',
    sideEffectFree: 'the salience update is a pure function of (reinforced, dt)',
    testable: 'reinforce raises salience; idle decays it; bounded to [0,1]',
    inspectable: 'the record fields and current salience',
  },
  {
    name: 'EventAgent Contract',
    mustExist: 'a metric, an enter/exit threshold with hysteresis, and a debounce window',
    mayMutate: 'nothing — it emits notifications',
    sideEffectFree: 'the edge detection is a pure function of (value, now)',
    testable: 'one clean edge per crossing; no per-frame firing; hysteresis prevents flicker',
    inspectable: 'the lit state and the configured thresholds',
  },
];
