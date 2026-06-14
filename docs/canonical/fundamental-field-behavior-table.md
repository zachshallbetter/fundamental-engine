> **Status: canonical.**
> Field/force laws, the electromagnetic split, fieldflow, and truth modes. Current as of the platform-runtime phase (Phase D). See [platform-architecture.md](platform-architecture.md) and [system-contracts.md](system-contracts.md).

# Fundamental Field Behavior Table for Fundamental

## Related Documents

| Document | Role |
|---|---|
| [`README.md`](./README.md) | Documentation map |
| [`definition-document.md`](definition-document.md) | Concept |
| [`system-contracts.md`](system-contracts.md) | Contracts |
| [`visualization-methods-taxonomy.md`](visualization-methods-taxonomy.md) | Field rendering and diagnostics |
| [`testing-and-conformance.md`](testing-and-conformance.md) | Tests |

## Core Distinction

Every field-like force must separate:

```txt
field(b, x, y)
```

from:

```txt
apply(b, p, env)
```

`field()` returns invisible structure.

`apply()` causes change.

A field line is not always a particle path.

## Field Grammar Reference

```txt
Body = where influence originates
Field = invisible structure
Force = how matter responds
Flow = how matter is transported
Metric = what the system measures
Render = how the invisible becomes visible
Feedback = how the field writes back to the DOM
```

## Truth Modes

| Truth mode | Meaning | Examples |
|---|---|---|
| Physical truth | modeled after a recognizable physical law | `gravity`, `charge`, `magnetism` |
| Designed truth | shaped for stable UI behavior | `attract`, `repel`, `spring` |
| Hybrid truth | a designed primitive operating over natural geometry | `fieldflow` |
| Diagnostic truth | reveals internal state | force vectors, heatmaps |
| Poetic truth | expressive composite | `blackhole`, `nebula` |
| Semantic truth | maps meaning into physics | attention, memory |

> **Implemented.** These are the `TruthMode` union + `TRUTH_MODES` catalog in
> `packages/core/src/contracts/passport.ts`. Forces classify as `physical` / `designed` / `hybrid`
> (fieldflow); `diagnostic` / `poetic` / `semantic` classify visualizations, composite presets, and
> the meaning→metric mappings respectively.

> **Diagnostic truth is read-only.** All diagnostic render modes — including `causality` and
> `prediction`, both shipped and live at `/docs/diagnostics` — only *visualize* field state. They
> read the field and draw on a render surface; they never feed back into `apply()` or mutate physics.
> Visualization and physics stay separate: a diagnostic overlay reveals internal structure without
> changing how matter responds.

## Fundamental Table

| Field / interaction | Field structure | `field(b, x, y)` should return | `apply(b, p, env)` should do | Particle relationship to field lines | Render expectation | Correct Fundamental role |
|---|---|---|---|---|---|---|
| **Gravity** | radial monopole well around mass-energy | gravitational vector field `g(x,y)` pointing toward source mass | softened gravitational acceleration: `g = -GM r̂ / (r² + ε²)` and `F = m g` | particles generally accelerate along the field; sideways velocity can create orbits | radial wells, falling paths, orbital arcs, accretion | `gravity`, natural primitive |
| **Electric / Charge** | signed radial monopole field | electric vector `E(x,y)` outward from positive, inward toward negative | Coulomb force: `F = qE` | positive particles move along `E`; negative particles move opposite; neutral particles ignore it | radial lines, attraction/repulsion, demixing | `charge`, natural primitive |
| **Magnetic** | loop, dipole, or pole-pair field | magnetic vector `B(x,y)`, derived from pole position, geometry, orientation, strength, and feedback | Lorentz magnetic force: `F = q(v × B)` | particles do not naturally stream along magnetic field lines; force is perpendicular to velocity and field | field loops plus curved charged tracks | `magnetism`, natural primitive |
| **Electromagnetic combined** | coupled electric and magnetic field | compound `{ E(x,y), B(x,y) }` | full Lorentz force: `F = q(E + v × B)` | electric pushes along/opposite `E`; magnetic bends across `B` | spirals, arcs, plasma motion when paired with `fieldflow` | future composite |
| **Field-aligned transport** | reads existing net field geometry | reads `env.fieldAt(x,y)` or `netField(...)` | steers velocity onto the field line and accelerates along it | particles intentionally follow field lines | solar prominences, auroras, routed plasma | `fieldflow`, label `Flux` |
| **Strong / Binding** | short-range confinement or string tension | local binding field or pair potential | binds, links, fuses, resists separation | not line-following | clusters, bonds, nuclei-like structures | `cohesion`, `link`, `fuse` |
| **Weak / Transformation** | instability or probability field | scalar instability or none | decay, split, transmute, emit secondaries | not path-based | state mutation, splitting | `decay`, `fission` |

## Electromagnetic Behavior Split

| Behavior | Token | Owns field geometry? | Motion law | Does work? | Particle path relative to field lines |
|---|---|---:|---|---:|---|
| Electric charge | `charge` | yes | `F = qE` | yes | along `E` for positive, opposite for negative |
| Magnetic Lorentz force | `magnetism` | yes | `F = q(v × B)` | no in ideal mode | across/around field lines |
| Field-aligned transport | `fieldflow` | no, reads net field | steer + accelerate along `normalize(fieldAt(x,y))` | yes | along existing field lines |

## Required Mental Model

```txt
Electric fields push.
Magnetic fields bend.
Fieldflow carries.
```

Do not make `magnetism.apply()` follow magnetic field lines.

That behavior belongs to `fieldflow`.

## Gravity

> **Implemented.** `gravity.field()` now ships (`packages/core/src/forces/natural.ts`,
> `bodyGravityField`): a radial inward field so gravity owns `field()`, renders as field lines, and
> can be followed by `fieldflow`. `gravity.apply()` is unchanged — adding the field only makes the
> structure visible/followable (a field line is not always a particle path). The passport's
> `ownsField` is now `true`.

### Field

```txt
r = (x - cx, y - cy)
d = max(length(r), ε)
r̂ = r / d
g = -GM * r̂ / (d² + ε²)
```

### Apply

```txt
F = m * g
a = F / m
v += a * dt
```

Simplifies to:

```txt
a = g
```

## Charge

### Field

```txt
r = (x - cx, y - cy)
d = max(length(r), ε)
r̂ = r / d
E = kQ * r̂ / (d² + ε²)
```

Bounded UI-safe mode:

```txt
falloff = max(0, 1 - d / range)^n
E = sign * strength * r̂ * falloff
```

### Apply

```txt
F = qE
a = F / m
v += a * dt
```

## Magnetism

### Field

For a simple visual loop:

```txt
r = (x - cx, y - cy)
d = max(length(r), ε)
r̂ = r / d
tangent = (-r̂.y, r̂.x)
falloff = max(0, 1 - d / range)^n
B = tangent * strength * spin * falloff
```

For production, prefer pole-derived field geometry:

```txt
B = bodyDipole(body, x, y)
```

or:

```txt
B = polePair(body.poles, x, y)
```

The field should respond to:

```txt
pole position
element geometry
orientation
strength
range
spin/polarity
live charge feedback
```

### Apply

```txt
F = q(v × B)
```

For 2D canvas motion with out-of-plane magnetic strength:

```txt
Fx = -q * Bz * vy
Fy =  q * Bz * vx
a = F / m
v += a * dt
```

### Required Tests

```txt
neutral particles ignore magnetism
still charged particles receive no magnetic force
moving charged particles curve
force is perpendicular to velocity
speed is preserved in ideal mode
charge reversal flips curvature
spin reversal flips curvature
no effect beyond range
```

## Fieldflow / Flux

`fieldflow` is field-aligned transport.

It does not define a fundamental field. It reads the net field created by other bodies.

### Apply

```txt
F_net = env.fieldAt(p.x, p.y)
h = normalize(F_net)

gain = strength * max(0, 1 - d / range)

v = steerToward(v, h, steer * gain)
v += h * accel * gain
```

Recommended tunable version:

```txt
h = normalize(env.fieldAt(p.x, p.y)) * direction
targetVelocity = h * flowSpeed
v += (targetVelocity - v) * flowSteer * gain
v += h * flowAccel * gain
```

### Recommended Attributes

```html
<div
  data-body="fieldflow"
  data-strength="1"
  data-range="0"
  data-flow-steer="0.18"
  data-flow-accel="0.08"
  data-flow-speed="2.4"
  data-flow-direction="1"
  data-field-source="all"
></div>
```

### Behavior

```txt
acts on neutral matter
does work
follows net field superposition
routes matter between linked poles
range 0 can mean global field-following formation
creates solar prominence / aurora / plasma behavior
```

## Implementation Matrix

| Token | Owns `field()`? | Uses `env.fieldAt()`? | Moves particles? | Moves along field lines? | Does work? | Main law / behavior |
|---|---:|---:|---:|---:|---:|---|
| `gravity` | yes | no | yes | mostly | yes | `g = -GM r̂ / (r² + ε²)` |
| `charge` | yes | no | yes | sign-dependent | yes | `F = qE` |
| `magnetism` | yes | no | yes | no | no ideal | `F = q(v × B)` |
| `fieldflow` | no | yes | yes | yes | yes | steer + accelerate along `fieldAt` |
| `cohesion` | optional/local | no | yes | n/a | yes | surface tension |
| `pressure` | optional/scalar | no | yes | n/a | yes | density relaxation |
| `link` | optional/local | no | yes | n/a | constraint | distance constraint |
| `fuse` | local | no | state/count | n/a | releases heat | conservation |
| `fission` | local | no | state/count | n/a | releases heat | budgeted split |
| `decay` | optional scalar | no | state/count | n/a | not motion-first | timed transformation |
| `spawn` | no | no | creates particles | n/a | source | budgeted source |

## Force Passport Template

Every force should include:

```txt
Token:
Category:
Truth mode:
Owns field():
Uses env.fieldAt():
Moves particles:
Does work:
Conserves speed:
Requires charge:
Requires velocity:
Affects neutral matter:
Can be visualized as field lines:
Can be visualized as force vectors:
Best render modes:
Conformance tests:
Common composites:
Design use:
Physics note:
```

## Future Flux-Linkage Layer

Flux-linkage is a future pairwise relationship metric.

```txt
Φ_AB = amount of field from body A that connects to or passes through body B
```

Do not implement flux-linkage before baseline `fieldflow`, field-line, and probe systems are stable.
