---
title: "The Road to RC1 — What 'Release Candidate' Actually Gates"
description: "RC1 is a promise about stability, not a feature finish line. Here's what's frozen, what's proven in CI, and the honest list of gates still standing between Fundamental and 1.0."
summary: "What a release candidate means for Fundamental: the frozen API surface, the 10-of-11 green gates, and the four that remain — perf budgets, an AT pass, support, and full contract coverage."
date: 2026-06-26
category: release
author: "Zach Shallbetter"
draft: true
---

# The Road to RC1 — What "Release Candidate" Actually Gates

A release candidate is the most honest version number a project ships. It is not "done." It is a
claim with a falsifiable test attached: *we believe this is 1.0, and here is the gate list that has
to stay green to prove it.* Anyone can call something stable. RC1 means you wrote down what stable
*means* and wired it to CI.

So this is not a launch post. Fundamental is at `0.8.1`, [published on npm](/docs/getting-started),
and the path to RC1 is mostly walked. This is the ledger: what is already locked, what CI already
proves, and — the part that matters — what is still standing between here and a `v1.0.0` tag.

## What RC1 freezes

The center of a 1.0 promise is the public surface. From RC1 forward, that surface is **additive-only**:
new methods, options, forces, and modes may land, but renaming or removing a frozen symbol is a
breaking change that costs a major version. This is not a vibe — it is a gate. `check:api` pins the
frozen surface at **14 entries** (the core exports, the `data-body` body contract, the `<field-root>`
element surface), and the build fails if any of them move. The full contract lives in
[API stability](/docs/api/stability).

Three more things are locked by their own gates:

- The **64-recipe catalog** is frozen (`check:recipes`); new recipes go to an experimental set, never
  the locked one. See [portable recipes](/writings/06-portable-field-recipes).
- The **36-force catalog** is single-sourced and conformance-checked **across planes** — the same
  catalog generates the JS and the Swift port, and a golden test asserts they agree force-for-force.
  That cross-plane discipline is the subject of [one engine, four runtimes](/writings/one-engine-four-runtimes).
- The **signals-first default** (`render: 'none'`) is the baseline behavior, not a flag that might
  change under you. Why that is the right default is its own essay:
  [the invisible field is the baseline](/writings/render-none-the-invisible-field).

A frozen surface is what lets you build on something pre-1.0 without it shifting beneath you. Pin to
`~0.MINOR` and additive-only does the rest.

## What CI already proves

The [RC gate dashboard](/rc) is the live-ish scoreboard. Ten of eleven automated gates are green, and
they run on **every PR to `main`**, not as a pre-tag ceremony:

- **Engine gate** — `typecheck` + `build` + `test` across all packages.
- **`check:api`** — the 14-entry frozen surface, unmoved.
- **`check:dist`**, **`check:readme`**, **`check:recipes`** (64), **`check:cem`** (the Custom
  Elements Manifest) — the packaging and authoring surfaces stay consistent with the code.
- **E2E** — Playwright over the shipped pages (Chromium + mobile), pinning the invisible-field
  invariants: the `data-body` contract, the `--field-*` feedback channels, the engagement and
  relationship edges.
- **Swift macOS** and **Swift iOS Simulator** — the native port builds and tests on Apple platforms.
- **JS ↔ Swift force conformance** — the 36-force golden, so the two planes can't silently drift.

The thing worth noting is not the count. It is that the gates are *mechanical*. "It works on the
homepage" is not a gate; a test that fails the build is. That distinction is the whole ethos —
the same one behind [explainable behavior](/writings/08-explainable-interface-behavior): a claim
isn't real until something can refute it.

## What still gates 1.0

A release candidate that hid its remaining work would be exactly the kind of dishonest interface
this project exists to argue against. Four gates are still open, and they are open for good reasons.

- **Perf budgets (RC-7, #324)** — the one *pending* gate on the dashboard. The field is
  [fill-rate-bound, not particle-bound](/writings/the-field-is-fill-rate-bound), which means the
  budgets that matter are canvas/DPR/compositing numbers, and those have to be measured on real
  hardware before they can be frozen into CI. Headless rasterization reads far worse than a real GPU,
  so a fact sheet from actual devices comes first; the gate follows it. This is blocked on
  measurement, not on engineering.
- **Accessibility — real AT pass (RC-8, #325)** — the automated half is done: the reduced-motion
  lint passes and reduced-motion equivalents are a hard rule, not a nicety
  ([motion equivalence](/writings/04-motion-equivalence) is the full argument). What remains is a
  *logged* pass with actual assistive technology — a screen reader on the shipped pages, written down.
  A lint can prove a rule is followed; it cannot prove the result is usable. A person has to.
- **Contract coverage (RC-6, #323)** — a coverage guard is already load-bearing in CI: it fails the
  build if a public option or metric ships without a test naming it. The gate closes when that
  coverage is complete across every public attribute, metric, and option.
- **Support commitment, published (ST-5, #332)** — the support policy exists; the gate is that it's
  discoverable from the live site, scoped honestly to a solo maintainer. (As of this writing, it
  lives in the repo and still needs a home in the docs shell — a small, specific piece of work.)

None of these is a surprise feature gap. They are the unglamorous, load-bearing parts of meaning
"1.0": measured performance, verified accessibility, complete coverage, an honest support promise.

## What RC1 means if you're building on it

Concretely: you can adopt the frozen surface now and trust it not to rename out from under you. The
[handle API](/docs/api/handle) and the [options](/docs/api/options) are part of the contract; the
internal integrator and render code are not. Pin `~0.MINOR`. Read [getting started](/docs/getting-started)
for the install, and [the manifesto](/writings/the-interface-is-a-field-not-a-screen) for why any of
this is worth adopting in the first place.

## The honest close

RC1 is a candidate, not a coronation. The surface is frozen, the engine ships on the web and natively
on Apple platforms, the gates are mechanical and mostly green — and there are still no external users
and no controlled user study. The claim that a field makes an interface more legible is a hypothesis
with a protocol behind it, not a measured result. What there is, in place of a study, is the gate
list — and it is public, on [the dashboard](/rc), with one pending and three open and nothing
pretending otherwise.

That is the point of doing it as a *candidate*. The version number tells the truth before the
marketing does.

## Related reading

- [The Interface is a Field, Not a Screen](/writings/the-interface-is-a-field-not-a-screen) — the paradigm RC1 is stabilizing.
- [render: 'none' — The Invisible Field Is the Baseline](/writings/render-none-the-invisible-field) — the default behavior that's now locked.
- [One Engine, Four Runtimes](/writings/one-engine-four-runtimes) — the cross-plane (JS ↔ Swift) conformance behind the force gate.
- [The Field Was Never Particle-Bound](/writings/the-field-is-fill-rate-bound) — why the perf gate is measured on real hardware.
- [API stability](/docs/api/stability) — the freeze contract in full.
- [The RC gate dashboard](/rc) — the live gate scoreboard.
