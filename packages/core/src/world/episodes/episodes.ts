/**
 * F1.7 — parameterized candidate-episode detection. Runs under a declared detection contract
 * ⟨boundary, timescale, coupling predicate, recurrence window, influence threshold⟩ and returns
 * CONDITIONAL findings only: "given these parameters, this trace satisfies the candidate-episode rule."
 * It never asserts the boundary is uniquely correct; alternate defensible parameterizations are reported.
 *
 * Coupling is distinguished from shared cause structurally: a coupling event is a directed perturbation
 * from one participant TO another. A common source C→A and C→B (no A↔B link) is shared cause, not a
 * coupled episode. Preserves the world-participant / episode-participant distinction. Field-free; internal.
 */
import type { WorldVersionEnvelope } from '../envelope.ts';

export interface Transition {
  readonly step: number;
  readonly from: string; // originating (world) participant
  readonly to?: string; // affected participant — a coupling target
  readonly operation: string;
  readonly influence: number;
}

export interface CouplingPredicate {
  readonly kind: 'direct-influence';
  readonly minInfluence: number;
}

export interface DetectionBoundary {
  readonly participants: readonly string[];
  readonly start: number;
  readonly end: number;
}

export interface DetectionContract {
  readonly boundary: DetectionBoundary;
  readonly timescale: number;
  readonly coupling: CouplingPredicate;
  readonly recurrenceWindow: number;
  readonly minimumInfluence: number;
}

export type EpisodeBasis = 'reciprocal' | 'mediated' | 'recurrent';

export interface CandidateEpisode {
  readonly participants: readonly string[];
  readonly supportingPairs: readonly (readonly [Transition, Transition])[];
  readonly basis: EpisodeBasis;
  readonly span: number;
}

export interface AlternateSegmentation {
  readonly participants: readonly string[];
  readonly basis: EpisodeBasis;
  readonly underParameter: string; // e.g. "recurrenceWindow≥19"
}

export interface DetectionResult {
  readonly conditional: true; // "given these parameters…", never unconditional
  readonly episodes: readonly CandidateEpisode[];
  readonly episodeParticipants: readonly string[];
  readonly worldParticipants: readonly string[];
  readonly boundaryUsed: DetectionBoundary;
  readonly couplingBasis: string;
  readonly determinacy: 'determinate' | 'multiple-defensible' | 'none';
  readonly alternateSegmentations: readonly AlternateSegmentation[];
  readonly failureReasons: readonly string[];
  readonly evidence: { readonly envelope?: WorldVersionEnvelope; readonly qualifyingEdges: number; readonly transitionsInBoundary: number };
}

interface Edge {
  readonly from: string;
  readonly to: string;
  readonly step: number;
  readonly influence: number;
}

function qualifyingEdges(trace: readonly Transition[], contract: DetectionContract): Edge[] {
  const threshold = Math.max(contract.minimumInfluence, contract.coupling.minInfluence);
  const inScope = (p: string) => contract.boundary.participants.includes(p);
  const out: Edge[] = [];
  for (const t of trace) {
    if (t.step < contract.boundary.start || t.step > contract.boundary.end) continue;
    if (t.to === undefined) continue;
    if (!inScope(t.from) || !inScope(t.to)) continue;
    if (t.influence < threshold) continue;
    out.push({ from: t.from, to: t.to, step: t.step, influence: t.influence });
  }
  return out;
}

function setKey(participants: readonly string[]): string {
  return [...participants].sort().join('|');
}

/** Episodes detectable within `window`: reciprocal (A↔B), mediated (A→M→B→A), recurrent (≥2 A→B). */
function detectWithin(edges: readonly Edge[], window: number): CandidateEpisode[] {
  const episodes: CandidateEpisode[] = [];
  const seen = new Set<string>();
  const add = (participants: string[], pairs: (readonly [Transition, Transition])[], basis: EpisodeBasis, span: number) => {
    const key = setKey(participants);
    if (seen.has(key)) return;
    seen.add(key);
    episodes.push({ participants: [...participants].sort(), supportingPairs: pairs, basis, span });
  };
  const toTransition = (e: Edge): Transition => ({ step: e.step, from: e.from, to: e.to, operation: 'coupling', influence: e.influence });

  // reciprocal: A→B (s1) then B→A (s2>s1), s2-s1 ≤ window
  for (const ab of edges) {
    for (const ba of edges) {
      if (ba.from === ab.to && ba.to === ab.from && ba.step > ab.step && ba.step - ab.step <= window) {
        add([ab.from, ab.to], [[toTransition(ab), toTransition(ba)]], 'reciprocal', ba.step - ab.step);
      }
    }
  }
  // mediated: A→M (s1), M→B (s2>s1), B→A (s3>s2), s3-s1 ≤ window
  for (const am of edges) {
    for (const mb of edges) {
      if (mb.from !== am.to || mb.step <= am.step) continue;
      for (const ba of edges) {
        if (ba.from === mb.to && ba.to === am.from && ba.step > mb.step && ba.step - am.step <= window && am.from !== am.to && am.to !== mb.to) {
          add([am.from, am.to, mb.to], [[toTransition(am), toTransition(mb)], [toTransition(mb), toTransition(ba)]], 'mediated', ba.step - am.step);
        }
      }
    }
  }
  // recurrent: ≥2 A→B within window (and not already a reciprocal/mediated episode)
  const byDir = new Map<string, Edge[]>();
  for (const e of edges) {
    const key = `${e.from}->${e.to}`;
    (byDir.get(key) ?? byDir.set(key, []).get(key)!).push(e);
  }
  for (const [, list] of byDir) {
    if (list.length < 2) continue;
    const sorted = [...list].sort((a, b) => a.step - b.step);
    const span = sorted[sorted.length - 1]!.step - sorted[0]!.step;
    if (span <= window) {
      add([sorted[0]!.from, sorted[0]!.to], [[toTransition(sorted[0]!), toTransition(sorted[1]!)]], 'recurrent', span);
    }
  }
  return episodes;
}

export function detectEpisodes(
  trace: readonly Transition[],
  contract: DetectionContract,
  worldParticipants: readonly string[],
  envelope?: WorldVersionEnvelope,
): DetectionResult {
  const edges = qualifyingEdges(trace, contract);
  const transitionsInBoundary = trace.filter((t) => t.step >= contract.boundary.start && t.step <= contract.boundary.end && contract.boundary.participants.includes(t.from)).length;

  const episodes = detectWithin(edges, contract.recurrenceWindow);

  // alternate segmentations: episodes that appear only under a materially wider window
  const wide = detectWithin(edges, contract.recurrenceWindow * 10 + 100);
  const declaredKeys = new Set(episodes.map((e) => setKey(e.participants)));
  const alternateSegmentations: AlternateSegmentation[] = wide
    .filter((e) => !declaredKeys.has(setKey(e.participants)))
    .map((e) => ({ participants: e.participants, basis: e.basis, underParameter: `recurrenceWindow≥${e.span}` }));

  const episodeParticipants = [...new Set(episodes.flatMap((e) => e.participants))].sort();

  const failureReasons: string[] = [];
  if (episodes.length === 0) {
    if (edges.length === 0) failureReasons.push('below-influence-threshold-or-out-of-boundary');
    else if (alternateSegmentations.length > 0) failureReasons.push('reciprocity-or-recurrence-only-outside-recurrence-window');
    else failureReasons.push('no-reciprocity-or-recurrence-under-boundary');
  }

  const determinacy: DetectionResult['determinacy'] =
    alternateSegmentations.length > 0 ? 'multiple-defensible' : episodes.length === 0 ? 'none' : 'determinate';

  return {
    conditional: true,
    episodes,
    episodeParticipants,
    worldParticipants: [...worldParticipants],
    boundaryUsed: contract.boundary,
    couplingBasis: `direct-influence ≥ ${Math.max(contract.minimumInfluence, contract.coupling.minInfluence)}`,
    determinacy,
    alternateSegmentations,
    failureReasons,
    evidence: { envelope, qualifyingEdges: edges.length, transitionsInBoundary },
  };
}
