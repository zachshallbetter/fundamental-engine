/**
 * Semantic layers (definition §11, worldclass §8, visual §15, interaction §15) — the
 * meaning→metric mapping that the "semantic truth" mode is about. It maps a piece of interface
 * meaning (importance, confidence, urgency…) to the field metric that expresses it, so authors can
 * drive the field from semantics instead of raw forces. Pure data + a tiny helper; node-testable.
 */
import type { ElementMetrics } from '../agents/element-agent.ts';

export type SemanticLayer =
  | 'importance'
  | 'confidence'
  | 'uncertainty'
  | 'urgency'
  | 'relationship'
  | 'history'
  | 'status'
  | 'hierarchy'
  | 'interactivity'
  | 'recency'
  | 'priority';

/** Each semantic layer's target field metric (a key of ElementMetrics, or a conceptual one). */
export interface SemanticMapping {
  /** the metric this meaning drives. */
  metric: keyof ElementMetrics | 'phase' | 'potential';
  /** how it reads visually / behaviorally. */
  response: string;
}

/** meaning → field metric (definition §11 / interaction §15 DataAgent merged). */
export const SEMANTIC_LAYERS: Readonly<Record<SemanticLayer, SemanticMapping>> = {
  importance: { metric: 'attention', response: 'strength / attention, stronger presence' },
  confidence: { metric: 'coherence', response: 'cleaner tone, stable hue, clarity' },
  uncertainty: { metric: 'entropy', response: 'disorder, desaturation, blur' },
  urgency: { metric: 'heat', response: 'warmer hue, higher glow' },
  relationship: { metric: 'memory', response: 'topology links / threads' },
  history: { metric: 'memory', response: 'patina, persistent tint, worn paths' },
  status: { metric: 'phase', response: 'material phase (gas/liquid/solid/plasma)' },
  hierarchy: { metric: 'pressure', response: 'potential / rank / depth' },
  interactivity: { metric: 'density', response: 'feedback gain' },
  recency: { metric: 'heat', response: 'recent = hot, cooling over time' },
  priority: { metric: 'attention', response: 'attention share' },
};

/**
 * Convert a semantic value (0..1) into the `ElementMetrics` contribution it implies, for the layers
 * whose target metric is a real ElementMetric (status→phase and hierarchy→potential are conceptual
 * and returned as `{}`). Pure.
 */
export function semanticToMetrics(layer: SemanticLayer, value: number): ElementMetrics {
  const m = SEMANTIC_LAYERS[layer];
  const v = value < 0 ? 0 : value > 1 ? 1 : value;
  if (m.metric === 'phase' || m.metric === 'potential') return {};
  return { [m.metric]: v } as ElementMetrics;
}
