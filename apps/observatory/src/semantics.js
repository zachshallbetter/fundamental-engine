/**
 * Semantic model + representation invariants — Phase O11.
 *
 * Views do not render straight from the bundle. They build a semantic model first: an inspectable
 * description of what is about to be shown, which transformations produced it, and which distinctions
 * must survive. Invariants are then asserted against the MODEL, so "the instrument preserves meaning"
 * becomes a test rather than a claim in a document.
 *
 * The distinctions that must never collapse:
 *
 *     hidden ≠ unavailable ≠ absent ≠ unknown ≠ unsupported ≠ missing
 *
 * Each means something different about the world, and a renderer that merges any two of them has
 * changed the reviewer's understanding without computing anything.
 */
import { byId, requiresDisclosure } from './transformations.js';

/** Status kinds that a renderer must keep visually and semantically distinct. */
export const STATUS_KINDS = ['exposed', 'hidden', 'unavailable', 'absent', 'unknown', 'unsupported', 'missing'];

/** Maturity emphasis tokens. Distinct per grade — a hypothesis may never look like a grounded claim. */
export const EMPHASIS = {
  'experimentally-grounded': 'grounded',
  'fixture-supported': 'fixture',
  'architectural-hypothesis': 'hypothesis',
};

function model(view, { items = [], transformations = [], disclosures = [], refusals = [], conditional = null }) {
  const auto = transformations
    .map(byId)
    .filter((t) => t && requiresDisclosure(t))
    .map((t) => ({ transformation: t.id, text: t.mitigation ?? t.lossDetail }));
  const seen = new Set(disclosures.map((d) => d.transformation));
  return {
    view,
    items,
    transformations,
    disclosures: [...disclosures, ...auto.filter((d) => !seen.has(d.transformation))],
    refusals,
    conditional,
  };
}

/* ─────────────────────────────────────────────────────────── operations */

/**
 * Operation exposure. The three runtime states are carried through unmerged, and an operation is never
 * dropped: an unavailable operation that vanished would be indistinguishable from one that does not
 * exist in the world.
 */
export function operationsModel(surface, baselineSurface, baselineId) {
  const items = surface.operations.map((o) => {
    const base = baselineSurface?.operations.find((b) => b.operation === o.operation);
    return {
      id: o.operation,
      kind: 'operation',
      label: o.operation,
      statusKind: o.exposure,
      signaled: o.signaled,
      // comparison is declared as instrument-introduced, with the baseline named
      comparison: base && base.exposure !== o.exposure
        ? { baseline: baselineId, was: base.exposure, transformation: 'T-OBS-007' }
        : null,
      evidenceId: `projection:${surface.identity.id}`,
    };
  });
  return model('operations', {
    items,
    transformations: baselineSurface ? ['T-OBS-006', 'T-OBS-007'] : ['T-OBS-006'],
  });
}

/* ─────────────────────────────────────────────────────────── predicates */

/**
 * Ω_sys predicates. All conjuncts are rendered at equal weight and in the order the runtime returned
 * them; the instrument does not rank failures, because the runtime assigns no severity (T-OBS-R01).
 */
export function predicatesModel(result, evidenceId) {
  const items = result.evidence.predicates.map((p, i) => ({
    id: p.predicate,
    kind: 'predicate',
    label: p.predicate,
    statusKind: p.value ? 'exposed' : 'unavailable',
    value: p.value,
    order: i, // runtime order, not a ranking
    basis: p.basis,
    authoritySource: p.authoritySource ?? null,
    evidenceId,
  }));
  return model('predicates', {
    items,
    transformations: ['T-OBS-002'],
    disclosures: [{
      transformation: 'T-OBS-002',
      text: 'All predicates are equal conjuncts in the order the runtime returned them. Colour marks the value, not importance — the instrument does not rank failures.',
    }],
  });
}

/* ───────────────────────────────────────────────────────────── episodes */

/**
 * Episode segmentation. Always conditional, always accompanied by its detector parameters, and the
 * alternatives are always present — a grouping shown alone would read as canonical.
 */
export function episodesModel(detections, activeIndex) {
  const active = detections[activeIndex];
  if (!active) {
    return model('episodes', {
      items: [],
      refusals: [{ what: 'episode segmentation', reason: 'no detection recorded', statusKind: 'missing' }],
    });
  }
  const items = active.result.episodes.map((e, i) => ({
    id: `episode-${i}`,
    kind: 'episode',
    label: e.participants.join(' ↔ '),
    statusKind: 'exposed',
    basis: e.basis,
    evidenceId: active.evidenceId,
  }));
  return model('episodes', {
    items,
    transformations: ['T-OBS-005'],
    conditional: {
      // parameters travel with the grouping; a conditional finding never appears bare
      parameters: {
        recurrenceWindow: active.contract.recurrenceWindow,
        minimumInfluence: active.contract.minimumInfluence,
        boundary: active.contract.boundary.participants,
        span: [active.contract.boundary.start, active.contract.boundary.end],
      },
      alternativesAvailable: detections.length - 1,
      selectedByInstrument: activeIndex === 0,
    },
  });
}

/* ─────────────────────────────────────────────────────────────── claims */

/** Claims carry maturity and independence as separate channels; they are never combined into a score. */
export function claimsModel(claims, independenceOf) {
  const items = claims.map((c) => ({
    id: c.id,
    kind: 'claim',
    label: c.claim,
    statusKind: 'exposed',
    maturity: c.grade,
    emphasis: EMPHASIS[c.grade],
    provenance: c.provenance,
    independence: independenceOf(c.provenance),
    prediction: c.prediction ?? null,
  }));
  return model('claims', { items, transformations: ['T-OBS-009'] });
}

/* ────────────────────────────────────────────── constructibility refusal */

/**
 * Whether a view may be constructed at all (T-OBS-R05). Rather than drawing a plausible graph over
 * insufficient evidence, the instrument declines and says what is missing.
 */
export function constructibility(claimId, claims, independenceOf) {
  const claim = claims.find((c) => c.id === claimId);
  if (!claim) {
    return { constructible: false, reason: 'no such claim in the evidence profile', statusKind: 'missing' };
  }
  const independence = independenceOf(claim.provenance);
  if (claim.grade === 'architectural-hypothesis') {
    return {
      constructible: false,
      statusKind: 'unsupported',
      reason: 'the supporting claim is an architectural hypothesis, not a finding',
      availableEvidence: `${claim.provenance} (independence: ${independence})`,
      wouldBeGroundedBy: claim.wouldBeGroundedBy,
      prediction: claim.prediction ?? null,
    };
  }
  return { constructible: true, statusKind: 'exposed', independence };
}

/* ──────────────────────────────────────────── representation invariants */

/**
 * The rules a rendered model must satisfy. Violations are instrument defects — the runtime could be
 * perfectly correct and the reviewer still misled.
 */
export function representationProblems(m) {
  const problems = [];
  const push = (rule, detail) => problems.push({ view: m.view, rule, detail });

  for (const item of m.items) {
    if (item.statusKind && !STATUS_KINDS.includes(item.statusKind)) {
      push('R0-known-status', `${item.id}: unknown status kind "${item.statusKind}"`);
    }
    // R1 — hidden and unavailable are different facts about the world
    if (item.kind === 'operation' && item.statusKind === 'hidden' && item.rendersAs === 'unavailable') {
      push('R1-hidden-is-not-unavailable', `${item.id} is hidden but renders as unavailable`);
    }
    // R6 — missing evidence must say missing, never empty or false
    if (item.evidenceMissing && item.statusKind !== 'missing') {
      push('R6-missing-is-not-empty', `${item.id} has no evidence but renders as ${item.statusKind}`);
    }
  }

  // R2 — nothing omitted without an omission indicator
  if (m.omitted > 0 && !m.disclosures.some((d) => /omitted|showing first|filter/i.test(d.text ?? ''))) {
    push('R2-omission-disclosed', `${m.omitted} item(s) omitted with no indicator`);
  }

  // R3 — a conditional finding always travels with its parameters
  if (m.conditional && !m.conditional.parameters) {
    push('R3-conditional-carries-parameters', 'conditional grouping rendered without detector parameters');
  }
  if (m.conditional?.selectedByInstrument && m.conditional.alternativesAvailable > 0) {
    const declared = m.transformations.includes('T-OBS-005');
    if (!declared) push('R3-default-selection-declared', 'instrument-selected default not declared as a transformation');
  }

  // R4 — maturity levels must not share an emphasis token
  const byEmphasis = new Map();
  for (const item of m.items.filter((i) => i.maturity)) {
    const prev = byEmphasis.get(item.emphasis);
    if (prev && prev !== item.maturity) {
      push('R4-maturity-distinct', `"${item.emphasis}" is used for both ${prev} and ${item.maturity}`);
    }
    byEmphasis.set(item.emphasis, item.maturity);
  }

  // R5 — discoveries and predictions must remain distinguishable
  const kinds = new Set(m.items.map((i) => i.kind));
  if (kinds.has('discovery') && kinds.has('prediction')) {
    const ambiguous = m.items.filter((i) => !i.kind);
    if (ambiguous.length) push('R5-discovery-distinct-from-prediction', `${ambiguous.length} item(s) without a kind`);
  }

  // R7 — disagreeing sources must not be merged
  if (m.mergedSources?.some((s) => s.disagreed)) {
    push('R7-no-collapse-on-disagreement', 'sources that disagree were collapsed into one value');
  }

  // R8 — every non-lossless transformation must be disclosed
  for (const id of m.transformations) {
    const t = byId(id);
    if (t && requiresDisclosure(t) && !m.disclosures.some((d) => d.transformation === id)) {
      push('R8-transformation-disclosed', `${id} (${t.classification}) applied without disclosure`);
    }
  }

  return problems;
}
