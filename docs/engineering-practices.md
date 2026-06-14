> **Status: living standard.**
> The engineering doctrine this repo actually runs on, distilled from the 2026 build arcs
> (the invisible-fields family, the platform extractions, the QA audits, the docs rebuild).
> Unlike `docs/canonical/` (which governs *concepts*), this governs *practice*. When a
> lesson is earned, it gets written here; when a bug class repeats, it gets a lint rule.

# Engineering practices

## 1. The verification ratchet

The project's defining habit: every failure becomes permanent infrastructure, one level up.

```txt
a bug            -> an e2e test that pins the fixed behavior
a bug CLASS      -> a lint rule that catches every future instance
a manual audit   -> a permanent spec (the audit re-runs on every PR)
a refactor       -> executed against the pinned suite as its parity harness
```

Concretely: the example pages' invariants became `apps/site/e2e/` (chromium + webkit +
mobile); the homepage audit became `home.spec.ts`; the silent-feedback bug class became
`sink-without-feedback` / `feedback-vars-unwritten` in `packages/platform/src/lint.ts`; and
the #228 write-path migration shipped with **zero observable change** because the suite it
was tested against was built from real bugs first. Protect this ratchet — it is worth more
than any individual fix.

A corollary: **an exception list in a test is tracked debt, not resolution.** Each entry
names a silent gap the suite is agreeing not to see. Burn-downs replace the entry with a
positive check — `home.spec.ts`'s `UNTRACEABLE = ["fieldflow", "warp"]` became two probe
recipes plus per-force demo-accuracy tests, and the boot test now asserts every
chip-bearing stage holds exactly one traced canvas, no carve-outs.

## 2. The house bug class: silent contract gaps

Fundamental's authoring model is declarative attribute pairs, and their failure mode is never
an error — it is a page that quietly shows nothing. We have shipped this class repeatedly:

| Instance | The silent gap |
|---|---|
| Evidence deferral was a visual no-op | author `display: grid` silently defeats the UA's `[hidden]` rule |
| Threads' depth variable | a page-local `--d` silently shadowed the engine's density channel |
| The accretion vessel (and two more homepage sinks) | `data-absorb` without `data-feedback` — captured for months, displayed nothing |
| Eight stage canvases missing | a tracer's `return null` for unknown tokens read as a design choice |
| The fieldflow demo chip | a transport force with no field-radiating sibling is a kinematic no-op — the stage looked plausibly alive (ambient drift) for months |

The rules:

- When designing an attribute contract, ask **"what happens if the author forgets the other
  half?"** If the answer is "nothing, silently" — add a lint rule the same day.
- Silent fallbacks in dev deserve a `console.warn` (DEV-gated). Nobody reports a bug that
  looks intentional.
- Page-local CSS custom properties must not collide with the engine's channels (`--d`,
  `--load`, `--lit`, `--field-*`). Prefix page locals (`--cc`, `--depth`, `--bar`).

**Sub-variant: the custom-element upgrade race.** Imperative method calls on a
`<field-root>` (or any custom element with a deferred boot) made before `customElements.define`
runs land on a bare `HTMLElement` and are silently dropped. `Base.astro` defers
`import('@fundamental-engine/elements')` to `requestIdleCallback` — but Safari has no
`requestIdleCallback`, so the upgrade fires on a plain `setTimeout(300)` there. Any call that
races this window sets durable wrong state in WebKit and is invisible in Chromium (which wins
the race almost always). Observed in `ForcePicker.ts`: `setOverlay('streamlines')` called at
IO-entry produced a permanently dark overlay in ~50 % of WebKit runs
(`home.spec.ts:103` data-forcepick test).

The fix: **drive long-lived field state through attributes, not methods.** Attributes set
pre-upgrade become the engine's construction-time config; set post-upgrade they forward through
`attributeChangedCallback` to the same setters — the race window is closed.

```ts
// ❌ method call — drops silently if element not yet upgraded (Safari)
field?.setOverlay?.('streamlines');

// ✓ attribute write — works pre- and post-upgrade
field?.setAttribute('overlay', 'streamlines');
```

One-shots (burst, flowTo) may stay imperative — they have no meaningful pre-upgrade behavior.
IO-driven toggles (attention, causality) and any mode that must survive a boot restart should
use attributes.

## 3. Verify in the browser; treat probes as suspects

Reading a diff catches structure; only running the page catches behavior. But the second
craft is harder: **in a mature codebase, most "broken" findings are broken probes.** Lessons
paid for:

- Synthetic `PointerEvent`s with fake `pointerId`s make `setPointerCapture` throw — drive
  the real input pipeline (Playwright's mouse/touchscreen, CDP touch) before declaring a
  drag broken.
- Attributes are scan-time inputs; live state is engine-side. Reading `data-*` to detect a
  runtime change tests the wrong layer — read the written CSS variables or pixels.
- IntersectionObserver gates mean "it didn't fire" usually means "it wasn't visible."
- WebKit catches *event-delivery* bugs chromium masks (a leading mouse-move releasing a
  dwell focus). CI Linux WPE delivers pointer events sparsely under software rendering —
  pace gesture input mechanics; never weaken assertions to pass.
- When a probe artifact reveals fragility anyway (a capture throw killing a drag), harden
  the page regardless of who triggered it.

## 4. Honest data, honest status

- Committed snapshots are the SSR baseline and the no-JS truth; pages may upgrade to live
  data in the browser and must SAY so (the provenance chip contract: `live · checked Ns
  ago` / `snapshot · <date>`, `(local)` for client-diverged state, `+N since snapshot`).
- Refresh cadence matches the source's real update rate. Polling a daily aggregate is
  theater; say so in the page's how-built section.
- The status rule (`docs/canonical/documentation-standards.md`) applies to code
  comments and PR prose too: nothing is "shipped" until code confirms it, and `main` moves
  fast enough that "planned" claims must be re-verified before acting on them.

## 5. Multi-agent builds (what actually works)

- **Foreground agents.** Background agents get orphaned by session restarts.
- **Strictly disjoint file ownership**, declared in every prompt, with shared files
  sequenced into waves. Name the concurrent agents' territories so build noise is ignorable.
- **Verified facts travel in the prompt** ("this is verified — do not re-derive"), and the
  load-bearing assumption gets verified by the orchestrator *first* (the one unverified
  assumption we delegated produced the only hollow integration of the arc).
- Unique `--outDir` per agent for site builds; the e2e webServer port (4399) is contended —
  wait/retry, don't fight.
- The orchestrator independently re-verifies the headline claim of each agent report before
  merging. Agents are honest but their probes have the same failure modes as §3.

## 6. The gate

Before declaring done or merging, always:

```txt
pnpm typecheck · pnpm build · pnpm test
pnpm check:api · check:dist · check:readme · check:recipes · check:cem
pnpm --filter @fundamental-engine/site test:e2e     (chromium + webkit + mobile)
```

CI runs the same gate plus the e2e matrix on PRs; `snapshots.yml` refreshes example data
weekly. Releases go through a tag → `release.yml` only (provenance requires CI; a failed
partial publish is retried with `gh run rerun --failed` — it is idempotent per-package).

## 7. Scope honesty

Epics get assessments, not cramming. A grounded plan comment on the issue (what exists, what
the slice is, what the parity harness will be) beats a rushed half-implementation — and the
assessment gets *better* as the infrastructure around it grows (#228 waited until its parity
harness existed, then executed cleanly in one pass).
