// Hand-authored API tables drawn from packages/core/src/core/types.ts. These
// interfaces are type-erased at build time, so the option/method/attribute lists
// live here. They change rarely; keep them in step with types.ts.

export interface OptionRow {
  name: string;
  type: string;
  def: string;
  desc: string;
}
export const OPTIONS: OptionRow[] = [
  { name: 'accent', type: 'string', def: "palette's first stop", desc: 'The travelling accent colour (a hex string).' },
  { name: 'density', type: 'number', def: '1', desc: 'Particle-count multiplier.' },
  { name: 'waves', type: 'boolean', def: 'true', desc: 'Draw the background Currents (the wave layers).' },
  { name: 'render', type: "'dots' | 'trails' | 'links' | 'streamlines'", def: "'dots'", desc: 'Render mode — the same physics drawn differently.' },
  { name: 'mass', type: 'boolean', def: 'false', desc: 'First-class mass: particle mass ∝ size and body forces accelerate by a = F/m.' },
  { name: 'palette', type: 'string | string[]', def: "'ours'", desc: 'Accent template — a built-in name or custom hex stops.' },
  { name: 'attention', type: 'boolean', def: 'false', desc: 'Conserved attention — one finite strength budget; engaging a body starves the others.' },
  { name: 'causality', type: 'boolean', def: 'false', desc: 'Cross-boundary causality — a saturated body spills density to its neighbours.' },
];

export interface MethodRow {
  sig: string;
  desc: string;
}
export const HANDLE: MethodRow[] = [
  { sig: 'scan()', desc: 'Re-scan the document for [data-body] bodies after a DOM change.' },
  { sig: 'rescan()', desc: 'Alias of scan().' },
  { sig: 'setAccent(hex)', desc: 'Recolour the travelling accent.' },
  { sig: 'setPalette(name | hex[])', desc: 'Swap the accent colour template live.' },
  { sig: 'setFormation(name)', desc: 'Switch the global formation.' },
  { sig: 'setAttention(on)', desc: 'Toggle conserved attention live (one finite strength budget).' },
  { sig: 'setCausality(on)', desc: 'Toggle cross-boundary causality live (density spills to neighbours).' },
  { sig: 'setRender(mode)', desc: 'Switch the render mode: dots / trails / links / streamlines.' },
  { sig: 'threads(list | null)', desc: 'Wire glowing connector lines between an engaged set, or clear with null.' },
  { sig: 'burst(x, y, hex?)', desc: 'A one-shot shove + heat near a point, optionally tinting the matter.' },
  { sig: 'destroy()', desc: 'Stop the loop and release listeners.' },
];

export interface AttrRow {
  name: string;
  type: string;
  def?: string;
  desc: string;
}
export const ATTRS: AttrRow[] = [
  { name: 'data-body', type: 'tokens', desc: 'Space-separated force ids — required to make an element a body. Forces compose.' },
  { name: 'data-strength', type: 'number', def: '0.5', desc: 'Force magnitude S.' },
  { name: 'data-range', type: 'px', def: '280', desc: 'Influence radius d_max.' },
  { name: 'data-spin', type: 'number', def: '1', desc: 'Sign/strength of rotation — vortex, charge, magnetism, lens.' },
  { name: 'data-angle', type: 'deg', def: '0', desc: 'Heading — stream, emitter, gate, shear, align.' },
  { name: 'data-color', type: 'hex', desc: 'Accent override on engage, and the carried colour for pigment.' },
  { name: 'data-when', type: 'condition', def: "''", desc: 'Gate the force on a condition: active, fast, slow, hot, cool.' },
  { name: 'data-feedback', type: 'flag', desc: 'Opt into two-way density write-back (the --d custom property).' },
  { name: 'data-absorb', type: 'px', def: '64', desc: 'Capture radius for the absorb force.' },
  { name: 'data-max', type: 'number', def: '60', desc: 'Load at which an absorber supernovas (releases).' },
  { name: 'data-fmin / data-fmax', type: 'number', desc: 'Variable-font weight range that --d drives on a feedback body.' },
  { name: 'data-opsz', type: 'number', desc: 'Optical-size axis to drive alongside weight.' },
  { name: 'data-active', type: '"1"', desc: 'Engagement state — set automatically on hover/focus of a [data-hot] element.' },
  { name: 'data-preset', type: 'name', desc: 'Expand a preset into several co-located bodies — blackhole, galaxy, tornado, …' },
];

export const RENDER_MODES: { name: string; desc: string }[] = [
  { name: 'dots', desc: 'The default — each particle a soft dot, cool centre → warm edge → accent.' },
  { name: 'trails', desc: 'Light-painting — particle history persists and fades.' },
  { name: 'links', desc: 'Constellation — lines drawn between nearby particles.' },
  { name: 'streamlines', desc: 'Draws the force field itself — a grid of arrows along the net push. A diagnostic view.' },
];
