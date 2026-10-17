# Pitfalls — defect classes this codebase has actually had

Each entry: the symptom, the root cause, how it was found, the guard that now exists. Read this before
building something similar — most of these passed every test that existed at the time.

## Shipping and packaging

**A CLI bin that never runs under npm.** `npm create @fundamental-engine` exited 0 with no output and no
project in every release from 0.9.3 to 0.11.0. The entrypoint guard compared `import.meta.url` with
`argv[1]`; npm runs bins through a `node_modules/.bin/` *symlink*, so `argv[1]` is the link and never
matched. Tests spawned the file directly, never through a link. Found by building `check:consumer`.
Fixed in #1245 (`isEntrypoint` compares real paths). Guard: a symlink test in `create/src/cli.test.ts`,
and `check:consumer` (blocking in `release.yml`).
→ Any "am I the main module" check must resolve symlinks. Test CLIs the way users invoke them.

**`sideEffects` tree-shakes a registration.** `<field-cell>` is defined at the top level of
`dist/field-cell.js`, reached from `index.js` only via `export *`; `sideEffects` listed only
`./dist/index.js`, so every bundler dropped it for `import '@fundamental-engine/elements'`. Found with an
esbuild repro. Fixed in #1244. Guard: `elements/src/side-effects.test.ts` (every module that registers
at import time must be listed) and the `check:consumer` bundle assertion.

**A 0.x caret pins the previous minor.** Scaffolder templates said `^0.9.2`, which on 0.x means
`<0.10.0`, so new projects installed an engine two minors old. Fixed in #1239. Guard: the template range
must equal `^<create's minor>.0` (`cli.test.ts`); the release runbook moves it on minor bumps.

**A starter that fails its own typecheck.** The React template imported `./App.tsx` without
`allowImportingTsExtensions` (TS5097); `vite build` doesn't typecheck, so nobody noticed. Fixed in #1245.
Guard: `check:consumer` runs `tsc --noEmit` on every scaffolded template.

## Lifecycle and the DOM host

**Teardown from inside the frame doesn't stop the frame.** `frame()` re-armed `host.raf(frame)` after
running user callbacks, and `destroy()` can only cancel the id of the frame already executing — so a
`destroy()` from `onFeedback`, a `field.on()` handler or a `field:*` listener left a zombie loop writing
`--d` forever. Same shape in the elements platform runtime and the pattern drive loop. Fixed in #1238
with a `destroyed` flag checked before every re-arm. → Every self-re-arming loop needs that flag.

**Elements removed without a rescan become ghosts.** `measureBodies` measured a detached element as an
all-zero rect: a visible body at (0,0), still exerting force and pinning the old DOM in memory. Under
SPA navigation (Astro view transitions) this happened on every page. Fixed in #1238 (skip + prune
detached bodies). → Anything holding element references across navigation must check `isConnected`.

**Capturing `document.body` at mount.** SPA routers replace `<body>`. `mountXRay` appended its panel to
the body it captured at mount, so after a navigation the hotkey seemed to do nothing. Fixed in #1250
(resolve the parent at open time).

**Global hotkeys that fire while typing.** `mountXRay` toggled on `?` even inside inputs and
contenteditable editors. Fixed in #1250. → Any document-level key handler must skip editable targets
and modifier combinations.

## Performance

**Rebuilding on every resize.** Every `resize` rebuilt the whole swarm and rescanned the DOM; mobile
browsers fire a height-only resize continuously as the URL bar shows/hides, so the field reset
mid-scroll. Fixed in #1241 (soft resize within 160 px of the built height).

**Thresholds tuned to 60 Hz.** `QualityGovernor` escalated on absolute 20/33/50 ms, so a 30 Hz display
(iOS Low Power Mode) sat at tier 2 permanently with nothing overloaded. Fixed in #1241 (thresholds scale
with the measured frame budget; don't feed the governor until the budget is known).

**Re-rastering an unchanged canvas.** The overlay cleared and re-stroked a full-viewport canvas every
frame; at DPR 2 that is the work that tipped the GPU perf gate's `overlay=grid dprCap=2` row from 60 to
30 fps. Fixed in #1243 by recording each frame's draw calls and skipping identical frames — only for
the engine-owned canvas, because an injected backend (three's) finalizes a frame on the next `clear()`.
→ When skipping work, check every backend's contract for what "no calls this frame" means.

## Correctness of claims

**Docs that describe intent, not code.** The 2026-10-14 audit found: a README example passing the wrong
rect shape (silently empty field); "20 render modes" read as 20 `render` values; force counts of 33, 36
and 37 in different docs; the Rust plane described as 28/37 when it had 36; a "36-force golden" that
pins 6; reduced motion "becoming sound or haptics"; replay shown as a timeline; use-case pages naming
APIs that don't exist. Guards now: `check:readme-code`, the widened catalog-count doc test,
`check:readme`, and the no-inflation rule. → When you write a claim, find the line of code that makes it
true.

**Audit tools overstate too.** Subagent audits have miscounted and reported things "missing" or
"orphaned" that existed. An agent's own wording slipped once in this repo (a "each unit-tested" claim
that was true for 30 of 36; fixed in #1242). Verify findings — including your own — against the code
before publishing them.

## Determinism and parity

**Shared mutable state across fields.** `reaction: true` drifts monotonically across identical seeded
runs in one process; the suspected cause is a module-level probe in `streamlines.ts` reset field by
field rather than rebuilt (#1207, open; fix in #1208). The golden pins one force application, not
repeated whole runs. → Test determinism as "N identical runs in one process are byte-identical".

**Registered is not reachable.** The parity matrix counted Kotlin `warp` as supported while nothing set
its pairing state, so it always returned at its first guard (#1176, open; Kotlin fix in #1175).

## Repository operations

**A bulk history rewrite strands every open PR** and re-pushes old tags, which re-triggers the release
workflow. See [`runbooks/workflow.md`](../runbooks/workflow.md#recovering-from-a-history-rewrite).

**Shared checkouts and a shared stash.** Parallel agents in one checkout commit onto each other's
branches; `git stash` is shared across all worktrees of a repo. One worktree per task; named stashes.

**Re-running CI doesn't re-merge.** A re-run tests the PR's original merge commit. After `main` moves,
merge `origin/main` into the branch to test the combination.
