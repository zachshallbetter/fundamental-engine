# Open work — status as of 2026-10-19

What is open, in flight, or deliberately left, with evidence and a concrete next step. IDs like `M7`
refer to [`docs/analysis/engine-audit-2026-10-14.md`](../../docs/analysis/engine-audit-2026-10-14.md).
Update this file when you close or open something; delete lines that stop being true.

## Released state

npm `latest` = **0.11.1** (2026-10-14). `main` is ahead of it with #1248, #1249 (site) and #1250
(x-ray hotkey + body-swap fix, in `[Unreleased]`). Next release is a patch unless a protected symbol
changes.

## Engine defects — open

| ID | What | Evidence / where | Next step |
|---|---|---|---|
| #1207 | `reaction: true` not deterministic across repeated runs in one process | PR #1208 identifies construction-time clock origin as the mechanism; the original shared-probe explanation was a hypothesis | Fix PR #1208 conflicts; inspect its shared merge base, preserve repeated-run regression coverage, reconcile newer main changes, and re-run gates under #1274 |
| #1176 | parity `force-tokens` counts registration, not reachability | issue; Kotlin `warp` case | Kotlin fix #1175 conflicts; recover with public pairing-path tests under #1274, then address the broader reachability gate |
| M7 | reduced-motion gaps: `burst()` sparks gated at boot (`field.ts` ~334/923), threads/waves animate from wall clock, `bindFieldNav` checks only at bind; `prefersReducedMotion()` allocates a `MediaQueryList` per frame | audit (code trace) | read reduced motion live in the spark gate; scale wall-clock animations by the motion budget; cache the media query |
| M10 | `query()`/`snapshot()` relationships are only `addEdge` edges — pattern/DOM relationships invisible to the read API | `field.ts` `programmaticEdges` in query/snapshot | decide: merge `RelationshipRegistry` edges into readings, or document the split as the contract |
| M5 | `<field-root>` runs up to three rAF loops (platform runtime, engine, pattern drive) interleaving writes and layout reads in one frame | `elements/src/platform-runtime.ts`, `field.ts` measure/movers/threads, `dom/src/apply-recipe.ts` | consolidate onto the six-phase scheduler or order reads before writes |
| M12 | off-thread render bridge: OffscreenCanvas never resized; buffer pool never fits above 1000 particles; no worker `error` handler | `dom/src/worker/offthread-bridge.ts` | resize message + pool growth + error → fallback |
| L1 | React: inline `palette`/`overlay`/`waveCenter` props rebuild the field every render; `useFieldField` drops `restingMotion` | `react/src/index.tsx` | depend on stable keys / use the live setters; pass `restingMotion` |
| L2 | `FrameScheduler.recorded` grows unbounded in non-strict mode | `dom/src/schedule.ts` | ring buffer or cap |
| L5/L6 | internal code still calls deprecated `*Recipe` aliases; canonical names (`compilePattern`, `destroyPattern`, `bindFieldNav`, …) lack tests while aliases have them | audit counts: core 87/391 exports untested by name | move internal callers and tests to canonical names **before** the 1.0 alias removal |
| L7 | stale docs/comments describe `forces:*` events as live | `field.ts` comment near the body-event wiring; `docs/planning/1.0-removal-checklist.md` | edit both |
| L8 | small costs: 1200 ms idle timer runs in hidden tabs; scroll handler does `querySelectorAll('[data-formation]')` + rects per scroll event; x-ray rebuilds its DOM every rAF while open | `field.ts`, `dom/src/x-ray.ts` | stop the timer when hidden; cache formation elements; diff the x-ray readout |
| L9 (suspected) | a hovered `[data-hot]` element removed from the DOM leaves `hoverAccent`/thread links pointing at it | code trace only | reproduce first |
| — | `createField(canvas, …)` requires an `HTMLCanvasElement`, so headless callers cast `undefined as unknown as HTMLCanvasElement` (README, cookbook) | `core/src/engine/field.ts` signature | widen to optional (additive API change) and drop the casts |
| — | width-changing resizes (window drag) still rebuild per event | `field.ts` `resize()` | debounce the rebuild while keeping surface sizing synchronous |
| — | detached bodies are skipped at once but pruned only on the every-6th-frame measure, so an SPA swap leaves the old page's bodies acting from their last rect for up to 5 frames (consumers rescan on swap to cover it) | `field.ts` measure cadence; zachshallbetter.com `d0b8eeb` | prune on detection in `measureBodies`'s caller, or on the next frame |
| — | `cargo fmt --check` fails on `rust/crates/fundamental-core/examples/cms.rs` | pre-existing; not run in CI | `cargo fmt`, then consider adding fmt to `rust.yml` |

## Repository state

- **14 open PRs report conflicts**: #1175, #1179, #1180, #1208, #1209, #1210, #1211, #1212, #1213,
  #1214, #1215, #1216, #1217, #1221. Current comparisons of all 17 open heads against `main` at
  `9fdea89b` find shared merge bases; the previous blanket no-ancestry claim was inaccurate. Inspect
  actual conflicts before choosing merge resolution or a separate recovery branch; see
  [`runbooks/workflow.md`](../runbooks/workflow.md#recovering-from-a-history-rewrite) and #1274.
- #1219 is clean with retrieved passing checks; review its interaction with #1216. #1229 is clean
  but explicitly held as a draft/do-not-merge. #1237 is mergeable but browser e2e and `conclusion`
  fail; diagnose those failures separately from ancestry/conflict recovery.
- Convergence #1274 tracks recovery and epic reconciliation; #1269 tracks contract investigations
  and site case studies; #1270 tracks comparative consumer audits, feeding #1271–#1273. #1111 remains
  parked research. Issue closure, merged implementation, released behavior and empirical validation
  are separate states.
- Perf (hardware) has rows that flake by one vsync step (see
  [`runbooks/gates-and-ci.md`](../runbooks/gates-and-ci.md#perf-hardware-on-the-titan-gpu-runner));
  `trails dprCap=1 density=64` is the most recent. Re-measure through the workflow if a row keeps
  failing with no code cause.
- `check:consumer` runs informational in CI (registry-dependent) and blocking in `release.yml`.
  Promoting it to required is a policy decision.
- `scripts/check-doc-links.mjs` checks markdown only; `.astro` hrefs are unchecked between audits. A
  post-build crawl of `apps/site/dist/**/*.html` would close that.

## Sites

- fundamental-engine.com: pick one positioning tagline (title / JSON-LD / `llms.txt` disagree) —
  maintainer's call. Optional next step for #1249: merge the adjacent `#how`/`#trust`/`#engine` and
  `#shipped`/`#hosts` sections (copy work).
- zachshallbetter.com: after the next engine release, bump the pin and remove the x-ray workaround
  (`XRAY_KEY` in `src/scripts/field-runtime.ts`). `interact.ts` rescans on every resize — debounce it
  or skip height-only changes. `textBodies` (hero/H1) and `threadOverlay` (article
  map) fit but change visuals — design decisions. See [`runbooks/sites.md`](../runbooks/sites.md).

## Strategic (maintainer's decisions, from the external review of 2026-10-14)

- Separate conformance classes (force · whole-simulation · isolation · observation · replay ·
  cross-platform) instead of one golden.
- A published support level per capability (declared → reachable → tested → conformant → validated),
  generated from the gates.
- Mid-tier mobile benchmarks that measure whole-application overhead; one independent third-party
  integration.
- Keep the world-substrate research (#1111) parked and separate from the production runtime.
