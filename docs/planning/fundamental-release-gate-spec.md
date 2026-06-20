# TASK: Fundamental Release-Gate Program (0.x → RC → 1.0)

**Status:** Proposed — execution gated on §0 inputs
**Predecessor / Position:** Consumes `Fundamental-homepage-reorg-spec.md` (the install/docs coherence requirement) and `Fundamental-launch-brief.md` (the cohort, which *is* the RC validation phase). Sits as release governance over the project — every feature/fix task flows up into these gates.
**Scope:** The gates that must pass to cut `1.0.0-rc.1`, and to promote `rc` → `1.0.0`, each stated as an evidence-bearing predicate. / **Excluded:** The implementation work behind any gate (the React fix, the CI wiring, the study) — those are separate tasks; this spec defines *what proves them done*, not how to do them.
**Authority class:** Release governance. The **1.0 API freeze** and the **1.0 support commitment** are irreversible promises — treat both as critical-path; a wrong call propagates into every dependent.
**System of record produced:** The release-gate ledger (two gates, each a checklist of predicates with attached evidence) plus the declared 1.0 surface and the support/versioning policy.

---

## 0. Halt-gated inputs (resolve before execution)

1. **The 1.0 surface decision.** Whether the current frozen surface *is* 1.0, or whether named primitives (forces/metrics/options) are still intended before stable. This is a system-of-record decision; an RC cannot be cut against an undeclared surface. If undeclared, **halt** — declare it, then proceed.
2. **The 1.0 support commitment.** What maintenance/deprecation policy a solo maintainer can actually keep. A 1.0 is a support promise; cutting it without a scoped, publishable policy makes the version a claim you can't honor. If undecided, **halt**.
3. **Repo-documented release tooling.** The CI test matrix, the coverage tooling, and the provenance/OIDC publish path as currently documented and correct. Do not assume a CI or publish behavior the repo doesn't document. If a required pipeline can't be identified, **halt for the gates that depend on it**.
4. **Source of performance budgets.** Budgets derive from the measured artifact (`Fundamental-perf-fact-sheet.md`) / the live console — never invented. If a budget can't be sourced, that gate is `open`, not guessed.

**Partial-halt rule.** If an input is unavailable and a gate depends on it, mark that gate `blocked` and continue evaluating the rest. Do not cut a tag while any gate for that tag is `blocked` or `open`.

---

## 1. Objective

Define, as evidence, exactly what must be true to **(a) cut `1.0.0-rc.1`** and **(b) promote `rc` → `1.0.0`** — and authorize each cut only when its gate is fully green.

**Why this framing.** 1.0 is **a commitment you can keep, not a quality bar you polish to.** The common, costly error is cutting 1.0 because the code feels done or momentum is wanted. The gate must therefore test *"can this API be frozen and supported, and has it survived contact with real users,"* not *"is the code clean."* The RC gate proves **freezability**; the stable gate proves the **freeze survived**.

**Non-negotiable.** No gate passes on assertion — each passes on evidence: a test verdict, a CI result, a real external build, or a signed decision. No 1.0 claim ships that the project can't keep; the truth gate from the homepage spec's §2.3 ledger is inherited verbatim.

---

## 2. Canonical shape

Each gate requirement is one record: **id · gate (`RC` | `STABLE`) · requirement · predicate (how it's checked) · evidence (what proves it) · owner · state (`open` | `blocked` | `met`)**. One requirement, one predicate, one evidence type.

**Version identity rule.** A tag is cut only from a commit at which every record for that gate is `met` with evidence attached. `rc` is re-cut (`rc.2`, `rc.3`…) whenever RC-period use forces a change; the stable tag is cut only from a green `STABLE` gate. No tag from an unproven gate, ever.

---

## 3. Domain model — the two gates

Ordered cheapest-and-most-blocking first within each gate.

### 3.1 RC gate — freezability (cut `1.0.0-rc.1` only when all `met`)

| id | Requirement | Predicate | Evidence |
|----|-------------|-----------|----------|
| RC-1 | **1.0 surface declared complete** | A signed decision names the exact 1.0 export surface; no "to-add-before-1.0" item remains open | the decision record |
| RC-2 | **No experimental API in the 1.0 surface** | No symbol flagged experimental/planned is exported in the 1.0 entry points; each is graduated (tested+frozen) or fenced out | grep of the export surface vs the status map |
| RC-3 | **Lifecycle contracts defined and tested per surface** | vanilla, web-component, and React each have a documented register/measure/unmount contract with tests — closing the flagged React register/unmount ambiguity | the contract docs + passing lifecycle tests |
| RC-4 | **Provenance + CI publish wired** | `npm publish --provenance` runs from CI via OIDC on a dry-run tag | the published provenance attestation on a test publish |
| RC-5 | **Support matrix declared and CI-tested** | The supported browsers, DPR, reduced-motion, and SSR/hydration behaviors are stated and exercised in CI | the matrix doc + green CI run |
| RC-6 | **Contract-level coverage** | Every documented attribute, metric, and option has a test; conformance tests and determinism fingerprints green across the matrix | coverage report + green conformance/fingerprint runs |
| RC-7 | **Performance budgets as gates** | Frame-time, long-task, and heap budgets (sourced from the fact sheet) are CI gates that fail the build on regression | the budget config + a passing run |
| RC-8 | **Accessibility verified, not just architectural** | Reduced-motion/semantic-truth lints pass on every shipped example, plus ≥1 real assistive-tech pass logged | lint run + the AT-pass note |
| RC-9 | **Docs complete for the 1.0 surface** | Every public API documented; a 0.x→1.0 migration note exists; the semver policy is stated | the docs diff |
| RC-10 | **Install/docs coherence shipped** | The homepage-reorg spec's install gates are green (vanilla default, no bare `Fundamental`, homepage matches `/docs`) | reference: `Fundamental-homepage-reorg-spec.md` §7 |

### 3.2 STABLE gate — the freeze survived (promote `rc` → `1.0.0` only when all `met`)

| id | Requirement | Predicate | Evidence |
|----|-------------|-----------|----------|
| ST-1 | **Real external builds** | ≥ N independent external builds on the RC (recommend a floor of **3**; you set N), each surfacing friction that was then addressed | the build references + the friction→fix log. Source: `Fundamental-launch-brief.md` cohort |
| ST-2 | **Quiet API window** | A defined stretch with no breaking change forced by RC use — recommend **two consecutive RC releases with zero breaking change** (a dependency/event gate, not a date). Any breaking change resets it | the rc tag history |
| ST-3 | **No open critical/breaking bugs** | The critical/breaking bug queue from real use is empty | the issue tracker state |
| ST-4 | **Benefit claims proven or demoted** | No 1.0 surface (site, README, posts) states a hypothesis ("improves orientation," "calibrates trust") as a result; either a study backs it or it's framed as capability | grep of 1.0 copy vs the claims ledger |
| ST-5 | **Support commitment published** | The §0.2 policy is finalized and visible | the published policy |
| ST-6 | **Security/dependency posture clean** | No advisories; provenance on; no secrets in repo/logs | audit + provenance attestation |
| ST-7 | **All RC gates still green** | Every RC-* record is still `met` at the stable commit | re-run of §3.1 |

---

## 4. Execution phases

Order is the dependency graph.

**Phase A — Decisions (blocking).** Resolve §0.1 (the 1.0 surface) and §0.2 (support policy). Every gate inherits these; nothing proceeds until they're signed.

**Phase B — RC engineering gates.** Drive RC-2 through RC-10 to `met`, parallelized across gates. RC-3 (lifecycle contracts, the React gap) and RC-4 (provenance) are the two most likely to be genuinely open; start there.

**Phase C — Cut `1.0.0-rc.1`.** Only when §3.1 is fully green. Tag from that commit; capture evidence.

**Phase D — Validation (blocking).** Run the launch-brief cohort *on the RC*. This is the validation phase the stable gate inherits — ST-1, ST-2, ST-3 are produced here. Do not shortcut it with internal testing; the gate requires *external* builds.

**Phase E — Promote `rc` → `1.0.0`.** Only when §3.2 is fully green. If RC-period use forces a breaking change, cut the next `rc`, fix, and **reset ST-2's quiet window** — that reset is the RC doing its job, not a failure.

---

## 5. Special procedure — the irreversible 1.0 promise

The single highest-risk operation is cutting 1.0, because the API freeze and the support commitment can't be quietly walked back. The seductive-but-wrong shortcuts:

- **Cutting 1.0 on a date or on "it feels done / we want momentum"** instead of on survived-real-use evidence. *Forbidden:* 1.0 is cut only from a green `STABLE` gate with real external builds (ST-1); the quiet window (ST-2) is event-gated, never date-gated.
- **Stating benefit hypotheses as results** to make 1.0 look stronger. *Forbidden* by ST-4 and the inherited claims ledger — demote or prove, never assert.
- **Promising support you can't staff.** *Forbidden:* the 1.0 commitment is scoped to what a solo maintainer can keep (§0.2), stated honestly, not an implied LTS.
- **Widening the support matrix or muting a perf/a11y budget to make a gate go green.** *Forbidden:* a gate is met by passing the bar, never by lowering it.

---

## 6. Agent execution model

- **The two decisions** (1.0 surface, support policy) and the **benefit-claim judgment** (ST-4) are capable-model-or-human authority calls that define the system of record.
- **Mechanical predicates** (grep of the export surface, coverage/conformance/budget/lint runs, tag history) → small/cheap model, one gate per agent, fan out, checkable output.
- **Predicate adjudication** once artifacts are frozen → mid model.

Discipline: evidence is appended to the gate ledger, not held in a context window; a gate already `met` with evidence is not re-litigated; a missing predecessor artifact (e.g., cohort evidence for ST-1) is a **halt**, not a guess. Idempotent and resumable.

---

## 7. Done criteria (evidence required)

- [ ] **§0 decisions signed:** the 1.0 surface and the support policy are declared. *Evidence:* the two decision records.
- [ ] **RC gate fully `met`:** every RC-* record carries its named evidence. *Evidence:* the §3.1 ledger, complete.
- [ ] **`1.0.0-rc.1` cut** from the green-gate commit. *Evidence:* the tag + attached gate snapshot.
- [ ] **Validation run:** ≥ N external builds on the RC with a friction→fix log. *Evidence:* `Fundamental-launch-brief.md` cohort output.
- [ ] **STABLE gate fully `met`,** including the quiet-window condition and "all RC gates still green." *Evidence:* the §3.2 ledger, complete.
- [ ] **`1.0.0` cut** from the green-`STABLE` commit. *Evidence:* the tag.
- [ ] **`git status` / `git diff --stat` / tag list captured.** No tag, publish, or release unless the user says **release** or **ship**.

---

## Invariants inherited from the program

- **Evidence grading:** `proven` (ran it / a real build) > `claimed` (doc, unverified) > `absent`. No gate closes on a claim.
- **Truth gate:** the §2.3 claims ledger of `Fundamental-homepage-reorg-spec.md` governs every 1.0-surface statement.
- **No dates in workflows:** every gate is sequenced by dependency and event, never by calendar.
- **One promise, kept:** 1.0 asserts only what the project can hold — frozen API, scoped support, claims it can show.
