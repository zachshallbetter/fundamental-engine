# F1 — build-ready execution spec

> **Status: proposed build spec (no code written).** Converts the ratified-provisional M1.5 decisions
> into an implementable design so F1 can start immediately on your explicit go. **Writing kernel code is
> still gated (G2)** — this document commits nothing to `packages/core` and touches no frozen surface.
> Decisions are parameterized on the M1.5 records ([`m1.5/`](m1.5/README.md)); if a decision changes at
> ratification, only the referenced record + the matching section here change. See [`PLAN.md`](PLAN.md)
> F1.0–F1.6 for acceptance criteria.

## Placement & surface policy
All F1 code lands under a new **experimental** module, exported through no frozen door:

```
packages/core/src/world/
├── envelope.ts        # F1.0 version envelope (M1.5-07)
├── kernel.ts          # K types + FieldPattern hosting (M1.5-06)
├── opportunity.ts     # F1.2 Ω_sys (M1.5-04)
├── interaction.ts     # F1.3 candidate-episode detection (M1.5-03)
├── ablation.ts        # F1.4 four-ablation harness (M1.5-08)
├── vectors.ts         # plane-neutral conformance vectors (R4)
└── world.test.ts      # top-level src test (contract-coverage guard scans src/*.test.ts)
```

Nothing here is added to `scripts/api-surface.data.mjs` (stays EXPERIMENTAL, R5). Core-boundary rule
holds: no DOM (`engine/dom-boundary.test.ts` empty allowlist).

## F1.0 — Version envelope  (M1.5-07)
Eight independently-versioned fields; incompatible load **fails**, never coerces.

```ts
export interface WorldVersionEnvelope {
  worldInstance: string;        // opaque instance id
  worldSchema: string;          // shape of declared state/ontology
  kernelSemantics: string;      // K evolution semantics
  contractSchema: string;       // contracts in force
  projectionContract: string;   // projection(s) that produced any representation
  implementation: string;       // engine build + plane, e.g. "js@<FIELD_VERSION>"
  conformanceVector: string;    // golden-vector version this was checked against
  migrationChain: string[];     // ordered schema migrations applied (identity only in F1; tooling in F4.4)
}
```
**Acceptance (PLAN F1.0):** every serialized world + trace carries the envelope; a load whose envelope is
incompatible on any field throws `IncompatibleWorldVersion` (no silent migration).

## F1.1 — Kernel `K` hosting a Field Pattern, three equivalences  (M1.5-06)
`hostFieldPattern(pattern): World` wraps an existing compiled `FieldPattern` as a `World` without changing
its behavior. Prove with three tests + a structural guard:

- **Operational:** run the hosted world and the raw field on identical seeded input (`rng`/`now` injected
  as today); assert identical numeric output **and** transition traces (reuse the conformance golden path).
- **Structural:** every body / relation / dimension / field config maps to a kernel element with a
  **total, lossless** round-trip (`toKernel`/`fromKernel` identity); no field concept is dropped or aliased.
- **Invariant:** existing invariants, `replay()` output, and failure conditions are unchanged.
- **No escape hatch:** a lint/test asserts the `kernel.ts` public type exposes **no** `FieldPattern`-typed
  field or `any` passthrough — the generic kernel must not smuggle a field-specific door.

**Acceptance (PLAN F1.1):** all three equivalences pass + the escape-hatch guard is green.

## F1.2 — System-relative opportunity `Ω_sys`  (M1.5-04)
One predicate for one (participant, operation, state, projection). **Belief `Ω̂` is out of scope.**

```ts
// Ω_sys = f(X, 𝒪, Cap, Auth, Reach, Π, H)
export function evaluateOpportunity(ctx: OpportunityContext, op: Operation): OpportunityProfile;

interface OpportunityProfile {           // all runtime-derived (M1.5-01), all serializable
  domainValid: boolean;
  capable: boolean;                       // Capable(participant, op, object, state, environment, substrate)
  permitted: boolean;                     // Permitted(participant, op, object, scope, state, time, authoritySource)
  enabled: boolean;
  reachable: boolean;
  exposed: boolean;                       // projection-relative
  signaled: boolean;                      // projection-relative
  reversible: boolean;
  recoveryPaths: OperationRef[];
  // NO believed/interpreted field — see M1.5-01 empirical class
}
```
**Acceptance (PLAN F1.2):** computes + serializes; a static test asserts no belief/interpretation field
exists on the type.

## F1.3 — Candidate-episode detection  (M1.5-03)
Boundary is a **declared parameter**; output is a candidate under that boundary, with alternates reported.

```ts
export function detectInteractions(trace: TransitionTrace, params: {
  participants: ParticipantRef[]; boundary: Boundary; timescale: Timescale;
  recurrenceWindow: Window; couplingPredicate: CouplingPredicate; minimumInfluence: number;
}): EpisodeResult;

interface EpisodeResult {
  episodes: CandidateEpisode[];           // each: supporting transition pairs, boundary used,
                                          //       recurrence/reciprocity basis, determinacy
  alternateSegmentations: Segmentation[]; // reported, NOT errors
  failures: { reason: string }[];         // where no episode qualifies under the declared boundary
}
```
**Adversarial fixtures (preregistered expected result *under a stated boundary*):**

| # | Fixture | Boundary (declared) | Expected |
|---|---|---|---|
| 1 | unilateral effect (no return) | default window | no episode (fails recurrence) |
| 2 | delayed response | window ⊇ delay | episode; report the delay basis |
| 3 | timeout | window < timeout | no episode; + alternate (wider window → episode) |
| 4 | retry | default | one episode with retry pair, not two |
| 5 | nested interaction | default | outer + inner episodes reported |
| 6 | one-shot, no reply | default | no episode; + alternate if reply arrives later |
| 7 | async reply outside window | window < gap | no episode; **alternate wider boundary → episode reported** |
| 8 | shared environmental cause | any | no episode (coupling predicate fails: no path between participants) |

**Acceptance (PLAN F1.3):** each fixture matches its preregistered result under its declared boundary;
boundary-relative cases (2,3,7) surface alternates rather than erroring.

## F1.4 — Four-ablation harness  (M1.5-08)
For each kernel element, run **deletion / substitution / collapse / factorization**; substitution is
invalid if it restores the element under another name.

```ts
export function runAblation(kernel: KernelSpec, element: KernelElement, form: AblationForm): AblationResult;

interface AblationResult {
  form: 'delete' | 'substitute' | 'collapse' | 'factor';
  capabilityPreserved: boolean;
  hiddenStructureAdded: boolean;          // substitution invalidator
  metrics: { reprComplexity: number; runtimeCost: number; authoringBurden: number;
             explanatoryClarity: number; conformanceStability: number };
  classification: 'formal-primitive' | 'runtime-index' | 'authoring-construct'
                | 'explanatory-construct' | 'reducible';
}
```
Highest-value targets (M1.5-06 open questions): **Projection** (kernel vs first-derived) and **Invariants**
(distinct vs guards over Dynamics). **Acceptance (PLAN F1.4):** every element receives a classification;
the report separates theory-necessity from implementation-locality.

## Plane-neutral vectors  (R4)
`vectors.ts` emits language-neutral fixtures (envelope, opportunity profiles, episode results, ablation
classifications) as JSON so Swift/Kotlin can be checked **without** a native port now (F1.6 deferred).
Format mirrors the existing `conformance-golden.json` convention at `depth:0`.

## Test → acceptance map
| Test | Proves | PLAN item |
|---|---|---|
| `world.test.ts › envelope` | incompatible-version fails, no silent migrate | F1.0 |
| `world.test.ts › host equivalence ×3 + no-escape` | K hosts a FieldPattern faithfully | F1.1 |
| `world.test.ts › Ω_sys` | system-relative only, serializable | F1.2 |
| `world.test.ts › episodes ×8` | boundary-parameterized detection | F1.3 |
| `world.test.ts › ablation` | per-element necessity classification | F1.4 |

## What starting F1 requires from you
An explicit **"build F1"** (or "go"). On that: implement F1.0 → F1.1 first (envelope + hosting are the
lowest-risk, highest-signal), then F1.2/F1.3, then F1.4, emitting vectors throughout; native ports (F1.6)
wait for the F2 review per R4. Nothing here is built until then.
