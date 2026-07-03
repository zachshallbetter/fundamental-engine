/**
 * The visualization truth table + render-mode catalog + presets (visualization-methods-taxonomy,
 * system-contracts §11/§18). "Every render mode needs a truth-table entry" — this is that table as
 * inspectable data: what each visualization reads, whether it mutates physics, and the truth it
 * shows. Pure data.
 */
import type { RenderLayer } from '../recipes/schema.ts';

/** One row of the visualization truth table (system-contracts §11). */
export interface VisualizationTruthRow {
  visualization: string;
  /** what it reads from. */
  readsFrom: string;
  /** does it mutate physics? (must be false unless declared feedback). */
  mutatesPhysics: boolean | 'optional' | 'visual';
  /** the truth it reveals. */
  showsTruthAbout: string;
}

/** The visualization truth table (system-contracts §11, viz-taxonomy "Visualization Truth Table"). */
export const VISUALIZATION_TRUTH_TABLE: readonly VisualizationTruthRow[] = [
  { visualization: 'particles', readsFrom: 'particle state', mutatesPhysics: true, showsTruthAbout: 'matter' },
  { visualization: 'field-lines', readsFrom: 'field()', mutatesPhysics: false, showsTruthAbout: 'structure' },
  { visualization: 'streamlines', readsFrom: 'vector field', mutatesPhysics: false, showsTruthAbout: 'continuous direction' },
  { visualization: 'force-vectors', readsFrom: 'apply() or probe', mutatesPhysics: false, showsTruthAbout: 'cause' },
  { visualization: 'trails', readsFrom: 'particle history', mutatesPhysics: false, showsTruthAbout: 'motion history' },
  { visualization: 'heatmap', readsFrom: 'scalar grids', mutatesPhysics: 'optional', showsTruthAbout: 'accumulation' },
  { visualization: 'contours', readsFrom: 'scalar fields', mutatesPhysics: false, showsTruthAbout: 'terrain / equal values' },
  { visualization: 'potential', readsFrom: 'potential field', mutatesPhysics: false, showsTruthAbout: 'wells and gradients' },
  { visualization: 'energy', readsFrom: 'particle + field state', mutatesPhysics: false, showsTruthAbout: 'cost and conservation' },
  { visualization: 'topology', readsFrom: 'relationship agents', mutatesPhysics: 'optional', showsTruthAbout: 'coupling' },
  { visualization: 'dom-state', readsFrom: 'CSS variables + events', mutatesPhysics: 'visual', showsTruthAbout: 'reciprocity' },
  { visualization: 'causality', readsFrom: 'per-force contributions', mutatesPhysics: false, showsTruthAbout: 'why motion happened' },
  { visualization: 'prediction', readsFrom: 'deterministic ghost step', mutatesPhysics: false, showsTruthAbout: 'expected future path' },
];

/** Whether a render mode/layer is shipped today or planned. */
export interface RenderModeInfo {
  mode: string;
  type: string;
  shows: string;
  status: 'shipped' | 'planned';
}

/** The render-modes catalog (viz-taxonomy "Render Modes Catalog"), with honest shipped/planned status. */
export const RENDER_MODES: readonly RenderModeInfo[] = [
  { mode: 'dots', type: 'matter', shows: 'particle positions and heat', status: 'shipped' },
  { mode: 'trails', type: 'motion', shows: 'path history', status: 'shipped' },
  { mode: 'links', type: 'topology', shows: 'connector lines between bodies', status: 'shipped' },
  { mode: 'streamlines', type: 'structure', shows: 'continuous field paths', status: 'shipped' },
  { mode: 'metaballs', type: 'matter', shows: 'liquid density surface', status: 'shipped' },
  { mode: 'voronoi', type: 'matter', shows: 'nearest-site cells', status: 'shipped' },
  { mode: 'field-lines', type: 'structure', shows: 'field() geometry', status: 'shipped' },
  { mode: 'heatmap', type: 'scalar', shows: 'density accumulation', status: 'shipped' },
  { mode: 'force-vectors', type: 'debug', shows: 'actual cause from apply()', status: 'shipped' },
  { mode: 'contours', type: 'scalar', shows: 'equal-value isolines', status: 'shipped' },
  { mode: 'potential', type: 'scalar', shows: 'wells and gradients', status: 'shipped' },
  { mode: 'energy', type: 'scalar', shows: 'kinetic / potential / thermal', status: 'shipped' },
  { mode: 'topology', type: 'graph', shows: 'threads, flux links', status: 'shipped' },
  { mode: 'inspector', type: 'debug', shows: 'bodies, agents, metrics, contracts', status: 'shipped' },
  { mode: 'causality', type: 'debug', shows: 'contribution sources', status: 'shipped' },
  { mode: 'prediction', type: 'debug', shows: 'ghost trajectory', status: 'shipped' },
  { mode: 'knockout', type: 'matter', shows: 'matter as negative space in a field wash', status: 'shipped' },
  { mode: 'redshift', type: 'matter', shows: 'Doppler + gravitational spectral shift', status: 'shipped' },
  { mode: 'blackbody', type: 'matter', shows: 'energy as thermal color', status: 'shipped' },
  { mode: 'depth', type: 'matter', shows: 'the z lane — parallax, occlusion, defocus', status: 'shipped' },
];

/** Named visualization presets (viz-taxonomy "Visualization Presets") as render-layer stacks. */
export const VISUALIZATION_PRESETS: Readonly<Record<string, RenderLayer[]>> = {
  beautiful: ['particles', 'trails'],
  scientific: ['field-lines', 'streamlines', 'particles'],
  diagnostic: ['particles', 'field-lines', 'heatmap'],
  thermal: ['heatmap', 'particles', 'trails'],
  plasma: ['field-lines', 'trails', 'particles'],
  topological: ['field-lines', 'links', 'particles'],
  reduced: ['field-lines'], // static structure only — the reduced-motion fallback (no travel)
  poster: ['particles', 'field-lines'],
};
