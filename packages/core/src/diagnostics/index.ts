/**
 * Diagnostics (visualization-methods-taxonomy §3–§7, §11). The data behind the diagnostic overlays —
 * energy accounting, scalar potential + grid sampling, probe force-vectors + causality, heatmap-variant
 * samplers — plus `render.ts`, which draws them onto a Canvas 2D context (C1). Nothing mutates physics.
 */
export * from './energy.ts';
export * from './potential.ts';
export * from './probes.ts';
export * from './fields.ts';
export * from './render.ts';
export * from './modes.ts';

/** The diagnostics this module provides (inspectable list; canvas drawing is the UI frontier). */
export const DIAGNOSTICS = [
  { name: 'energy', provides: 'kinetic / thermal / total energy + drift', reads: 'particles' },
  { name: 'potential', provides: 'scalar potential Φ + grid sampling for contours', reads: 'bodies' },
  { name: 'force-vectors', provides: 'a force’s Δv on a probe at a point', reads: 'force + probe' },
  { name: 'causality', provides: 'per-token contribution to motion (ranked bars + vectors)', reads: 'registry + tokens' },
  { name: 'heatmap-variants', provides: 'density / heat / velocity scalar grids', reads: 'particles' },
  { name: 'topology', provides: 'relationship-agent coupling edges (strength / memory)', reads: 'relationship agents + positions' },
  { name: 'inspector', provides: 'body / agent / metric / contract HUD rows', reads: 'system snapshot' },
  { name: 'prediction', provides: 'deterministic forward ghost trajectory', reads: 'forces + bodies + probe' },
] as const;
