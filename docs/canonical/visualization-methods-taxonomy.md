> **Status: canonical.**
> Render layers, diagnostics, heatmaps, field lines, probes, energy, topology, causality, and prediction. Current as of the platform-runtime phase (Phase D). See [field-ui-platform-architecture.md](field-ui-platform-architecture.md) and [field-ui-system-contracts.md](field-ui-system-contracts.md).

# Visualization Methods Taxonomy for field-ui

## Related Documents

| Document | Role |
|---|---|
| [`README.md`](./README.md) | Documentation map |
| [`field-ui-system-contracts.md`](field-ui-system-contracts.md) | Visualization contract |
| [`fundamental-field-behavior-table.md`](fundamental-field-behavior-table.md) | Field vs force laws |
| [`field-ui-testing-and-conformance.md`](field-ui-testing-and-conformance.md) | Visualization tests |

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
> layers, not the whole system: `field-ui` computes renderer-agnostic field behavior and
> `@field-ui/platform` binds it to the DOM, while these overlays draw it onto the canvas surface.

## Render Modes Catalog

| Render mode | Type | Shows |
|---|---|---|
| `particles` | matter | particle positions and heat |
| `trails` | motion | path history |
| `field-lines` | structure | `field()` geometry |
| `streamlines` | structure | continuous field paths |
| `force-vectors` | debug | actual cause from `apply()` |
| `velocity-vectors` | debug | actual motion |
| `heatmap` | scalar | density, heat, force, entropy |
| `contours` | scalar | equal-value isolines |
| `potential` | scalar/vector | wells and gradients |
| `energy` | scalar | kinetic, potential, thermal |
| `boundaries` | geometry | gates, reflectors, screens |
| `topology` | graph | threads, flux links, relationships |
| `phase` | material | gas, liquid, solid, plasma |
| `dom-state` | feedback | CSS variables and DOM metrics |
| `inspector` | debug | bodies, agents, metrics, contracts |
| `poster` | static | frozen export |
| `causality` | debug | contribution sources |
| `prediction` | debug/teaching | ghost trajectory |

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
