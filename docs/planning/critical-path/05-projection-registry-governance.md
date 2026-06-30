# Projection Registry + Governance

## Status

Experimental — **Projection Registry MVP shipped** (`@fundamental-engine/core`, `field.projections`):
register named projections that map field state to an output surface, declaring `channels`/`surfaces`/
`reducedMotionEquivalent`/`accessibilityEquivalent`; `register`/`unregister`/`get`/`list`/`apply`;
read-only (a projection never changes state); reported by `query()`/`snapshot()`; on every surface.
**Not yet built (the Governance half + extras):** governance lint rules (lane separation,
relationship-as-force, motion-only, semantic-source), write-phase auto-apply, sound/haptic/agent-json
surface adapters, formation inspector, strict CI lint mode. Not in the frozen API surface.

Proposed platform/devtools architecture. Required for design systems, accessibility, AI-readable field state, non-visual outputs, multi-surface runtimes, and trustworthy field behavior.

## Purpose

Fundamental separates field behavior from how that behavior is made visible or usable.

A Projection Registry formalizes that separation.

Governance ensures powerful field behavior stays explainable, accessible, and non-magical.

## Core principle

```txt
Projection reveals state.
Coupling changes state.
Do not confuse them.
```

A projection can show a dimension without causing dynamics.

A coupling must be declared by a force or Field Formation.

## Projection Registry

A Projection Registry maps field state into output surfaces.

Possible projection surfaces:

```txt
CSS variables
DOM attributes
SVG overlays
Canvas render layers
Typography
Static annotations
Reduced-motion equivalents
Sound
Haptics
Native views
AR/spatial layers
AI-readable JSON
OS-level indicators
```

## Why this matters

Fundamental should not be locked to motion, canvas, or CSS.

The same field state may need to become:

```txt
movement for one user
contrast for another
sound for another
haptic feedback for another
structured data for an AI agent
static annotation for reduced motion
spatial placement for AR
```

The behavior remains the same. The projection changes.

## Proposed projection definition

```ts
type FieldProjection = {
  id: string;
  label: string;
  channels: string[];
  surfaces: FieldProjectionSurface[];
  reducedMotionEquivalent?: string;
  accessibilityEquivalent?: string;
  apply(reading: FieldProjectionReading, target: FieldProjectionTarget): void;
};

type FieldProjectionSurface =
  | "css"
  | "dom-attribute"
  | "svg"
  | "canvas"
  | "typography"
  | "annotation"
  | "sound"
  | "haptic"
  | "native"
  | "spatial"
  | "agent-json";
```

## Registration API

```ts
field.projections.register("density-outline", {
  label: "Density Outline",
  channels: ["density"],
  surfaces: ["css", "annotation"],
  reducedMotionEquivalent: "outline and label",
  accessibilityEquivalent: "semantic emphasis and explanation",
  apply(reading, target) {
    target.style.setProperty("--field-outline", String(reading.density));
  },
});
```

## Projection examples

### Density

| Projection type | Expression |
|---|---|
| Motion | lift, pull, drift, gather |
| Static | border weight, color depth, type weight |
| Reduced motion | outline, label, ordered emphasis |
| Sound | volume / tone intensity |
| Haptic | pulse strength |
| AI-readable | `density: 0.72` |

### Memory

| Projection type | Expression |
|---|---|
| Motion | trail, sediment, fade |
| Static | tint, mark, visited annotation |
| Reduced motion | “previously visited” label |
| AI-readable | `memory: 0.64` |

### Conflict

| Projection type | Expression |
|---|---|
| Motion | separation, vibration, charge split |
| Static | split border, opposing labels |
| Reduced motion | conflict summary |
| AI-readable | contradiction records |

### Confidence

| Projection type | Expression |
|---|---|
| Motion | stable settling |
| Static | badge, opacity, weight |
| Reduced motion | confidence text/icon |
| AI-readable | confidence metric and provenance |

## Reduced-motion equivalence

Reduced motion should not mean behavior disappears.

It means behavior is translated into a non-motion projection.

```txt
The behavior is not removed.
It is projected differently.
```

Examples:

```txt
motion pull → outline emphasis
orbit → static relationship diagram
trail → visited marker
pulse → persistent warning block
fieldflow → ordered route list
charge separation → conflict labels
```

## Projection and accessibility

Every motion-heavy Field Formation should declare an accessibility equivalent.

Required:

```txt
meaning without motion
static fallback
screen-reader-readable explanation
keyboard-accessible state
reduced-motion projection
```

Accessibility is not fallback. It is an alternate projection of the same field state.

## AI-readable projection

AI agents should receive structured field state rather than scraping UI.

Example:

```json
{
  "projection": "evidence-summary",
  "body": "claim-42",
  "density": 0.72,
  "confidence": 0.58,
  "relationships": [
    { "type": "supports", "target": "source-3", "strength": 0.81 },
    { "type": "contradicts", "target": "claim-9", "strength": 0.44 }
  ],
  "diagnostics": ["unsupported-gap", "source-age-warning"]
}
```

This is a projection. It does not mutate the field.

## Governance

As Fundamental becomes more powerful, it needs rules that prevent arbitrary, inaccessible, or manipulative field behavior.

## Governance rules

### Lane separation

```txt
Concepts describe.
Dimensions hold state.
Fields structure.
Relationships associate.
Forces couple.
Tokens execute.
Metrics measure.
Diagnostics explain.
Conditions activate.
Projections reveal.
Formations compose.
FieldRecipe represents.
Contracts execute.
No word lives in two lanes.
```

### Relationship causality

Relationships are non-causal by default.

Only a Field Formation may map a relationship into force.

```txt
association alone moves nothing
formation maps association into coupling
force causes state change
```

### Coupling passport

Any force that couples dimensions must declare it.

```txt
Couples dimensions: translation → rotation
Couples dimensions: time → strength
Couples dimensions: relation → charge
```

### Projection requirement

Every added dimension needs a projection rule.

Every motion-heavy projection needs a reduced-motion equivalent.

### Semantic source requirement

Visual layers must not replace semantic sources.

```txt
semantic HTML owns meaning
field body owns participation
visual layer owns expression
```

### API naming rule

Do not rename frozen API symbols while refining conceptual terminology.

```txt
Field Formation = concept
FieldRecipe = API representation
```

## Field lint rules

A governance layer should produce lint warnings and errors.

Suggested rules:

```txt
field/no-hidden-coupling
field/no-motion-only-formation
field/no-visual-without-semantic-source
field/no-relationship-force-without-formation
field/no-dimension-coupling-without-passport
field/no-configuration-for-formation
field/no-matter-for-formation
field/no-raw-force-soup-in-design-system
field/no-field-density-for-raw-live-density
field/no-mass-for-sink-load
field/reduced-motion-equivalent-required
field/accessibility-equivalent-required
```

## Severity levels

```txt
info      explanatory or style guidance
warning   likely mistake, but not fatal
error     violates doctrine or accessibility contract
fatal     breaks API/conformance/security assumptions
```

## Governance examples

### Hidden coupling

Problem:

```txt
A relation silently causes attraction.
```

Correction:

```txt
Declare a Field Formation that maps relation strength into attraction/cohesion.
```

### Motion-only projection

Problem:

```txt
A warning only appears as a pulse.
```

Correction:

```txt
Add static warning block, label, or outline projection.
```

### Visual source replacement

Problem:

```txt
SVG text replaces semantic heading.
```

Correction:

```txt
Keep real HTML heading. Bind SVG as aria-hidden visual representation.
```

### Field Formation naming error

Problem:

```txt
Configuration decides which associations become couplings.
```

Correction:

```txt
A Field Formation decides which associations become couplings.
```

## Relationship to design systems

Design systems should use governance to define allowed behavior.

Each component should declare:

```txt
allowed field roles
allowed Field Formations
allowed projections
required reduced-motion equivalents
forbidden tokens
allowed diagnostics
```

Example:

```txt
Button
- may be source or receiver
- may use Priority Well or Command Intent Field
- may not be Dynamic by default
- must provide reduced-motion projection
```

## Relationship to Field Query and Snapshot

Projection Registry should expose projection state to queries and snapshots.

A query should answer:

```txt
which projection is active?
which channels does it read?
does it have reduced-motion equivalent?
does it preserve semantic meaning?
```

A snapshot should capture:

```txt
active projections
projection outputs
accessibility equivalents
governance warnings
```

## MVP scope

Start with CSS/static/reduced-motion projections.

MVP:

```txt
projection registry interface
registered CSS projection
registered annotation projection
reduced-motion equivalent field
governance lint checklist
basic field lint rules
```

Next:

```txt
sound projection
haptic projection
AI-readable projection
Storybook/docs integration
formation inspector
strict CI lint mode
```

## Acceptance checklist

- Projection is formally separate from coupling.
- Projection Registry can register named projections.
- Projections declare channels and surfaces.
- Reduced-motion equivalent can be declared.
- Accessibility equivalent can be declared.
- Field Query can read active projections.
- Field Snapshot can capture active projections.
- Governance lint rules enforce lane separation.
- Governance prevents relationship-as-force without Field Formation.
- Governance prevents motion-only behavior.
- Governance preserves semantic source vs visual expression.
