> **Status: canonical.**
> Typography, color, shape, distance, pattern, emission, containers, surfaces, and visual semantics. Current as of the platform-runtime phase (Phase D). See [platform-architecture.md](platform-architecture.md) and [system-contracts.md](system-contracts.md).

# Fundamental Visual Language and Geometry System

## Related Documents

| Document | Role |
|---|---|
| [`README.md`](./README.md) | Documentation map |
| [`definition-document.md`](definition-document.md) | Core concept |
| [`system-contracts.md`](system-contracts.md) | Contracts |
| [`visualization-methods-taxonomy.md`](visualization-methods-taxonomy.md) | Render and diagnostic layers |
| [`interaction-and-relationship-model.md`](interaction-and-relationship-model.md) | User, relationship, and DOM agents |
| [`authoring-and-recipes.md`](authoring-and-recipes.md) | Authoring model |

## Purpose

This document defines how `Fundamental` should treat visual form as part of the field system.

The field should not only move particles. It should be able to influence typography, color, shape, distance, pattern, emission, containers, surfaces, hierarchy, and semantic visual state.

The visual system is native-platform-first, dependency-light, and framework-agnostic. The `Fundamental` package specifically carries zero runtime dependencies; visual layers prefer native web APIs and treat any external adapter as opt-in and outside core.

These visual layers are render surfaces bound to the field runtime by `@fundamental-engine/dom`: canvas render modes, SVG overlays, and diagnostic overlays. `Fundamental` computes renderer-agnostic field behavior; the platform binds that behavior to the DOM through measurement, state, feedback, relationships, visual bindings, overlays, scheduling, and linting. Canvas is one render surface, not the whole system. Every visual layer here is a semantic-safe, accessibility-aware render surface over a shared field context.

Implementation should use fundamental web APIs wherever possible:

```txt
HTML
CSS
SVG
Canvas 2D
Web Animations API
Custom Elements
Shadow DOM
ResizeObserver
IntersectionObserver
Pointer Events
Keyboard / Focus Events
CSS Custom Properties
CSS Typed OM where available
WebGL / WebGPU only when explicitly needed
```

Do not depend on external libraries for core behavior unless there is no practical alternative.

## 1. Core Visual Principle

Visual behavior should be caused by field state.

```txt
field metrics -> visual variables -> rendered form
```

Examples:

```txt
density -> font weight
attention -> color intensity
heat -> emission/glow
entropy -> irregularity
coherence -> alignment
memory -> trail/patina
pressure -> compression
distance -> spacing/falloff
relationship -> tension/line weight
```

The core sentence:

```txt
The field does not decorate the interface. It parameterizes the interface.
```

## 2. Visual Parameters

Every visual system can be expressed as a set of field-responsive parameters.

| Parameter | Meaning | Field mapping |
|---|---|---|
| Font weight | typographic mass | density, attention |
| Font width | compression / expansion | pressure, available space |
| Font slant | directional force | velocity, pull vector |
| Optical size | perceived scale/detail | distance, attention |
| Tracking | breathing room | pressure, entropy |
| Stroke width | visual force | strength, density |
| Fill opacity | presence | attention, visibility |
| Hue | categorical state | type, role, charge |
| Saturation | intensity | heat, urgency |
| Tone / lightness | hierarchy | depth, attention |
| Alpha | certainty / presence | confidence, distance |
| Blur | uncertainty / depth | entropy, distance |
| Glow | emission / activation | heat, energy |
| Radius | softness / phase | cohesion, pressure |
| Scale | importance / proximity | attention, strength |
| Rotation | torque / spin | vortex, magnetism |
| Translation | field pull | force vector, attention |
| Pattern density | information load | memory, relationship count |
| Line spacing | reading calm | pressure, density |
| Shadow | depth / lift | attention, z-field |
| Mask | visibility window | spotlight, screen, gate |

## 3. Typography and Webfonts

Webfonts are vector systems with semantic text constraints.

A font contains glyph outlines, spacing, kerning, hinting, OpenType features, Unicode mappings, ligatures, variable axes, and rendering metadata. Glyphs can be treated as vector geometry, but live text should remain semantic whenever possible.

`Fundamental` should support three typography layers.

## 3.1 Live Text Layer

Live text remains selectable, accessible, searchable, translatable, and responsive.

Use CSS custom properties and variable font axes where available.

Example:

```css
.field-text {
  /* --field-density is the primary feedback variable; --d is a compact legacy alias. */
  --d: var(--field-density, 0);
  --a: var(--field-attention, 0);
  --h: var(--field-heat, 0);

  font-variation-settings:
    "wght" calc(300 + var(--field-density, 0) * 500),
    "wdth" calc(90 + var(--a) * 20),
    "slnt" calc(var(--field-pull-x, 0) * -8);

  letter-spacing: calc((1 - var(--a)) * 0.04em);
  text-shadow: 0 0 calc(var(--h) * 18px) currentColor;
}
```

Use this path by default.

## 3.2 Vectorized Glyph Layer

For highly expressive typography, text may be converted into SVG paths or Canvas path geometry.

This enables:

```txt
glyph deformation
per-point distortion
path animation
field-driven outlines
particle emission from glyph edges
collision from glyph shape
masking and clipping
liquid or plasma typography
```

Accessibility rule:

```txt
The visual layer can be vectorized, distorted, animated, shader-rendered, or fully custom.
The semantic layer should remain real HTML text.
```

Pattern:

```html
<h1 class="field-title">
  <span class="sr-only">Liquid Typography System</span>
  <svg aria-hidden="true" focusable="false">
    <!-- expressive glyph paths -->
  </svg>
</h1>
```

For short labels:

```html
<h1 aria-label="Liquid Typography System">
  <svg aria-hidden="true" focusable="false">
    <!-- expressive glyph paths -->
  </svg>
</h1>
```

For longer text, hidden real text is preferred over large `aria-label` content.

## 3.3 Font Source Layer

Editing a font file itself is a type-design workflow, not ordinary field rendering.

`Fundamental` should not require font-file modification for runtime effects.

Runtime behavior should prefer:

```txt
CSS variable axes
SVG paths generated from known glyph outlines
Canvas text metrics and masks
semantic HTML fallback
```

Font licensing rule:

```txt
Do not convert, modify, redistribute, or embed altered commercial font glyph data unless the license explicitly permits it.
```

## 4. Text as Geometry

Text can participate as geometry in several ways.

| Mode | Semantic text preserved? | Use |
|---|---:|---|
| CSS live text | yes | default typography |
| SVG visual duplicate + hidden text | yes | expressive headings |
| Canvas visual duplicate + hidden text | yes | particle/field effects |
| Outlined glyph paths only | no unless fallback supplied | logos, non-semantic art |
| Font-file modification | depends | custom typeface production |

Recommended rule:

```txt
Keep the semantic layer live. Let the visual layer become geometry.
```

## 5. Color System

Color should be field-driven but controlled.

Separate color into independent channels.

```txt
hue = categorical meaning
saturation = intensity
tone/lightness = hierarchy and depth
alpha = presence/confidence
temperature = heat/cool state
contrast = accessibility requirement
```

Suggested variables:

```css
:root {
  --field-hue: 210;
  --field-saturation: 80%;
  --field-tone: 55%;
  --field-alpha: 1;
  --field-heat: 0;
  --field-attention: 0;
  --field-entropy: 0;
}
```

Example:

```css
.field-color {
  color: hsl(
    calc(var(--field-hue) + var(--field-heat) * 24)
    calc(var(--field-saturation) + var(--field-attention) * 12%)
    calc(var(--field-tone) + var(--field-density) * 10%)
    / var(--field-alpha)
  );
}
```

## 5.1 Color Channel Mapping

| Field metric | Color response |
|---|---|
| density | deeper tone / stronger presence |
| heat | warmer hue / higher glow |
| entropy | hue instability / desaturation |
| coherence | cleaner tone / stable hue |
| attention | increased saturation / contrast |
| memory | patina / persistent tint |
| confidence | opacity and clarity |
| uncertainty | lower saturation, higher blur |
| danger | heat shift plus contrast |
| disabled | low saturation and low alpha |

## 5.2 Accessibility Rules for Color

```txt
Color must not be the only carrier of meaning.
Contrast must remain readable.
Motion and glow must not be required to understand state.
Reduced mode should preserve state through static tone, outline, icon, text, or layout.
```

A field-driven color layer must be bounded.

```txt
min contrast threshold
max saturation threshold
max glow threshold
reduced-motion fallback
prefers-contrast support
```

## 6. Shape System

Shape is the visible boundary of field response.

Shape can respond through:

```txt
scale
aspect ratio
corner radius
stroke width
outline offset
mask shape
clip path
path deformation
surface tension
morph target
container curvature
```

Suggested mappings:

| Field metric | Shape response |
|---|---|
| pressure | compression |
| density | mass/scale |
| heat | expansion / bloom |
| cohesion | rounding / liquid behavior |
| entropy | irregular edges |
| coherence | geometric regularity |
| attention | lift / scale / sharper outline |
| memory | worn edge / trail imprint |
| collision | dent / rebound |
| fieldflow | elongated along field direction |

## 6.1 Shape Modes

| Mode | Description | Best for |
|---|---|---|
| Box geometry | rect-based body | cards, buttons |
| Rounded surface | radius field | soft UI |
| Path geometry | SVG path body | icons, glyphs |
| Mask geometry | alpha mask | images, typography |
| Particle boundary | sampled shape | complex silhouettes |
| Container field | region behavior | sections/panels |

## 6.2 Shape Deformation

Dependency-free deformation options:

```txt
CSS transform
CSS border-radius
SVG path attributes
SVG filters
Canvas masks
clip-path
mask-image
Canvas pixel sampling
manual point interpolation
```

Rules:

```txt
Use CSS for simple transforms.
Use SVG for path-accurate shape.
Use Canvas for dense particles, masks, and raster effects.
Keep semantic DOM separate from expressive geometry.
```

## 7. Distance and Spatial Hierarchy

Distance is one of the most important visual variables.

Distance can mean:

```txt
physical distance between bodies
semantic distance between concepts
attention distance from user focus
relationship distance in graph
depth distance in interface hierarchy
time distance from last interaction
confidence distance from expected state
```

## 7.1 Distance Mappings

| Distance type | Visual expression |
|---|---|
| near | higher attention, stronger feedback |
| far | lower alpha, lower force |
| semantically close | thread, cohesion, reduced spacing |
| semantically far | lower coupling, more spacing |
| recently used | memory glow |
| stale | cooling/fading |
| high priority | lower potential well |
| low confidence | blur/desaturation |

## 7.2 Falloff

Use bounded falloffs for UI legibility.

Linear:

```txt
u = max(0, 1 - d / range)
```

Smooth:

```txt
u = max(0, 1 - d² / range²)²
```

Gaussian-like:

```txt
u = exp(-d² / (2σ²))
```

Recommended default:

```txt
u = max(0, 1 - d² / range²)²
```

Use inverse-square behavior for physical modes only, with softening.

## 8. Pattern System

Patterns make accumulated field state visible.

Pattern variables:

```txt
frequency
scale
orientation
phase
density
contrast
grain
spacing
repetition
interference
```

Field mappings:

| Field metric | Pattern response |
|---|---|
| memory | persistent texture |
| entropy | irregular pattern |
| coherence | aligned pattern |
| field direction | oriented stripes / flow lines |
| relationship | linked pattern rhythm |
| heat | higher frequency / glow |
| pressure | tighter spacing |
| distance | larger or softer pattern |

Pattern sources:

```txt
CSS repeating gradients
SVG patterns
Canvas procedural drawing
CSS masks
background layers
border images
inline SVG
```

No dependency is required.

## 8.1 Pattern Examples

Memory grain:

```css
.memory-surface {
  background-image:
    radial-gradient(circle at center,
      hsl(var(--field-hue) 40% 60% / calc(var(--field-memory) * 0.18)) 1px,
      transparent 1px);
  background-size: calc(18px - var(--field-memory) * 8px);
}
```

Fieldflow stripes:

```css
.flow-surface {
  background-image:
    repeating-linear-gradient(
      calc(var(--field-angle, 0deg)),
      currentColor 0,
      currentColor 1px,
      transparent 1px,
      transparent calc(12px - var(--field-density) * 6px)
    );
}
```

## 9. Emission System

Emission is visual energy leaving a body or surface.

Emission can appear as:

```txt
particles
light/glow
waves
rings
rays
sparks
heat blooms
field lines
sound-like pulses
event pulses
relationship pulses
```

## 9.1 Emission Types

| Type | Meaning |
|---|---|
| Matter emission | actual particles |
| Light emission | glow only |
| Event emission | pulse indicating threshold |
| Relationship emission | signal along link |
| Heat emission | thermal bloom |
| Memory emission | persistent trail |
| Semantic emission | state announcement |
| Debug emission | visualized cause |

## 9.2 Emission Contract

Any emission that creates particles or state must be budgeted.

```txt
rate
capacity
lifetime
energy cost
cooldown
reduced-motion behavior
accessibility fallback
```

Emission that is purely visual should be classified as render/feedback, not source physics.

## 10. Containers and Surfaces

A container is not only a layout wrapper. It can be a field region.

Container roles:

```txt
field scope
boundary
sensor
emitter
sink
screen
lens
memory region
pressure region
weather region
local cell
```

## 10.1 Container Behaviors

| Container behavior | Description |
|---|---|
| Scope | limits field participation |
| Boundary | contains, reflects, gates |
| Sensor | samples metrics |
| Screen | attenuates forces |
| Lens | bends field rendering |
| Sink | absorbs/captures |
| Emitter | produces matter/influence |
| Reservoir | stores particles/attention |
| Weather region | tracks aggregate field state |
| Local cell | isolated simulation island |

## 10.2 Container Attributes

```html
<section
  data-field-scope="local"
  data-field-role="boundary"
  data-render="particles field-lines heatmap"
  data-feedback
>
  ...
</section>
```

Potential CSS outputs:

```css
--field-density
--field-pressure
--field-weather
--field-entropy
--field-attention
--field-memory
```

## 11. Surface Materials

Forces define behavior. Materials define feel.

| Material | Behavior |
|---|---|
| glass | lens + reflect + low drag |
| rubber | spring + damping |
| liquid | cohesion + pressure |
| plasma | fieldflow + thermal + trails |
| dust | diffuse + low mass |
| metal | magnetism + reflect |
| fabric | link + shear |
| paper | low motion + memory |
| stone | high mass + low response |
| smoke | diffuse + stream + entropy |
| gel | cohesion + stretch + damping |
| mirror | reflect + inversion |
| membrane | gate + pressure |
| sponge | absorb + delayed release |

## 12. Icon and Glyph System

Icons are compact field diagrams.

A force icon should express:

```txt
source
direction
field shape
particle response
boundary condition
state change
```

Icon variables:

```txt
stroke width = strength
glow = heat
dash pattern = instability
arrow direction = flow
curve = vortex/magnetism
density = accumulation
gap = gate/screen
```

Icons can be:

```txt
inline SVG
CSS masked SVG
Canvas-rendered symbols
live text glyphs
custom vector marks
```

Avoid icon ambiguity. For magnetism, avoid implying “cartoon magnet pulls metal” unless the mode is explicitly ordinary magnet attraction. Prefer field loops and curved motion.

## 13. Image and Media Surfaces

Images, videos, and canvases can act as field surfaces.

Potential mappings:

| Media property | Field behavior |
|---|---|
| brightness | mass / density |
| contrast | field strength |
| edges | collision / emission source |
| dominant hue | category field |
| motion | velocity field |
| subject mask | body geometry |
| depth map | potential surface |

Dependency-free options:

```txt
Canvas drawImage
Canvas getImageData
manual pixel sampling
CSS masks
SVG clip paths
IntersectionObserver
```

Accessibility rule:

```txt
Media-derived visual behavior must not replace alt text, captions, or semantic description.
```

## 14. Layering and Compositing

The render stack should be explicit.

Suggested order:

```txt
1. background field wash
2. heatmaps / scalar fields
3. field lines / contours
4. particles / trails
5. relationship topology
6. DOM content
7. DOM feedback effects
8. inspector/debug overlays
```

Some experiences may place particles above DOM, but the default should protect readability.

These layers are not a single canvas. The canvas render surface owns the field washes, scalar fields, field lines, particles, and topology; SVG overlays own path-accurate relationship lines and crisp diagnostic marks; and diagnostic overlays own the inspector and debug views. The `@fundamental-engine/dom` `OverlayRegistry` registers and orders the SVG and diagnostic overlays, while the `FrameScheduler` keeps each layer on its phase (`discover -> read -> compute -> state -> write -> render`) so render surfaces never measure or mutate physics mid-frame.

The full set of render and diagnostic modes ships and is browsable at `/docs/diagnostics`: `dots`, `trails`, `links`, `streamlines`, `metaballs`, `voronoi`, `field-lines`, `heatmap`, `force-vectors`, `contours`, `potential`, `energy`, `topology`, `inspector`, `causality`, and `prediction`. None of these are planned; they are all live render surfaces over the shared field context.

## 15. Visual Semantics

Visual state should carry meaning consistently.

| Meaning | Visual channel |
|---|---|
| attention | saturation, weight, glow, scale |
| uncertainty | entropy, blur, desaturation |
| memory | patina, trail, pattern persistence |
| danger | heat, contrast, repel pattern |
| completion | coherence, alignment, calm |
| relationship | thread, tension, shared pattern |
| priority | strength, depth, larger range |
| disabled | screen, desaturation, low response |
| loading | stream, pulse, vortex |
| success | release, coherence, cooling |

## 16. Accessibility and Semantic Layer

Expressive visuals must not be the only source of meaning.

Rules:

```txt
Live semantic text remains in the DOM.
Vectorized text must be paired with hidden or equivalent semantic text.
Canvas visuals require semantic DOM fallback.
Color is not the only carrier of meaning.
Motion is optional.
Reduced motion preserves state without travel.
Field events should not spam assistive technologies.
```

Typography pattern:

```html
<h1 class="hero-title">
  <span class="sr-only">The actual accessible heading text</span>
  <svg aria-hidden="true" focusable="false">
    <!-- manipulated glyph paths -->
  </svg>
</h1>
```

## 17. Dependency-Free Implementation Rule

Core `Fundamental` should avoid dependencies.

Use platform APIs first:

```txt
Custom Elements
Shadow DOM
CSS Custom Properties
CSS transforms
CSS gradients
CSS masks
SVG paths
SVG filters
Canvas 2D
Pointer Events
Keyboard Events
Focus Events
ResizeObserver
IntersectionObserver
Web Animations API
requestAnimationFrame
```

Rules:

```txt
Do not require external libraries for core rendering.
Do not require external font parsing for standard typography effects.
Do not mutate commercial font files.
Do not make SVG/Canvas the only semantic source of text.
Do not make debug or visual layers mutate physics.
```

If an optional adapter exists, it should be outside the core.

## 18. Visual Contracts

Every visual layer should declare:

```txt
name
source metrics
target properties
whether it mutates physics
whether it writes DOM state
reduced-motion behavior
accessibility fallback
performance cost
debug visibility
```

Example:

```txt
Layer: live typography density
Source: --field-density, --field-attention
Target: font-variation-settings, text-shadow
Mutates physics: no
Writes DOM state: no
Reduced motion: unchanged
Accessibility: semantic text remains live
Performance: CSS only
```

## 18.1 Visual Binding and Overlay Registries

The `@fundamental-engine/dom` runtime makes the visual contract above operational. Two registries on the `FrameScheduler` own the visual-to-semantic boundary.

`VisualBindingRegistry` pairs each visual layer with the semantic body it expresses. A binding declares its source metrics, its target properties, and the semantic element it must stay paired with, so an expressive canvas or SVG layer is never the sole carrier of meaning. The platform lint surfaces two relevant rules here:

```txt
visual-orphan      -> a visual binding with no semantic body to pair with
visual-not-hidden  -> a decorative visual layer not marked aria-hidden / non-semantic
```

`OverlayRegistry` registers and orders the SVG and diagnostic overlays that sit above the canvas render surface, and ties each overlay to the links or relationships it visualizes. Its lint rule:

```txt
overlay-without-links -> a relationship overlay registered with no links to draw
```

Both registries run as scheduler phases (`discover -> read -> compute -> state -> write -> render`), so overlays read in the read phase and draw in the render phase and never mutate physics. `lintPlatform()` reports these rules alongside the other platform checks (`relation-target-missing`, `state-unregistered`, `feedback-non-css-var`, `measurement-off-phase`).

## 18.2 Accessibility Preview and Exported Diagnostics

The visual layers are accessibility-aware render surfaces, and the platform exposes that property directly.

An accessibility preview lets you view any composition as the reduced surface: motion stilled, glow bounded, and state preserved through static tone, outline, icon, text, or layout. This makes the "color is not the only carrier of meaning" and "reduced motion preserves state" rules verifiable rather than aspirational, by rendering the meaning-preserving fallback for a body and its visual bindings.

Diagnostic overlays can be exported as SVG or PNG. SVG export captures the path-accurate overlay layers (relationship lines, contours, field lines, vector marks) as resolution-independent geometry; PNG export captures the rasterized canvas render surface for any of the modes at `/docs/diagnostics`. Exported diagnostics are render output only: they read field state, never mutate physics, and never replace the semantic DOM.

## 19. Visual Authoring Attributes

Suggested attributes:

```html
<div
  data-visual="typography color pattern"
  data-field-material="plasma"
  data-color-mode="heat"
  data-shape-mode="pressure"
  data-pattern-mode="memory"
  data-emission="threshold"
  data-container-role="sensor"
></div>
```

Potential attributes:

| Attribute | Purpose |
|---|---|
| `data-visual` | active visual systems |
| `data-field-material` | material preset |
| `data-color-mode` | color mapping |
| `data-shape-mode` | shape mapping |
| `data-pattern-mode` | pattern mapping |
| `data-emission` | emission behavior |
| `data-container-role` | container behavior |
| `data-semantic-layer` | semantic mapping |
| `data-reduced-visual` | reduced-mode fallback |

## 20. Useful Visual Recipes

### Living Typography

```txt
density -> weight
attention -> width / glow
pull vector -> slant
heat -> emission
```

### Magnetic Logo Field

```txt
glyph outlines -> field body
magnetism -> field loops
fieldflow -> plasma travel
semantic text -> hidden accessible label
```

### Relationship Pattern Map

```txt
RelationshipAgent strength -> line weight
memory -> pattern persistence
attention -> glow
conflict -> dashed entropy
```

### Form Coherence Surface

```txt
valid fields -> coherence
invalid fields -> heat / entropy
submit button -> attention only when coherent
```

### Reading Memory Article

```txt
read paragraphs -> memory pattern
viewport center -> attention
citations -> threads
unresolved terms -> entropy
```

### Container Weather

```txt
section samples local density, heat, entropy, memory
container changes tone/pattern based on field weather
```

## 21. Implementation Priority

The platform-runtime phase (Phase D) makes this layer the default for `<field-root>`: the visual binding and overlay registries, the visual lint rules, the SVG glyph/path layer with semantic fallback, and relationship visualization all ship. The order below remains the recommended sequencing for any new visual layer built on the runtime.

Build this visual layer in this order:

```txt
1. CSS variable output contract for visual metrics.
2. Live text mapping for density, attention, heat, pull.
3. Color channel mapping with accessibility bounds.
4. Shape mapping for scale, radius, pressure, entropy.
5. Container roles and scope visuals.
6. Pattern rendering through CSS gradients and SVG patterns.
7. Emission contract and budgeted source distinction.
8. SVG glyph/path visual layer with semantic text fallback.
9. Relationship pattern visualization.
10. Material presets.
11. Visual lint rules.
12. Visual recipes.
```

## 22. Final Rule

The visual system should make field state legible without sacrificing semantics.

```txt
Visual form can become geometry.
Semantic meaning must remain accessible.
Field state can shape appearance.
Appearance must not corrupt the field.
```
