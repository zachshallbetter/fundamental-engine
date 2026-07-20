# FCI Observatory

An inspection instrument for the empirical research program. **Not** a demo, a dashboard, a reference
implementation, or an analytics system.

Think of it as a debugger for computational interaction: every visible statement is reproducible from
recorded evidence, and a reviewer should never have to trust the UI.

## Run it

```bash
node scripts/emit-observatory-bundle.mjs   # capture evidence from the runtime
node apps/observatory/server.mjs           # → http://localhost:4410
```

No build step, no framework, no dependencies, no network access.

## The one architectural rule

**The Observatory never derives anything.**

```
living system  →  instrumentation adapter  →  normalized evidence log  →  Observatory
   (substrates)     (packages/core/src/world/observatory/capture.ts)        (this app)
```

The runtime stays authoritative. The app cannot import the runtime even if it wanted to — core's
`exports` map is closed and core must remain DOM-free — so the only path evidence can take is the
bundle. That constraint is what makes the instrument trustworthy rather than merely well-intentioned.

Scientific findings originate **only** from substrate experiments, pre-registered predictions,
adaptation, conformance, accepted discoveries, and accepted negative results. The Observatory
visualizes them. It cannot improve evidence, upgrade a hypothesis, reinterpret a prediction, or compute
a registry entry that is not already present.

This is enforced, not asserted: `packages/core/src/world/observatory/observatory.test.ts` walks this
app's source and fails if it contains a hardcoded discovery, prediction, negative result, or ablation
classification, or if it calls or reimplements any runtime derivation.

## Modes

**Replay** — a recorded execution of one substrate, scrubbable. Panes: World, Projection, Opportunity,
Episodes, Evidence, Timeline. Space toggles play/pause; ←/→ step.

**Research** — the research program itself: Corpus, Discoveries, Predictions, Projection lab, Ablation,
Cross-version.

## What it will refuse to show you

- A **pending** substrate never gets a fabricated run; it appears greyed out as pending.
- A substrate that cannot declare its transition law shows **no law**, not an empty one.
- An ablation the harness never executed is marked **unsupported**, with the reason.
- Episode groupings under different parameters are all retained; none overwrites another, and every
  result is labelled conditional.
- `inferred` state is structurally zero — the runtime does not infer state, so the category exists only
  so its emptiness is visible.
- Cross-version comparison with one revision loaded shows nothing rather than inventing a baseline.

## Cross-version comparison

```bash
git checkout <older-commit>
node scripts/emit-observatory-bundle.mjs --out /tmp/older.json
git checkout -
node scripts/emit-observatory-bundle.mjs
```

Then load `/tmp/older.json` in the Cross-version pane. It compares **scientific state** — discoveries,
negative results, prediction grades, churn, accuracy — never source text. A discovery that disappears
between revisions is flagged, because discovery identifiers are permanent.
