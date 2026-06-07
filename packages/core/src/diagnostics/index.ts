/**
 * Diagnostics (B4 — visualization-methods-taxonomy §3–§7, §11). The pure data behind the diagnostic
 * render overlays: energy accounting, scalar potential + grid sampling (contours/potential), probe
 * force-vectors + causality, and heatmap-variant samplers. These compute what the Lab/Inspector draw;
 * the canvas drawing of the overlays is the remaining UI layer. Nothing here mutates field state.
 */
export * from './energy.ts';
export * from './potential.ts';
export * from './probes.ts';
export * from './fields.ts';

/** The diagnostics this module provides (inspectable list; canvas drawing is the UI frontier). */
export const DIAGNOSTICS = [
  { name: 'energy', provides: 'kinetic / thermal / total energy + drift', reads: 'particles' },
  { name: 'potential', provides: 'scalar potential Φ + grid sampling for contours', reads: 'bodies' },
  { name: 'force-vectors', provides: 'a force’s Δv on a probe at a point', reads: 'force + probe' },
  { name: 'causality', provides: 'per-token contribution to motion', reads: 'registry + tokens' },
  { name: 'heatmap-variants', provides: 'density / heat / velocity scalar grids', reads: 'particles' },
] as const;
