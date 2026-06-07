// The research-section navigation — the field-ui paper family. One source for the
// research sidebar and prev/next, mirroring `docs-nav.ts`. These are preprint drafts
// (work in progress); the canonical source is `docs/research/` in the repository.

export interface ResearchPaper {
  /** route, e.g. /research/01-field-translation-runtime */
  href: string;
  /** paper number 1..8 */
  n: number;
  /** short sidebar label */
  short: string;
  /** full title */
  title: string;
  /** one-line contribution */
  contribution: string;
}

export const RESEARCH_PAPERS: ResearchPaper[] = [
  {
    n: 1,
    href: '/research/01-field-translation-runtime',
    short: 'Field Translation Runtime',
    title: 'field-ui: A Field Translation Runtime for Relational DOM Interfaces',
    contribution: 'The paradigm: UI as a shared, inspectable field of meaning.',
  },
  {
    n: 2,
    href: '/research/02-reading-field',
    short: 'Reading Field',
    title: 'Reading Field: Attention, Memory, and Relationship Awareness in Long-Form Web Documents',
    contribution: 'A field model for reading attention and document memory that preserves semantic HTML.',
  },
  {
    n: 3,
    href: '/research/03-evidence-fields',
    short: 'Evidence Fields',
    title: 'Evidence Fields: Visualizing Support, Contradiction, Confidence, and Provenance in AI Interfaces',
    contribution: 'A field-based interaction model for evidence, confidence, contradiction, and provenance.',
  },
  {
    n: 4,
    href: '/research/04-motion-equivalence',
    short: 'Motion Equivalence',
    title: 'Motion Is Not Meaning: Reduced-Motion Equivalence in Field-Based Interface Systems',
    contribution: 'A conformance model for translating motion-heavy behavior into static semantic equivalents.',
  },
  {
    n: 5,
    href: '/research/05-host-driven-runtime',
    short: 'Host-Driven Runtime',
    title: 'A Host-Driven Field Runtime for Portable Interface Behavior',
    contribution: 'A runtime architecture that targets DOM, Canvas, SVG, WebGL, native, or headless.',
  },
  {
    n: 6,
    href: '/research/06-portable-field-recipes',
    short: 'Portable Field Recipes',
    title: 'Recipes as Portable Field Programs for Interface Behavior',
    contribution: 'A structured authoring model that composes behavior without corrupting runtime vocabulary.',
  },
  {
    n: 7,
    href: '/research/07-data-as-field-participants',
    short: 'Data as Field Participants',
    title: 'Data as Field Participants: Binding Records, Relationships, and Metrics into Interface Fields',
    contribution: 'A data-binding model for relational interface fields.',
  },
  {
    n: 8,
    href: '/research/08-explainable-interface-behavior',
    short: 'Explainable Interface Behavior',
    title: 'Explainable Interface Behavior Through Field Diagnostics',
    contribution: 'A diagnostic framework for explainable interaction behavior.',
  },
];
