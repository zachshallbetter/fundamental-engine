# F1 — execution spec v2 (post-finding, A′ architecture)

> **Status: current build reference.** Replaces `F1-execution-spec.md` (superseded by the F1.1 finding).
> The kernel sits **above** the field runtime, not around it:
>
>     Declaration → Kernel/runtime orchestration → DynamicsContract → ExecutionSubstrate → (Field adapter)
>                                                                        ↳ optional: declarative FieldDynamics
>
> Acceptance criteria live in [`PLAN.md`](PLAN.md) F1.0–F1.9; semantics in [`m1.5/`](m1.5/README.md).
> `✅ built` marks code already green on `feat/world-kernel`; `▢` marks remaining work.

## Layer map (and what exists)

| Layer | File(s) | PLAN item | State |
|---|---|---|---|
| **Declaration** — generic `World` | `world/world.ts` | F1.2 | ✅ built, green |
| **Kernel/runtime orchestration** — `hostWorld` executes a contract | `world/kernel.ts` | F1.3 | ✅ MVP |
| **DynamicsContract** — the execution boundary | `world/dynamics.ts` | F1.3 | ▢ MVP → enrich |
| **ExecutionSubstrate + Field adapter** — opaque field wrap | `world/adapters/field-runtime.ts` | F1.4 | ✅ adapter; ▢ equivalence measurement |
| **Version envelope** | `world/envelope.ts` | F1.0 | ✅ built, green |
| **Declarative FieldDynamics** (experiment) | — | F1.5 | ▢ not started |
| **Ω_sys / episodes / ablation / findings** | — | F1.6–F1.9 | ▢ not started |

## F1.3 — enrich `DynamicsContract` (the current increment)

The MVP contract exposes `id · substrate · declarative · step · snapshot`. Enrich to the full boundary:

```ts
interface DynamicsContract<State, Input, Output, Evidence> {
  readonly identity: DynamicsIdentity;         // id + version
  readonly executionKind:                      // classify the implementation
    'declarative' | 'interpreted' | 'compiled' | 'opaque-native' | 'external' | 'nondeterministic' | 'hybrid';
  readonly capabilities: DynamicsCapabilities; // snapshot? replay? deterministic? evidence?
  readonly determinism: 'deterministic' | 'seeded' | 'nondeterministic';
  initialize(declaration: unknown): State;
  advance(state: State, input: Input, context: ExecutionContext): TransitionResult<State, Output, Evidence>;
  snapshot(state: State): WorldStateSnapshot;
  // failure semantics explicit; no throw-through of substrate internals
}
```

**Acceptance (F1.3):** kernel imports no field impl; `FieldRuntime` only behind the adapter; opaque
execution labeled opaque; the runtime asserts nothing about unobserved internal laws; **transition
evidence distinguishes** declared input · substrate response · checked invariants · inferred
interpretation. The current `FieldRuntimeDynamics` sets `declarative: false` — keep it; add
`executionKind: 'opaque-native'`, `capabilities`, `determinism`, and an evidence channel.

## F1.4 — measure raw-field vs field-substrate equivalence

The adapter exists; the missing piece is the **measurement**: run the *raw* field and the field *behind
the contract* on identical seeded input and compare outputs/traces. **Acceptance:** operational
equivalence is between **raw field execution and the field substrate** — never between the field and a
falsely-declarative kernel. Snapshots labeled by actual fidelity; replay declared truthfully; state
ownership explicit (substrate may retain the field; the generic world/kernel must not).

## F1.5 — declarative FieldDynamics experiment (optional, framed as an experiment)

Can force `apply(b,p,env)` laws be represented as data / an interpretable IR? Three valid outcomes:
complete declarative representation · partial declarative + opaque extensions · failure to represent
without equivalent embedded code. A partial/negative result is a finding. **Only start after F1.3/F1.4
validate the contract boundary** — do not design a Force IR before the generic boundary is tested.

## F1.6–F1.9 (unchanged in intent; renumbered)

- **F1.6 Ω_sys** — the system-relative opportunity predicate (`world/opportunity.ts`), belief out of scope.
- **F1.7 episode detection** — `detectInteractions(trace, ⟨B,T,C,R,I⟩)` + 8 adversarial fixtures.
- **F1.8 ablation** — four ablations over the revised architecture; plus: is `DynamicsContract` a
  primitive/interface/authoring construct? does substrate identity belong in kernel or envelope? keep
  `Operations`/`Dynamics` distinct? one contract or separate opaque/declarative types?
- **F1.9 findings** — updated `K` vs `K₀`; Operations/Dynamics role classification.

## Guardrails (unchanged)

No field imports in `world/{world,dynamics,kernel,envelope}.ts` (architectural test enforces it). Nothing
exported from the package entry (frozen surface untouched). JS is the reference; native ports deferred to
the F1/F2 review (R4). Preserve the superseded spec as evidence of the falsified hypothesis.
