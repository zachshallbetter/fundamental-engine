> **Status: legacy / superseded.**
> Preserved for design history. The current architecture is governed by the canonical docs ([../canonical/](../canonical/)) and @field-ui/platform; do not treat this as the current implementation.

# field-ui — what it is

> **Elements bend the field; the field bends them back.**

*For the current model, see the canonical definition ([../canonical/](../canonical/)): field-ui is a platform-native relational field runtime for the DOM — @field-ui/core computes renderer-agnostic field behavior and @field-ui/platform binds it to the DOM (measurement, state, feedback, relationships, visual bindings, overlays, scheduling). The single-canvas, zero-dependency framing below is the original narrow pitch.*

Most "particle background" effects are wallpaper: a pretty animation that sits
*behind* your page and ignores it. **field-ui is the opposite.** It's a single
physical field that your interface lives *inside* — where the words, links, and
cards on the page are real bodies with mass, and the field reacts to them while
they react to it.

It runs on one `<canvas>`, has **zero runtime dependencies**, and you opt elements
in with plain HTML attributes — no framework required.

---

## The one idea: reciprocity

The whole system is one loop with two halves.

**Element → Field.** Any element you tag becomes a *force*. It pushes, pulls,
swirls, or captures the particles around it. The layout of your page literally
shapes the motion of the field.

**Field → Element.** Wherever particles gather, that element gains **weight, glow,
and pull**. The density the field collects on a word is written back as a CSS
variable (`--d`), so the word can thicken and light up. The field shapes the
layout in return.

Neither side is decoration. Hover the word **"mass"** on the home page: it pulls
particles in, they pile up on it, and the pile makes the word heavier and brighter
— a closed loop you can feel.

---

## Anatomy of a body

You turn any element into a force by adding attributes. No JavaScript:

```html
<a data-body="attract"
   data-strength="0.9"      <!-- how hard it pulls           -->
   data-range="320"         <!-- how far its reach extends    -->
   data-color="#4da3ff"     <!-- its accent colour            -->
   data-feedback            <!-- gain weight/glow from density -->
   data-when="hot">…</a>     <!-- only act when a condition holds -->
```

| Attribute | What it does |
|---|---|
| `data-body` | the force(s): `attract` · `repel` · `swirl` · `stream` · `viscosity` · `jet` · `tether` · `wall` · `sink` (they compose) |
| `data-strength` | force magnitude |
| `data-range` | influence radius, in px |
| `data-color` | the element's accent (and the colour of any sparks it sheds) |
| `data-feedback` | opt into the field → element write-back (`--d` density) |
| `data-when` | a gate: act only when `fast` / `slow` / `hot` / `cool` / `active` / `scrolling` |

Nine forces, each a verb. Compose them on one element (`data-body="sink attract"`)
and it pulls matter in *and* swallows it.

---

## Nothing is created from nothing

The field obeys one law: **captured = released.** Particles are pulled in, held,
torn loose, and reclaimed — but never spawned or destroyed in the steady state. An
absorber *holds* matter and, when it's full, releases exactly what it held (a
supernova). That conservation is why the field feels alive rather than like a
screensaver: every motion came from somewhere.

---

## A note on words

Don't build words out of particles — assembled letterforms read rough. **Words get
effects *around* them** instead: glow and growth from gathered density, a ripple or
bend of the field, a brighter pull on hover. Save particle *assembly* (matter
forming a shape) for **punctuation, marks, and logos** — a period, a dash, an icon —
where a simple silhouette stays clean.

---

## What you can build

- **Type that has real weight** — headings that thicken and glow as the field
  collects on them.
- **A reciprocal hero** — a word you can disturb and watch settle back.
- **Sets that wire themselves** — hover one item and glowing threads connect it to
  its siblings; a list reveals itself as a system.
- **A field that drives behaviour** — `data-on="dense:field:lit"` fires a real
  DOM event when matter piles up, so the field can change app state, not just
  pixels.
- **Elements the field can move** — cards nudged by forces, springing back to home.
- **The field as the page's mood** — its colour travels through the palette as you
  scroll; each section reconfigures the motion underneath you.

---

*field-ui is pre-alpha and building in the open. The full developer specification
lives in [`forces-system.md`](../engine-reference/forces-system.md); the roadmap and the wider idea
space are in [`forces-possibilities.md`](forces-possibilities.md).*
