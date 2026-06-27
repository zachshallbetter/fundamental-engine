---
title: "The Road to 1.0 — What the RC1 Gates Actually Prove"
description: "Fundamental isn't a release candidate yet — it's at 0.8.1, working the gate program that produces one. Here's what's already frozen, what CI proves, and the gates still standing between here and a 1.0.0-rc.1 tag."
summary: "The honest path to 1.0: what's locked in 0.x today, the 10-of-11 green gates, and the four that must pass before 1.0.0-rc.1 can be cut — perf budgets, an AT pass, support, and full contract coverage."
date: 2026-06-26
category: release
author: "Zach Shallbetter"
draft: false
---

# The Road to 1.0 — What the RC1 Gates Actually Prove

The most honest thing a project can do before 1.0 is publish the list of things that have to be true
first — and then refuse to cut the tag until they are. Fundamental has that list. It's called the
**RC1 gate program**, and this is its ledger.

First, a precise word about names, because it's easy to overclaim one. Fundamental is at `0.8.1`,
[published on npm](/docs/getting-started). It is **not** a release candidate — no `1.0.0-rc` build has
been cut. "RC1" is the name of the *gate program*: the set of predicates that must all go green before
a real `1.0.0-rc.1` can be tagged. The sequence the [release-gate spec](/docs/api/stability) defines
is deliberate:

> `0.8.1` (today) → **RC1 gates all green** → cut `1.0.0-rc.1` → a quiet window (two consecutive RC
> releases with zero breaking change) → promote → `1.0.0`

So this is not a launch post, and it isn't a "we're at RC" post either. It's the map between here and
the first tag that earns the letters "rc."

## What's already frozen (in 0.x, today)

A common misconception is that 1.0 is when the API stops moving. It already has. The public surface is
**frozen for the entire `0.x` line** — not "from RC1 forward," now — and the freeze is **additive-only**:
new methods, options, forces, and modes may land, but renaming or removing a frozen symbol is a
breaking change. This isn't a vibe; it's a gate. `check:api` pins the frozen surface at **14 entries**
(the core exports, the `data-body` body contract, the `<field-root>` element surface) and fails the
build if any of them move. The full contract is in [API stability](/docs/api/stability).

Three more surfaces are locked by their own gates today:

- The **64-recipe catalog** is frozen (`check:recipes`); new recipes go to an experimental set, never
  the locked one. See [portable recipes](/writings/06-portable-field-recipes).
- The **36-force catalog** is single-sourced and conformance-checked **across planes** — the same
  catalog generates the JS and the Swift port, and a golden test asserts they agree force-for-force.
  That cross-plane discipline is the subject of [one engine, four runtimes](/writings/one-engine-four-runtimes).
- The **signals-first default** (`render: 'none'`) is the baseline behavior, not a flag that might
  change under you. Why it's the right default is its own essay:
  [the invisible field is the baseline](/writings/render-none-the-invisible-field).

This is what lets you build on a pre-1.0 library without it shifting beneath you. Pin to `~0.MINOR`
and additive-only does the rest — that guarantee is in force right now, well ahead of any `rc` tag.

## What CI already proves

The [RC gate dashboard](/rc) is the scoreboard. Ten of eleven automated gates are green, and they run
on **every PR to `main`**, not as a pre-tag ceremony:

- **Engine gate** — `typecheck` + `build` + `test` across all packages.
- **`check:api`** — the 14-entry frozen surface, unmoved.
- **`check:dist`**, **`check:readme`**, **`check:recipes`** (64), **`check:cem`** (the Custom
  Elements Manifest) — the packaging and authoring surfaces stay consistent with the code.
- **E2E** — Playwright over the shipped pages (Chromium + mobile), pinning the invisible-field
  invariants: the `data-body` contract, the `--field-*` feedback channels, the engagement and
  relationship edges.
- **Swift macOS** and **Swift iOS Simulator** — the native port builds and tests on Apple platforms.
- **JS ↔ Swift force conformance** — the 36-force golden, so the two planes can't silently drift.

The point isn't the count. It's that the gates are *mechanical*. "It works on the homepage" is not a
gate; a test that fails the build is. That distinction is the whole ethos — the same one behind
[explainable behavior](/writings/08-explainable-interface-behavior): a claim isn't real until
something can refute it.

## What still has to go green before `1.0.0-rc.1`

A gate program that hid its remaining work would be exactly the kind of dishonest interface this
project exists to argue against. Four gates are still open, and they're open for good reasons.

- **Perf budgets (RC-7, #324)** — the one *pending* gate on the dashboard. The field is
  [fill-rate-bound, not particle-bound](/writings/the-field-is-fill-rate-bound), which means the
  budgets that matter are canvas/DPR/compositing numbers, and those have to be measured on real
  hardware before they can be frozen into CI. Headless rasterization reads far worse than a real GPU,
  so a fact sheet from actual devices comes first; the gate follows it. Blocked on measurement, not
  on engineering.
- **Accessibility — real AT pass (RC-8, #325)** — the automated half is done: the reduced-motion lint
  passes and reduced-motion equivalents are a hard rule, not a nicety
  ([motion equivalence](/writings/04-motion-equivalence) is the full argument). What remains is a
  *logged* pass with actual assistive technology — a screen reader on the shipped pages, written down.
  A lint can prove a rule is followed; it can't prove the result is usable. A person has to.
- **Contract coverage (RC-6, #323)** — a coverage guard is already load-bearing in CI: it fails the
  build if a public option or metric ships without a test naming it. The gate closes when that
  coverage is complete across every public attribute, metric, and option.
- **Support commitment, published (ST-5, #332)** — the support policy exists; the gate is that it's
  discoverable from the live site, scoped honestly to a solo maintainer. (As of this writing it lives
  in the repo and still needs a home in the docs shell — a small, specific piece of work.)

None of these is a surprise feature gap. They're the unglamorous, load-bearing parts of meaning "1.0":
measured performance, verified accessibility, complete coverage, an honest support promise. Only when
all of them are green does `1.0.0-rc.1` get cut — and even then, the stable `1.0.0` waits on a quiet
window of RC releases that force no breaking change. The `rc` period is allowed to do its job.

## What this means if you're building on it

Concretely: you can adopt the frozen surface now and trust it not to rename out from under you — that
guarantee predates the `rc`, it doesn't wait for it. The [handle API](/docs/api/handle) and the
[options](/docs/api/options) are part of the contract; the internal integrator and render code are
not. Pin `~0.MINOR`. Read [getting started](/docs/getting-started) for the install, and
[the manifesto](/writings/the-interface-is-a-field-not-a-screen) for why any of this is worth adopting
in the first place.

## The honest close

Calling this "the road to RC1" instead of "we shipped an RC" is the point. The surface is frozen, the
engine ships on the web and natively on Apple platforms, the gates are mechanical and mostly green —
and there are still no external users, no controlled user study, and no `1.0.0-rc` tag. The claim that
a field makes an interface more legible is a hypothesis with a protocol behind it, not a measured
result. What there is, in place of a study, is the gate list — public, on [the dashboard](/rc), with
one pending and three open and nothing pretending otherwise.

The version number tells the truth before the marketing does. `0.8.1` means `0.8.1`.

## Related reading

- [The Interface is a Field, Not a Screen](/writings/the-interface-is-a-field-not-a-screen) — the paradigm the gate program is stabilizing.
- [render: 'none' — The Invisible Field Is the Baseline](/writings/render-none-the-invisible-field) — the default behavior already locked in 0.x.
- [One Engine, Four Runtimes](/writings/one-engine-four-runtimes) — the cross-plane (JS ↔ Swift) conformance behind the force gate.
- [The Field Was Never Particle-Bound](/writings/the-field-is-fill-rate-bound) — why the perf gate is measured on real hardware.
- [API stability](/docs/api/stability) — the freeze contract in full.
- [The RC gate dashboard](/rc) — the live gate scoreboard.
