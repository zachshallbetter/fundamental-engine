# Feedback Channels

**Status:** Shipped (0.9.x). Authoritative specification. This is the canonical feedback-vars
reference — the one place the density story is told correctly.

CSS custom properties are the engine's primary output channel. The engine writes values onto
elements during the `write` phase of every frame; the page's own CSS reads them to produce
visible reactions. No polling, no event listeners, no separate state — the engine is a CSS
property writer and the page is a CSS property reader.

> **Density is one value on two variables — they are CONSISTENT.** `--d` and `--field-density`
> hold the **same** eased live-density number, written together by the feedback sink
> (`packages/core/src/core/feedback-sink.ts` — both `setProperty` off the one `ch.density`).
> `--d` is the canonical, compact working channel; `--field-density` is its namespaced twin.
> Read **either** — they never disagree.
>
> `--field-density` is **not** a "legacy alias," and neither is `--d`. There was a real bug
> (now fixed): `applyRecipe()`'s metric pipeline used to bind a recipe's `density` metric onto
> `--field-density`, overwriting the engine's live write with the host-supplied
> `data-field-density` attribute (absent → `0`), so `var(--field-density)` read `0` while `--d`
> held the value. The fix (`packages/dom/src/apply-recipe.ts` — the `ENGINE_OWNED_METRICS` set)
> **excludes `density` from the recipe metric pipeline**, so the engine's live write is
> authoritative and `--field-density === --d` on every element, recipe-driven or not. The old
> advice "prefer `--field-density`; `--d` is the legacy alias" was doubly wrong — it named the
> broken variable as primary *and* mislabelled the working one as legacy. Neither is legacy;
> both are current; use whichever reads better in your stylesheet.

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
| `--field-density` | 0 → 1 | The namespaced twin of `--d` — **the same value**, written in the same sink call. Consistent, not legacy; read either (see the density note above). |
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

## 3. The `--field-<metric>` recipe lanes — and their provenance

When a recipe declares `metric` lanes, `applyRecipe()` writes each as `--field-<metric>` on the
bound `[data-feedback]` element during the `write` phase — **alongside** (never instead of) the
engine body-feedback vars in §2. The `--field-<metric>` namespace is reserved for these lanes;
don't author custom properties into it on the same elements.

There are **nine** metric lanes (`METRIC_KINDS`, `packages/dom/src/metrics.ts`), and they split
by **provenance** — this is the engine-written vs host-supplied distinction that governs the
whole feedback surface:

| Lane (`--field-<metric>`) | Provenance | Written by |
|---|---|---|
| `--field-attention` | **computed** | The engine each frame — proximity + engagement. |
| `--field-memory` | **computed** | The engine each frame — engagement decay. |
| `--field-coherence` | **computed** | The engine each frame — from relationship resolution + age. *(Distinct from the engine-measured `--coherence` in §2, which is velocity alignment on the body.)* |
| `--field-entropy` | **computed** | The engine each frame — inferred disorder. *(Distinct from the measured `--entropy` in §2.)* |
| `--field-pressure` | **computed** | The engine each frame — relationship/age pressure. |
| `--field-recency` | **computed** | The engine each frame — interaction recency, **grounded** to world time when the body declares `data-field-at` (then `freshness(at, now, halfLife)`). |
| `--field-priority` | **computed** | The engine each frame — derived importance. |
| `--field-confidence` | **supplied-only** | The **host** — present ONLY when supplied (`data-field-confidence` / recipe option / domain model). The engine never infers it: a citation is not certainty. |
| `--field-risk` | **supplied-only** | The **host** — present ONLY when supplied. Never defaulted to `0`: "no risk" is a claim, not a safe blank. |

A third provenance class, **designed**, covers any *other* `--field-<name>` a recipe references
(e.g. `signal`, `route-strength`, `sync`): the host must supply it via `data-field-<name>`, and
with neither a supply nor a computed source the lane is **inert** — declared but never written.
`classifyMetric(name)` returns `computed` / `supplied-only` / `designed`, and the
`lintInertFeedback` rule (in `lintPlatform`) flags a binding to a designed lane the host never
supplies — the same silent-contract class as `lintSinkFeedback`.

**The rule of thumb:** if a var is engine-**written**, style off it directly. If it is
host-**supplied** (`confidence` / `risk` / any designed lane), you must feed it — reading it
without supplying it gets you the CSS fallback, never a live value.

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

**`density` is engine-owned, not a recipe lane.** Even when a recipe declares a `density`
metric, `applyRecipe()` **does not** bind it into the metric pipeline — the `ENGINE_OWNED_METRICS`
set (`packages/dom/src/apply-recipe.ts`) excludes it, so the engine's live per-frame write to
`--d` / `--field-density` stays authoritative. This is the fix behind the density note at the top:
a recipe can no longer clobber the live density value with a host attribute default.

---

## 8. Related documents

- `docs/canonical/invisible-fields.md` — the invisible-fields pattern: the two-field architecture,
  data-hot + data-active engagement, relationship edges, provenance chips.
- `docs/canonical/platform-architecture.md` — the six-phase scheduler and six registries.
- `docs/engine-reference/forces-system.md` §19 — the write phase specification.
- `apps/site/src/lib/docs-api.ts` → `WRITEBACK[]` — the live enumeration of all feedback vars.
