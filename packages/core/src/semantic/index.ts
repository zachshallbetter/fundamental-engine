/**
 * The semantic layer (BA2 — definition §11 "semantic truth", interaction §15/§23/§24). Maps
 * interface *meaning* to field behavior: semantic layers (meaning→metric), interaction materials
 * (feel→force composition), and field states (state→field behavior). Pure data + helpers — the
 * "semantic truth" mode made concrete.
 */
import type { ContractMeta } from '../contracts/types.ts';

export * from './layers.ts';
export * from './materials.ts';
export * from './states.ts';

/** The semantic-mapping contracts (truth mode: semantic). */
export const SEMANTIC_CONTRACTS: readonly ContractMeta[] = [
  {
    name: 'Semantic Layer Contract',
    mustExist: 'a mapping from a meaning (importance, confidence, urgency…) to a field metric',
    mayMutate: 'nothing — it produces a metric contribution the agent layer applies',
    sideEffectFree: 'semanticToMetrics is pure',
    testable: 'each layer maps to a real metric; values clamp to [0,1]',
    inspectable: 'the SEMANTIC_LAYERS table',
  },
  {
    name: 'Interaction Material Contract',
    mustExist: 'a material → real force-token composition (feel built from behavior)',
    mayMutate: 'nothing — it yields a data-body token string',
    sideEffectFree: 'materialBody is pure',
    testable: 'every material references real, passported forces',
    inspectable: 'the INTERACTION_MATERIALS table',
  },
  {
    name: 'Field State Contract',
    mustExist: 'a named field state → the field behavior it implies',
    mayMutate: 'nothing — it describes behavior',
    sideEffectFree: 'isFieldState is pure',
    testable: 'every state declares a behavior',
    inspectable: 'the FIELD_STATES table',
  },
];
