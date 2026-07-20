/**
 * Observatory transformation ledger — Phase O11.
 *
 * The guards in `observatory.test.ts` prove the instrument cannot invent evidence or call a runtime
 * derivation. They prove nothing about what happens to MEANING between the bundle and a reviewer's
 * understanding. A renderer can compute nothing and still mislead.
 *
 * Every transformation applied between normalized evidence and visible output is named here. The target
 * is not zero transformations — a visualization necessarily transforms — but explicit, bounded,
 * inspectable transformation.
 *
 * Classification:
 *   lossless        — the original is fully recoverable from what is shown
 *   lossy-disclosed — information is dropped AND the drop is visible to the reviewer
 *   interpretive    — the instrument makes a choice the evidence does not determine
 *   unsupported     — the instrument would have to assert something the evidence cannot support;
 *                     these must not be implemented, and are listed so the refusal is auditable
 */

export const TRANSFORMATIONS = [
  {
    id: 'T-OBS-001',
    name: 'chronological ordering',
    input: 'recorded transitions with step indices',
    output: 'ordered timeline',
    classification: 'lossless',
    lossDetail: 'recorded steps are a total order supplied by the runtime; no tie-breaking is invented',
    reversible: true,
    basis: 'RecordedTransition.step',
  },
  {
    id: 'T-OBS-002',
    name: 'predicate status colour encoding',
    input: 'boolean predicate results',
    output: 'colour and weight emphasis',
    classification: 'interpretive',
    lossDetail: 'visual salience may imply evidential importance the runtime did not assign; all predicates are equal conjuncts',
    reversible: false,
    basis: 'OpportunityResult.evidence.predicates',
    risk: 'a reviewer may read the most prominent failed predicate as the sole cause',
    mitigation: 'every predicate is rendered at the same size and order returned by the runtime; the conjunction is printed literally',
  },
  {
    id: 'T-OBS-003',
    name: 'evidence list truncation',
    input: 'full evidence node list',
    output: 'first N nodes',
    classification: 'lossy-disclosed',
    lossDetail: 'nodes beyond the cap are not rendered',
    reversible: true,
    basis: 'bundle.evidence',
    mitigation: 'the count of omitted nodes is stated in the view',
  },
  {
    id: 'T-OBS-004',
    name: 'default projection selection',
    input: 'set of recorded projections',
    output: 'one initially displayed projection',
    classification: 'interpretive',
    lossDetail: 'the evidence does not designate any projection as primary; the instrument picks the first recorded',
    reversible: true,
    basis: 'bundle.projections[0]',
    risk: 'the default surface can read as canonical',
    mitigation: 'the selector shows all projections at equal weight and the default is labelled as an instrument choice',
  },
  {
    id: 'T-OBS-005',
    name: 'default episode segmentation selection',
    input: 'set of recorded detections at different parameterizations',
    output: 'one initially displayed segmentation',
    classification: 'interpretive',
    lossDetail: 'episode findings are conditional; choosing one to display first implies precedence the detector did not assign',
    reversible: true,
    basis: 'bundle.detections[0]',
    risk: 'a conditional boundary appears canonical — the exact failure P-OBS-003 tests',
    mitigation: 'detector parameters are rendered with every grouping, and all parameterizations are listed side by side',
  },
  {
    id: 'T-OBS-006',
    name: 'operation exposure grouping',
    input: 'OperationExposureRecord per operation',
    output: 'exposed / hidden / unavailable labels',
    classification: 'lossless',
    lossDetail: 'the three states are carried through verbatim and never merged',
    reversible: true,
    basis: 'ProjectionSurface.operations',
  },
  {
    id: 'T-OBS-007',
    name: 'projection baseline comparison',
    input: 'active projection and one other projection',
    output: 'a "changed vs baseline" column',
    classification: 'interpretive',
    lossDetail: 'the baseline is an instrument choice; the evidence contains no privileged projection',
    reversible: true,
    basis: 'bundle.projections',
    risk: 'implies the baseline is the true state and other projections are deviations',
    mitigation: 'the baseline is named in the column header rather than left implicit',
  },
  {
    id: 'T-OBS-008',
    name: 'stale reading fallback',
    input: 'transitions where some steps carry no snapshot reading',
    output: 'the most recent earlier reading',
    classification: 'lossy-disclosed',
    lossDetail: 'the displayed reading is not from the cursor step',
    reversible: true,
    basis: 'RecordedTransition.reading',
    mitigation: 'the originating step is stated and the value is marked as a carried-forward reading',
  },
  {
    id: 'T-OBS-009',
    name: 'claim maturity and independence encoding',
    input: 'EvidenceGrade and EvidenceProvenance',
    output: 'two separate visual channels',
    classification: 'lossless',
    lossDetail: 'maturity and provenance are rendered as distinct values and never combined into a single score',
    reversible: true,
    basis: 'ProjectionClaim.grade, ProjectionClaim.provenance',
  },
  {
    id: 'T-OBS-010',
    name: 'ablation support matching',
    input: 'requested ablation label; executed AblationRecord set',
    output: 'supported / unsupported verdict',
    classification: 'interpretive',
    lossDetail: 'matching is by substring on element and exact match on form; a differently-named but equivalent experiment would be reported unsupported',
    reversible: false,
    basis: 'AblationRecord.element, AblationRecord.form',
    risk: 'a false "unsupported" understates what the harness actually established',
    mitigation: 'the matcher states the element and form it searched for, so a false negative is diagnosable',
  },
  {
    id: 'T-OBS-011',
    name: 'payload serialization',
    input: 'evidence payload objects',
    output: 'JSON text',
    classification: 'lossless',
    lossDetail: 'the payload is rendered whole; nothing is summarized',
    reversible: true,
    basis: 'EvidenceNode.payload',
  },
];

/** Transformations the instrument refuses to implement, recorded so the refusal is auditable. */
export const REFUSED_TRANSFORMATIONS = [
  {
    id: 'T-OBS-R01',
    name: 'severity ranking of failed predicates',
    classification: 'unsupported',
    reason: 'the runtime returns failed predicates as an unordered conjunction with no severity; ranking them would assert a priority the evidence does not contain',
  },
  {
    id: 'T-OBS-R02',
    name: 'hiding unavailable operations by default',
    classification: 'unsupported',
    reason: 'absence in the UI would be indistinguishable from nonexistence in the world; unavailable and hidden are different states and must both remain visible',
  },
  {
    id: 'T-OBS-R03',
    name: 'inferring causality between a discovery and the prediction preceding it',
    classification: 'unsupported',
    reason: 'the registries record chronology and attribution, not causation; adjacency in a layout must not imply one produced the other',
  },
  {
    id: 'T-OBS-R04',
    name: 'collapsing disagreeing provenance records into one',
    classification: 'unsupported',
    reason: 'disagreement between sources is itself evidence; a single merged value would erase it',
  },
  {
    id: 'T-OBS-R05',
    name: 'rendering an opportunity graph when the supporting evidence is insufficient',
    classification: 'unsupported',
    reason: 'the instrument must disclose that it cannot construct the view, and why, rather than drawing a plausible one',
  },
];

export const byId = (id) =>
  TRANSFORMATIONS.find((t) => t.id === id) ?? REFUSED_TRANSFORMATIONS.find((t) => t.id === id);

/** Transformations a reviewer must be told about: everything that is not lossless. */
export const requiresDisclosure = (t) => t.classification !== 'lossless';

export function transformationLedger() {
  const by = (c) => TRANSFORMATIONS.filter((t) => t.classification === c);
  const needing = TRANSFORMATIONS.filter(requiresDisclosure);
  return {
    total: TRANSFORMATIONS.length,
    lossless: by('lossless').length,
    lossyDisclosed: by('lossy-disclosed').length,
    interpretive: by('interpretive').length,
    refused: REFUSED_TRANSFORMATIONS.length,
    requiringDisclosure: needing.length,
    /** Every non-lossless transformation must state a mitigation shown to the reviewer. */
    allDisclosed: needing.every((t) => typeof t.mitigation === 'string' && t.mitigation.length > 0),
  };
}
