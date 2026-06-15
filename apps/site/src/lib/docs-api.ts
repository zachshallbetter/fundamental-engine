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
  { name: 'host', type: 'FieldHost', def: 'required', desc: 'The environment seam (viewport, scroll, rAF, canvas). createField throws without it — pass browserHost() from @fundamental-engine/platform, or use @fundamental-engine/vanilla / the web component, which wire it for you.' },
  { name: 'accent', type: 'string', def: "palette's first stop", desc: 'The travelling accent color (a hex string).' },
  { name: 'density', type: 'number', def: '1', desc: 'Particle-count multiplier.' },
  { name: 'waves', type: 'boolean', def: 'true', desc: 'Draw the background Currents (the wave layers).' },
  { name: 'background', type: "'opaque' | 'transparent'", def: "'opaque'", desc: "Substrate background. 'transparent' clears to transparent instead of painting the near-black substrate, so the underlay composites over light content (an image, a 3D scene, a light page) — trails fade to transparent rather than to black. Also a <field-root background> attribute and live via setBackground." },
  { name: 'depth', type: 'number', def: '0', desc: 'Optional z volume. 0 (the default) is the flat field, byte-identical to the 2D engine; > 0 opens a shallow depth the matter drifts through, projected as a size/alpha recession. Purely additive — no API requires z.' },
  { name: 'render', type: "'dots' | 'trails' | 'links' | 'metaballs' | 'voronoi' | 'streamlines' | 'flow'", def: "'dots'", desc: 'Render mode for the underlay surface (behind content) — the same physics drawn differently.' },
  { name: 'overlay', type: "OverlayMode | OverlayMode[]", def: "'off'", desc: 'Field Surfaces: the overlay READING(S) drawn in front of content (see the overlay-readings table) — one reading or an additive stack. Set alongside render. <field-root> manages the front canvas (space-separated tokens in the attribute); for createField directly, pass overlayCanvas.' },
  { name: 'mass', type: 'boolean', def: 'false', desc: 'First-class mass: particle mass ∝ size and body forces accelerate by a = F/m.' },
  { name: 'palette', type: 'string | string[]', def: "'ours'", desc: 'Accent template — a built-in name or custom hex stops.' },
  { name: 'attention', type: 'boolean', def: 'false', desc: 'Conserved attention — one finite strength budget; engaging a body starves the others.' },
  { name: 'causality', type: 'boolean', def: 'false', desc: 'Cross-boundary causality — a saturated body spills density to its neighbours.' },
  { name: 'heatmap', type: 'boolean', def: 'false', desc: 'Density heatmap — a glow layer of where matter pools, sampled back to bodies as --field-heatmap-density.' },
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
  { sig: 'setSurfaces(plan) / getSurfaces()', desc: 'One declarative verb for the whole surface state: setSurfaces({ underlay, overlay, heatmap }) — matter behind content, readings in front, the accumulation layer. Full-state, so an omitted key resets to its default (dots / off / false); idempotent and restorable. getSurfaces() is the inverse; setSurfaces(getSurfaces()) is a no-op. The single-surface verbs remain for surgical pokes. Shipped-but-unfrozen.' },
  { sig: 'setRender(mode)', desc: 'Switch the underlay render mode (behind content): dots / trails / links / metaballs / voronoi / streamlines / flow.' },
  { sig: 'setOverlay(mode | mode[])', desc: 'Field Surfaces: render overlay reading(s) in front of content — one reading or an additive stack (the readings compose). The vocabulary: streamlines / force-vectors / field-lines / grid / temperature / energy / path / data, or off. Pairs with setRender.' },
  { sig: 'setBackground(mode)', desc: "Switch the substrate live: 'transparent' clears to transparent so the underlay composites over light content; 'opaque' restores the near-black substrate. Additive." },
  { sig: 'threads(list | null)', desc: 'Wire glowing connector lines between an engaged set, or clear with null.' },
  { sig: 'burst(x, y, hex?)', desc: 'A one-shot shove + heat near a point, optionally tinting the matter.' },
  { sig: 'flowTo(x, y, opts?)', desc: 'Place/move a dynamic flow focus the field bends toward — pulls matter in and curves the streamlines. Retarget it each frame to follow the pointer, an element, or a path. opts: { strength?, radius? }.' },
  { sig: 'clearFlow()', desc: 'Remove the flow focus — the field relaxes back to its bodies-only shape.' },
  { sig: 'seed(atoms)', desc: "Bind a data record to each base particle, round-robin. Each record's weight ∈ [0,1] scales that particle's mass + size. Re-applied across resize/density rebuilds." },
  { sig: 'atomAt(x, y)', desc: 'The seeded record on the nearest particle to (x, y) within ~24 px, or null. For hover-to-inspect.' },
  { sig: 'focusAt(x, y)', desc: 'Hold + highlight the nearest seeded particle; return its record — the dwell affordance before a click. Returns null if no particle is in range.' },
  { sig: 'clearFocus()', desc: 'Release the focused particle; it resumes drifting.' },
  { sig: 'particleCount()', desc: 'Live size of the particle pool. Use for external budget monitors or debug overlays without walking the particle array. Shipped-but-unfrozen.' },
  { sig: 'energy()', desc: 'Per-frame energy snapshot: { kinetic, thermal, total, count }. Forwards to energyReport() without requiring a reference to the internal particle array. Shipped-but-unfrozen.' },
  { sig: 'readParticles(out)', desc: 'Copy live particle state into a caller-owned Float32Array (stride 5: x, y, z, heat, size — z is the optional depth lane, 0 in a flat field); returns the count written = min(particleCount(), floor(out.length/5)). Zero-alloc and read-only — the render-agnostic swarm read-out an alternative surface (e.g. @fundamental-engine/three) draws from. Shipped-but-unfrozen; the stride may widen (a color lane) before 1.0.' },
  { sig: 'readParticleIds(out)', desc: 'Copy each live particle\'s stable id into a Uint32Array, parallel to readParticles (same order, same agent skip), so ids[i] is the identity of the particle at stride offset i*5. Lets a host track a seeded entity across frames and key its own opaque payload off the id. Zero-alloc, read-only. Shipped-but-unfrozen.' },
  { sig: 'sample(x, y)', desc: 'The net field force a still test particle would feel at (x, y), as { x, y } in field-pixel space — every visible body superposed (wells, dipole structure, flow bias). Pure and read-only, samplable at any resolution; the seam external visualizers consume for vector grids, streamline tubes, or mesh displacement. Shipped-but-unfrozen.' },
  { sig: 'sampleScalar(x, y)', desc: 'The smooth diffused density scalar ∈ [0,1] at (x, y) — the heatmap grid, bilinear-sampled, so its gradient stays meaningful at a source (forage-by-gradient), unlike a nearest-body readout. Requires the heatmap layer (createField({ heatmap: true }) / setHeatmap(true)); returns 0 when off. Read-only, updated each frame including under render:none. Shipped-but-unfrozen.' },
  { sig: 'sampleGradient(x, y)', desc: 'The gradient ∇ {x,y} of the density field at (x, y) — direction + steepness (1/px) of increasing matter density. The analytic companion to sampleScalar, off the same diffused heatmap grid, so it stays non-degenerate at a source (a real uphill slope where a nearest-body density flattens to zero) — the cue reliable forage-/flee-by-gradient steers by. Requires the heatmap layer; returns { x: 0, y: 0 } when off or empty. Pure, read-only, maintained under render:none. Shipped-but-unfrozen.' },
  { sig: 'grid(name)', desc: 'Open a named host-authorable ScalarGrid — the engine field-buffer primitive (the same one diffuse/memory/propagate run on), promoted to a public surface for application fields the simulation composes with (a scent map, a wear/desire-path layer, a goal attractor). { sample, deposit, gradient, decay, clear } in field px. Created on first access, kept viewport-sized, advanced each frame by its mode (wave… = wave, memory… = slow decay, else diffuse); a same-named force shares the buffer. Shipped-but-unfrozen.' },
  { sig: 'on(type, cb)', desc: 'Subscribe to a discrete field event — the host-agnostic push bus, for reacting to occurrences instead of polling feedback channels each frame. Returns an unsubscribe fn; plain data, no DOM. Events: absorb / release — a sink body captured / let go of matter (rising / falling edge of accretion), { body, count }. Lazy: a type with no listener costs nothing. (contact / settle / enter·exit are the next slice, #441.) Shipped-but-unfrozen.' },
  { sig: 'addAgent(spec)', desc: 'Add an engine-stepped agent — a participant the integrator MOVES (vs sample(), where you integrate yourself). It lives in the particle pool, so it feels every force the swarm feels (body forces AND particle-level hunt/align/cohesion); each step its report(p) fires so an external transform (a THREE.Object3D) follows it. spec: { x, y, z?, mass?, maxSpeed?, species?, report }. maxSpeed caps it, species lets tagged bodies (data-affects) steer it selectively; it edge-bounces (not wraps) and is excluded from readParticles. Returns { particle, remove() }. The creatures primitive @fundamental-engine/three’s layer.addAgent binds over. Shipped-but-unfrozen.' },
  { sig: 'addBody(spec)', desc: 'Add a programmatic body (no DOM) from a spec — the sanctioned alternative to the [data-body] scan for a non-DOM host (Three.js mesh, native view). { tokens, strength?, range?, spin?, angle?, color?, rect:()=>box, data?, onFeedback? }; rect() samples the box in field px each frame. The body carries a data record and takes per-body feedback (channels demuxed from the global sink); survives rescan. Returns { data, channels, remove() }. Shipped-but-unfrozen.' },
  { sig: 'scrollV()', desc: "The engine's eased page-scroll velocity — the same EMA the scrolling condition gate reads: (prev × 0.7) + (|Δscroll| × 0.3) per frame. Units are px/frame at the display refresh rate (refresh-rate dependent — roughly half on 120 Hz; may normalize to px/ms before 1.0). Mirrored to --field-scroll-v on :root by the platform runtime. Pull-based: read on demand, don't poll in tight loops. Shipped-but-unfrozen." },
  { sig: 'setVisible(on)', desc: 'Element-level visibility hint: setVisible(false) skips all draw work (render + overlay) each frame while the simulation and its feedback signals stay live — scrollV(), --d, --load, capture events keep flowing. Distinct from the tab-level pause (visibilitychange already stops the loop entirely). <field-root> wires it automatically from an IntersectionObserver on the host. Shipped-but-unfrozen.' },
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
  { name: 'data-affects', type: 'species', desc: 'Matter tagging — a comma-separated species set this body acts on (e.g. "1" or "1,2"). Matter whose species is outside the set is skipped entirely (no force, no density sample). Omit to act on all matter (the default). Lets pollen / seeds / spores share one field, each pulled only by its own bodies.' },
  { name: 'data-species', type: 'number', desc: 'The species tag a spawn source stamps on the matter it emits, so a downstream data-affects body can act on it selectively. Particles default to species 0.' },
  { name: 'data-absorb', type: 'px', def: '64', desc: 'Capture radius for the sink force.' },
  { name: 'data-max', type: 'number', def: '60', desc: 'Load at which a sink supernovas (releases).' },
  { name: 'data-life', type: 'frames', def: '90 (spawn)', desc: 'Source budget: how long each particle a spawn source emits lives. An unbudgeted source gets the safe default 300 (and a dev warning).' },
  { name: 'data-cap', type: 'number', desc: 'Source budget: the most live particles a spawn source sustains — the emission rate is clamped to cap/life. The unbudgeted-source safe default is 120.' },
  { name: 'data-screen-min', type: 'number', def: '0', desc: 'Floor of the screen modifier’s attenuation factor (0 = other forces may cancel fully at the screen’s core).' },
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
  { name: '--field-density', on: 'data-feedback', desc: 'Namespaced alias of --d (same value).' },
  { name: '--field-heatmap-density', on: 'data-feedback + heatmap', desc: 'The ambient heatmap density under the body ∈ [0,1] — where matter pools around it, distinct from --d.' },
  { name: '--load / --mass', on: 'sink body', desc: 'A sink’s accretion fill fraction ∈ [0,1] (--mass is a back-compat alias).' },
  { name: '--lit', on: 'causality', desc: 'Spillover-lit density when a saturated neighbour bleeds density across a boundary.' },
  { name: '--entropy', on: 'data-feedback', desc: 'Measured local disorder ∈ [0,1] — velocity-direction dispersion, gated by agitation (physics workover v0.3). Engine-measured; distinct from the platform’s inferred --field-entropy lane.' },
  { name: '--coherence', on: 'data-feedback', desc: 'Measured local order ∈ [0,1] (= 1 − entropy; velocity alignment). Numeric — not the --coherence palette color on :root.' },
  { name: '--temperature', on: 'data-feedback', desc: 'Measured local agitation ∈ [0,1] — half mean heat, half normalized kinetic energy.' },
];

export const RENDER_MODES: { name: string; desc: string }[] = [
  { name: 'dots', desc: 'The default — each particle a soft dot, cool centre → warm edge → accent.' },
  { name: 'trails', desc: 'Light-painting — particle history persists and fades.' },
  { name: 'links', desc: 'Constellation — lines drawn between nearby particles.' },
  { name: 'metaballs', desc: 'A liquid iso-surface — the swarm rendered as one molten skin via marching squares, not dots.' },
  { name: 'voronoi', desc: 'Shattered glass — each particle owns a cell; the walls are the boundaries between nearest-neighbour regions.' },
  { name: 'streamlines', desc: 'Draws the force field itself — a grid of arrows along the net push. A diagnostic view, REPLACES the dots.' },
  { name: 'flow', desc: 'The dots AND the streamline arrows together in the one underlay canvas — particles drifting along the visible flow. No second blended surface, so it stays cheap.' },
];

/** Field Surfaces — the overlay READINGS (`field.setOverlay`). Line/text diagnostics drawn in front of
 *  content; additive — pass one, or a stack (array / space-separated attribute) and they compose. */
export const OVERLAY_MODES: { name: string; desc: string }[] = [
  { name: 'streamlines', desc: 'Arrows along the net push a still probe would feel — vector flow, felt.' },
  { name: 'force-vectors', desc: 'The same arrows scaled by raw magnitude — strong forces read strong, weak stay faint.' },
  { name: 'field-lines', desc: 'Arrows along the structure-only field (dipoles / monopoles) — the geometry, not the felt push.' },
  { name: 'grid', desc: 'A reference lattice displaced by the local field — space itself made visible, bending where the field is strong.' },
  { name: 'temperature', desc: 'Iso-contour rings of accumulated particle heat — the thermal field, drawn as lines so it never paints over content.' },
  { name: 'energy', desc: 'Iso-contour rings of kinetic energy (½m·|v|²) — where the motion is.' },
  { name: 'path', desc: 'Streamline curves traced from seeded probes — where the field would carry a particle over distance.' },
  { name: 'data', desc: 'A numeric density readout beside each measuring body — the --d measurement made legible.' },
];
