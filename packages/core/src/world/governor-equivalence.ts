/**
 * G3.2 — raw-vs-adapted equivalence for the SECOND substrate (the governor rule set).
 *
 * Same discipline as F1.4: the RAW substrate is the baseline authority (driven directly via
 * `feedGovernor`), the adapted path routes the identical fixture through `DynamicsContract` +
 * `hostWorld`, and equivalence is compared at EVERY transition — never final state alone.
 *
 * The controls differ from the field, and that difference is itself evidence: this substrate has no
 * clock, no randomness, no queue, no environment, no retry policy and no external I/O, so those
 * controls are recorded as NOT-APPLICABLE rather than silently claimed. Field-free at runtime (the
 * shared vocabulary is imported type-only). Internal/experimental.
 */
import { hostWorld } from './kernel.ts';
import { createWorldEnvelope } from './envelope.ts';
import type { World } from './world.ts';
import { governorDynamics } from './adapters/governor-runtime.ts';
import { feedGovernor, initialGovernorState, DEFAULT_BUDGET_MS } from './substrates/governor.ts';
import type { QualityTier } from './substrates/governor.ts';
import type { CoverageClass, CoverageEntry, SnapshotFidelity } from './equivalence.ts';

export interface GovernorSemanticStep {
  readonly step: number;
  readonly tier: QualityTier;
  readonly overrunStreak: number;
  readonly cleanStreak: number;
  readonly changed: boolean;
  readonly failure?: string;
}

/** Only the controls that exist for THIS substrate; the rest are recorded not-applicable. */
export interface GovernorEquivalenceConditions {
  readonly initialStateControlled: boolean;
  readonly operationOrderControlled: boolean;
  readonly inputValuesControlled: boolean;
  readonly transitionCountControlled: boolean;
  readonly notApplicable: readonly string[];
}

export const GOVERNOR_CONDITIONS: GovernorEquivalenceConditions = {
  initialStateControlled: true,
  operationOrderControlled: true,
  inputValuesControlled: true,
  transitionCountControlled: true,
  notApplicable: ['clock', 'randomness', 'queue-order', 'environment', 'retry-policy', 'external-response', 'host-geometry'],
};

/** Complete: the payload reconstructs State exactly (contrast: the field is `partial-observable`). */
export const GOVERNOR_SNAPSHOT_FIDELITY: SnapshotFidelity = 'complete-restorable';

/** Every construct is represented — nothing is substrate-owned, lossy, or unavailable. */
export function governorStructuralCoverage(): CoverageEntry[] {
  const rep = (construct: string): CoverageEntry => ({ construct, classification: 'represented' as CoverageClass });
  return [
    rep('tier'),
    rep('overrun streak'),
    rep('clean streak'),
    rep('budget'),
    rep('transition law (declared escalation table)'),
    rep('tier-change events'),
    rep('snapshot state'),
    rep('failure state'),
  ];
}

export interface GovernorFixture {
  readonly durations: readonly number[];
  readonly budgetMs: number;
  readonly conditions: GovernorEquivalenceConditions;
}

export function governorFixture(durations: readonly number[], budgetMs: number = DEFAULT_BUDGET_MS): GovernorFixture {
  return { durations, budgetMs, conditions: GOVERNOR_CONDITIONS };
}

function world(): World {
  return { envelope: createWorldEnvelope('governor-world'), entities: [], relations: [], invariants: [], projections: [] };
}

/** RAW path — the authority. Drives the substrate directly; never through the adapter. */
export function runRawGovernorPath(fixture: GovernorFixture): GovernorSemanticStep[] {
  let state = initialGovernorState(fixture.budgetMs);
  const trace: GovernorSemanticStep[] = [
    { step: 0, tier: state.tier, overrunStreak: state.overrunStreak, cleanStreak: state.cleanStreak, changed: false },
  ];
  fixture.durations.forEach((d, i) => {
    if (!Number.isFinite(d) || d < 0) {
      trace.push({ step: i + 1, tier: state.tier, overrunStreak: state.overrunStreak, cleanStreak: state.cleanStreak, changed: false, failure: 'invalid-state' });
      return;
    }
    const r = feedGovernor(state, d);
    state = r.state;
    trace.push({ step: i + 1, tier: state.tier, overrunStreak: state.overrunStreak, cleanStreak: state.cleanStreak, changed: r.changed !== undefined });
  });
  return trace;
}

/** ADAPTED path — identical fixture, routed through DynamicsContract + hostWorld. */
export function runAdaptedGovernorPath(fixture: GovernorFixture): GovernorSemanticStep[] {
  const w = world();
  const host = hostWorld(w, governorDynamics(w, fixture.budgetMs));
  const trace: GovernorSemanticStep[] = [];
  const s0 = host.readState();
  if (s0.ok) {
    const m = s0.value.reading.metrics;
    trace.push({ step: 0, tier: m.tier as QualityTier, overrunStreak: m.overrunStreak!, cleanStreak: m.cleanStreak!, changed: false });
  }
  fixture.durations.forEach((d, i) => {
    const adv = host.advance({ durationMs: d });
    if (!adv.ok) {
      const rs = host.readState();
      const m = rs.ok ? rs.value.reading.metrics : { tier: 0, overrunStreak: 0, cleanStreak: 0 };
      trace.push({ step: i + 1, tier: m.tier as QualityTier, overrunStreak: m.overrunStreak!, cleanStreak: m.cleanStreak!, changed: false, failure: adv.error.code });
      return;
    }
    const rs = host.readState();
    const m = rs.ok ? rs.value.reading.metrics : { tier: 0, overrunStreak: 0, cleanStreak: 0 };
    trace.push({ step: i + 1, tier: m.tier as QualityTier, overrunStreak: m.overrunStreak!, cleanStreak: m.cleanStreak!, changed: adv.value.changed });
  });
  host.dispose();
  return trace;
}

export interface GovernorDivergence {
  readonly step: number;
  readonly field: string;
  readonly detail: string;
}

export interface GovernorEquivalenceResult {
  readonly equivalent: boolean;
  readonly divergences: readonly GovernorDivergence[];
  readonly transitionsCompared: number;
  readonly conditions: GovernorEquivalenceConditions;
  readonly coverage: readonly CoverageEntry[];
  readonly snapshotFidelity: SnapshotFidelity;
}

/** Compare at EVERY transition. All values are discrete → exact equality, no tolerance needed. */
export function compareGovernorTraces(
  raw: readonly GovernorSemanticStep[],
  adapted: readonly GovernorSemanticStep[],
  fixture: GovernorFixture,
): GovernorEquivalenceResult {
  const divergences: GovernorDivergence[] = [];
  if (raw.length !== adapted.length) {
    divergences.push({ step: -1, field: 'step-count', detail: `raw ${raw.length} vs adapted ${adapted.length}` });
  }
  const n = Math.min(raw.length, adapted.length);
  for (let i = 0; i < n; i++) {
    const r = raw[i]!;
    const a = adapted[i]!;
    if (r.tier !== a.tier) divergences.push({ step: i, field: 'tier', detail: `${r.tier} vs ${a.tier}` });
    if (r.overrunStreak !== a.overrunStreak) divergences.push({ step: i, field: 'overrunStreak', detail: `${r.overrunStreak} vs ${a.overrunStreak}` });
    if (r.cleanStreak !== a.cleanStreak) divergences.push({ step: i, field: 'cleanStreak', detail: `${r.cleanStreak} vs ${a.cleanStreak}` });
    if (r.changed !== a.changed) divergences.push({ step: i, field: 'changed(event)', detail: `${r.changed} vs ${a.changed}` });
    if (r.failure !== a.failure) divergences.push({ step: i, field: 'failure', detail: `${r.failure ?? 'none'} vs ${a.failure ?? 'none'}` });
  }
  return {
    equivalent: divergences.length === 0,
    divergences,
    transitionsCompared: n,
    conditions: fixture.conditions,
    coverage: governorStructuralCoverage(),
    snapshotFidelity: GOVERNOR_SNAPSHOT_FIDELITY,
  };
}

/** Final-state-only comparison — used ONLY to demonstrate it can false-pass. */
export function compareGovernorFinalOnly(
  raw: readonly GovernorSemanticStep[],
  adapted: readonly GovernorSemanticStep[],
  fixture: GovernorFixture,
): boolean {
  const r = raw[raw.length - 1];
  const a = adapted[adapted.length - 1];
  if (!r || !a) return false;
  return compareGovernorTraces([r], [a], fixture).equivalent;
}
