/**
 * Instrumentation adapter (EXPERIMENTAL, internal) — Phase O1/O2.
 *
 * Drives real substrates through their real `DynamicsContract` adapters and RECORDS what the runtime
 * emitted. It contains no findings of its own: every derivation in the resulting bundle is the return
 * value of a runtime function (`runConformance`, `evaluateOpportunity`, `project`, `detectEpisodes`,
 * `runAblations`, the registries), and every registry section is passed through verbatim.
 *
 * The rule this file must never break: **if the runtime did not produce it, the bundle does not carry
 * it.** A substrate with no captured run appears in `pendingSubstrates`, never as an empty run that
 * looks like a result.
 */
import { hostWorld } from '../kernel.ts';
import { createWorldEnvelope } from '../envelope.ts';
import type { World } from '../world.ts';
import type { DynamicsContract } from '../dynamics.ts';
import { runConformance, corpus, corpusLedger } from '../conformance/corpus.ts';
import { discoveries } from '../conformance/discoveries.ts';
import { predictions, predictionAccuracy } from '../conformance/predictions.ts';
import { negativeResults, negativeLedger } from '../conformance/negative-results.ts';
import { projectionClaims, projectionEvidenceProfile } from '../projection/evidence-profile.ts';
import { evaluateOpportunity } from '../opportunity/opportunity.ts';
import type { AuthorityGrant, OperationDecl } from '../opportunity/opportunity.ts';
import { detectEpisodes } from '../episodes/episodes.ts';
import type { DetectionContract, Transition as EpisodeTransition } from '../episodes/episodes.ts';
import { runAblations } from '../ablation/ablation.ts';
import { project, toOpportunityProjection } from '../projection/projection.ts';
import type { ProjectionDefinition, ProjectionSource } from '../projection/projection.ts';
import { governorDynamics } from '../adapters/governor-runtime.ts';
import { fsmDynamics } from '../adapters/fsm-runtime.ts';
import { plannerDynamics } from '../adapters/planner-runtime.ts';
import { fieldRuntimeDynamics, worldFromCompiledPattern } from '../adapters/field-runtime.ts';
import { structuralCoverage } from '../equivalence.ts';
import type { FsmDefinition } from '../substrates/fsm.ts';
import type { PlannerProblem } from '../substrates/planner.ts';
import type { FieldRecipe } from '../../recipes/schema.ts';
import type { CompiledPattern } from '../../recipes/compile.ts';
import {
  BUNDLE_SCHEMA,
  evidenceNodesFrom,
  type EvidenceNode,
  type ObservatoryBundle,
  type RecordedDetection,
  type RecordedProjection,
  type RecordedRun,
  type RecordedTransition,
  type StateFact,
} from './evidence-log.ts';

function world(id: string): World {
  return { envelope: createWorldEnvelope(id), entities: [], relations: [], invariants: [], projections: [] };
}

// ───────────────────────────────────────────────────────────────────── fixtures (inputs, not results)

const DOOR: FsmDefinition = {
  id: 'door',
  initial: 'closed',
  states: ['closed', 'open', 'locked', 'destroyed'],
  accepting: ['destroyed'],
  transitions: [
    { from: 'closed', on: 'open', to: 'open' },
    { from: 'open', on: 'close', to: 'closed' },
    { from: 'closed', on: 'lock', to: 'locked', guard: { key: 'hasKey', equals: true } },
    { from: 'open', on: 'smash', to: 'destroyed', assign: { intact: false } },
  ],
  context: { hasKey: false, intact: true },
};

const GRAPH: PlannerProblem = {
  id: 'grid',
  nodes: [{ id: 'a', x: 0, y: 0 }, { id: 'b', x: 1, y: 0 }, { id: 'c', x: 2, y: 0 }, { id: 'd', x: 1, y: 1 }, { id: 'z', x: 3, y: 0 }],
  edges: [
    { from: 'a', to: 'b', cost: 1 }, { from: 'a', to: 'd', cost: 4 },
    { from: 'b', to: 'c', cost: 1 }, { from: 'd', to: 'z', cost: 1 }, { from: 'c', to: 'z', cost: 1 },
  ],
  start: 'a',
  goal: 'z',
  heuristic: { kind: 'euclidean' },
};

function compiledPattern(): CompiledPattern {
  return {
    id: 'observatory', recipe: { id: 'observatory' } as unknown as FieldRecipe,
    bodies: [{ attributes: { 'data-body': 'attract' }, tokens: ['attract'] }],
    relationships: [], feedback: [], diagnostics: [], metrics: [], conditions: [],
    render: { underlay: null, overlay: [], heatmap: false, unapplied: [] },
    reducedMotion: { reducedMotion: 'none', meaningWithoutMotion: '', staticOutputs: [] },
  };
}

// ─────────────────────────────────────────────────────────────────────────────────── run recording

/**
 * Record one substrate's execution. The transitions come from `hostWorld`, the conformance verdict
 * from `runConformance` — this function decides nothing about either.
 */
function recordRun<S, I, O>(
  substrate: string,
  makeWorld: () => World,
  makeContract: (w: World) => DynamicsContract<S, I, O>,
  inputs: readonly I[],
  extraFacts: readonly StateFact[] = [],
): { run: RecordedRun; evidence: EvidenceNode[] } {
  const w = makeWorld();
  const contract = makeContract(w);
  const host = hostWorld(w, contract);
  const transitions: RecordedTransition[] = [];
  const evidence: EvidenceNode[] = [];

  for (const [i, input] of inputs.entries()) {
    const prefix = `${substrate}:${i}`;
    const r = host.advance(input);
    const nodes = evidenceNodesFrom(r.evidence as never, i, prefix, `${substrate}.advance`);
    evidence.push(...nodes);
    const snap = contract.capabilities.snapshot ? host.readState() : undefined;
    const reading = snap && 'ok' in snap && snap.ok ? snap.value.reading.metrics : undefined;

    transitions.push({
      step: i,
      input,
      output: r.ok ? r.value : undefined,
      lifecycle: host.lastLifecycle,
      failure: r.ok ? undefined : { code: r.error.code, message: r.error.message },
      reading,
      evidenceIds: nodes.map((n) => n.id),
    });
    if (host.lastLifecycle === 'terminal') break;
  }

  // state visibility, sourced from the contract's own declarations — never assumed
  const last = transitions[transitions.length - 1];
  const stateFacts: StateFact[] = [
    ...Object.entries(last?.reading ?? {}).map(([key, value]): StateFact => ({
      key,
      visibility: 'observed',
      value,
      basis: 'contract.snapshot() reading',
    })),
    ...extraFacts,
  ];
  if (contract.capabilities.restore) {
    stateFacts.push({ key: '<full state>', visibility: 'reconstructed', basis: 'capabilities.restore = true; snapshot is restorable' });
  }

  const law = contract.capabilities.declareTransitionLaw && contract.describeTransitionLaw
    ? contract.describeTransitionLaw()
    : undefined;

  const conformance = runConformance(makeWorld, makeContract, inputs);
  host.dispose();

  return {
    run: {
      substrate,
      contractId: contract.identity.id,
      executionKind: contract.executionKind,
      capabilities: contract.capabilities,
      determinism: contract.determinism,
      transitions,
      stateFacts,
      conformance,
      transitionLaw: law && law.ok ? law.value : undefined,
      terminated: host.lastLifecycle === 'terminal',
    },
    evidence,
  };
}

// ────────────────────────────────────────────────────────────────────────── projection recording

const PROJECTION_OPERATIONS: readonly OperationDecl[] = [
  { id: 'publish', reversible: false, recoveryPaths: ['unpublish'] },
  { id: 'unpublish', reversible: true, recoveryPaths: [] },
  { id: 'delete', reversible: false, recoveryPaths: [] },
  { id: 'audit', reversible: true, recoveryPaths: [] },
];

const PROJECTION_AUTHORITY: readonly AuthorityGrant[] = [
  { operation: 'publish', scope: 'editor', authoritySource: 'editorial-policy-v2' },
  { operation: 'audit', scope: 'auditor', authoritySource: 'compliance-charter' },
];

function projectionSource(): ProjectionSource {
  const envelope = createWorldEnvelope('projection-world');
  return {
    envelope,
    operations: PROJECTION_OPERATIONS,
    snapshot: { envelope, step: 7, entities: [], metrics: { drafts: 3, published: 2, internalRiskScore: 91, moderationQueue: 5 } },
    capabilities: ['publish', 'unpublish', 'audit'],
    authority: PROJECTION_AUTHORITY,
    evidenceIds: ['ev-publish-log', 'ev-risk-model', 'ev-moderation-trace'],
  };
}

function projectionDefinitions(): ProjectionDefinition[] {
  const envelope = projectionSource().envelope;
  const base = {
    sourceEnvelope: envelope,
    invariants: [{ id: 'drafts-bounded', statement: 'drafts <= 10', reads: ['drafts'] }],
    provenance: [{ id: 't1', kind: 'redact' as const, detail: 'risk score redacted' }],
  };
  return [
    {
      ...base,
      identity: { id: 'editor', version: '1' },
      scope: { consumer: 'editor', kind: 'participant' },
      observation: { observable: ['drafts', 'published'], hidden: ['internalRiskScore'] },
      operations: { exposed: ['publish'], hidden: ['audit'], signaled: ['publish'] },
      evidence: { accessible: ['ev-publish-log'], withheld: ['ev-risk-model'] },
      authority: { presented: ['publish'] },
    },
    {
      ...base,
      identity: { id: 'auditor', version: '1' },
      scope: { consumer: 'auditor', kind: 'agent' },
      observation: { observable: ['drafts', 'internalRiskScore'], hidden: [] },
      operations: { exposed: ['audit'], hidden: ['publish'], signaled: ['audit'] },
      evidence: { accessible: ['ev-risk-model', 'ev-moderation-trace'], withheld: [] },
      authority: { presented: ['audit'] },
    },
    {
      ...base,
      identity: { id: 'overreaching', version: '1' },
      scope: { consumer: 'untrusted', kind: 'external-system' },
      observation: { observable: ['drafts'], hidden: ['internalRiskScore'] },
      operations: { exposed: ['publish', 'delete'], hidden: [], signaled: ['delete'] },
      evidence: { accessible: ['ev-publish-log'], withheld: [] },
      authority: { presented: ['publish', 'delete'] },
    },
  ];
}

function recordProjections(): { projections: RecordedProjection[]; evidence: EvidenceNode[] } {
  const source = projectionSource();
  const evidence: EvidenceNode[] = [];
  const projections = projectionDefinitions().map((definition): RecordedProjection => {
    const result = project(definition, source);
    const surfaceId = `projection:${definition.identity.id}`;
    evidence.push({
      id: surfaceId,
      kind: 'runtime-derivation',
      origin: 'project()',
      label: `surface ${definition.identity.id}`,
      payload: result.surface,
      derivedFrom: [],
    });
    result.anomalies.forEach((a, i) => {
      evidence.push({
        id: `${surfaceId}:anomaly:${i}`,
        kind: 'runtime-derivation',
        origin: 'project()',
        label: `${a.code}: ${a.subject}`,
        payload: a,
        derivedFrom: [surfaceId],
      });
    });

    const omegaProjection = toOpportunityProjection(result.surface);
    const opportunities = PROJECTION_OPERATIONS.map((op) => {
      const r = evaluateOpportunity(
        {
          world: { envelope: source.envelope, operations: PROJECTION_OPERATIONS },
          participant: definition.scope.consumer,
          state: { enabled: ['publish', 'audit', 'unpublish'], reachableOutcomes: ['publish', 'audit', 'unpublish'] },
          projection: omegaProjection,
          history: [],
          capabilities: source.capabilities,
          authority: source.authority,
        },
        op.id,
      );
      evidence.push({
        id: `${surfaceId}:omega:${op.id}`,
        kind: 'runtime-derivation',
        origin: 'evaluateOpportunity()',
        label: `Ω_sys ${definition.identity.id}/${op.id} → ${r.available ? 'available' : 'unavailable'}`,
        payload: r,
        derivedFrom: [surfaceId],
      });
      return r;
    });

    return {
      definitionId: definition.identity.id,
      scope: `${definition.scope.consumer} (${definition.scope.kind})`,
      result,
      opportunities,
      evidenceIds: [surfaceId],
    };
  });
  return { projections, evidence };
}

// ───────────────────────────────────────────────────────────────────────────── episode recording

const EPISODE_TRACE: readonly EpisodeTransition[] = [
  { step: 1, from: 'A', to: 'B', operation: 'request', influence: 0.8 },
  { step: 2, from: 'B', to: 'A', operation: 'respond', influence: 0.7 },
  { step: 3, from: 'A', to: 'B', operation: 'confirm', influence: 0.6 },
  { step: 9, from: 'C', to: 'D', operation: 'notify', influence: 0.5 },
  { step: 11, from: 'C', to: 'E', operation: 'notify', influence: 0.5 },
  { step: 20, from: 'B', to: 'A', operation: 'followup', influence: 0.2 },
];

/** Several parameterizations, ALL retained — the mission requires alternates never overwrite. */
function recordDetections(): { detections: RecordedDetection[]; evidence: EvidenceNode[] } {
  const participants = ['A', 'B', 'C', 'D', 'E'];
  const variants: { label: string; contract: DetectionContract }[] = [
    {
      label: 'baseline (window 5, influence ≥ 0.3)',
      contract: { boundary: { participants, start: 0, end: 30 }, timescale: 1, coupling: { kind: 'direct-influence', minInfluence: 0.3 }, recurrenceWindow: 5, minimumInfluence: 0.3 },
    },
    {
      label: 'wide window (25)',
      contract: { boundary: { participants, start: 0, end: 30 }, timescale: 1, coupling: { kind: 'direct-influence', minInfluence: 0.3 }, recurrenceWindow: 25, minimumInfluence: 0.3 },
    },
    {
      label: 'strict influence (≥ 0.65)',
      contract: { boundary: { participants, start: 0, end: 30 }, timescale: 1, coupling: { kind: 'direct-influence', minInfluence: 0.65 }, recurrenceWindow: 5, minimumInfluence: 0.65 },
    },
    {
      label: 'narrow boundary (A,B only)',
      contract: { boundary: { participants: ['A', 'B'], start: 0, end: 30 }, timescale: 1, coupling: { kind: 'direct-influence', minInfluence: 0.3 }, recurrenceWindow: 5, minimumInfluence: 0.3 },
    },
  ];

  const evidence: EvidenceNode[] = [];
  const detections = variants.map(({ label, contract }, i): RecordedDetection => {
    const result = detectEpisodes(EPISODE_TRACE, contract, participants);
    const id = `detection:${i}`;
    evidence.push({
      id,
      kind: 'runtime-derivation',
      origin: 'detectEpisodes()',
      label: `${label} → ${result.episodes.length} candidate episode(s)`,
      payload: result,
      derivedFrom: [],
    });
    return { label, contract, result, evidenceId: id };
  });
  return { detections, evidence };
}

// ─────────────────────────────────────────────────────────────────────────────── bundle assembly

/**
 * Assemble the whole bundle. Registry sections are passed through VERBATIM — a test asserts they
 * deep-equal the live registries, so the Observatory cannot show a discovery the runtime does not hold.
 */
export function captureBundle(revision: { commit: string; coreVersion: string }): ObservatoryBundle {
  const evidence: EvidenceNode[] = [];
  const runs: RecordedRun[] = [];

  const fsm = recordRun('FiniteStateMachine', () => world('fsm-world'), (w) => fsmDynamics(w, DOOR),
    [{ event: 'open' }, { event: 'close' }, { event: 'open' }, { event: 'smash' }, { event: 'open' }]);
  runs.push(fsm.run); evidence.push(...fsm.evidence);

  const planner = recordRun('SearchPlanner', () => world('planner-world'), (w) => plannerDynamics(w, GRAPH),
    Array.from({ length: 12 }, () => ({ expand: 1 as const })));
  runs.push(planner.run); evidence.push(...planner.evidence);

  const governor = recordRun('QualityGovernor', () => world('governor-world'), (w) => governorDynamics(w),
    [30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 10, 10, 10].map((durationMs) => ({ durationMs })));
  runs.push(governor.run); evidence.push(...governor.evidence);

  // the field is lossy: its coverage classification is the runtime's own, not a judgement made here
  const fieldFacts: StateFact[] = structuralCoverage()
    .filter((c) => c.classification !== 'represented')
    .map((c): StateFact => ({
      key: c.construct,
      visibility: c.classification === 'lossy' || c.classification === 'unavailable' ? 'unavailable' : 'observed',
      basis: `structuralCoverage(): ${c.classification}`,
    }));
  const field = recordRun('FieldRuntime', () => worldFromCompiledPattern(compiledPattern()).world,
    (w) => fieldRuntimeDynamics(w), Array.from({ length: 6 }, () => ({ steps: 1 })), fieldFacts);
  runs.push(field.run); evidence.push(...field.evidence);

  const { projections, evidence: projectionEvidence } = recordProjections();
  evidence.push(...projectionEvidence);
  const { detections, evidence: detectionEvidence } = recordDetections();
  evidence.push(...detectionEvidence);

  const ablations = runAblations();
  ablations.forEach((a, i) => {
    evidence.push({
      id: `ablation:${i}`,
      kind: 'runtime-derivation',
      origin: 'runAblations()',
      label: `${a.element} / ${a.form} → ${a.classification}`,
      payload: a,
      derivedFrom: [],
    });
  });

  // registry entries become evidence nodes so the Observatory can cite them like anything else
  discoveries().forEach((d) => {
    evidence.push({ id: d.id, kind: 'discovery', origin: 'discoveries()', label: `${d.id} ${d.concept}`, payload: d, derivedFrom: [] });
  });
  predictions().forEach((p) => {
    evidence.push({ id: p.id, kind: 'prediction', origin: 'predictions()', label: `${p.id} ${p.grade}`, payload: p, derivedFrom: [] });
  });
  negativeResults().forEach((n) => {
    evidence.push({ id: n.id, kind: 'negative-result', origin: 'negativeResults()', label: `${n.id} ${n.status}`, payload: n, derivedFrom: [] });
  });
  corpus().forEach((e) => {
    evidence.push({ id: `corpus:${e.substrate}`, kind: 'registry-entry', origin: 'corpus()', label: `${e.substrate} (${e.status})`, payload: e, derivedFrom: [] });
  });

  const captured = new Set(runs.map((r) => r.substrate));
  const pendingSubstrates = corpus().filter((e) => !captured.has(e.substrate)).map((e) => e.substrate);

  return {
    revision: { ...revision, bundleSchema: BUNDLE_SCHEMA },
    registries: {
      corpus: corpus(),
      corpusLedger: corpusLedger(),
      discoveries: discoveries(),
      predictions: predictions(),
      predictionAccuracy: predictionAccuracy(),
      negativeResults: negativeResults(),
      negativeLedger: negativeLedger(),
      projectionClaims: projectionClaims(),
      projectionProfile: projectionEvidenceProfile(),
    },
    runs,
    projections,
    detections,
    ablations,
    evidence,
    pendingSubstrates,
  };
}
