# Substrate-alignment pass — report

_Completed 2026-07-01. A consolidation/propagation pass (no new architecture) bringing the docs, README,
site, API pages, examples, and release framing into alignment with the current positioning._

## The center

> **Fundamental is an inspectable relational substrate for software behavior.**
> Developer-facing: _a readable behavior layer for host objects._

Organizing model — the five verbs:

| Verb | Meaning |
|------|---------|
| **Declare** | Host objects become bodies (`data-body`, `addBody`, `addEdge`; `MinimalFieldHost` + `FieldBodyIdentity` off the DOM). |
| **Influence** | Forces act through declared channels — accumulated centrally, deterministic, replayable. |
| **Read** | `query()` / `snapshot()` expose the field as plain, serializable state. |
| **Reveal** | Projections express state through CSS vars, DOM attributes, JSON, native views, overlays. |
| **Govern** | Policy, budgets, redactions, lane lints, reduced-motion — what runs and what an agent may read. |

The host owns domain truth; Fundamental owns relational field state; projections reveal it; queries expose
it; policy decides what may be read. Fundamental does not decide whether a claim is true.

## What shipped

### The 7-PR alignment sequence
| PR | Scope | # |
|----|-------|---|
| 1 | Terminology cleanup — global formation modes ≠ Field Formation; host-native (not DOM-first); Body broadened beyond DOM; snapshot disambiguation | merged |
| 2 | Feedback channel — `--d` first, `--field-density` as the field-namespaced alias (right direction) | merged |
| 3 | Event/status corrections — no shipped event described as future; parity vs conformance vs readiness; status chips | merged |
| 4 | Docs landing + reader path — choose-your-path, Start/Build/Reference/Substrate/Assurance/Research/Frontier IA, promoted AI Evidence + Substrate Demo | #905 |
| 5 | Safety & policy doctrine — `agent-safety-model.md` (agent-readable ≠ writable; snapshots exclude private by default; projections may not mutate) | #907 |
| 6 | Host model & conformance — `host-model.md` (the FieldHost adapter contract, `MinimalFieldHost`, capability ladder, conformance checklist) | #910 |
| 7 | Data honesty — reusable `DataHonesty` component across 20 evidence/example/study pages (source · snapshot · live-refresh · what the field does NOT claim) | #911 |

### Homepage restructure (changed the page's _job_ from "show the full engine" to "prove the substrate, then route to proof")
- **P1** hero + doctrine copy: "readable behavior layer for host objects" leads; physics demoted; dropped
  the "first that enforces" firstness claim; fixed the `--d` / relationships-associate doctrine.
- **P2** de-stuff: moved the ~1000-line executable manual to a dedicated **`/engine-tour`** page; the
  homepage collapsed 1459 → 284 lines behind a compressed "the full engine, live" card. e2e retargeted.
- **P3** spine: reorder to hero → inbox proof → AI proof → **How it works (5 verbs)** → why → install →
  **Hosts** (web/native/renderer/**headless**) → **Trust** → engine card → **Explore**.
- **P4** align the site-wide footer tagline; verified reduced-motion preserves meaning.

### `/demo` rebuilt — "One field. Two readings."
The substrate proof, in one screen: the same field read as interface (type + ink) and as `field.query()`
JSON — the density on a body equals the density in the JSON. _An agent reads the field, not the DOM._

## Status vocabulary (applied consistently)
- **Shipped** = callable and code-confirmed · **Experimental** = not frozen · **Stable** = in the frozen
  public API · **Canonical** = conceptually authoritative. The substrate read API is _shipped and
  documented, but experimental and unfrozen_; "canonical" never implies "stable".

## Verification
- **10-phrase anti-pattern sweep** across `docs/canonical`, `docs/engine-reference`, `apps/site/src`:
  **all clean (0 hits)** — no `DOM-first`/`platform-native DOM`, no setFormation-as-Field-Formation, no
  field-as-wallpaper, no `--field-density`-as-primary, no `next slice`, no Body-only-DOM, no "first that
  enforces", no agent-writable implication, no old tagline, no projection-mutation claims.
- Full site build green; e2e retargeted for the moved manual + regrouped nav IA; internal doc links resolve.
- The llms corpus (`llms.txt` / `llms-full.txt`) is a **build artifact** — regenerated from source by
  `gen-llms.mjs` at deploy (gitignored, not hand-edited). Post-pass it carries 33 canonical docs.

## Follow-ups captured (out of scope — not fixed here)
- **Deeper homepage art-direction** (palette / type system / hero spacing) left for hand-tuning — P1–P3
  delivered the structure + copy; the visual foundation is calm but subjective polish remains.
- **`budgets.agentRead` fractional gradient** is DECLARED-not-yet-enforced (only the `0` boundary is wired);
  `agent-safety-model.md` documents only the shipped behavior.
- **Host-conformance table overlap** between `platform-architecture.md` and `host-model.md` — an IA call
  (which doc should own the checklist) rather than a correctness issue.
- **`demo.astro` / `examples.astro`** carry no data-honesty strip (no external dataset to describe).
