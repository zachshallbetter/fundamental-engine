# Feedback Channels

**Status:** Shipped (0.8.x). Authoritative specification.

CSS custom properties are the engine's primary output channel. The engine writes values onto
elements during the `write` phase of every frame; the page's own CSS reads them to produce
visible reactions. No polling, no event listeners, no separate state — the engine is a CSS
property writer and the page is a CSS property reader.

> **Correctness note (v0.8.0):** `--d` is the reliable live-density channel. `--field-density`
> is an alias of `--d` on the element — but `applyRecipe()` writes `--field-density` separately
> as a recipe-metric output, so on elements running a recipe, `--field-density` reflects the
> recipe's density output, not the engine's raw particle density. **Drive reactions off `--d`.**
> This is documented so the wrong advice ("prefer `--field-density`; `--d` is legacy") cannot
> silently re-enter the docs.

---

## 1. Channel types

There are three categories of engine-written CSS properties:

| Category | Where written | Driven by |
|---|---|---|
| **Body feedback** | `[data-feedback]` elements | Engine per-body particle density |
| **Recipe metric** | `[data-feedback]` elements | Declared recipe metric pipeline |
| **Environment / root** | `:root` | Scroll state, global field presence |

---

## 2. Body feedback channels

Written on every element carrying `[data-feedback]`, every frame:

| Variable | Range | Semantics |
|---|---|---|
| `--d` | 0 → 1 | Live local particle density gathered around this body, eased. **The canonical reaction variable.** Rises toward 1 when a `data-hot` body is held; eases back on release. |
| `--field-density` | 0 → 1 | Namespaced alias of `--d`. Prefer `--d`; see correctness note above. |
| `--field-heatmap-density` | 0 → 1 | The heatmap ambient density *under* this body — where matter pools around it globally, distinct from the body's own `--d`. Only present when the heatmap overlay is active. |
| `--load` | 0 → 1 | A sink body's accretion fill fraction. 0 = empty, 1 = saturated. Written when the body has `data-absorb`. |
| `--mass` | 0 → 1 | Back-compat alias of `--load`. Prefer `--load`. |
| `--lit` | 0 → 1 | Spillover-lit density when a saturated neighbouring sink bleeds density across a boundary (causality). |
| `--entropy` | 0 → 1 | Local disorder — velocity-direction dispersion, gated by agitation. Distinct from the platform-inferred `--field-entropy` recipe lane. |
| `--coherence` | 0 → 1 | Local order (= 1 − entropy; velocity alignment). Numeric value — not the `--coherence` palette colour on `:root`. |
| `--temperature` | 0 → 1 | Local agitation — half mean heat, half normalised kinetic energy. |

**Enabling feedback on an element:**

```html
<!-- add data-feedback to receive the engine's CSS-var writes -->
<article data-body="attract" data-feedback>
  The field is around me.
</article>
```

Without `[data-feedback]`, the engine scanner does not register the element as a feedback
target and the vars are never written onto it.

---

## 3. Recipe metric channels

When a recipe pipeline runs against a body, it writes its declared metric lanes:

| Variable pattern | Written when | Example |
|---|---|---|
| `--field-<metric>` | The recipe declares a `metric` key | `--field-attention`, `--field-trust`, `--field-coherence` |
| `--field-entropy` | Recipe declares `entropy` metric | The platform-inferred lane; distinct from engine `--entropy` |

These are written by `applyRecipe()` during the `write` phase, alongside (not instead of) the
engine body-feedback vars above. The `--field-<metric>` namespace is reserved for recipe
outputs; don't put custom CSS properties in this namespace on the same elements.

---

## 4. Environment / root channels

Written on `:root` by the platform's write phase:

| Variable | Semantics |
|---|---|
| `--field-scroll-v` | Eased scroll velocity (px/frame). Used to gate conditions (`< 2.0` = reading pace). Updated every frame; deduped when unchanged. |
| `--field-presence` | 1 when the page field is active, 0 when it is paused (backgrounded tab, reduced motion). Use to fade field-only decorations gracefully. |

---

## 5. Consuming feedback — patterns

### 5a. The amplification pattern

`--d` is a fraction in [0, 1] — small by design. Scale it before driving visual properties:

```css
[data-feedback] {
  /* scale the raw fraction into a usable 0..1 range with a hard ceiling */
  --d-amp: clamp(0, calc(var(--d, 0) * 12), 1);
}

.hero-mass {
  /* react off the amplified value, not the raw fraction */
  transform: translateY(calc(var(--d-amp) * -8px));
  opacity:   calc(0.4 + var(--d-amp) * 0.6);
}
```

Don't bake the magic-12 amplifier into every consumer — keep it in one `[data-feedback]` rule
so tuning it in one place tunes every reaction.

### 5b. Sink fill

A sink body with `data-absorb` and `data-max` exposes `--load`:

```html
<div data-body="sink" data-absorb data-max="40" data-feedback></div>
```

```css
.queue-indicator::after {
  content: '';
  width: calc(var(--load, 0) * 100%);  /* grows as the sink fills */
  background: var(--accent);
}
```

### 5c. Reading-pace gate

Gate a progressive behaviour on slow scroll (the reading-pace condition):

```css
/* hide ambient glow while scrolling fast; reveal it only at reading pace */
.ambient-glow {
  opacity: 0;
  transition: opacity 0.4s;
}

@supports (animation-timeline: scroll()) {
  .ambient-glow {
    /* the field writes --field-scroll-v on :root every frame */
    opacity: calc(max(0, 1 - var(--field-scroll-v, 99) / 2));
  }
}
```

Or in markup with `data-when` (engine-evaluated):

```html
<div data-body="attract" data-when="slow">
  <!-- this force only activates at reading pace -->
</div>
```

---

## 6. The data-feedback requirement

Only elements with `[data-feedback]` receive per-body CSS-var writes. This is by design:
writing CSS properties on every `[data-body]` would be expensive at scale.

**Common mistake:** adding `data-body` and expecting `--d` to arrive — it won't without
`[data-feedback]`. The lintPlatform check (`pnpm check:cem`) catches the missing attribute.

A body can be a force source (`[data-body]`) and a feedback receiver (`[data-feedback]`) on
the same element, or they can be separate elements in the same region:

```html
<!-- one element: source + receiver -->
<article data-body="attract" data-feedback></article>

<!-- two elements: force source + a sibling feedback receiver -->
<section>
  <div data-body="attract"></div>
  <div class="glow" data-feedback></div>  <!-- gets --d from the section's local density -->
</section>
```

---

## 7. Platform vs engine writes — the split

| Written by | Source | Cadence |
|---|---|---|
| Engine (core) | Particle density computation | Every frame (frame-rate) |
| Platform (dom) | `[data-feedback]` write registry | Every frame, write phase only |
| Recipe pipeline | `applyRecipe()` metric lanes | On recipe apply + body re-measurement |
| Root platform | Scroll velocity, field presence | Every frame, deduped |

The six-phase scheduler enforces the split: the `write` phase happens after `compute` and
`state`, so CSS properties are always written from a stable, post-simulation snapshot.

---

## 8. Related documents

- `docs/canonical/invisible-fields.md` — the invisible-fields pattern: the two-field architecture,
  data-hot + data-active engagement, relationship edges, provenance chips.
- `docs/canonical/platform-architecture.md` — the six-phase scheduler and six registries.
- `docs/engine-reference/forces-system.md` §19 — the write phase specification.
- `apps/site/src/lib/docs-api.ts` → `WRITEBACK[]` — the live enumeration of all feedback vars.
