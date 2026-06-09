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
  { name: 'host', type: 'FieldHost', def: 'required', desc: 'The environment seam (viewport, scroll, rAF, canvas). createField throws without it — pass browserHost() from @field-ui/platform, or use @field-ui/vanilla / the web component, which wire it for you.' },
  { name: 'accent', type: 'string', def: "palette's first stop", desc: 'The travelling accent color (a hex string).' },
  { name: 'density', type: 'number', def: '1', desc: 'Particle-count multiplier.' },
  { name: 'waves', type: 'boolean', def: 'true', desc: 'Draw the background Currents (the wave layers).' },
  { name: 'render', type: "'dots' | 'trails' | 'links' | 'metaballs' | 'voronoi' | 'streamlines'", def: "'dots'", desc: 'Render mode for the underlay surface (behind content) — the same physics drawn differently.' },
  { name: 'overlay', type: "'off' | 'streamlines' | 'force-vectors' | 'field-lines'", def: "'off'", desc: 'Field Surfaces: a field-structure visualization on the OVERLAY surface (in front of content), set alongside render. <field-root> manages the front canvas; for createField directly, pass overlayCanvas.' },
  { name: 'mass', type: 'boolean', def: 'false', desc: 'First-class mass: particle mass ∝ size and body forces accelerate by a = F/m.' },
  { name: 'palette', type: 'string | string[]', def: "'ours'", desc: 'Accent template — a built-in name or custom hex stops.' },
  { name: 'attention', type: 'boolean', def: 'false', desc: 'Conserved attention — one finite strength budget; engaging a body starves the others.' },
  { name: 'causality', type: 'boolean', def: 'false', desc: 'Cross-boundary causality — a saturated body spills density to its neighbours.' },
  { name: 'heatmap', type: 'boolean', def: 'false', desc: 'Density heatmap — a glow layer of where matter pools, sampled back to bodies as --forces-heatmap-density.' },
  { name: 'overlayCanvas', type: 'HTMLCanvasElement', def: 'undefined', desc: 'Field Surfaces: a caller-provided canvas for the overlay surface (drawn in front of content). The web component creates/manages this for you; pass it only when calling createField directly.' },
  { name: 'feedbackSink', type: 'FeedbackSink', def: 'undefined', desc: 'Advanced: route per-body density/feedback writes to the platform FeedbackRegistry instead of letting the engine write the DOM (Phase D3).' },
];

export interface MethodRow {
  sig: string;
  desc: string;
}
export const HANDLE: MethodRow[] = [
  { sig: 'scan()', desc: 'Re-scan the document for [data-body] bodies after a DOM change.' },
  { sig: 'rescan()', desc: 'Alias of scan().' },
  { sig: 'setAccent(hex)', desc: 'Recolor the travelling accent.' },
  { sig: 'setPalette(name | hex[])', desc: 'Swap the accent color template live.' },
  { sig: 'setFormation(name)', desc: 'Switch the global formation.' },
  { sig: 'setAttention(on)', desc: 'Toggle conserved attention live (one finite strength budget).' },
  { sig: 'setCausality(on)', desc: 'Toggle cross-boundary causality live (density spills to neighbours).' },
  { sig: 'setHeatmap(on)', desc: 'Toggle the density heatmap layer live (a glow of where matter pools).' },
  { sig: 'setRender(mode)', desc: 'Switch the underlay render mode (behind content): dots / trails / links / metaballs / voronoi / streamlines.' },
  { sig: 'setOverlay(mode)', desc: 'Field Surfaces: render a field-structure visualization on the overlay surface (in front of content): streamlines / force-vectors / field-lines, or off. Pairs with setRender.' },
  { sig: 'threads(list | null)', desc: 'Wire glowing connector lines between an engaged set, or clear with null.' },
  { sig: 'burst(x, y, hex?)', desc: 'A one-shot shove + heat near a point, optionally tinting the matter.' },
  { sig: 'flowTo(x, y, opts?)', desc: 'Place/move a dynamic flow focus the field bends toward — pulls matter in and curves the streamlines. Retarget it each frame to follow the pointer, an element, or a path. opts: { strength?, radius? }.' },
  { sig: 'clearFlow()', desc: 'Remove the flow focus — the field relaxes back to its bodies-only shape.' },
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
  { name: 'data-spin', type: 'number', def: '1', desc: 'Sign/strength of rotation — swirl, charge, magnetism, lens.' },
  { name: 'data-angle', type: 'deg', def: '0', desc: 'Heading — stream, jet, gate, shear, align.' },
  { name: 'data-color', type: 'hex', desc: 'Accent override on engage, and the carried color for pigment.' },
  { name: 'data-when', type: 'condition', def: "''", desc: 'Gate the force on a condition: active, fast, slow, hot, cool, scrolling.' },
  { name: 'data-feedback', type: 'flag', desc: 'Opt into two-way density write-back (the --d custom property).' },
  { name: 'data-shaped', type: 'flag', desc: 'Shaped source — forces reference the nearest point on the element box, so matter shells the shape instead of bunching at its centre.' },
  { name: 'data-absorb', type: 'px', def: '64', desc: 'Capture radius for the sink force.' },
  { name: 'data-max', type: 'number', def: '60', desc: 'Load at which a sink supernovas (releases).' },
  { name: 'data-fmin / data-fmax', type: 'number', desc: 'Variable-font weight range that --d drives on a feedback body.' },
  { name: 'data-opsz', type: 'number', desc: 'Optical-size axis to drive alongside weight.' },
  { name: 'data-active', type: '"1"', desc: 'Engagement state — set automatically on hover/focus of a [data-hot] element.' },
  { name: 'data-preset', type: 'name', desc: 'Expand a preset into several co-located bodies — blackhole, galaxy, tornado, …' },
];

/** The CSS custom properties the field writes back onto bodies — the reciprocal half of the
 *  loop (the field measures, then writes state into the elements that made it). Read these in
 *  your own CSS to make an element answer the field. Written only to bodies that opt in. */
export const WRITEBACK: { name: string; on: string; desc: string }[] = [
  { name: '--d', on: 'data-feedback', desc: "The body's own gathered density ∈ [0,1], eased. The canonical reaction var." },
  { name: '--forces-density', on: 'data-feedback', desc: 'Explicit alias of --d (the namespaced name; same value).' },
  { name: '--forces-heatmap-density', on: 'data-feedback + heatmap', desc: 'The ambient heatmap density under the body ∈ [0,1] — where matter pools around it, distinct from --d.' },
  { name: '--load / --mass', on: 'sink body', desc: 'A sink’s accretion fill fraction ∈ [0,1] (--mass is a back-compat alias).' },
  { name: '--lit', on: 'causality', desc: 'Spillover-lit density when a saturated neighbour bleeds density across a boundary.' },
];

export const RENDER_MODES: { name: string; desc: string }[] = [
  { name: 'dots', desc: 'The default — each particle a soft dot, cool centre → warm edge → accent.' },
  { name: 'trails', desc: 'Light-painting — particle history persists and fades.' },
  { name: 'links', desc: 'Constellation — lines drawn between nearby particles.' },
  { name: 'metaballs', desc: 'A liquid iso-surface — the swarm rendered as one molten skin via marching squares, not dots.' },
  { name: 'voronoi', desc: 'Shattered glass — each particle owns a cell; the walls are the boundaries between nearest-neighbour regions.' },
  { name: 'streamlines', desc: 'Draws the force field itself — a grid of arrows along the net push. A diagnostic view.' },
];
