# Changelog

All notable changes are documented here, following
[Keep a Changelog](https://keepachangelog.com) and [SemVer](https://semver.org).
The packages are published to npm under the `@fundamental-engine` scope; each release is also cut as
a git tag (see [RELEASING.md](RELEASING.md)).

## [Unreleased]

## [0.8.0] — 2026-06-20

### Added

- **`gridWarp` — distortion multiplier for the `grid` overlay (core).** The `grid` overlay (the
  reference lattice displaced by the field) deflects each node by a deliberately-legible amount; the new
  `gridWarp` FieldOption scales that deflection so the deformation reads more strongly (`1` default;
  `2`–`3` exaggerates it for demos; `0` flattens the lattice). Exposed as `<field-root grid-warp>` and
  documented in the options reference. Additive — the frozen API surface is unchanged.

- **`wall` sparks in the body's own colour (core).** A kinematic `wall` already throws a spark on a hard
  impact (§6.4); it now sparks in the body's `data-color` tint when it carries one (falling back to the
  canonical wall hue), so a tagged container's impact flash matches its tag-tint. One-line change to the
  `wall` force; existing spark/bounce tests unchanged.

- **Tag-tint — particles wear their nearest tag's colour (core).** Every body that carries a colour
  (`data-color`) now stains the swarm toward its tint at render time, by proximity — a *pervasive*
  companion to the overlap-only `pigment` force, so a particle near a tagged body reflects its hue even
  on a sparse field (nearest-strongest wins, linear falloff to ~1.4× the force range; pigment still
  layers on top for advected streaks). Automatic — no markup beyond `data-color`.
- **Scroll-position heatmap fade (core).** The density heatmap now fades out as the page scrolls past
  the hero (≈ the first viewport) — a smooth, MONOTONIC function of scroll position, so unlike the
  earlier velocity-based suppression it never pops/flickers. Below the hero the whole layer is skipped
  (no texel recompute, no upscale), confining the at-rest heatmap cost (#409) to where it's focused.

- **`lintFeedbackWritesUnread` — the producer half of the feedback-contract lint (dom).** Closes the
  recurring "charged but reads nothing" bug class (#411): a `data-feedback` body gets `--d`/`--load`/
  `--field-*` written every frame, but if no style rule reads them it changes invisibly. The existing
  `lintFeedbackVarReads` caught the inverse (reads-without-writes); this catches writes-without-reads by
  walking the document's accessible stylesheets for var consumers and warning for any `data-feedback`
  body matched by none. Dev-only/heuristic — no-ops under SSR/tests/cross-origin sheets, and lenient
  (strips pseudo-selectors) so it under-reports rather than false-positives. Wired into `lintPlatform`.

### Changed

- **Warm default palette (core).** The free-particle heat ramp (`COOL`/`WARM` in `math.ts`) and the
  Currents' wave baseline (`WAVE_RGB` in `field.ts`) shift from the cool blue/teal/purple baseline to a
  warm one (`COOL [255,224,200]` / `WARM [255,110,80]`; waves `#ff8a5c`/`#f0628e`/`#ffc46b`). The
  energized **accent** is unchanged and still overridable per field (`accent` / `palette` / `setAccent`),
  so the look is warm ambient matter under cool-accent highlights. This is the engine's default identity
  now; the wave baseline and ramp ends remain hardcoded (no per-field override yet — tracked separately).
  The Swift port is brought to parity in a follow-up so the planes don't diverge.

- **Overlay arrows resample on a cadence (core perf).** `drawOverlayArrows` (the in-front
  `streamlines`/`force-vectors` Field-Surfaces reading) rebuilt its whole force-vector grid every
  frame — the same per-frame regrid waste the underlay shed in #406. It now resamples every 3rd frame
  (or when its cache is empty / a flow focus is live) and draws from the cache every frame, so the
  arrows never flicker or step. Matches the underlay `slSamples` pattern; `accent` is still read every
  frame so `setAccent` recolors immediately. (#412)

### Fixed

- **`<field-root dpr-cap>` rejects non-finite values (elements).** The `dprCap` getter now guards with
  `Number.isFinite` like `density`/`depth`, so `dpr-cap="Infinity"`/`"NaN"` fall back to the engine
  default instead of feeding a bad backing-store DPR downstream.
- **Removed the non-functional `root` option from `FieldLayerOptions` (three).** The `FieldLayer` class
  scans its mesh-body registry, so the DOM `[data-body]` scan root was silently discarded (`void root`).
  It's gone from the type; the lower-level `createThreeField({ root })` builder still honours it.
- **Corrected the `ParticlePool` staging-buffer stride comment (three)** — it read "stride-4 `[x,y,heat,size]`"
  but the buffer is stride-5 `[x, y, z, heat, size]`, matching `readParticles`.


- **Bodies track scroll between re-measures — no more swarm "pause" on scroll (core).** Body centres are
  re-measured (`getBoundingClientRect`) only every 6th frame, but the page scrolls continuously under the
  fixed field — so during a scroll each attractor's force-centre snapped in 6-frame steps and the swarm
  read as pausing/stuttering. The cached centres are now translated by the per-frame scroll delta between
  measures (`b.cy -= dScroll`), which carries the shaped box too (it's centred on `cy`); `measureBodies`
  still refreshes from the real rects on its cadence, so there's no drift. Verified: sampled body force at
  a fixed point changes every frame through a scroll (plateau fraction 0, was ~0.83).


- **Post-0.7.0 integrity sweep.** The release workflow's post-publish smoke + provenance checks no
  longer install the retired `kit`/`fundamental-engine` umbrellas (that mismatch is why the 0.7.0 run
  reported failure even though all 7 packages published); the version-match gate now skips private
  packages. Doc corrections: `api-stability.md` no longer promises a `forces-*` alias window that the
  hard rename removed (only `forces:*` events survive); the root README + `RELEASING.md` + the retired
  umbrella READMEs drop install instructions for unpublished packages; `elements` README `dom` links
  point at `../dom`; stale "35 forces" counts fixed (authoritative is 36); the `addField` JSDoc no
  longer implies the engine consumes channels internally. Test hardening: `BodyHandle.set` color +
  range/angle/spin coverage, and a reverse option-drift guard that would have caught the original
  `depth` drop.

### Internal

- **`check:dist` now smoke-tests all 7 published packages** — it had drifted to the pre-0.7.0 set and was
  omitting `dom` and `three` (validating only the deprecated `platform` alias).
- **`check:links` now validates cross-file `#fragment` anchors** against the target doc's headings
  (GitHub slug rules), catching the section-rename → rotted-link class. Same-file ToC anchors stay out of
  scope (they follow the site renderer's slug convention, not GitHub's).
- **Site home-runtime hygiene:** the drag `pointermove`/`pointerup` listeners now bind to the page
  AbortSignal (no orphan on navigate-mid-drag), and the gallery readout reads the engine's inline
  `--field-density` write instead of calling `getComputedStyle` every animation frame.

### Site

- **A `/changelog` page — "what's new", on the site.** Recently-shipped highlights over the full,
  versioned log, rendered at build time straight from this `CHANGELOG.md` (single source of truth). A
  version badge in the nav links to it.
- **Homepage content pass.** Sharpened the copy to explain the point over the spectacle (the AI-trust
  section, the install story), de-jargoned the install language, and added the `0.x preview` maturity
  signal to `/eli5`. Tightened the narrative by cutting three Gallery beats that re-demoed earlier
  chapters (the live experience keeps its full length; only the redundancy is gone).
- **Wayfinding — every concept leads to its reference.** Each manual chapter now links to its canonical
  doc, and all 36 forces deep-link to their exact entry in the force catalog. Added a "pick your
  package" decision path to the docs and two worked accessibility examples (reduced-motion CSS, the
  `aria-hidden` visual-binding pattern).

### Documentation

- **Docs accuracy sweep.** Audited all 86 docs + package READMEs against the code. Corrected the force
  count to **36** where docs drifted (9 canonical + 19 extended + 8 natural; `forces-engine.md`,
  `research/01`); fixed package READMEs (`react`/`vanilla` `../platform` links → `../dom`, `three` CDN
  example `@0.3.1` → `@0.7.0`); reconciled `RELEASING.md`/`PUBLISHING.md` to **six** published packages at
  **0.7.0**; removed a false `compat-*` package claim; split the shipped `warp` atom from the spec-only
  `wormhole` preset; fixed the `pheromone`→`diffuse` token name; repaired broken `docs/...` cross-paths;
  committed the load-bearing RC/1.0 gate spec and removed stale `docs/planning/` duplicates; added a
  table of contents to `forces-system.md`.

## [0.7.0] — 2026-06-17

### Breaking

- **`@fundamental-engine/platform` → `@fundamental-engine/dom`.** The package is the DOM-binding layer
  (`browserHost`, the six registries, the frame scheduler, `lintPlatform`, `bindData`) — `dom` is the
  honest name. `packages/platform` moved to `packages/dom`; all internal references updated.
  **Migration:** change `@fundamental-engine/platform` → `@fundamental-engine/dom` in your imports.
  `@fundamental-engine/platform` continues to publish as a thin **deprecated alias** that re-exports
  `dom` (with a console deprecation notice), so existing imports keep working for now — but it will be
  removed in a future release. Pin to `~0.7` and migrate when convenient.
- **Umbrella packages retired.** `@fundamental-engine/kit` and `fundamental-engine` are no longer
  published. Install the specific `@fundamental-engine/*` package(s) you need (`core` is the engine;
  `dom` / `elements` / `react` / `vanilla` / `three` are the surfaces). They added an indirection
  without earning it, and the unpublish/republish churn around them caused real incidents.

### Fixed

- **Force-availability accuracy (docs/comments).** Corrected the misleading `// … opt-in` comments on
  `registerNaturalForces`/`registerExtendedForces` in `field.ts` — all **36** forces are registered on
  every field (the natural and extended sets are *not* opt-in; activate any per-body via its
  `data-body` token). Fixed stale "34"/"35" force counts in the core guide and force-glyph styles.

## [0.5.1] — 2026-06-17

### Added

- **`FieldHandle.addField(name, sampler)` + `sampleField(name, x, y)` — open input-channel registry
  (core).** The render surfaces (`setRender`/`setOverlay`) are bundled *output* layers; this is their
  *input* mirror: register an external scalar field — terrain height, soil moisture, a heat map — as a
  pull-based sampler `(x, y) => number` and read it back through `sampleField`, so a consumer queries
  **one** field instead of bolting a parallel grid alongside it. Returns a `FieldChannelHandle` to swap
  the sampler live or remove the channel. Pull-based (never cached). Force coupling — a force reading a
  channel as a potential — is a separate, opt-in follow-up; this is the read substrate. Mirrored on
  vanilla / elements / three; additive.
- **`BodyHandle.set({ strength, range, angle, spin, color })` — reactive params for programmatic
  bodies (core).** `addBody`'s handle gained the live setter the three `FieldBody` already had: mutate a
  body's force params within a frame on the measure cadence, with no `rescan()` and no remove + re-add
  (a fading lure, a fox getting hungrier). `color` re-tints the carried pigment; a *structural* change
  (different `tokens`) still needs remove + `addBody`. Additive.
- **`FieldOptions.dprCap` + `FieldHandle.setDprCap(cap)` — a configurable render-resolution ceiling
  (core).** The field rendered at full `devicePixelRatio` (hard-capped at 2), the dominant fill-rate
  cost on retina — and the ambient field is soft, so it doesn't need 2× crispness. `dprCap` (default 2)
  caps the backing-store DPR: the effective DPR is `min(devicePixelRatio, dprCap)`, so ~1.5 buys ~1.8×
  fill headroom for a small softening. Settable at creation (`createField({ dprCap })`), at runtime
  (`setDprCap`, re-sizes immediately), and as `<field-root dpr-cap>` (live). Mirrored on vanilla /
  elements / react; additive. (#410)
- **`FieldHandle.addBody(spec)` — first-class programmatic bodies (core).** The only sanctioned way to
  make a body was the `[data-body]` DOM scan, so a non-DOM host (`@fundamental-engine/three`, a native
  view) had to duck-type a fake element + a fake `querySelectorAll` root (#393/#418). `addBody(spec)` is
  the real API: `{ tokens, strength?, range?, spin?, angle?, color?, rect, data?, onFeedback? }`, where
  `rect()` is sampled each frame for the body's box in field px. Two riders from the Field Agent
  Consumption Model: the body **carries a `data` record** (the Body-level analog of a particle's atom)
  and takes **per-body feedback** (`onFeedback` — its channels demultiplexed from the global sink). It
  persists across `rescan()`. Returns a `BodyHandle` (`data`, live `channels`, `remove()`). Mirrored on
  vanilla / elements / three (overloaded with three's mesh form). Additive. (#419 — three's
  `FieldBodyRegistry` collapse onto `addBody` is the remaining follow-up.)

### Fixed

- **`<field-root>` now forwards `FieldOptions.depth` (elements).** `<field-root depth="40">` was a
  no-op — `depth` had no attribute, getter, or forwarding, though core/react/vanilla/three all support
  it. Added the attribute + getter + forwarding, and table-drove `start()`'s option object from one
  `OPTIONS` source so an option can't be silently dropped again; a drift-guard test pins
  `observedAttributes` to that table.
- **`@fundamental-engine/elements` npm metadata corrected.** The package description and README named
  the pre-rename `<forces-field>` / `<forces-cell>` tags, which aren't registered (the rename left no
  aliases). Corrected to `<field-root>` (also registered as `<field-field>`) and `<field-cell>`.

### Removed

- **`setSurfaces` / `getSurfaces` / `SurfacePlan` and `readParticleColors` — pulled before shipping.**
  A design review found both were the rigidity they were meant to solve: `setSurfaces` is a fixed-key
  struct where an open `registerOverlay` registry belongs (the output mirror of `addField`), and
  `readParticleColors` is a half-feature with no consumer. Both were unreleased, so this is **not** a
  breaking change. `setRender`/`setOverlay`/`setHeatmap` and `readParticles`/`readParticleIds` are
  unchanged.

## [0.5.0] — 2026-06-14

### Fixed

- **`@fundamental-engine/three` samplers — EMA-smoothed vector field + core field-line tracing.**
  `vectorField` normalized its arrows by the raw per-frame peak magnitude, so every arrow jittered as a
  transient (a dragged body, an animated strength) shifted the peak frame to frame; it now eases the
  peak (up fast, down slow — the core "pulsing lesson"), so the field reads as a calm pulse (#422).
  `traceStreamline` (the streamline-tube path) re-walked the field forward-only; it now delegates to
  core's `traceFieldLine` — bidirectional (the seed sits mid-line), loop-closing, with a turn budget so
  a vortex can't wind the whole step budget into one circle (#421).

### Added

- **`FieldHandle.readParticleIds(out)` + `Particle.id` — stable per-particle identity (core).** Pooled
  particles were anonymous, so a host couldn't track a specific one across frames (a wind-borne seed,
  a tagged mote) or keep payload attached to it through readback. Each particle now carries a stable
  monotonic `id`, and `readParticleIds(out)` copies them into a caller `Uint32Array` parallel to
  `readParticles` (same order, same agent exclusion) — so `ids[i]` is the identity of the particle at
  stride offset `i*5`. The engine carries the identity; the host keeps its own opaque payload keyed by
  id (spec FieldUI-Engine-Features §1.3). Zero-allocation, read-only. Mirrored on vanilla / elements /
  three; additive — `Particle.id` is optional for back-compat (the engine always sets it).

### Added

- **`FieldHandle.on(type, cb)` — a host-agnostic discrete event bus (core).** The engine emitted
  continuous feedback channels (`density`/`load`/…) but no discrete *occurrences*, so a non-DOM host
  (3D/native/headless) had to poll state every frame to know when something happened. `on(type, cb)`
  delivers occurrences as plain-data push (no DOM, distinct from the `data-on` CustomEvent bindings),
  returning an unsubscribe. First events: **`absorb`** / **`release`** — a `sink` body captured / let
  go of matter (the rising / falling edge of accretion), `{ body, count }`. Detection is lazy — a type
  with no listener costs nothing. (`contact`, `settle`, and per-particle `enter`·`exit` are the next
  slice, #441.) Mirrored on vanilla / elements / three; additive to the (unfrozen) handle.

### Added

- **`FieldHandle.grid(name)` — host-authorable scalar grids (core).** The engine's field-buffer
  primitive (the uniform scalar grid `diffuse` / `memory` / `propagate` run on) is now a public
  surface, so an application can lay down and read its own fields the simulation composes with: a scent
  map, a wear/desire-path layer, a goal-attractor field. `grid(name)` returns a `ScalarGrid` with
  `deposit(x,y,amount)` / `sample(x,y)` / `gradient(x,y)` (forage-by-gradient on an authored field) plus
  the new `decay(rate)` / `clear()`. It is created on first access (allocating nothing until then), kept
  viewport-sized, and advanced once per frame by the mode inferred from its name (`wave…` = wave scheme,
  `memory…` = slow decay, else diffuse). A force of the same name shares the buffer, so a host can read
  what a force writes (and vice versa); a distinct name keeps an authored field independent. Mirrored on
  vanilla / elements / three; additive to the (unfrozen) handle and to `ScalarGrid`.

### Fixed

- **React adapter forwards the full `FieldOptions`.** `<FieldField>` and `useFieldField` destructured
  only 10 of the engine options and silently dropped `depth`, `heatmap`, `overlayBackend`, `rng`, `now`,
  and `feedbackSink` — so `<FieldField heatmap depth={120} />` did nothing. All `FieldOptions` are now
  forwarded to `createBrowserField` in both the component and the hook (declarative ones drive
  recreation via the dep list; the determinism/feedback seams forward but stay out of deps). (#468)

### Added

- **Adapter type re-exports.** `@fundamental-engine/{vanilla,react}` now re-export `AgentSpec`,
  `AgentHandle`, `AtomPayload`, `FeedbackSink`, and `FeedbackChannels` (and vanilla re-exports the
  `cssFeedbackSink` value), so consumers using `field.addAgent(...)` / `field.atomAt(...)` / a custom
  feedback sink don't have to import the types from `@fundamental-engine/core` separately. (#469)

### Added

- **`FieldHandle.sampleGradient(x, y)` — the analytic gradient of the density field (core).** The
  companion `sampleScalar` shipped without a gradient, so callers finite-differenced it — and sampled
  too close in, that re-introduces the exact flattening-at-a-source the scalar exists to avoid (the
  failure that forced foragers back onto explicit seek points). `sampleGradient` returns the `{x, y}`
  direction + steepness (1/px) of increasing density straight off the same diffused heatmap grid
  (central difference, normalized by the eased peak), so it stays non-degenerate at a source: add it to
  a heading to climb toward matter, negate it to flee crowding. Requires the heatmap layer
  (`createField({ heatmap: true })` / `setHeatmap(true)`); returns `{ x: 0, y: 0 }` when off or empty.
  Pure, read-only, maintained under `render: 'none'`. Mirrored on vanilla / elements / three; additive
  to the (unfrozen) handle. (Swift port tracked under #423.)

### Changed

- **Documentation rebrand: `field-ui` → Fundamental, completed.** The #428 code rebrand renamed the
  published packages to `@fundamental-engine/*` but left the docs on the intermediate `field-ui` name.
  This finishes it: ~845 prose/token occurrences swept (`field-ui` → Fundamental, `@field-ui/*` →
  `@fundamental-engine/*`) across `CLAUDE.md`, `docs/canonical`, `docs/research`, `docs/engine-reference`,
  `docs/planning-archive`, code comments, scripts, and the Swift port; the 13 canonical docs lose their
  `field-ui-` filename prefix (e.g. `field-ui-natural-fields.md` → `natural-fields.md`) with every
  reference updated. The original `forces-ui` / `@forces-ui` names, the CHANGELOG/MIGRATION history, and
  the README lineage note are preserved as historical record. No runtime behavior change.

### Fixed

- **Stale `@forces-ui` / `forces-ui` alias claims removed.** #428's hard rename removed the `@forces-ui/*`
  compat packages and the `ForcesField` / `useForcesField` API aliases (the test suite asserts their
  absence), but several docs still described them as live: `platform-architecture.md`
  ("compatibility alias packages re-export…"), `forces-engine.md` ("`@forces-ui/*` are deprecated
  aliases"), the React package's `## Aliases` README section, and CI/release/`check-packaging` comments.
  These claimed shipped surfaces that no longer exist; corrected to reflect the hard rename. The
  `migration.test.ts` guards that pin the old scopes/exports as *absent* are kept (they enforce the
  rename); CHANGELOG/MIGRATION history is unchanged. Docs-only — no behavior change.

### Added

- **`FieldHandle.addAgent` — engine-stepped agents (the creatures primitive, core).** An agent is a
  mesh-bound participant the integrator *moves*: it lives in the particle pool, so it feels every
  force the swarm feels — body forces AND the particle-level ones (`hunt`/`align`/`cohesion`) — and
  each step its `report(p)` fires so an external transform follows it. `maxSpeed` caps it, `species`
  lets tagged bodies (`affects`) steer it selectively, it edge-bounces (not wraps), and
  `readParticles` excludes it. Unlike the self-integrating `FieldAgent` (where the caller integrates),
  the engine owns the motion — the lever that lets particle-level forces act on creatures.
  `@fundamental-engine/three` gains `layer.addAgent(object3d, { maxSpeed, species, hover,
  faceVelocity })`, the aligned successor to `FieldAgent`. Mirrored on vanilla / `<field-root>`. (#438)
- **`cssFeedbackSink` — the feedback CSS adapter, named.** Feedback was already plain data
  (`FeedbackChannels`) through an injectable sink, but the CSS write path (`--d`/`--field-density`/
  `--load`/`--lit`) was unnamed engine-internal default. It's now exported so the DOM door installs it
  explicitly and a non-DOM host (e.g. `@fundamental-engine/three`'s `FieldLayer`) clearly opts out by
  passing its own sink. Behavior is identical — the default for `createField`/vanilla/`<field-root>`
  is unchanged. (#445)
- **Matter tagging — multiple ecologies in one field with selective forces.** A body's new
  `data-affects` (comma-separated species) restricts its forces to that matter — particles whose
  `species` isn't in the set are skipped entirely (no force, no density sample); omit it and the body
  acts on all matter (back-compat, bit-for-bit). A `spawn` source's new `data-species` stamps its tag
  on the matter it emits, so pollen, seeds, and spores can share one field, each pulled only by its
  own attractors/sinks. `@fundamental-engine/three`'s `FieldBodySpec` gains `species` and `affects`.
  (#444)
- **Reactive body params — live `strength`/`range`/`angle`/`spin` without a `rescan()`.** A body's
  hot force params are now re-read from its element on the measure cadence, so changing `data-strength`
  on a DOM body (or calling `FieldBody.set({ strength })` in `@fundamental-engine/three`) takes effect
  within a frame. Only attributes actually present override, so preset/intent bodies are untouched.
  `@fundamental-engine/three`'s `FieldBody` gains `set({ strength, range, angle, spin })`. (#442)
- **`FieldHandle.sampleScalar(x, y)` — smooth, gradient-capable density sampling.** Returns the
  diffused density scalar ∈ [0,1] (the heatmap grid, bilinear-sampled) at a point, so its gradient
  stays meaningful *at* a source — what forage-by-gradient needs (a nearest-body readout flattens
  there). Requires the heatmap layer (`createField({ heatmap: true })` / `setHeatmap(true)`); returns
  `0` when off; updated each frame including under `render: 'none'`. Mirrored on
  `@fundamental-engine/vanilla`, `<field-root>`, and `@fundamental-engine/three`'s `FieldLayer`.
  Additive. (#440)

### Fixed

- **Rebrand stragglers in user-facing engine strings.** The `inspect` example recipe's `intent`, the
  system-report heading, and the canvas-context error/warn messages still said "field-ui"; renamed to
  "Fundamental". Copy-only — no API, recipe structure, or behavior change.
- **The density heatmap no longer reacts to scroll.** It was suppressed while scrolling (draw only when
  `scrollV < 6`), so the glow popped off the instant you scrolled and back on when you stopped — choppy.
  The scroll coupling is removed entirely: the heatmap is a continuous ambient layer that draws every
  frame when enabled. The original perf intent is served by the existing compute throttle (the texel
  grid recomputes only every 3rd frame), so the per-frame cost is just the cached bilinear upscale.
- **Engagement listeners no longer accumulate on a long-lived field.** `bindEngagement()` deduped via
  `data-fx-engaged` but, unlike the body/emitter reconciliation, never pruned `[data-hot]` elements that
  had left the DOM — so a persistent field (the page `<field-root>` with `transition:persist`) outliving
  the elements swapped under it could retain detached nodes and their pointer/focus listeners across
  rescans. Each rescan now drops disconnected engagements, releasing their four listeners and the array
  ref. (Latent: didn't manifest in a 20-navigation heap probe, but closed for very long sessions.)
- **Frame-rate-independent particle motion.** `env.dt` was a flat `1` regardless of framerate, so the
  per-frame sim ran 2–4× faster once the perf work lifted the homepage to 60–120fps. dt is now the real
  frame interval normalized to a 60fps baseline (≈1 at 60fps, clamped so a stall can't teleport matter);
  position alone is dt-scaled, forces/friction stay per-frame by design. Mirrored to the Swift port. (#434)
- **Particle glow is now crisp points.** #416's three-disc soft glow — *and* the older heat-scaled halo
  it had replaced (`size + 3 + 6*h`) — both bloomed into large overlapping rings wherever the accretion
  sink heats a cluster (every particle there reaches `h≈1`). Particles now draw as a crisp core with a
  single fixed ~1px bloom; heat reads through the core's brightness and size, never a growing aura. (#434)
- **Lifecycle teardown closes registry + observer leaks.** `platform` destroy now prunes stale registry
  entries and disconnects its observers; `@fundamental-engine/three`'s layer tears down its body registry
  on destroy and reuses overlay GPU buffers instead of reallocating them per frame. Repeated
  field teardown/rescan no longer retains detached entries or leaks observers. (#463)

### Performance

- **Reuse draw/flow scratch instead of allocating per particle per frame.** The core draw and flow paths
  allocated scratch (`flowBias`/`particleRGB`) per particle per frame; the hot loops now pass shared
  module scratch via internal write-into variants — the public `flowBias`/`particleRGB` stay as thin
  wrappers, math bit-for-bit unchanged. (#463)

## [0.4.0] — 2026-06-13

### Changed

- **Renamed: `@field-ui/*` → `@fundamental-engine/*`.** The project is now **Fundamental**
  (`fundamental-engine.com`). All packages move to the `@fundamental-engine` scope, and the one-install
  umbrella is now the bare package **`fundamental-engine`** (`npm i fundamental-engine`), replacing
  `@field-ui/kit` / `@field-ui/field-ui`. A **hard rename** — the deprecated `@forces-ui/*` compatibility
  shims are dropped (there are no external consumers yet). The **engine's primitive is unchanged**:
  `<field-root>`, `FieldHandle`, `createField`, and the `--field-*` CSS variables stay — *fundamental
  forces act across a field*. Old `@field-ui/*` packages will be deprecated on npm pointing here.

### Added

- **`FieldAgent` — an `Object3D` that rides the field (`@field-ui/three`).** The creatures
  primitive: a specific scene object (a bee, a fish, a drone) that samples the live field at its own
  position each frame, steers along the force (acceleration toward it, drag, a top speed, optional
  wander and hover-bob), and writes its world position through the shared `FieldProjection`. Agents
  are consumers, not bodies — they feel the field but exert nothing back unless also registered with
  `addBody`. The `sampler` is the `FieldSampler` interface, so an agent can follow a layer, a raw
  handle, or any custom blend. Renderer-free and unit-tested. (#426)

### Changed

- **`@field-ui/three`'s `three` peer range relaxed to `>=0.147.0`** (was `>=0.150.0`). An API audit
  shows the package touches only long-stable three symbols — the newest are `InstancedMesh` (r109)
  and `Object3D.clear()` (r123) — and r147 is verified live in a real integration (a no-build game
  pinning `three@0.147`). The old floor forced `?deps`/import-map overrides to fight the manifest;
  now the declared range matches reality.

## [0.3.1] — 2026-06-12

`@field-ui/three` joins the published family — the Three.js authoring surface (the engine headless,
its swarm and structure rendered in a WebGL scene), plus the two engine read-outs it consumes. All
additive; the frozen API surface is unchanged.

### Added

- **`FieldBodySpec.color` — pigment tint on mesh-bodies (`@field-ui/three`).** The scanner reads a
  body's tint from `el.dataset.color` (the `pigment` force's conserved color transport); the virtual
  element now carries it from the spec, so a registered mesh can dye passing matter with its color.
  (#418)
- **`FieldHandle.sample(x, y)` — read the live field at a point.** Returns the net force a still test
  particle would feel as `{ x, y }` (a thin wrapper over `forceAt(bodies, forces, env)`): pure,
  read-only, samplable at any resolution. The seam external 3D visualizers consume to build their own
  field geometry. Mirrored on `@field-ui/vanilla` and `<field-root>`; additive, the frozen API surface
  is unchanged.
- **`@field-ui/three`: meshes as bodies.** `layer.addBody(object3d, spec)` (and `FieldBodyRegistry`)
  registers a `THREE.Object3D` as a field body — it bends the field and the swarm responds, while
  `density` / `load` / `lit` feedback flows back onto the mesh (drive a uniform from `onFeedback`).
  Crucially the body **carries a `data` record** (a genome, an inventory), so a mesh can be a
  meaningful agent, not just a force. Needs no core change — the body is a lightweight non-DOM
  element scanned through the host, its rect projected from the mesh's world position.
- **`@field-ui/three`: native field visuals.** `vectorField()` (instanced arrow grid) and
  `streamlineTubes()` (traced flow tubes) build scene geometry from `FieldHandle.sample()` — the
  field's structure rendered directly, not via particles. The tracing core is pure and tested.

- **`@field-ui/three` — bind the field engine to a Three.js scene.** A new authoring-surface
  package that runs the engine headless (`render: 'none'`) and renders its conserved swarm as a
  `THREE.Points` layer: `createFieldLayer()` / `FieldLayer` (which implements the full
  `FieldHandle`, so `burst`/`flowTo`/`setFormation`/`seed` drive the 3D layer). A `FieldProjection`
  coordinate seam maps the field to world space — `PlaneProjection` (flat, stylistic heat-relief) or
  `VolumeProjection` (the engine's real depth lane; `createFieldLayer({ depth })` selects it). Also
  ships `threeHost()` (the `FieldHost` for a WebGL scene) and `threeBackend()` (a `RenderBackend`
  drawing the diagnostic line overlays — streamlines, field-lines, grid, contours — as scene
  geometry). `three` is a peer dependency. (#408)
- **`FieldHandle.readParticles(out)` — render-agnostic swarm read-out.** Copies live particle state
  into a caller-owned `Float32Array` (stride 5: `x, y, z, heat, size`; `z` is the optional depth lane
  from the z-axis, `0` in a flat field) and returns the count written. Zero-allocation and read-only,
  so a surface with no 2D context (the `@field-ui/three` particle bridge) can draw the swarm directly.
  Mirrored on `@field-ui/vanilla` and `<field-root>`; additive, the frozen API surface is unchanged.
  `RenderBackend` / `Stroke` are now also exported from `@field-ui/core` for external surfaces to
  implement. (#408)

- **`overlay` prop for `@field-ui/react` — Field Surfaces parity with `<field-root>`.** The
  `<FieldField>` component and `useFieldField` hook now accept an `overlay` prop (`OverlayInput`
  — one mode or an additive stack) that activates the front overlay surface. The component
  lazily creates a fixed, full-viewport, `pointer-events:none`, `z-index:5`,
  `mix-blend-mode:screen` canvas on `document.body` when an overlay mode is first set —
  matching the pattern of `<field-root overlay="…">` — and removes it on unmount. The
  `overlay` dep is wired into the effect's dep array alongside the other engine options, so
  changing the mode re-creates the field with the new overlay. Purely additive; no behavior
  changes when `overlay` is omitted. (#352)
- **`render: 'flow'` — particles and the streamline arrows in one underlay canvas.** A new
  underlay render mode that draws the dot swarm AND the field's streamline arrows together in
  the single `<field-root>` canvas — the particles drifting along the visible flow — with no
  separate front surface and no `mix-blend`, so it stays one cheap composited layer.
  (`'streamlines'` still draws the arrows alone; `'flow'` keeps the dots underneath.) Accepted
  by `createField({ render: 'flow' })`, `setRender('flow')`, and `<field-root render="flow">`.
  Additive — the frozen API surface is unchanged. (#405)

### Fixed

- **Smoother scrolling with the streamline arrows on.** The underlay streamlines / `flow` arrows
  re-sampled the whole force-field grid every frame, even though the sampled field is driven by
  body positions that only update on the `measureBodies` cadence (every 6th frame). The grid is
  now resampled every 3rd frame (or when the cache is empty / a flow focus is animating) and the
  arrows draw from the cache every frame — no flicker or stepping, ~3× less per-frame work for the
  flow layer, and dropped frames during scroll fall sharply. (#406)
- **The density heatmap is much cheaper per frame.** Its texel grid is now recomputed on a cadence
  (every 3rd frame) into a reused `ImageData` buffer instead of being rebuilt and reallocated every
  frame, and the full-viewport bilinear-upscale draw is suppressed while the page is scrolling fast
  (eased `env.scrollV`) — the heatmap is ambient density you read at rest, not detail you track
  mid-scroll, so it returns the instant the page settles and scrolling never pays its fill cost.
- **Particles render as a soft glow, not a solid disc.** Each particle is now three concentric
  additive discs — a wide faint aura, a mid body, a small bright core — summing under the `lighter`
  composite into a smooth radial falloff, so matter reads as *light* rather than a hard filled
  circle. Cheap (a few small arcs; no per-particle gradient or shadowBlur). And a sink's captured
  matter renders again as its dim orbital cloud (an earlier change had removed it entirely) — the
  body visibly gathers and holds a real swarm before the supernova flings it back out; still
  conserved either way.
- **The Field-Surfaces overlay canvas no longer costs framerate when idle.** The full-viewport
  `mix-blend-mode: screen` overlay canvas was left in the compositing tree even with `overlay:
  off`, so the browser re-blended the whole screen against the animating underlay every frame —
  roughly halving the framerate of a singleton page field since the surface landed. `<field-root>`
  now takes the canvas out of the tree (`display: none`) whenever no reading is active and restores
  it when one is set. Visible-overlay behavior is unchanged. (#405)
- **`[data-dock]` collapsed elements and emit clones now set `inert` alongside `aria-hidden`**, so focusable descendants inside a scale-collapsed mover or a decorative emit clone are removed from the tab order and cannot receive keyboard focus while invisible. `inert` is removed on all restore paths (undock, teardown). (#353)
- **`scan()` / `rescan()` reconciles consumer state across rescans** instead of rebuilding from scratch: persisting `[data-move]` elements carry their offset and dock progress forward (no reset during a live animation), and `[data-emit]` emitters carry their existing clones forward so repeat scans no longer accumulate up to `cap × rescans` clones. Clones from emitter elements that have left the scan root are removed on the next scan. (#354)

## [0.3.0] — 2026-06-12

A native **Swift port** of the engine also landed this cycle — `FieldUICore` /
`FieldUIPlatform` / `FieldUIVanilla` / `FieldUISwiftUI` mirroring the npm family, plus the
**FieldLab** macOS showcase app, byte-equivalent to the JS engine at z = 0. It lives in
[`swift/`](swift/README.md) and is versioned separately from these npm packages.

### Added

- **`background: 'transparent'` — the underlay can sit over light content.** The engine painted a
  near-black substrate every frame, so the underlay blanked out anything beneath it (a 3D scene,
  an image, a light page) — consumers had to reach for a `mix-blend-mode: screen` workaround. A new
  additive `FieldOptions.background` (`'opaque'` default · `'transparent'`) clears to transparent
  instead, so the bright matter composites over the content and trails light-paint that fade to
  transparent rather than to black (`destination-out`). Live via `field.setBackground(mode)`,
  declaratively via `<field-root background="transparent">`, and as a prop on the React component.
  Purely additive — the default is unchanged.

- **Traced field lines + the `gravity-field` preset.** The `field-lines` overlay reading now draws
  the field's real *structure as curves* instead of sampled arrows: `fieldLineSeeds` (new,
  `@field-ui/core` `fieldline-seeds.ts`) seeds each field-bearing body by its own geometry — a
  dipole's perpendicular bisector for a magnet, a core ring for a monopole `charge`/`gravity` well —
  and `traceFieldLines` follows the **net** field through every seed, so the bar-magnet loops, the
  radial spokes, and the linkage between two bodies all emerge from the math (bodies that radiate no
  `field()` get no seeds, so the diagram stays the structure, never a starburst). `FIELD_BEARING_TOKENS`
  is the canonical set (`magnetism`, `charge`, `gravity`). Built on this, the experimental
  **`gravity-field`** recipe presents gravity as a *visible, followable natural field* — `gravity`
  radiates the monopole structure the lines trace, and a light `swirl` makes infalling matter thread
  those lines in orbit rather than dropping straight in. It joins `EXPERIMENTAL_RECIPES` (outside the
  locked 64; `gravity` and `swirl` stay their own force tokens).

- **`fieldLineSeeds` / `dipoleSeeds` / `monopoleSeeds`** (`@field-ui/core`, `fieldlines.ts`).
  The field-line *seeding* algorithm — where to start tracing so the diagram is the correct
  STRUCTURE (dipole loops seeded along the heading's perpendicular bisector; monopole spokes
  from a core ring) — was app-only, living in `apps/site/src/lib/field-probe.ts`. It is now a
  pure core export with the synthesized-dipole fallback the field math uses, so every consumer
  (the site's force chips, the native renderers, any future bridge) shares one definition. The
  site's `traceDipole` is refactored onto it; behavior is unchanged.

- **`<field-root heatmap>`** — the density heatmap layer (field-systems H1) is now a declarative
  attribute on the element runtime (observed, toggles live via `setHeatmap`), alongside the
  existing `mass` / `attention` / `causality`. The handle and `FieldOptions` already supported it;
  this exposes it to HTML authors. Documented in the regenerated custom-elements manifest.

- **Recipes execute their declarations.** `recipe.render` and per-body condition gates stop being
  descriptive (#370): `compileRecipe` now derives an executable render plan (one underlay matter
  mode, the additive overlay reading stack, the heatmap toggle — unmappable layers are NAMED in
  `plan.unapplied`, never silently dropped), and `applyRecipe` gains a structural `field` target
  (`FieldHandle` and `<field-root>` both fit) that it drives with the plan and releases on
  `destroy()`. `BodyRecipe.when` is the new executable gate — compiled to `data-when`, validated
  against the engine's registered condition ids so an unknown gate is a validation error rather
  than a silently-never-passing body. The `contour-charge` recipe now carries its own engagement
  gate. Fully additive: without a `field` option recipes stay signals-only as before; `renderless`
  and reduced motion skip the drive.

- **Injectable randomness and wall clock (#371).** Every random draw in the engine — particle
  seeding, spawn scatter, brownian wander, force jitter and emission cones, release angles —
  now flows through one source: `createField({ rng })` (default `Math.random`), carried to
  forces and the integrator as `env.rng`. A seeded generator makes a run reproducible — the
  seam record/replay needs, pinned by a bit-identical two-run test. The wall clock joins it:
  `createField({ now })` (default `performance.now`) feeds input-idle tracking, completing the
  three-clocks separation (wall / frame / simulation — see temporal.ts).

- **RenderBackend — the drawing seam (#373).** The structural contract between the engine and a
  drawing surface (`size` / `clear` / `segments` / `polyline` / `rect` / `text`), with the
  Canvas 2D implementation as the default. The OVERLAY surface — all eight readings — now
  renders exclusively through it; `createField({ overlayBackend })` accepts any conforming
  implementation, which is the seam the WebGL/WebGPU frontier builds on. The underlay matter
  modes (dots' gradients, metaballs, voronoi) still draw on the 2D context directly and convert
  in a later slice — the contract grows additively when their needs (gradients, composite modes)
  arrive. Contract pinned by recording-stub tests.

- **`FieldLineOpts.maxTurns` — a turning budget for the field-line tracer** (`@field-ui/core`,
  `fieldlines.ts`). A traced line orbiting a pole that never passes back through its *seed*
  (so `loopDist` can't close it) otherwise winds the same circle for its whole step budget —
  hundreds of overlapping segments that waste the trace and, on renderers whose antialiaser
  computes path self-intersections, explode stroke cost superlinearly (measured at ~3 s/frame
  in the Swift CoreGraphics renderer before this guard; ~81× faster after). The budget counts
  cumulative heading change in full revolutions; `Infinity` — the default — preserves the
  unbounded behavior exactly, so existing consumers and goldens are untouched. Renderers
  tracing dipole fields should pass ~`1.5` (a closed dipole line turns exactly one revolution).

- **Attention-gated discharge + the `contour-charge` recipe.** A sink gated on engagement
  (`data-when="active"`) now RELEASES what it holds on the falling edge of attention — the same
  conserved supernova ritual (same radial burst, same `field:released` event) that saturation
  fires; capture was already gated, release now matches (`dischargeDisengaged`, accretion.ts).
  The experimental `contour-charge` recipe names the composed behavior — attract + sink gated on
  `active`, glow ∝ `--load`, glyph-outline rings as the bound representation — and joins the
  wayfinding pair in `EXPERIMENTAL_RECIPES` (bare `charge` stays the electric force token; the
  compound respects the one-word-one-lane rule). The home Gallery demos it live: dwell on the
  Charge mark to fill it, look away and it lets go.

- **Contour primitive — glyph outlines from any font (`@field-ui/platform`).**
  `contourPathData(font, text, size)` lays out text as combined glyph-outline SVG path data
  (per-glyph + pair kerning; Latin display scope), and `contourSvgFor(el, font)` generates the
  aria-hidden contour-ring SVG from a body element's own text and computed font-size, binds it
  with `data-field-visual-for`, and lets the Bound Visual mirroring drive its rings from the
  body's live `--d` / `--load`. The caller supplies the parsed font — any object matching the
  `ContourFont` contract (opentype.js's `Font` fits directly) — so the primitive works with
  whatever face the author applied to the element and field-ui stays zero-dependency. The same
  function powers the site's build-time generation (`gen-contours.mjs`).

- **The optional z lane — a not-required third axis** (`@field-ui/core`,
  [docs/engine-reference/z-axis.md](docs/engine-reference/z-axis.md)). The engine simulates an
  opt-in depth dimension: `createField({ depth: 300 })` seeds matter through a shallow volume
  behind the page, bodies stay on the page plane (z = 0) and their falloffs pull matter back
  toward it, z integrates/damps/wraps toroidally, the `c` cap bounds the full 3D speed, and the
  dots render recedes (smaller + fainter) with depth. **Flat is exact:** with no `depth` — the
  default — every z term multiplies away to nothing and the engine matches its prior behavior
  bit-for-bit (enforced by the `z-axis.test.ts` suite). Every new field is optional
  (`Particle.z`/`vz`/`gz`, `Env.dz`/`D`, `FieldOptions.depth`) so existing `Particle`/`Env`
  literals keep compiling unchanged; no public call signature changes (`burst(x, y)` et al. act on
  the plane, their effects extending into the volume automatically). Distance is 3D everywhere
  (the body delta, range cull, spatial-hash filter, sink absorption, sampling, atom picking,
  kinetic energy); radial forces gain a spherical z leg; the neighbour forces (`collide` —
  spheres, not discs — `cohesion`, `pressure`, `link`, `hunt`, `align`) are truly 3D; the
  deliberately-planar set (`wall`, `magnetism`/`lens`, the currents, the grids, the modifiers) is
  documented per-force with its reasoning.

- **Bound Visual Sink — state mirroring for visual bindings.** The platform's
  `VisualBindingRegistry` now mirrors a semantic body's feedback channels (`--d` /
  `--field-density`, `--load` / `--mass`, `--lit`, and the measured metrics — the exported
  `MIRRORED_CHANNELS`) onto every bound `representation` / `measurement` visual
  (`data-field-visual-for`), change-gated via a MutationObserver on the source's style attribute.
  CSS custom properties don't cross to siblings, so an `aria-hidden` SVG beside a sink heading can
  now thicken its contours from `var(--load)` exactly as authored — the element absorbs, the visual
  shows what absorption means, the text stays the source of meaning. On by default in
  `createFieldPlatform` (`visuals.setMirroring(true)`); the element runtime scans declarative
  visuals at start. The canon now names the sink tiers: Element Sink · Text Sink · Bound Visual
  Sink · Contour Sink (Body Matter Interaction → Sink/Accretion).

- **`bindFieldNav` + the inert-metric-lane guard.** The navigation-chrome idiom the site
  hand-spread across ~12 surfaces (run a recipe signals-only over a nav's `<a href>` links, pin the
  current as the well, mark visited links, return a teardown) lifts into
  `bindFieldNav(root, recipe, { pin, visited, extraMetrics, reducedMotion })`
  (`@field-ui/platform`); reduced motion → `null` (plain, reachable links). Paired guard:
  `classifyMetric(name)` splits a recipe's metric lanes into **computed** / **supplied-only** /
  **designed** (`COMPUTED_METRICS` + `SUPPLIED_ONLY_METRICS` partition `METRIC_KINDS`), and the new
  `lintInertFeedback` rule (now in `lintPlatform`) flags a feedback binding to a designed
  `--field-<m>` lane the host never supplies — declared but never written, the same silent-contract
  class as `lintSinkFeedback`. The `/recipes` pages now document each metric's lane support. All
  additive and unfrozen.

- **Field Surfaces: additive overlay readings.** `setOverlay` (core, `<field-root overlay>`,
  vanilla) now accepts one reading **or a stack** — an array (`['grid','path']`) or a
  space-separated attribute (`overlay="grid path"`) — drawn in order on the front surface, so
  several readings compose over any underlay matter mode. Five new readings join
  `streamlines` / `force-vectors` / `field-lines`, all line/text diagnostics (the overlay reveals,
  never occludes): `grid` (a reference lattice displaced by the field — deformation),
  `temperature` (iso-contours of particle heat), `energy` (iso-contours of kinetic energy),
  `path` (streamline curves traced from seeded probes), and `data` (numeric `--d` density
  readouts beside each measuring body). The home Field Surfaces panel now defines every mode
  in place and exposes the readings as additive toggles, scoped to the panel in view.

The **physics workover** begins: a designed / natural / hybrid substrate that makes the
engine more physically coherent without losing the designed interface feel. The full plan
and an as-built audit live in [`docs/engine-reference/physics-workover.md`](docs/engine-reference/physics-workover.md); the
work ships across v0.3 to v0.6. (The audit's headline: first-class mass, softened
inverse-square gravity/charge, `b.accreted`, and class-[S] source/sink budgeting already
ship, so the work is the mode system, medium formalization, safety layer, `screen`,
metrics, and the transformation primitives, not re-building what exists.)

### Changed

- **A supernova now ejects captured matter as PERSISTENT field matter** (`@field-ui/core`,
  `accretion.ts`). When a sink saturates and supernovas, `releaseCaptured` clears each released
  particle's `age`: mortal class-`[S]` source-spawned matter that the sink captured and held is
  released **immortal**, so a `spawn → sink → supernova` loop visibly conserves — the matter a
  source made rejoins the lasting field instead of silently dying once released. A **no-op for the
  conserved base pool** (whose particles already have no `age`). Closes a long-standing gap where a
  source's output, once captured and released, would quietly expire rather than return to the field.

- **A supernova now ejects matter PAST the absorption radius, so the sink cycle repeats**
  (`@field-ui/core`, `accretion.ts`). `releaseCaptured` placed ejecta *at the core* — inside
  `absorbR` — so the sink re-captured its own ejecta on the very next frame, degenerating the
  explosion into a ~1-per-frame strobe whose blast progressively evacuated the catchment until the
  sink fell dormant ("exploded once, won't collect again"; ejecta appears to accelerate away and
  never return). Each particle is now ejected just past `absorbR` along its bearing, so matter
  leaves the accretion zone, a `sink+attract` well reels it back, and the
  fill → explode → fall-back → refill cycle repeats at a real period (≈9 frames vs ≈1; in a headless
  `sink+attract` repro, supernovas drop from 581 to 66 per 600 frames while the catchment stays
  populated instead of decaying). A lone `sink` simply lets the ejecta disperse.

### Fixed

- **One source of truth for reduced-motion and page-visibility probes (`@field-ui/platform`).** Four
  independent `matchMedia('(prefers-reduced-motion: reduce)')` calls and two direct `document.hidden`
  reads scattered across `flip.ts`, `field-nav.ts`, `apply-recipe.ts`, and `browser-host.ts` have
  been consolidated into a single `env.ts` module exposing `prefersReducedMotion()` and
  `pageHidden()`. Both helpers are SSR-safe (return `false` when `window`/`document` are absent) and
  accept overrides via `setEnvOverrides` / `clearEnvOverrides` — a clean test seam that replaces
  the previous approach of stubbing `globalThis.matchMedia` in tests. `browserHost()` implements its
  `reducedMotion` and `hidden` methods through the helpers; `flip.ts` tests now use `setEnvOverrides`
  instead of patching the global. The site-level `politeLoop` (apps/site) gains injectable
  `isHidden` and `onVisibilityChange` options (both default to the live `document` behaviour) for
  the same reason.

- **Platform registries close their exits.** Three registries leaked entries for elements that
  left the DOM: `FeedbackRegistry` (no unregister at all — bindings and thresholds for removed
  elements flushed forever), `RelationshipRegistry` (unresolved edges accumulated and were never
  re-resolved when a target later mounted), and `StateRegistry` (per-key `delete` stranded empty
  listener maps). Each now prunes disconnected elements at its natural moment — `flush()`,
  `discover()` (which also re-resolves late-mounting targets by replacing the unresolved set),
  and a new `prune()` — and gains an explicit `unregister(element)` for immediate reclamation,
  matching the standard `MeasurementRegistry` and `VisualBindingRegistry` already set.

- **Warp pair ghost (#368a).** When a paired element (resolved via `data-pair`) leaves the DOM,
  `updateWarpTargets` now clears `pairBody` and `warpHas` so the wormhole closes instead of
  relocating matter to the detached node. The link re-resolves naturally on the next rescan.

- **Docked element removal (#368b).** A `[data-dock]` mover whose DOM node is removed while
  docked no longer leaves the sink believing it holds that element. `updateMovers` now detects
  `!el.isConnected`, clears `mv.docked` / `mv.dock.dock`, and skips all per-frame work for
  the detached element — symmetric with how the rescan reconciliation handles departed bodies.

- **Heatmap buffer persists across disable/enable (#369).** `setHeatmap(false)` now calls
  `heatmap.clear()` before releasing the buffer, so a paused or mid-accumulation field never
  bleeds stale density into the next active session. Re-enabling creates a fresh instance.
  `Heatmap.clear()` (new) zeroes the grid and resets the peak tracker; `ScalarGridImpl.clear()`
  (new) fills all three internal buffers with zero.

- **`priority-well` recipe note corrected.** It claimed `density` writes back as `--field-density`;
  that lane is host-supplied (ground it with `data-field-density`) — the engine's live density
  channel is `--d` on `data-feedback` bodies. Surfaced by the new metric-lane classifier.

- **Streamlines arrow-field pulsing eliminated.** The `streamlines` underlay render and all three
  overlay arrow modes (`streamlines`, `force-vectors`, `field-lines`) normalized arrow length and
  alpha to the raw per-frame peak magnitude, so any frame-to-frame shift in `maxMag` (body drag,
  animated strength, charge-feedback density ramp) rescaled the entire arrow field at once — a
  visible flash/pulse. Both renderers now maintain an independent EMA of their normalization
  reference (rise alpha 0.3, decay alpha 0.1), seeded on the first frame, so the scale tracks
  real changes while smoothing transients. The underlay and overlay carry separate state and
  cannot cross-influence each other.

- The home manual's last two untraced stages now trace real engine runs: **`fieldflow`**
  pairs with a magnet on the live chip (it advects matter along the *net* field other
  forces radiate, so alone it had no lines to follow — the demo itself was a silent
  kinematic no-op, not just untraced) and **`warp`** wires its pair target headlessly the
  way the conformance experiment does, showing the conserved relocation from throat to
  pair. Both gained per-force demo-accuracy tests, and the e2e boot test dropped its
  `UNTRACEABLE` exception list — every chip-bearing stage must hold exactly one traced
  canvas.

## [0.2.3] — 2026-06-10

The cycle that built the **invisible-fields family** — twelve real-data example pages whose
render surface is the page's own type — and shipped the engine/platform capabilities the
family proved out. The pattern is canonical in
[`docs/canonical/invisible-fields.md`](docs/canonical/invisible-fields.md).

### Added

- **`FieldHandle.scrollV()`** — the engine's eased page-scroll velocity (the `scrolling`
  condition gate's EMA), mirrored to **`--field-scroll-v`** on `:root` by the platform write
  phase (deduped when unchanged). Experimental surface; px/frame, refresh-rate dependent.
- **`FieldHandle.setVisible(on)`** — element-level visibility hint: `false` skips all draw
  work while the simulation and feedback signals stay live. `<field-root>` wires it
  automatically from an IntersectionObserver. Under reduced motion the static scene redraws
  at quarter rate.
- **`render: 'none'`** — the signals-only engine mode (#297): created with `'none'`, a field
  never acquires a canvas context, never sizes a backing store, never allocates render
  scratch — it exists purely as signals (`--d`, `--load`, `--lit`, events, `scrollV`).
  `setRender` out of `'none'` acquires the context lazily.
- **`QualityGovernor`** + the **`field:quality-tier`** event — adaptive frame-budget tier
  detection (0–3, asymmetric escalation/recovery); the `<field-root>` runtime feeds it,
  skips discontinuity frames, resets on `visibilitychange`, and throttles its own platform
  tick at tiers 2–3 as the built-in consumer.
- **`FeedbackRegistry.cssWritesLastFrame()`** — the actual per-frame DOM write count
  (mirrored `--field-*`/`--forces-*` pairs count as 2), distinct from `boundVars().length`.
- **`PlatformRuntime.attachHandle(handle)`** — post-hoc wiring of the engine handle into the
  platform runtime (scroll-v writes + governor monitoring).
- **`withFlip()`** in `@field-ui/platform` (#295) — the FLIP reflow helper extracted from the
  example runtimes (1D/2D, exclude hook, reduced-motion guard).
- **`allocateAttention()`** in `@field-ui/core` (#296) — conserved water-filling allocation
  (Σw = budget exact, pins take the cap, capped excess re-flows), unit-tested for exactness.
- **The invisible-fields example family** at `/evidence/<slug>` — twelve pages over committed
  real-data snapshots (refreshed weekly by CI) with live in-browser upgrades, provenance
  chips, and per-page signature mechanics; pinned by a 62-test Playwright matrix
  (chromium · webkit · Pixel-7 touch).

### Fixed

- `[hidden]` on styled grid/flex elements is restated in author CSS (the UA default loses).
- Sparkline draw-ins use `pathLength="100"` keyframes ending dash-free (WebKit dash-precision
  artifacts at `pathLength="1"`).
- Touch drag on the backlog board arms by long-press (touch-action latches at gesture start).
- The dependencies snapshot reads publish dates from the full packument (`/latest` omits
  `time`).
- `threads`' depth variable renamed `--depth` (it collided with the engine's `--d` channel).

### Expanded the field-ui model (migration plan Phases 4–8)

On top of the migrated, stabilized base, the field-first model was built out — all engine-side,
pure, and node-tested, with no change to the preserved physics:

- **Contracts** (`core/contracts`): formal contract types, a validated `ForcePassport` for all 34
  forces, the Error-Taxonomy dev-mode guards, and an inspectable contracts catalog.
- **Agents** (`core/agents`): the FieldAgent model — element, relationship, user, layout, and data
  agents, plus a thresholded EventAgent (hysteretic, debounced) runtime.
- **Visual language** (`core/visual`): bounded metric→appearance mappings (typography, color,
  shape, emission), lint rules, and the semantic-text fallback.
- **Authoring & recipes** (`core/recipes`): the serializable SceneRecipe schema + validation, the
  intent compiler, the essential-recipe gallery, and Explain-This-Field / Field-Diff.
- **Inspection** (`core/inspect`): deterministic snapshot regression, a performance-budget
  inspector, and an aggregate system report.

The suite grew to 476 tests. App-level surfaces (Composer, Inspector UI) remain the frontier.

### Migrated to field-ui

The project moved from `forces-ui` to **field-ui** — a field-first framing where the field (the
invisible structure) is the primary abstraction. This is a rename + alias pass, **not** a rewrite:
no force formulas, integrator behavior, magnetism (Lorentz `F = q(v × B)`), fieldflow, render
math, heatmap math, force tokens, or `data-*` authoring changed. The migration plan is
`docs/field-ui-migration-plan.md` (since retired).

Every old public name keeps working as a compatibility alias during the transition:

- **Packages** renamed: `forces-ui` → `field-ui`, `@forces-ui/{elements,react,vanilla}` →
  `@field-ui/*`. Thin re-export alias packages keep the old specifiers resolving.
- **Events**: `field:register-body` / `field:unregister-body` / `field:update-body` are now
  dispatched and listened for alongside the `forces:*` names.
- **CSS variables**: `--field-density` / `--field-heatmap-density` are written alongside
  `--forces-density` / `--forces-heatmap-density` (same values).
- **Elements**: `<field-root>` / `<field-field>` / `<field-cell>` register alongside
  `<forces-field>` / `<forces-cell>`; React gains `FieldField` / `useFieldField`, vanilla gains a
  `FieldField` alias.

Aliases will be removed in a future major once docs, examples, and downstream code have moved.

### Added

- **`@forces-ui/vanilla` — a framework-free TypeScript wrapper.** A fourth package exposes the
  imperative API as a typed `ForcesField` class (it manages a canvas for you, or drives one you
  own) alongside `mountField()` and a re-exported `createField()` plus the catalog — with no
  custom-element registration and no framework dependency, so importing it has no side effects.
  `mountField` now lives here as its canonical home; `@forces-ui/elements` re-exports it, so
  existing `import { mountField } from '@forces-ui/elements'` is unchanged. The developer portal
  gains a **TypeScript** guide for it.
- **`waves` is now a real toggle.** `FieldOptions.waves` (and `<forces-field waves>` / the React
  `waves` prop) now actually gates the background Currents — default stays `true`, set `false`
  for the bare free-particle field. It was previously accepted but ignored.
- **`scrolling` `data-when` gate wired.** `data-when="scrolling"` now acts only while the page is
  actually scrolling: the engine eases a per-frame scroll speed into `env.scrollV` and the gate
  fires above `0.25`. It was cataloged but inert before (silently acting "always").
- **`mass` on the web component.** `<forces-field mass>` now opts into first-class mass (§21.3),
  matching the React adapter and the `ForcesField` class; the option was previously React-only.
- **SSR-safe imports + a browser-only guard.** Importing `@forces-ui/elements` no longer throws
  `HTMLElement is not defined` under server-side rendering (the custom-element base is guarded),
  and `new ForcesField()` / `mountField()` from `@forces-ui/vanilla` throw a clear "client only"
  error during SSR instead of a cryptic `document is not defined`. A new `pnpm check:dist` smoke
  check (in CI and the publish checklist) verifies every package's entry points import cleanly.
- **Global velocity cap + safety conformance sweep.** The integrator now clamps every free
  particle's speed to the unit system's `c` (12) each step, so no canonical force or
  composite can produce a runaway (the natural primitives already self-clamped; this makes
  it universal). A new conformance **safety sweep** runs every experiment and asserts the
  whole trajectory stays finite (no NaN/Infinity), positions finite, speed ≤ c, heat
  bounded, and the particle count stable unless a budgeted [S] source is active.

### Changed

- **BREAKING — six canonical force tokens renamed to functional terms.** `vortex → swirl`,
  `spring → tether`, `emitter → jet`, `drag → viscosity`, `reflect → wall`, and `absorb → sink`
  (the other three canonical forces — `attract`, `repel`, `stream` — keep their names). This is
  a **hard rename**: the old `data-body` values no longer resolve, so update markup to the new
  tokens. The capture-radius attribute stays `data-absorb` and the accretion CSS var stays
  `--load`; the per-force vars follow the tokens (`--f-swirl`, `--f-viscosity`, …). The engine,
  presets, the conformance catalog + full test suite, the Field Manual, the Lab, and every doc
  move together. (The wave-binding tear keys on a force *property*, not a token list, so it
  needed no change.)

### Fixed

- **`<forces-field>` reacts to live attribute changes, and `destroy()` cleans up fully.**
  Changing `accent` / `render` / `palette` / `attention` / `causality` on a mounted
  `<forces-field>` now applies immediately (and `density` / `waves` / `mass` rebuild the field);
  the `observedAttributes` were declared but inert before. `destroy()` / `disconnectedCallback`
  now also release the per-element `[data-hot]` engagement listeners, so repeated mount/destroy
  on the same DOM no longer leaks handlers.
- **First-class mass no longer corrupts velocity-replacing forces.** Under `mass: true` the
  integrator scaled the *whole* per-frame velocity change by `1/m`, breaking forces that *set*
  velocity rather than add to it: a `wall` bounce could drive matter through the wall, and a
  `jet` launched heavy matter far too slowly (`lens`/`gate` likewise). Mass is now applied
  per-force — additive forces scale by `1/m`, while velocity-replacing forces (newly flagged
  `kinematic`: `wall`, `jet`, `lens`, `gate`) set velocity outright. New conformance scenarios
  cover `m ≠ 1`, which the suite never exercised before.
- **Canonical vortex swirls again (inward bias `0.6` → `0.12`).** Reverts the v0.2.0 bias:
  the spec (§6.8) and the catalog already specified `0.12`. Canonical `vortex` is a designed
  swirl verb — the tangential component dominates the inward one ~8×, so it holds shape — not
  a spiral drain. That binding belongs in a preset (`whirlpool` / `blackhole` / `accretion`).
  The conformance check moves from an exact inward spiral to **tangential dominance**; the Lab
  shows the first-frame Δv `(0.020, −0.171)` with `|Δvᵧ| > 4×|Δvₓ|` and a swirl track.
- **Every force can disturb the resting field (not just seven canonical tokens).** The
  resting field rides on wave-bound matter, and a force only reaches a bound particle once
  it's torn loose. The tear pass had a hardcoded allowlist — `reflect`, `attract`, `absorb`,
  `emitter`, `repel`, `vortex`, `stream` — so every **natural primitive and extended force**
  (`gravity`, `charge`, `magnetism`, `thermal`, `collide`, `diffuse`, `propagate`, `memory`,
  `cohesion`, `pressure`, …, plus `drag` and `spring`) let the wave shimmer ride straight
  through, doing nothing. Tearing is now keyed on a force *property*, not a token list: any
  visible always/active body that carries a non-modifier, non-source token frees nearby bound
  matter with a gentle inward nudge, then the integrator's real `apply()` shapes it — so gentle
  forces read gently and strong ones strongly. (Modifiers `resonate`/`spotlight` and the pure
  source `spawn` correctly never tear.)
- **`charge` and `magnetism` now act on the live field (charge induction).** Both forces
  ignore neutral matter by contract — and every live particle starts neutral, so on the page
  they did nothing. A charge/magnetism body now **polarizes** the matter in its range: a
  neutral particle picks up a sign by which side of the body it sits on (a +/- domain split),
  induced once so matter carries its charge. Induction is a field-level pass (`induceCharges`)
  kept *outside* the integrator the conformance suite runs, so the force's golden contract
  ("ignores neutral matter") stays exactly true while the field gains charged matter to push.
- **Field Cell + React adapter caught up to the rename.** The Field Cell's poster engine
  still switched on `vortex`/`spring`, so the Lab's `swirl`/`tether` cells fell through to
  `attract`; renamed to `swirl`/`tether`. React `<ForcesField>` / `useForcesField` had
  silently dropped the `palette`, `attention`, and `causality` props; they are now forwarded.
  The elements package gained a `test` script so its cell-force tests run in CI.

### Documentation

- **Audit cleanup sweep.** Marked the four spec-only render modes (`knockout` / `heatmap` /
  `redshift` / `blackbody`) **planned** in the §20.6 table; documented `morph`'s `range` as its
  *recruitment radius* (distant matter isn't pulled into the form — use `data-range="0"` for the
  whole field); corrected the `presets.ts` note (`lens` / `buoyancy` / `spawn` ship now, not
  "deferred"); and fixed the ROADMAP scaffold line (`tsc` / `node:test`, not `tsup` / `vitest`).
- **Docs and the live manual reconciled to the workover.** The Field Manual's `vortex`
  panel now reads as a swirl — the inward bias surfaces as `+ 0.12` in its formula, with no
  "whirlpool" — and the `absorb` panel uses `accreted / capacity`. The formula handbook's
  `absorb` row, the testing guide (the new safety-sweep layer, the corrected class list, the
  test count), the spec's §20.10 (an as-built note on the global cap + safety sweep),
  the possibilities doc, and the README status (`v0.2.0`; packages not yet on npm) are all
  brought in line.
- **Repo-wide documentation audit.** Swept every doc against the shipped engine. Corrected
  stale tokens the rename missed (the explainer's `data-body` list, ROADMAP prose, the Field
  Cell example), the formula handbook's forward registry (`pheromone` → `diffuse`;
  `diffuse`/`memory` flagged as natural [C]; the spec-only `warp`/`wormhole` and the
  `supernova` event marked; the budgeted source named `spawn`), the test count (306),
  ROADMAP's force counts (33), the spec's runtime-field list (drops the removed `b.mass`), and
  stopped PUBLISHING / SECURITY / the package READMEs from implying the packages are on npm.

## [0.2.2] — 2026-06-09

Documentation and release-tooling pass — no engine code changed.

### Added
- **Provenance release workflow** (`.github/workflows/release.yml`): a tag-triggered CI publish that
  signs each package with npm provenance (a Sigstore build attestation) via GitHub OIDC. Provenance
  can only be produced from CI, so this becomes the path for all future releases.

### Changed
- Expanded the `@field-ui/react`, `@field-ui/elements`, and `@field-ui/vanilla` READMEs with full
  options/methods tables, the `data-body` attribute vocabulary, and framework/SSR notes.

## [0.2.1] — 2026-06-08

First npm release under the `@field-ui` scope.

### Changed
- **The core package is published as `@field-ui/core`** (was the unscoped `field-ui`). The unscoped
  name is unavailable on npm — an unrelated, active `fieldui` package trips the registry's
  name-similarity guard — so the engine ships under the org scope alongside the four adapters. All
  internal dependencies and `import … from 'field-ui'` specifiers now resolve to `@field-ui/core`;
  the public API surface is otherwise unchanged (the freeze gate still passes its 14 entries).

### Published
- `@field-ui/core`, `@field-ui/platform`, `@field-ui/elements`, `@field-ui/react`, and
  `@field-ui/vanilla` are live on npm. Install any layer directly (`npm i @field-ui/core`, etc.).
- `@field-ui/kit` (a meta-package that installs the whole suite) and `@field-ui/field-ui` (a thin
  alias for the kit) also published, for one-install consumption.

## [0.2.0] — 2026-06-04

### Added

- **Force-aware Lab controls.** The TUNE & REFIRE panel is driven by each force's
  catalog attributes — it shows only the knobs that matter for the selected force
  (shear exposes its flow angle, `vortex`/`charge`/`resonate` expose spin, class-[S]
  sources show just strength + angle), each with its symbol (S, d, σ, θ°), units,
  a live formula line, and a default-value tick on the track.
- **Quick-pick value bands.** Named quick-set chips under each control (strength:
  weak/default/strong/max; range: near/default/far; spin: ccw/off/cw; angle:
  0/45/90/180; vx/vy: 0/slow/fast; count: 1/8/24) — click a meaningful setting
  instead of guessing and dragging; the active band is highlighted.
- **Frontiers roadmap + backlog.** `docs/roadmap-frontiers.md` (implementation notes for
  the next frontiers — reciprocal input channels, a GPU backend, the compositor bridge,
  `bindData()`, finishing the cosmology, and render frontiers) and `BACKLOG.md` (the
  granular queue). All 33 forces re-verified via the Lab — every one reaches MATCH.
- **Seven more forces (33 total), spanning every input class.** `memory` (a worn-path
  occupancy field, [C]) and `pigment` (conserved color transport, [E]); `pressure`
  (SPH density relaxation — incompressible even-fill, [B]); `link` (a Verlet distance
  constraint — ropes, cloth, soft structures, [B]); `hunt` (two-species predator/prey
  pursuit, [B]); `morph` (matter assembles into a mark/chart/logo — never words, §11; the
  new shape-assignment class [D]); and `spawn` (a budgeted source atom that *creates*
  matter, the new class [S]).
- **The source system (class [S]).** A `source(b, env)` hook on the `Force` contract
  (run once per body per frame, the dual of `modify`), plus an integrator source pass and
  an aging/despawn **sink** for mortal matter. Sources are budgeted by a per-particle
  lifespan and a hard pool ceiling, so they can't grow the field without bound. Adds the
  `fountain` preset (a continuous upward jet arcing home under gravity).
- **Two more render modes (six total)** — `metaballs` (a liquid iso-surface traced by
  marching squares) and `voronoi` (shattered-glass nearest-neighbour cells), alongside
  `dots` · `trails` · `links` · `streamlines`.
- **Closed-loop concepts on the Field Manual** — **material typography** (one density,
  `--d`, drives every type axis at once: weight, optical size, tracking, bloom, color)
  and a **self-laying-out page** (`data-move="layout"` elements find equilibrium positions
  via anchor + mutual repulsion + density pressure, and re-settle on resize).
- **Conserved attention** (§2.4) — one finite strength budget across the page; engaging a
  body pulls force off the others. Opt-in via `FieldOptions.attention` /
  `FieldHandle.setAttention` / `<forces-field attention>`.
- **Cross-boundary causality** — density spills from a saturated body to its neighbours
  (`--lit` + `field:lit`/`field:dim` events). Opt-in via `causality`.
- **Physics conformance framework** (`forces-ui` `conformance/`) — `runScenario` + a
  declarative `EXPERIMENTS` catalog of per-force invariants and exact checks, shared by
  the test suite and the Lab. Fire a particle into a force, verify it reacts as the math
  predicts.
- **The Lab is a physics detector** — fire known particles into a force, watch the track,
  the field, and related particles, and see each conformance check pass frame-by-frame.
  Numeric tuning + presets, multi-particle firing, once/loop/unlocked playback, a
  timeline with a per-particle **speed waveform** and a marker at every test's pass-frame
  with a MATCH flag, a parameter-sweep plot (vary one input across its range, see the
  response curve), and actionable save (Export JSON / Copy report). Handles class-[S]
  sources that start with no test particle (drawing the emitted spray).
- **Composition + condition experiments** — `COMPOSITE_EXPERIMENTS` verifies that forces
  compose (`attract repel` cancel; `attract vortex` sums to a spiral) and gate on
  conditions (`data-when` runs through the real condition registry).
- **Developer portal** (`/docs`) — getting started, concepts, framework guides, a
  catalog-driven API reference, recipes, and performance/accessibility notes.
- **`docs/forces-tests.md`** — the testing & conformance reference.
- **Release engineering** — CI (typecheck · test · build on every PR), `CONTRIBUTING.md`,
  `RELEASING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`, and issue/PR templates.

### Fixed

- **Vortex binds its orbit into a whirlpool.** Its inward bias (0.12) was far too
  weak to provide centripetal binding, so particles gained tangential speed and
  drifted *outward* — a feeble swirl that read like gravity. Raising it to 0.6
  binds the orbit: matter circles ~1.2× while spiralling gently in, a real
  whirlpool (tangential still dominates ~1.7×). Driven by headless orbit-count
  sweeps; the conformance exact-Δv and the `attract vortex` composite are updated.
- **Drag's no-redirection check is velocity-relative.** It hardcoded Δvy = 0 —
  true only for horizontal motion — so tuning a test particle's vy flipped a
  correct drag to NO MATCH. Drag is `v −= v·k`, so Δv is anti-parallel to v at any
  velocity; the check now asserts no perpendicular component (cross ≈ 0).
- **The emitter Lab scenario fires from the nozzle**, so it demonstrates the jet
  (relaunched fast along the heading, receding from the body) instead of sitting
  in the feed zone, where it read as an attractor.
- **`collide` now conserves momentum in the trajectory.** It resolved only `p` and
  trusted `q`'s later turn, but the integrator processes particles sequentially, so `q`
  read `p`'s already-changed velocity — an order-dependent, non-conserving result. The
  pair is now resolved symmetrically in one pass (equal & opposite impulses), giving a
  proper equal-mass elastic bounce.
- **Conformance experiments tightened** — `thermal` isotropy is measured over a 150-body
  cloud (ratio ≈ 1, not a single noisy walk); `collide` is centred in positive space and
  approaches slowly so the bounce is clear (gap 20 → 31) and gains a velocity-reversal
  check; `wind` uses a stronger gust; the `gate` expectation wording is corrected
  ("reflected back along n").

### Changed

- **The site front door** — the Field Manual is now the home page (`/reference` redirects
  to `/`); client-side navigation keeps the field running continuously across pages.

### Performance

- Range-culled the integrator body-force loop (~2× at scale) and removed all
  `shadowBlur` from the render path; cached the per-frame `scrollHeight` read.

## 0.1.0 — the complete engine

The first feature-complete milestone: the full reciprocal-field engine, a
self-documenting site, and adapters for any stack. Every ROADMAP item is checked.

### Engine

- **26 forces** — the canonical nine (§6); seven **natural primitives** (`gravity`,
  `charge`, `magnetism`, `thermal`, `collide`, `diffuse`, `propagate`; §20.10); nine
  **designed-extended** forces and two **modifiers** (`lens`, `gate`, `buoyancy`,
  `shear`, `crystallize`, `align`, `wind`, `cohesion`, `resonate`, `spotlight`; §20.3).
- **Env services** — spatial-hash `neighbors`, the scalar `grid` (diffusion + leapfrog
  wave), the integrator **modifier pass**, and **first-class mass** (`a = F/m`).
- **Preset layer** (§20.9) — `blackhole`, `whitehole`, `star`, `quasar`, `galaxy`,
  `nebula`, `tornado`, guarded by a registry cross-check.
- **Full `FieldHandle` API** — `scan`/`setAccent`/`setFormation`/`threads`/`burst`/
  `setPalette`/`destroy`, proxied onto `<forces-field>`.
- **Color templates** — `ours`, `heatmap`, `infrared`, `spectrum`.
- **§20.2 reconciliation** — a canonical color for every registered force.

### Site (field-ui.com)

- The engine-driven **home** page; **`/reference`** — the Field Manual, rendered from
  the catalog (pinned to the engine by a completeness test) with a playable demo;
  **`/lab`** — paint forces on the page, watch the single field react, share via URL.

### Adapters

- The `<forces-field>` **custom element**, the framework-free **`mountField()`**, and
  the **`@forces-ui/react`** `<ForcesField>` component + `useForcesField` hook.

### Quality

- **162 core tests**, every merge green-and-tested.
- **Zero runtime dependencies** in the engine; React is a peer dependency of the React
  adapter only.
