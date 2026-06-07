/**
 * The visual language layer (Phase 6 — visual-language-and-geometry). Pure, dependency-free
 * mappings from field metrics to appearance (typography, color, shape, emission), the lint rules
 * that keep them accessible, the semantic-text fallback, and the Visual Layer declaration every
 * visual layer must publish (§18). The math returns plain values + CSS strings; the DOM write
 * stays in the feedback/agent layer.
 */
import type { ContractMeta } from '../contracts/types.ts';

export * from './mapping.ts';
export * from './channels.ts';
export * from './lint.ts';
export * from './semantic-text.ts';

/** A visual layer's self-declaration (visual-language §18). Inspectable + lintable. */
export interface VisualLayerDeclaration {
  name: string;
  /** the field metrics it reads (e.g. ['density', 'attention']). */
  sourceMetrics: readonly string[];
  /** the visual properties it writes (e.g. ['font-variation-settings', 'text-shadow']). */
  targetProperties: readonly string[];
  /** must be false unless the layer is also declared feedback/force. */
  mutatesPhysics: boolean;
  /** does it set data-state on the DOM? */
  writesDomState: boolean;
  /** what happens under prefers-reduced-motion. */
  reducedMotion: string;
  /** the accessible fallback that preserves meaning. */
  accessibilityFallback: string;
  /** rough cost, e.g. 'CSS only' | 'canvas' | 'svg'. */
  performanceCost: string;
  /** is it visible in debug/inspector? */
  debugVisibility: boolean;
}

/** The authoring attributes the visual language recognizes (visual-language §19). */
export const VISUAL_AUTHORING_ATTRIBUTES = [
  'data-visual',
  'data-field-material',
  'data-color-mode',
  'data-shape-mode',
  'data-pattern-mode',
  'data-emission',
  'data-container-role',
  'data-semantic-layer',
  'data-reduced-visual',
] as const;

/** The Visual Language Contract (system-contracts §19, visual-language §18). */
export const VISUAL_CONTRACTS: readonly ContractMeta[] = [
  {
    name: 'Visual Language Contract',
    mustExist: 'a declared mapping from field metrics to bounded visual properties; a VisualLayerDeclaration per layer',
    mayMutate: 'appearance (visually) and, if it opts in, data-state — never physics',
    sideEffectFree: 'the metric→appearance math (pure value + CSS strings); the DOM write is separate',
    testable: 'mappings are bounded (saturation/glow/contrast caps); reduced-motion keeps meaning; semantic text stays live',
    inspectable: 'each layer’s declaration (source metrics, targets, mutatesPhysics, reduced-motion, a11y, cost)',
  },
];
