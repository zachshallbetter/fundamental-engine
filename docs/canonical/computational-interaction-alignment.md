> **Status: canonical (relationship doc).**
> How Fundamental relates to **Foundations of Computational Interaction (FCI)**, an external research
> framework maintained separately. This doc records the concept mapping and the **bounded** claim that
> connects them. It introduces no engine behavior and asserts no new API. Where a mapping names a
> Fundamental capability, the maturity column is verified against code as of the platform-runtime phase;
> when code and this doc disagree, the code wins — fix the doc.

# Fundamental and Foundations of Computational Interaction

Fundamental and FCI were built from opposite directions and met in the middle.

- **FCI** is a research program (top-down, from epistemology). It studies interaction as an explanatory
  target by separating declared *domain commitments, state, semantics, projection, representation,
  interpretation, opportunity, coupling, behavior, measurement, similarity, strategy, and evidence* so
  their relationships can be examined rather than assumed. FCI is pre-empirical and says so.
- **Fundamental** is a runtime (bottom-up, from code). It turns host objects into bodies in a shared
  field, applies forces, and exposes the running field as inspectable, queryable, replayable data.

They converge because both refuse the same shortcut: **presentation is not the system.** FCI separates
projection from meaning from behavior so confounds can be isolated; Fundamental separates
`FieldHost` / state / operational semantics / projection so a representation change does not silently
change the modeled system. This document maps one onto the other and — just as importantly — fences the
relationship so neither overclaims the other.

## Related documents

| Document | Role |
|---|---|
| [`definition-document.md`](definition-document.md) | What Fundamental *is* ("substrate, not wallpaper") |
| [`substrate-api.md`](substrate-api.md) | The shipped substrate read API (EXPERIMENTAL): `query` / `snapshot` / `diff` / `replay` / `projections` |
| [`causality-and-truth.md`](causality-and-truth.md) | The causality ladder and truth labels — Fundamental's evidence discipline |
| [`agent-safety-model.md`](agent-safety-model.md) | Agent-readable ≠ agent-writable; projections reveal, never mutate |
| [`system-contracts.md`](system-contracts.md) | Bodies, forces, passports, truth modes |
| [`api-stability.md`](api-stability.md) | The removal-protection contract — why FCI vocabulary is **not** forced into the public surface |
| [`../research/README.md`](../research/README.md) | Fundamental's own paper family (the FCI-adjacent, self-authored research) |

## 1. The bounded claim

The relationship is **methodological, not evidential**. Stated the way FCI states it:

> Foundations of Computational Interaction studies the relations among declared systems, projections,
> interpretation, opportunity, coupling, behavior, measurement, similarity, and strategy; Fundamental
> makes a bounded subset of those relations executable, replayable, and inspectable.

And the constraint that keeps it honest:

> **Neither proves the other.** Fundamental is one possible research instrument for FCI; running a field
> is not evidence that FCI's account is correct, and FCI's account is not evidence that Fundamental's
> physics is right.

Fundamental can make a *subset* of FCI's distinctions executable — projection, opportunity structure,
interaction state, snapshot, replay, and comparison inputs. It cannot make the empirical ones
(human interpretation, behavior, trust, accessibility outcomes, construct validity, causal
identification) executable; those remain research claims that no implementation can manufacture.

## 2. Concept alignment

Each row: an FCI concept, the Fundamental primitive that instantiates a bounded part of it, the file,
and the current maturity. `protected` = on the removal-protected public surface (`scripts/api-surface.data.mjs`);
`experimental` = shipped and callable but explicitly unfrozen; `planned` = designed, not built.

| FCI concept | Fundamental primitive | Where | Maturity |
|---|---|---|---|
| Domain commitments | Body contract (`data-body`) + force **passports** | `contracts/passport.ts`; `system-contracts.md` | `data-body` protected; passports shipped |
| System state / operational semantics | Field state + integrator + force pass | `engine/field.ts`, `engine/integrator.ts` | shipped |
| Projection (governed transform to a representation) | **Projection Registry** + `setRender` / `setOverlay` | `engine/field.ts` (`projectionRegistry`); `substrate-api.md` | registry experimental; render protected entry, unprotected shape |
| Projection contract (preserve / transform / omit / introduce) | Governance lint + accessibility-equivalent rules | `engine/governance.ts`; `05-projection-registry-governance.md` | MVP shipped; most rules planned |
| Representation | Render surfaces (underlay / overlay / typographic) | `visualization-methods-taxonomy.md` | shipped |
| Interpretation | *Out of scope for the runtime* — requires empirical study | — | not runtime |
| Opportunity / affordance / action availability | **Field Agent Consumption Model** (influence → consumer) | `agent-consumption-model.md`; `forAgent` in `engine/field.ts` | model shipped; `forAgent` experimental |
| Coupling (pathway that changes another's transitions) | **Forces** (the only coupling mechanism) | `dimensional-coupling.md`; `contracts/passport.ts` | shipped |
| Interaction episode / trace | Snapshot + diff over frames | `engine/field-snapshot.ts` | experimental |
| Measurement contract / truth modes | **Six truth modes** + truth labels | `contracts/passport.ts`; `causality-and-truth.md` | shipped |
| Similarity / comparison | `diff()` + cross-plane conformance golden | `engine/field-snapshot.ts`; `parity-matrix.md` | experimental / shipped |
| Scoped invariance (typed preservation across projections) | Cross-plane conformance golden + parity matrix (API / math / host) | `testing-and-conformance.md`; `parity-matrix.md` | shipped |
| Evidence discipline (claim only the level your data supports) | **Causality ladder** (Observed → Attributed → Explained → Replayed → Predicted) | `causality-and-truth.md` | shipped framing |
| Strategy | *Out of scope for the runtime* — latent, needs rival models | — | not runtime |
| Representation-independence | `FieldHost` SPI + empty-allowlist boundary test | `engine/host.ts`; `engine/dom-boundary.test.ts` | shipped |
| Field Query API (FCI names this as the readable surface) | `query()` — "the substrate's agent-/tool-readable surface" | `engine/field.ts`; `02-field-query-api.md` | experimental |

Two names line up exactly rather than merely mapping: **projection** ("reveal state, never mutate it")
and **coupling** ("the mechanism that changes another body's transitions"). Fundamental's lane
discipline ("no word lives in two lanes") and FCI's ontology independently assigned these words the
same meaning. That is the strongest single point of convergence.

## 3. Shared epistemic doctrines

Beyond vocabulary, the two frameworks adopted the same governing rules under different names:

| Doctrine | FCI form | Fundamental form |
|---|---|---|
| Presentation ≠ system | "semantic equivalence does not imply opportunity or behavioral equivalence" | "substrate, not wallpaper"; "projection reveals state; coupling changes state" |
| Metric ≠ construct | "a metric is not a construct" | truth modes separate physical / designed / hybrid; a reading is not the thing |
| Bounded claims | evidence ladder; "claims may stop at any level, must not skip levels" | causality ladder; "quote the highest level your data supports, and no higher" |
| Comparison honesty | incomparability over a forced score | conformance golden with calibrated tolerance; parity is typed, not scalar |
| Instrument ≠ proof | "Fundamental does not validate FCI" | this doc; `agent-safety-model.md` invariants |

## 4. What "sync" means — and what it does not

**Sync means:** the concepts are documented as related; Fundamental's primitives carry an explicit FCI
mapping; the public research framing (the `/writings` family, `/eli5` disclaimers) stays honest about
what is built versus predicted.

**Sync does not mean** importing FCI's vocabulary into Fundamental's public API. Three reasons, all
already ratified in this repo:

1. **The removal-protection contract** ([`api-stability.md`](api-stability.md)) keeps the stable surface tiny
   (`createField`, patterns, hosts, `data-body`). Renaming or adding `opportunity` / `coupling` /
   `interaction-episode` as public symbols is a semver-relevant, opinionated decision, not a doc fix.
2. **FCI's own separation** — "neither proves the other" — is violated if Fundamental rebrands itself as
   "the FCI runtime." Fundamental is *one* instrument FCI may use.
3. **Lane discipline** — Fundamental already owns `projection` and `coupling` with FCI-compatible
   meanings. Adding more research nouns risks collapsing lanes the engine deliberately keeps separate.

The alignment therefore lives in documentation and in the (already convergent) architecture, not in a
rename of the running code.

## 5. Falsification

Narrow or drop the claimed relationship if:

- projection and source model cannot be separated in practice in the engine;
- ports fail to preserve declared operational semantics (the conformance golden breaks);
- projection contracts / governance lint add no diagnostic or experimental value;
- opportunity structure cannot be enumerated reliably from `query()` / `forAgent()`;
- a simpler architecture controls the same variables with less complexity.

These mirror the falsification conditions in FCI's own framework statement. If any holds, this document
should be revised before the relationship is repeated elsewhere.
