/**
 * Instrument registry, instrument evidence log, and fidelity measurement — Phase O11.
 *
 * The Observatory is itself a computational system that makes claims, so it is a research subject like
 * any other. But its claims must never be confused with the subject's. Three layers stay separate:
 *
 *   SUBJECT claims       — what the inspected substrate and the FCI runtime establish
 *   INSTRUMENT claims    — what the Observatory says it rendered, withheld, reordered or emphasized
 *   INTERPRETATION       — what a reviewer understood, missed, or inferred
 *
 * A reviewer misreading an episode boundary does not falsify episode detection; it may falsify the
 * instrument's representation of conditionality. And a better visualization that helps someone find an
 * existing inconsistency improves INSPECTION QUALITY, not the underlying theory.
 *
 * For the same reason the instrument's predictions live here and NOT in the FCI prediction registry:
 * mixing them would contaminate the theory's accuracy metric with claims about a UI.
 */
import { TRANSFORMATIONS, REFUSED_TRANSFORMATIONS, requiresDisclosure } from './transformations.js';
import { STATUS_KINDS } from './semantics.js';

/* ────────────────────────────────────────── instrument predictions (P-OBS) */

export const INSTRUMENT_PREDICTIONS = [
  {
    id: 'P-OBS-001',
    hypothesis:
      'Showing failed Ω_sys predicates individually will improve identification of WHY an opportunity is unavailable, without changing the interpreted availability result.',
    failureCondition: 'Reviewers infer that the most visually prominent failed predicate is the sole cause.',
    status: 'pending',
    testableBy: 'structured review task: given an unavailable operation, ask which conditions must change for it to become available',
    relatedTransformation: 'T-OBS-002',
  },
  {
    id: 'P-OBS-002',
    hypothesis:
      'Displaying evidence independence beside maturity will reduce the tendency to treat fixture-supported claims as experimentally grounded.',
    failureCondition: 'Reviewers continue to rank claims primarily by the maturity label.',
    status: 'pending',
    testableBy: 'structured review task: rank claims by strength of support and compare against independence ordering',
    relatedTransformation: 'T-OBS-009',
  },
  {
    id: 'P-OBS-003',
    hypothesis: 'Retaining alternate episode segmentations will communicate conditionality.',
    failureCondition: 'Reviewers treat the initially selected segmentation as canonical.',
    status: 'pending',
    testableBy: 'structured review task: ask whether the displayed grouping is the only defensible one',
    relatedTransformation: 'T-OBS-005',
  },
  {
    id: 'P-OBS-004',
    hypothesis:
      'Refusing to construct a view over insufficient evidence, with a stated reason, will not be read as a defect of the instrument.',
    failureCondition: 'Reviewers report the refusal as a bug rather than as an evidential limit.',
    status: 'pending',
    testableBy: 'structured review task: ask what the refusal message means and what would resolve it',
    relatedTransformation: 'T-OBS-R05',
  },
];

/* ───────────────────────────────────────────── instrument evidence log */

/**
 * The second trace. Records what the INSTRUMENT did — what was loaded, selected, filtered, hidden,
 * revealed, refused. Kept structurally separate from subject evidence so instrument activity can never
 * be mistaken for, or contaminate, evidence about the substrate under study.
 */
export class InstrumentLog {
  #events = [];
  #seq = 0;

  record(action, detail = {}) {
    const event = {
      // `I-` prefix: an instrument event id can never collide with a subject evidence id
      id: `I-${String(++this.#seq).padStart(4, '0')}`,
      layer: 'instrument',
      action,
      ...detail,
    };
    this.#events.push(event);
    return event;
  }

  get events() { return [...this.#events]; }
  get length() { return this.#events.length; }

  byAction(action) { return this.#events.filter((e) => e.action === action); }

  /** An interaction episode: the reviewer's own trace through the instrument. */
  get episode() {
    return this.#events.map((e) => e.action);
  }

  clear() { this.#events = []; this.#seq = 0; }
}

export const INSTRUMENT_ACTIONS = [
  'experiment-loaded', 'revision-selected', 'mode-changed', 'view-changed', 'substrate-selected',
  'projection-selected', 'segmentation-changed', 'filter-applied', 'evidence-inspected',
  'derivation-followed', 'replay-seek', 'replay-play', 'unsupported-requested', 'refusal-shown',
];

/* ─────────────────────────────────────────────── fidelity measurement */

/**
 * Instrument fidelity. Each measure answers "what does the instrument do to the evidence?" — not "is
 * the runtime correct?". `interpretationError` is deliberately NOT computed: it requires human review
 * tasks, and presuming it zero would be exactly the kind of unearned claim this program exists to
 * prevent.
 */
export function measureFidelity(bundle, models = []) {
  const evidenceIds = new Set(bundle.evidence.map((n) => n.id));

  // 1. trace completeness — every factual item resolves to evidence
  const factual = models.flatMap((m) => m.items.filter((i) => i.evidenceId !== undefined));
  const resolvable = factual.filter((i) => evidenceIds.has(i.evidenceId));
  const traceCompleteness = factual.length === 0 ? null : resolvable.length / factual.length;

  // 2. transformation disclosure — every non-lossless transformation carries a mitigation
  const needing = TRANSFORMATIONS.filter(requiresDisclosure);
  const disclosed = needing.filter((t) => typeof t.mitigation === 'string' && t.mitigation.length > 0);
  const transformationDisclosure = needing.length === 0 ? 1 : disclosed.length / needing.length;

  // 3. semantic distinction preservation — no two status kinds collapse to one rendering
  const rendered = new Map();
  let collapsed = 0;
  for (const item of models.flatMap((m) => m.items)) {
    if (!item.statusKind || !item.rendersAs) continue;
    const prev = rendered.get(item.rendersAs);
    if (prev && prev !== item.statusKind) collapsed += 1;
    rendered.set(item.rendersAs, item.statusKind);
  }

  // 4. replay fidelity — the rendered state at n must equal the recorded state at n
  let replayExact = true;
  for (const run of bundle.runs) {
    for (const [i, t] of run.transitions.entries()) {
      if (t.step !== i) { replayExact = false; break; }
    }
  }

  return {
    traceCompleteness,
    transformationDisclosure,
    semanticDistinctionPreserved: collapsed === 0,
    statusKindsTracked: STATUS_KINDS.length,
    replayFidelityExact: replayExact,
    revisionFidelity: revisionCompatibility(bundle, bundle),
    refusedTransformations: REFUSED_TRANSFORMATIONS.length,
    /** Requires human review tasks. Not measured is not the same as zero. */
    interpretationError: { measured: false, value: null, reason: 'requires structured review tasks; see P-OBS-001..004' },
  };
}

/**
 * Revision fidelity: a historical bundle must not be rendered using present-day registry semantics. If
 * the schema differs, the instrument declares incompatibility rather than silently reinterpreting.
 */
export function revisionCompatibility(current, other) {
  if (!other?.revision) return { compatible: false, reason: 'no revision metadata' };
  if (other.revision.bundleSchema !== current.revision.bundleSchema) {
    return {
      compatible: false,
      reason: `schema ${other.revision.bundleSchema} cannot be rendered with ${current.revision.bundleSchema} semantics`,
    };
  }
  return { compatible: true, reason: 'same bundle schema' };
}
