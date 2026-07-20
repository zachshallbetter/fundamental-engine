/**
 * Evidence provenance (EXPERIMENTAL, internal).
 *
 * Maturity and provenance are different dimensions and were previously conflated. Two claims can both
 * be "fixture-supported" while differing completely in what backs them: one may exercise a mechanism
 * that already existed and could have behaved otherwise, the other may only exercise an API introduced
 * in the same commit as the test. The first can fail; the second is a tautology with assertions.
 *
 * So every claim and every discovery carries BOTH a maturity level and a provenance, and provenance
 * carries an independence rating that is a property of the source, not of the author's confidence.
 */

export type EvidenceProvenance =
  /** Fell out of a mechanism built earlier for another purpose — it could have come out otherwise. */
  | 'emerged-from-prior-mechanism'
  /** A substrate written without knowledge of the thing it ended up testing. */
  | 'revealed-by-independent-substrate'
  /** A test written to break the design, by someone or something not working from its internals. */
  | 'independent-adversarial-test'
  /** A test written against the API it was designed alongside. Cannot falsify its own design. */
  | 'fixture-against-same-implementation'
  /** Asserted by the design. No observation involved. */
  | 'architectural-argument';

export type Independence = 'high' | 'medium' | 'low' | 'none';

export function independenceOf(provenance: EvidenceProvenance): Independence {
  switch (provenance) {
    case 'emerged-from-prior-mechanism':
    case 'revealed-by-independent-substrate':
      return 'high';
    case 'independent-adversarial-test':
      return 'medium';
    case 'fixture-against-same-implementation':
      return 'low';
    case 'architectural-argument':
      return 'none';
  }
}

/** Maturity of a claim — how settled it is, independent of what backs it. */
export type EvidenceGrade = 'experimentally-grounded' | 'fixture-supported' | 'architectural-hypothesis';

export interface ProvenanceProblem {
  readonly rule: string;
  readonly detail: string;
}

/**
 * Maturity may not outrun provenance. A claim cannot be `experimentally-grounded` on the strength of a
 * fixture written against its own implementation, and a claim resting on an architectural argument
 * cannot be anything but a hypothesis.
 */
export function gradeProvenanceProblems(grade: EvidenceGrade, provenance: EvidenceProvenance): ProvenanceProblem[] {
  const independence = independenceOf(provenance);
  const problems: ProvenanceProblem[] = [];

  if (grade === 'experimentally-grounded' && (independence === 'low' || independence === 'none')) {
    problems.push({
      rule: 'grounded-requires-independence',
      detail: `experimentally-grounded requires high or medium independence, got ${independence} (${provenance})`,
    });
  }
  if (grade === 'fixture-supported' && independence === 'none') {
    problems.push({
      rule: 'fixture-requires-observation',
      detail: 'an architectural argument is not a fixture — this is a hypothesis',
    });
  }
  if (grade === 'architectural-hypothesis' && independence !== 'none') {
    problems.push({
      rule: 'hypothesis-understates-evidence',
      detail: `${provenance} is real evidence; grading it a hypothesis understates what is known`,
    });
  }
  return problems;
}
