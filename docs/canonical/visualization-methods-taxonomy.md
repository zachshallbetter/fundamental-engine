> **Status: canonical.**
> Render layers, diagnostics, heatmaps, field lines, probes, energy, topology, causality, and prediction. Current as of the platform-runtime phase (Phase D). See [platform-architecture.md](platform-architecture.md) and [system-contracts.md](system-contracts.md).

# Visualization Methods Taxonomy for Fundamental

## Related Documents

| Document | Role |
|---|---|
| [`README.md`](./README.md) | Documentation map |
| [`system-contracts.md`](system-contracts.md) | Visualization contract |
| [`fundamental-field-behavior-table.md`](fundamental-field-behavior-table.md) | Field vs force laws |
| [`testing-and-conformance.md`](testing-and-conformance.md) | Visualization tests |

## Purpose

Visualization methods reveal fields, forces, energy, matter state, topology, heat, memory, attention, and reciprocal DOM state.

Visualization is not decoration.

It is how the system explains itself.

```txt
Particles show matter.
Field lines show structure.
Force vectors show cause.
Trails show history.
Heatmaps show accumulation.
Contours show terrain.
Energy views show cost.
Topology shows relationships.
DOM state shows reciprocity.
```

## Visualization Truth Table

| Visualization | Reads from | Mutates physics? | Shows truth about |
|---|---|---:|---|
| Particles | particle state | yes, particles are state | matter |
| Field lines | `field()` | no | structure |
| Streamlines | vector field | no | continuous direction |
| Force vectors | `apply()` or probe | no | cause |
| Trails | particle history | no | motion history |
| Heatmaps | scalar grids | optional | accumulation |
| Contours | scalar fields | no | terrain / equal values |
| Potential | potential field | no | wells and gradients |
| Energy | particle + field state | no | cost and conservation |
| Topology | relationship agents | optional | coupling |
| DOM state | CSS variables and events | yes, visually | reciprocity |
| Causality | per-force contributions | no | why motion happened |
| Prediction | deterministic ghost step | no | expected future path |

> **Shipped (as data + renderers).** `VISUALIZATION_TRUTH_TABLE`, the `RENDER_MODES` catalog, and
> `VISUALIZATION_PRESETS` live in `packages/core/src/visual/visualization.ts`. Every catalog mode is
> `shipped` — none are planned. The matter/structure modes ship; the diagnostic modes force-vectors,
> contours, potential and energy ship with canvas renderers in `diagnostics/render.ts` (C1); and
> topology, inspector, causality and prediction ship in `diagnostics/modes.ts` (`drawTopology`,
> `drawInspector`, `causalityAt` + `drawCausality`, `ghostTrajectory` + `drawPrediction`). All of these
> are exercised on the live `/docs/diagnostics` page. The canvas is one render surface among these
> layers, not the whole system: `Fundamental` computes renderer-agnostic field behavior and
> `@fundamental-engine/platform` binds it to the DOM, while these overlays draw it onto the canvas surface.

## Render Modes Catalog

The engine ships **16** render modes (`RENDER_MODES` in `packages/core/src/visual/visualization.ts`),
split into matter/structure modes and diagnostic modes. All are shipped; set one with
`field.setRender(mode)` (or the `render` option). The `<field-root>` `render` *attribute* exposes a
subset (`dots` / `trails` / `links` / `streamlines` / `metaballs` / `voronoi`); the rest are reached
through `setRender()` / the core.

| Render mode | Type | Shows |
|---|---|---|
| `dots` | matter | particle positions and heat |
| `trails` | motion | path history |
| `links` | structure | proximity links between near bodies |
| `streamlines` | structure | continuous field paths |
| `metaballs` | matter | merged density blobs |
| `voronoi` | structure | region cells around bodies |
| `field-lines` | structure | `field()` geometry |
| `heatmap` | scalar | density, heat, force, entropy |
| `force-vectors` | diagnostic | actual cause from `apply()` |
| `contours` | diagnostic | equal-value isolines |
| `potential` | diagnostic | wells and gradients |
| `energy` | diagnostic | kinetic, potential, thermal |
| `topology` | diagnostic | threads, flux links, relationships |
| `inspector` | diagnostic | bodies, agents, metrics, contracts |
| `causality` | diagnostic | contribution sources |
| `prediction` | diagnostic | ghost trajectory |

## Visualization Presets

| Preset | Layers |
|---|---|
| `beautiful` | particles + subtle trails |
| `scientific` | field-lines + vectors + contours |
| `diagnostic` | inspector + vectors + body rects |
| `thermal` | heatmap + particle heat + energy |
| `plasma` | field-lines + fieldflow + heat trails |
| `topological` | field-lines + flux links + threads |
| `reduced` | static contours + DOM state |
| `poster` | frozen particles + field lines + composition-safe layout |
| `causality` | particles + force vectors + contribution colors |
| `prediction` | actual trails + ghost trails + divergence error |

## Surfaces & Placement

The methods above answer *what* to draw. **Placement** answers *where* it composites relative to page
content — an axis orthogonal to every visualization method. The visible particle canvas is one
**surface**; Fundamental defines three:

| Surface | Placement | Drawn on | Status |
|---|---|---|---|
| **Underlay** | behind content (`z-index:0`) | the `<field-root>` canvas | shipped (the default) |
| **Overlay** | in front of content (`pointer-events:none`, screen-blend, above content / below the nav) | a second light-DOM canvas the element owns | shipped |
| **Typographic (invisible)** | in the content itself | nothing — the field's feedback variables (`--d`, `--load`, `--field-*`) styled by author CSS into type, ink, and anchor | shipped — see [invisible-fields.md](invisible-fields.md) |

- **Immersive** = the same field drawn on *both* surfaces, so content sits **inside** the field. It is
  a composition, not a new primitive: set the underlay (`render`) and the overlay (`overlay`) together.
- **Typographic (invisible)** = no surface at all: the engine runs draw-skipped
  (`FieldHandle.setVisible(false)`) and/or a recipe runs render-less (`render: []`), and the page's
  own type *is* the render surface. The full pattern — two-field architecture, live channels,
  engagement contracts, data provenance — is canonical in
  [invisible-fields.md](invisible-fields.md).
- **Overlay-suitable methods** are the structure/vector visualizations that reveal field *shape*
  without occluding text: `streamlines`, `force-vectors`, `field-lines`, `grid` (the reference
  lattice displaced by the field — deformation), `temperature` / `energy` (iso-contour instances of
  the scalar `contours` method, reading heat and kinetic energy), `path` (streamline curves traced
  from seeded probes), and `data` (numeric per-body density readouts — the inspector method's
  lightest form). Particle/matter methods (`dots`, `trails`, `metaballs`,
  `voronoi`) stay on the **underlay** by design — drawn over text they would obscure it.
- The overlay renders the **live** field (the engine's `forceAt` / `netField` samplers over the
  current bodies), not a static trace — so it tracks the page as bodies move, scroll, and engage.

### Surfaces API

| Surface | Set live | Declarative (`<field-root>`) | createField option |
|---|---|---|---|
| Underlay | `setRender(mode)` | `render="…"` | `render` |
| Overlay | `setOverlay(mode)` | `overlay="…"` | `overlay` (+ `overlayCanvas` for raw `createField`) |

```html
<!-- immersive: dots behind content, the live force field washing over it -->
<field-root render="dots" overlay="streamlines"></field-root>
```

```ts
field.setRender('dots');           // underlay (behind content)
field.setOverlay('field-lines');   // overlay (in front of content); 'off' clears the surface
field.setOverlay(['grid', 'path', 'temperature']); // readings are ADDITIVE — a stack composes
```

**The input mirror — field channels.** Surfaces are *output*: the engine draws onto them. Their open
*input* analog is a **field channel** — `addField(name, sampler)` registers an external scalar field
(terrain, moisture, a heat map) the engine samples on its own read path, read back with
`sampleField(name, x, y)`. A surface is a place the field draws; a channel is a field the engine reads.
Channels obey the field-function contract and are pull-based — see
[system-contracts.md §2.1](system-contracts.md). (The surface *set* is deliberately the three
placements above, not an open registry; the open extension point on the output side is a registrable
render/overlay mode, tracked separately.)

Readings are **additive**: `setOverlay` takes one reading or a stack (an array; space-separated in
the `overlay` attribute), drawn in order on the one front surface — so matter (underlay) + the
heatmap layer + several overlay readings compose into a single legible picture of the same field.

**Placement is orthogonal to mode** — any overlay-suitable method renders on either surface.
`<field-root>` owns the overlay canvas (created in the light DOM, since the shadow host is `z-index:0`);
`createField` callers pass their own `overlayCanvas`. Core stays renderer-agnostic: it only draws to
the canvases it is handed.

> **Planned (named, not built):** per-element / `inline` placement (a surface scoped to one box),
> `framed` placement (within a stage), the `potential` scalar overlay, and the graph overlays
> (`topology` / `causality` / `prediction`). The `OverlayMode` union is additive, so these land
> without a breaking change — exactly how `grid` / `temperature` / `energy` / `path` / `data` landed.

## 1. Particles

Particles are visible matter.

Methods:

| Method | Description | Formula / data |
|---|---|---|
| Point particles | simple dots | `p.x`, `p.y`, `p.heat`, `p.phase` |
| Heat-tinted particles | color shifts with excitation | `color = mix(base, accent, p.heat)` |
| Velocity-stretched particles | faster particles elongate | `length ∝ |v|` |
| Mass-scaled particles | heavier particles render bigger | `radius ∝ sqrt(p.m)` |
| Phase particles | visual treatment by material state | gas/liquid/solid/plasma |
| Pigment particles | particles carry color state | `p.color` |

Recommended:

```txt
particle radius = baseRadius * (1 + heat * 0.8) * sqrt(m)
particle alpha = baseAlpha + heat * heatAlpha
```

## 2. Field Lines

Field lines visualize `field(b, x, y)`.

They are not always particle paths.

| Field | Field-line structure | Particle relationship |
|---|---|---|
| Gravity | inward radial lines | particles accelerate along field unless orbiting |
| Charge | outward/inward radial lines | positive follows, negative moves opposite |
| Magnetism | loops/dipoles | particles curve across lines |
| Fieldflow | reads existing lines | particles follow them |
| Memory | worn paths/gradients | agents may follow memory gradient |

General tracing:

```txt
p0 = seed point
for step:
  F = fieldAt(p)
  dir = normalize(F)
  p = p + dir * stepSize
```

Trace forward and backward:

```txt
p_forward += normalize(F) * stepSize
p_backward -= normalize(F) * stepSize
```

Stop when:

```txt
field strength < threshold
point exits viewport
line reaches max length
line loops near start
line approaches another line too closely
```

## 3. Force Vectors

Force vectors show actual cause from `apply()`.

For velocity-dependent forces, use probes.

Example for magnetism:

```txt
probe = { q: 1, v: chosenVelocity, m: 1 }
F = applyToProbe(probe)
```

Important distinction:

```txt
field magnitude != force magnitude
```

A strong magnetic field can exert zero force on a neutral or still particle.

## 4. Probe Modes

Probe particles are instruments.

| Probe | Purpose |
|---|---|
| Neutral probe | fieldflow, transport, collision |
| Positive charge probe | electric and magnetic behavior |
| Negative charge probe | sign reversal |
| Still charged probe | velocity requirement |
| Fast probe | drag, magnetism, collision |
| Hot probe | thermal, crystallize, fuse |
| Massive probe | gravity and inertia |
| Paired probes | divergence, attraction, collision |
| Probe sheet | field distortion across a plane |

The Lab should not only show demos. It should fire instruments into the field.

## 5. Heatmaps

Heatmaps are scalar field buffers.

| Heatmap | Measures | Formula |
|---|---|---|
| Density | particle concentration | `H = Σ K(|x - p.x|, r)` |
| Heat | particle excitation | `H = Σ p.heat * K(d,r)` |
| Force | force magnitude | `H = |Σ F_i(x,y)|` |
| Velocity | motion intensity | `H = Σ |p.v| * K(d,r)` |
| Entropy | disorder | weighted local variance |
| Memory | repeated occupancy | `M = M * decay + occupancy` |
| Attention | engagement concentration | body density + engagement |
| Accretion | captured matter | `body.accreted / capacity` |
| Relationship | linked content intensity | relationship weight |
| Path | repeated user movement | user trail deposits |

Recommended kernel:

```txt
K(d, r) = max(0, 1 - d² / r²)²
```

Scalar grid:

```ts
type ScalarGrid = {
  width: number
  height: number
  resolution: number
  values: Float32Array
  decay: number
}
```

## 6. Contours and Potential

Contours show equal scalar values.

Use for:

```txt
potential
density
heat
entropy
memory
pressure
attention
```

Potential examples:

```txt
Φ_gravity = -GM / sqrt(r² + ε²)
Φ_charge = kQ / sqrt(r² + ε²)
```

Use marching squares for isolines.

## 7. Energy Visualization

Energy views make the system accountable.

| Energy | Formula | Meaning |
|---|---|---|
| Kinetic | `K = 0.5 * m * |v|²` | motion |
| Potential | `U = mΦ` or `U = qΦ` | position in field |
| Thermal | heat or velocity variance | agitation |
| Binding | `0.5 * k * (d - L)²` | stored link energy |
| Accretion | accreted/capacity | held matter |
| Dissipation | `ΔE_lost` | drag/damping loss |
| Source | emitted budget | spawn/supernova |

Lab metrics:

```txt
E_total
ΔE per step
energy injected
energy dissipated
energy conserved
```

## 8. Topology and Relationship Visualization

Topology views show relationships among agents.

| Overlay | Meaning |
|---|---|
| Threads | explicit relationships |
| Flux links | field-derived relationships |
| Memory paths | repeated routes |
| Attention bridges | attention transfer |
| Graph edges | data relations |
| Accretion ownership | captured matter ownership |

Render:

```txt
curved lines between bodies
pulse along relationship
thickness by coupling
color by force type
dashed inferred relations
```

## 9. Boundary Visualization

| Boundary | Visualization |
|---|---|
| Reflect | collision box and bounce normals |
| Gate | one-way membrane arrows |
| Screen | shield/attenuation field |
| Spotlight | cone wedge |
| Lens | refractive ring / caustic lines |
| Absorb | capture horizon |
| World edge | wrap/fade margin |
| Morph target | target points/silhouette |

## 10. Phase and Material Visualization

| Phase | Visual |
|---|---|
| Gas | sparse particles |
| Liquid | metaballs/cohesion |
| Solid | lattice/crystal |
| Plasma | fieldflow + glow trails |
| Memory-worn | persistent paths |
| Accreted | captured core/meter |

## 11. Causality Overlay

The system should answer:

```txt
Why did that move?
```

Causal visuals:

| Cause | Visual |
|---|---|
| Charge | electric accent |
| Magnetism | curved blue/purple impulse |
| Fieldflow | cyan stream |
| Drag | gray resistance |
| Collision | spark |
| Gravity | deep well glow |
| Screen | shield fade |
| Reflect | bounce normal |

## 12. Prediction Mode

Predict the next N frames without mutating live state.

```txt
actual path = solid
predicted path = ghost
error = divergence
```

Use for:

```txt
integrator debugging
chaotic fields
force comparison
magnetism vs fieldflow
stability testing
education
```

## 13. Field Narrative Mode

A page can teach the system by progressively revealing layers.

```txt
1. particles only
2. bodies appear
3. field lines appear
4. forces move agents
5. density writes to DOM
6. heatmaps reveal accumulation
7. topology links bodies
8. inspector shows reciprocity
```

This narrative reveal ships: the diagnostics surface steps through the layers above, and the live
`/docs/diagnostics` page walks the reveal in order.

An accessible preview ships alongside it. Under `prefers-reduced-motion`, the narrative collapses to a
static preview that still names each layer and shows its current state, so the explanation reaches
keyboard and reduced-motion users without animation. Reduced motion preserves meaning rather than
hiding it.

## 14. Field Diff

When parameters change, explain the difference.

Example:

```txt
Before: entropy 0.22, average speed 1.4, density center 0.61
After: entropy 0.37, average speed 2.1, density center 0.44
Change: stronger fieldflow increases velocity and lowers center density.
```

Compare:

```txt
entropy
coherence
average speed
energy drift
density concentration
attention share
source budget
particle count
```

## 15. Exportable Field Snapshots

Export formats:

```txt
PNG
SVG field lines
JSON scene recipe
Lab report
conformance state
debug trace
poster image
```

Field export ships: the diagnostics surface exports the current field as an image — SVG (vector field
lines and overlays) or PNG (rasterized canvas) — alongside the JSON scene recipe. Snapshots should
become regression tests where possible.

> **Diagnostics shipped (data layer + renderers).** The pure math behind these overlays ships in
> `packages/core/src/diagnostics/`: energy accounting (§7), scalar `potentialAt` + grid sampling for
> contours/potential (§6), probe `forceVectorAt` + `causalityAt` (§3/§4/§11), and heatmap-variant
> samplers density/heat/velocity (§5). The canvas *drawing* of these overlays also ships in
> `diagnostics/render.ts` and `diagnostics/modes.ts`, and the SVG/PNG field export above is wired up.
> All of it is live and interactive on the `/docs/diagnostics` page.

## Implementation Priority

This list records the build order that has now shipped; every item below is live (see
`/docs/diagnostics`).

```txt
1. Visualization truth table
2. Field lines from every field() hook
3. Force vectors through probes
4. Probe modes
5. Density/heat/attention heatmaps
6. Energy dashboard
7. Boundary overlays
8. Reciprocity Inspector
9. Scene recipe export/import
10. Causality overlay
11. Prediction mode
12. Topology/flux-linkage after fieldflow stabilizes
```
