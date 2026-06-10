> **Status: canonical.**
> The invisible-fields pattern: running the field with **no drawn surface at all**, so its
> measurements come back as typography, ink, and anchor. Defines the third placement (after
> underlay and overlay), the two-field page architecture, the live feedback channels, the
> engagement contracts (`data-hot`, `data-active`), declared relationships
> (`data-field-relation`), and the data-provenance honesty pattern. Everything here is shipped
> and verified against code; the reference implementation is the example family at
> `apps/site/src/pages/evidence*` (twelve pages, e2e-tested in `apps/site/e2e/`).

# field-ui Invisible Fields

## Related Documents

| Document | Role |
|---|---|
| [`visualization-methods-taxonomy.md`](visualization-methods-taxonomy.md) | Surfaces & Placement (underlay / overlay) — this doc adds the third |
| [`field-ui-system-contracts.md`](field-ui-system-contracts.md) | The hard contracts (bodies, feedback, relationships) |
| [`field-ui-platform-architecture.md`](field-ui-platform-architecture.md) | The platform runtime, registries, scheduler |
| [`field-ui-agent-consumption-model.md`](field-ui-agent-consumption-model.md) | How consumers read one influence differently |
| [`field-ui-definition-document.md`](field-ui-definition-document.md) | The operating model ("substrate, not wallpaper") |

## 1. What an invisible field is

The definition document says the field is a **substrate, not wallpaper**. An invisible field is
that claim taken literally: the engine runs, bodies participate, matter flows — and **nothing is
drawn**. The only output is the feedback the platform writes back to the DOM (CSS variables,
thresholded events), and the only render surface is the page's own type and ink, styled by CSS
that reads those variables.

This is the third **placement** in the Surfaces & Placement taxonomy:

| Surface | Placement | Drawn on | Status |
|---|---|---|---|
| Underlay | behind content | the `<field-root>` canvas | shipped |
| Overlay | in front of content | a second light-DOM canvas | shipped |
| **Typographic (invisible)** | **in the content itself** | **nothing — feedback variables styled by author CSS** | **shipped** |

Two shipped mechanisms produce it:

- **Engine, draw-skipped** — `FieldHandle.setVisible(false)` keeps the full simulation and its
  feedback live while skipping all draw work (`packages/core/src/core/field.ts`). The
  `<field-root>` element wires this automatically from an IntersectionObserver, so a page that
  hides the element with CSS (`display: none`) gets a signals-only engine for free.
- **Recipe, render-less** — `applyRecipe(root, { ...recipe, render: [] }, { bodies })` runs the
  platform's metric pipeline over explicit bodies with no engine canvas at all
  (`packages/platform/src/apply-recipe.ts`).

Formalizing the first mechanism as a named engine mode is filed as
[#297](https://github.com/zachshallbetter/field-ui/issues/297).

## 2. The two-field page architecture

Every invisible-fields example page runs **both** mechanisms at once, and they are not redundant
— they write different lanes:

```txt
the PAGE ENGINE (hidden <field-root>, setVisible(false) via IO)
  real particle simulation over every [data-body] on the page
  writes: --d (live local density), --load/--mass (sink fill), --lit,
          capture/release events, field:* thresholded events
  honors: data-hot engagement (hover/focus -> the body activates,
          the spine bends to it, density gathers -> --d rises toward 1)

the SCOPED RECIPE PIPELINE (applyRecipe, render: [])
  geometric metric computation over the page's explicit record bodies
  writes: --field-<metric> for every metric the recipe declares
          (the examples extend the evidence-field recipe with "attention")
  inputs per frame: viewport-center proximity, visibility ratio,
          engaged (:hover, :focus, :focus-within, [data-active]),
          relationship resolution/conflict, host-supplied data-field-<metric>
```

A record on an example page therefore carries **four live channels** plus its server data:

| Variable | Written by | Semantics | Movement |
|---|---|---|---|
| `--w` (page-local, e.g. `--trust`) | server / page runtime | the data's normalized weight | on lens/weight change |
| `--cat` | server / page runtime | the active lens color | on lens change |
| `--d` | the page engine | live local particle density (0..1) | every frame; gathers to ~1 on `data-hot` hold |
| `--field-attention` | the scoped pipeline | eased blend of engagement + proximity + visibility | every frame; follows scroll and hover |

CSS composes them: weight drives `font-variation-settings`/opacity; the live channels drive a
glow and background lift that is **felt, not loud** — and `main[data-field="off"]` zeroes the
live channels, so "field off" is honest.

## 3. Engagement contracts

Two attributes make engagement programmable; both are shipped and verified:

- **`data-hot`** (engine) — the engine's scanner wires hover/focus listeners on `[data-hot]`
  elements at scan time; engaging one activates its body (`b.on`), bends the wave spine to it,
  and gathers matter — its `--d` rises toward 1 and eases back on release. The attribute must be
  present **at scan time** (ship it in markup; a rescan picks up late additions).
- **`data-active`** (metric pipeline) — the recipe pipeline's `engaged` input is
  `el.matches(':hover, :focus, :focus-within') || el.hasAttribute('data-active')`. Setting
  `data-active` programmatically is the sanctioned way to tell the field "this element is in
  hand": the backlog example sets it on a card for the duration of a drag (the field re-measures
  work in flight), and the fleet example holds it ~3 s on a live status change (the field
  notices the change).

Canon-doc coverage of these two attributes is the substance of
[#298](https://github.com/zachshallbetter/field-ui/issues/298); this section is that
documentation.

## 4. Declared relationships

The RelationshipRegistry discovers native graph semantics (`a[href^="#"]`, `label[for]`,
`aria-controls/-describedby/-labelledby/-flowto`) and one declarative form:

```html
<!-- one edge per element: type + id-ref target (+ optional data-field-strength) -->
<span hidden data-field-relation="supports" data-field-target="#finding-W1480"></span>
```

A body **contains** its declaration elements, so a record can declare many edges through hidden
child spans. The metric pipeline counts, per body, the touching relationships that resolve
on-page versus those declared-but-unresolved — that ratio is what `--field-coherence` reads.
The evidence example renders its real citation edges this way: the same edges its hover threads
draw are the graph the platform measures, and connected findings read `--field-coherence: 1.000`
while unconnected ones read `0.000` (verified live).

## 5. Conditions in the page: the reading-pace gate

`--field-scroll-v` on `:root` is the engine's eased scroll velocity (px/frame; written by the
platform write phase, deduped when unchanged). The invisible-fields pages use one shared
condition built on it — **reading pace** (`< 2.0`) — to gate progressive behavior:

- the evidence page's deferred-batch reveal (plus a sink-charge short-circuit: a sentinel
  `data-body="sink"` whose engine-written `--load` can pre-empt the dwell),
- chart entry animations (sparkline dash draw-ins, bar sweeps, card staggers) — applied
  instantly, without animation, when the user is scanning fast or prefers reduced motion.

The unit is px/frame at the display refresh rate (refresh-rate dependent; see the API note in
`scripts/api-surface.data.mjs` — it may normalize to px/ms before 1.0).

## 6. Data honesty: snapshots, provenance chips, cadence

The examples run on real data with a strict provenance contract:

- **The committed snapshot is the baseline.** Every page ships a committed JSON snapshot
  (`apps/site/src/data/examples/`, regenerated by `apps/site/scripts/snapshot-examples.mjs`,
  refreshed weekly by `.github/workflows/snapshots.yml`). It is the SSR baseline and the no-JS
  truth; builds are deterministic.
- **Pages upgrade themselves and say so.** A provenance chip states the mode:
  `live · checked Ns ago` after a successful refresh, `snapshot · <date>` before one or after
  failures. Client-diverged state is marked (`(local)` on the triaged backlog;
  `+N since snapshot` on refreshed citation counts). A page that can prove it is not lying is a
  feature, not a caveat.
- **Cadence matches the source's real update rate.** 60 s for markets and fleet status, 5 min
  for the question feed (API backoff honored), **once per visit** for daily/weekly aggregates —
  polling a daily aggregate would be theater, and the pages say so in their how-built sections.
- **The plumbing is shared.** `apps/site/src/lib/live-data.ts`: `politeLoop` (skips hidden tabs
  but **owes** the skipped attempt and catches up on `visibilitychange`; retires after 3
  consecutive failures; cleans up on the page's AbortController) and `wireLiveChip` (the chip
  contract above). Failures are silent by design — the page keeps its snapshot.

## 7. The family (reference implementations)

Twelve pages at `/evidence` and `/evidence/<slug>` (roster:
`apps/site/src/lib/invisible-fields.ts`); each demonstrates a distinct capability, and the
layout itself embodies the concept:

| Example | Geometry | Demonstrates |
|---|---|---|
| Evidence | weighted list | trust as mass; declared relationships → live coherence; batched live refresh |
| Inbox | focus split | **conserved attention** — Σw is exact through pin/unpin/arrivals; live arrivals enter the field |
| Market | cap-weighted mosaic | mass is *area*; polarity lens; 60 s live polling; visual-bound sparklines |
| Backlog | two-lane board | hand-rolled pointer drag; `data-active` engagement in flight; sink-backed cycle capacity; local-honesty markers |
| Calendar | day / week / month | time itself as the field input (1 Hz imminence ramp); same bodies, three geometries |
| Threads | indented tree | binding chains; subtree collapse with honest hidden counts |
| Dependencies | graph strip + list | causality spill along real `usedBy` edges; staleness decay |
| Fleet | grid + timeline | sink capture/release as incident accretion; live status diffing with `data-active` pulses |
| Catalog | shelf grid | the evidence trust formula retargeted; shared-subject affinity |
| Library | ranked bar ladder | a real sink-backed queue (engine `--load`) that fills and releases |
| Memory | word-card grid | decay (forgetting curve) vs. anchoring; localStorage persistence |
| Newsroom | newspaper front page | placement as encoding; rebuilds itself to the latest edition |

The page-level lesson, stated on the calendar example and true of all twelve: **the field does
not care about the layout; it measures whatever geometry you give it.**

Their invariants are pinned by the e2e suite (`apps/site/e2e/` — 8 specs, 21 tests, network
blocked to non-localhost so pages hold their snapshots), run in CI on PRs touching the site or
packages.

## 8. What the pattern earned the platform

Building twelve pages against the contracts above surfaced the platform's next API work, filed
and boarded: [#295](https://github.com/zachshallbetter/field-ui/issues/295) a platform FLIP
helper (every runtime hand-rolls the same reflow), [#296](https://github.com/zachshallbetter/field-ui/issues/296)
`allocateAttention()` (the inbox's exact conserved water-filling belongs to the engine's
attention concept), [#297](https://github.com/zachshallbetter/field-ui/issues/297) a named
signals-only engine mode, [#299](https://github.com/zachshallbetter/field-ui/issues/299) a
mobile/touch QA pass.
