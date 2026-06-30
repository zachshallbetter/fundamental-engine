# Substrate phase-2 frontier — design proposals (decisions needed)

The substrate critical path is complete and merged (epics 01–05 + doc-04 Steps 1–5; Step 6 started with
the **thermal** lane). The remaining phase-2 items are **not** capture-only increments like thermal —
each needs an architectural decision that should be the coordinator's, not guessed autonomously. This
doc lays out each with options + a recommendation so they can be greenlit and built quickly.

Status legend: 🟢 additive/behavior-preserving once decided · 🟡 needs new state · 🔴 changes a contract.

---

## 1. Angular accumulator lane + per-particle orientation 🟡

**Goal:** populate `FieldImpulseAccumulator.angular` and let a force impart spin/torque.

**Blocker:** particles have no orientation/angular state. `swirl` rotates *linear* velocity, not spin.
The thermal lane was capturable because forces already mutate `p.heat`; nothing mutates angular state.

**Options**
- **A — opt-in orientation lane (mirror the z-lane pattern).** Add optional `p.orient?`, `p.spin?`
  (undefined ⇒ flat/no-spin, byte-identical to today, like `z`/`vz`). A force (a new `torque`, or an
  opt-in mode on `swirl`) writes `p.spin`; `applyAndRecord` captures the Δspin into `acc.angular`.
  Renderers may ignore `orient`. **Recommended** — matches the established z-lane precedent, fully
  additive + behavior-preserving (golden unmoved while no force writes spin), and gives a real torque
  source.
- B — accumulator-only (type the lane, no particle state). Cheap but the lane stays empty forever; no
  value. Reject.
- C — full rigid-body angular state on bodies (for body torque). Larger; defer to item 5.

**Recommendation:** A. Ship `p.orient?/p.spin?` (opt-in) + a `torque` force + angular capture, behind
the same "undefined ⇒ inert" discipline as the z-lane. **Decision needed:** do we want particle
orientation in the data model at all (it touches renderers/golden expectations)?

---

## 2. Temporal accumulator lane 🟡

**Goal:** populate `temporal { delay, decay, phase }` — forces that act with a time kernel.

**Blocker:** no force expresses a temporal contribution; "delay/decay/phase" need a defined semantics
(decay of what, over which clock — wall/frame/sim?).

**Options**
- A — a `decay` contribution captured from forces that already damp (e.g. `viscosity`): record the
  per-force damping factor into `temporal.decay`. Capture-only, achievable. Modest value.
- B — a real time-kernel force (delayed/phased response). New feature; needs a clock decision.

**Recommendation:** A as a small capture-only win (parallels thermal); B is a feature for later.
**Decision needed:** is `temporal.decay` capture worth a PR, or skip to semantic?

---

## 3. Semantic accumulator lane 🟡

**Goal:** populate `semantic: Record<string, number>` — attention/confidence/memory as force inputs.

**Blocker:** semantics live on bodies (metrics/attn) + recipes, not as force contributions. A Field
Formation "maps semantic state into force parameters" (doc 04) — that mapping is unimplemented.

**Options**
- A — capture the conserved-attention multiplier (`b.attn`) a body applies as a `semantic.attention`
  attribution. Capture-only-ish; ties into the existing attention system. Achievable.
- B — formation→semantic→force coupling (the real thing). Needs the formation-as-mapping machinery
  (also blocks governance item 5). Larger.

**Recommendation:** A is a thin capture win; B is the substantive one but couples to governance/
formation work. **Decision needed:** build A now, or bundle semantic with the formation-mapping work?

---

## 4. Deeper governance lint rules 🔴 (blocked on data model)

**Goal:** `field/no-hidden-coupling`, `field/no-relationship-force-without-formation`,
`field/no-dimension-coupling-without-passport`, lane-separation, semantic-source.

**Blocker:** these need data structures that don't exist yet:
- **lane-separation** needs a canonical word→lane registry (which tokens are forces vs metrics vs
  diagnostics vs projections …). The naming canon is documented in prose, not a checkable map.
- **relationship-as-force** needs the "a Field Formation maps an edge into coupling" concept — edges
  are non-causal today; nothing maps them to force.
- **coupling-passport** needs forces to declare `couplesDimensions` in their passport (`passport.ts`);
  most don't.

**Recommendation:** **Decision needed first** — (a) stand up a canonical lane registry (one source of
truth for word→lane, replacing the prose canon), then lane-separation lint becomes a clean PR; (b)
add `couplesDimensions` to force passports, then the coupling-passport lint follows. Both are
worthwhile but they're data-model commitments, not lint code. The projection-accessibility rules
(shipped in #849) were the only governance rules checkable without new structures.

---

## 5. Dynamic-body own-emission recoil + torque 🟡 (depends on 1)

**Goal:** a `dynamic` body recoils from the matter IT pushes (true Newton's-third-law recoil), and can
rotate (torque).

**Blocker:** #845 shipped field-to-body coupling (a dynamic body integrates under the *other* bodies'
field). Own-emission recoil needs the reaction to the impulses the body imparts to nearby matter —
which requires summing per-body reaction (the force-contract / accumulator-per-body work) — and torque
needs the angular lane (item 1).

**Recommendation:** sequence after item 1 (angular) + a per-body reaction accumulator. **Decision
needed:** confirm the recoil model (sum of −Δv imparted to matter, vs. a simpler density-gradient
reaction) before implementing.

---

## What's safe to do autonomously now (no decision needed)

- **Documentation/research alignment** — bring `docs/canonical/`, `docs/research/`, and the site docs
  in line with the shipped substrate (query/snapshot/diff/replay/projections/governance/authority/
  dynamic/integrator/thermal). Additive, safe.
- **Test hardening** — fill any remaining cross-surface/integration gaps for the shipped phase-2
  features. Additive, safe.

These are being worked autonomously; the items above wait for the decisions noted.
