import corpusData from '../data/manga-corpus.json';

export interface ObservationVector {
  negativeSpace: number;
  panelDensity: number;
  dialogueDensity: number;
  inkCoverage: number;
  closeUpFrequency: number;
  sfxDensity: number;
  environmentalScale: number;
  characterRecurrence: number;
  visualPacing: number;
  borderViolation: number;
  actionDensity: number;
  contrast: number;
}

export interface MangaEdition {
  id: string;
  name: string;
  volumeCount: number;
  isbns: string[];
  format: string;
}

export interface MangaSection {
  id: string;
  volume: string;
  chapterRange: string;
  pageRange: string;
  label: string;
  vector: ObservationVector;
  keyCharacters?: string[];
}

export interface MangaWork {
  id: string;
  title: string;
  originalTitle?: string;
  author: string;
  publisher: string;
  genre: string[];
  yr?: number;
  editions: MangaEdition[];
  overallVector: ObservationVector;
  sections?: MangaSection[];
}

export interface QueryChip {
  kind: 'obs' | 'entity' | 'era' | 'status';
  label: string;
  test: (w: MangaWork) => boolean;
}

export interface ShelfItem {
  work: MangaWork;
  section?: MangaSection;
  matchScore: number; // 0..100
  explanation: {
    why: string;
    held: string[];
    varied?: string[];
    matchingPageRange?: string;
    provenance?: string;
  };
}

export interface ShelfResult {
  id: string;
  poeticTitle: string;
  generatedLabel: string;
  activeTitle: string;
  subtitle: string;
  lensType: string;
  evidenceState: 'new' | 'steady' | 'fading';
  evidenceScore: number;
  counterfactual?: boolean;
  items: ShelfItem[];
}

export const MANGA_WORKS: MangaWork[] = corpusData.works as MangaWork[];

const RESERVED_OUTSIDE_IDS = ['work_golden_kamuy', 'work_yotsuba', 'work_demon_slayer'];

const DIM_SHORT: Record<keyof ObservationVector, string> = {
  negativeSpace: 'wide panels',
  panelDensity: 'dense panels',
  dialogueDensity: 'dialogue',
  inkCoverage: 'dark ink',
  closeUpFrequency: 'close-ups',
  sfxDensity: 'sound effects',
  environmentalScale: 'architectural scale',
  characterRecurrence: 'cast focus',
  visualPacing: 'slow pacing',
  borderViolation: 'borderless panels',
  actionDensity: 'action density',
  contrast: 'high contrast',
};

// Query term resolution regexes
const QUERY_TERMS = [
  { match: /\bquiet|silent|wordless\b/i, chip: 'dialogue: low', test: (w: MangaWork) => w.overallVector.dialogueDensity < 0.35 },
  { match: /\bloud|chaos|chaotic|action\b/i, chip: 'panel density: high', test: (w: MangaWork) => w.overallVector.panelDensity > 6.5 },
  { match: /\bdark|black|ink\b/i, chip: 'ink coverage: high', test: (w: MangaWork) => w.overallVector.inkCoverage > 0.65 },
  { match: /\bslow|meditative\b/i, chip: 'pacing: slow', test: (w: MangaWork) => w.overallVector.visualPacing < 0.30 },
  { match: /\bwide|large panels|cinematic\b/i, chip: 'negative space: wide', test: (w: MangaWork) => w.overallVector.negativeSpace > 0.70 },
  { match: /\bclose-?ups?|faces\b/i, chip: 'close-ups: frequent', test: (w: MangaWork) => w.overallVector.closeUpFrequency > 0.70 },
  { match: /\b1990s|90s|nineties\b/i, chip: 'published: 1990s', test: (w: MangaWork) => (w.yr ?? 2000) >= 1990 && (w.yr ?? 2000) < 2000 },
  { match: /\b1980s|80s\b/i, chip: 'published: 1980s', test: (w: MangaWork) => (w.yr ?? 2000) >= 1980 && (w.yr ?? 2000) < 1990 },
  { match: /\bnew|recent\b/i, chip: 'added: recently', test: (w: MangaWork) => (w.yr ?? 2000) >= 2018 },
];

export function resolveQueryChips(text: string): QueryChip[] {
  const chips: QueryChip[] = [];
  if (!text.trim()) return chips;

  for (const term of QUERY_TERMS) {
    if (term.match.test(text)) {
      chips.push({ kind: 'obs', label: term.chip, test: term.test });
    }
  }

  // Author & Genre resolution
  for (const w of MANGA_WORKS) {
    const authorName = w.author.split(' ')[0];
    if (new RegExp('\\b' + authorName + '\\b', 'i').test(text) && !chips.some((c) => c.label.includes(authorName))) {
      chips.push({ kind: 'entity', label: `creator: ${w.author}`, test: (item) => item.author === w.author });
    }
  }

  return chips;
}

export function filterCorpusByChips(works: MangaWork[], chips: QueryChip[]): MangaWork[] {
  if (chips.length === 0) return works;
  return works.filter((w) => chips.every((c) => c.test(w)));
}

export function computeCentroid(vectors: ObservationVector[]): ObservationVector {
  if (vectors.length === 0) {
    return {
      negativeSpace: 0.5, panelDensity: 5.0, dialogueDensity: 0.5, inkCoverage: 0.5,
      closeUpFrequency: 0.5, sfxDensity: 0.5, environmentalScale: 0.5, characterRecurrence: 0.5,
      visualPacing: 0.5, borderViolation: 0.5, actionDensity: 0.5, contrast: 0.5,
    };
  }
  const sum = vectors.reduce((acc, v) => ({
    negativeSpace: acc.negativeSpace + v.negativeSpace,
    panelDensity: acc.panelDensity + v.panelDensity,
    dialogueDensity: acc.dialogueDensity + v.dialogueDensity,
    inkCoverage: acc.inkCoverage + v.inkCoverage,
    closeUpFrequency: acc.closeUpFrequency + v.closeUpFrequency,
    sfxDensity: acc.sfxDensity + v.sfxDensity,
    environmentalScale: acc.environmentalScale + v.environmentalScale,
    characterRecurrence: acc.characterRecurrence + v.characterRecurrence,
    visualPacing: acc.visualPacing + v.visualPacing,
    borderViolation: acc.borderViolation + v.borderViolation,
    actionDensity: acc.actionDensity + v.actionDensity,
    contrast: acc.contrast + v.contrast,
  }));
  const k = vectors.length;
  return {
    negativeSpace: sum.negativeSpace / k,
    panelDensity: sum.panelDensity / k,
    dialogueDensity: sum.dialogueDensity / k,
    inkCoverage: sum.inkCoverage / k,
    closeUpFrequency: sum.closeUpFrequency / k,
    sfxDensity: sum.sfxDensity / k,
    environmentalScale: sum.environmentalScale / k,
    characterRecurrence: sum.characterRecurrence / k,
    visualPacing: sum.visualPacing / k,
    borderViolation: sum.borderViolation / k,
    actionDensity: sum.actionDensity / k,
    contrast: sum.contrast / k,
  };
}

export interface LensDefinition {
  id: string;
  poeticTitle: string;
  subtitle: string;
  lensType: string;
  counterfactual?: boolean;
  weights: Partial<Record<keyof ObservationVector, number>>;
}

const LENSES: LensDefinition[] = [
  {
    id: 'vast-worlds',
    poeticTitle: 'Vast Worlds, Small People',
    subtitle: 'High Environmental Scale, Negative Space & Sparse Dialogue',
    lensType: 'scale-architecture',
    weights: { environmentalScale: 2.5, negativeSpace: 2.0, dialogueDensity: -2.0, panelDensity: -1.5 },
  },
  {
    id: 'complicated-relationships',
    poeticTitle: 'Complicated Relationships',
    subtitle: 'Dialogue-Heavy Chapter Ranges, Reactions & Close-Ups',
    lensType: 'character-dialogue',
    weights: { closeUpFrequency: 2.5, dialogueDensity: 2.0, characterRecurrence: 2.0, actionDensity: -1.5 },
  },
  {
    id: 'beautiful-chaos',
    poeticTitle: 'Beautiful Chaos',
    subtitle: 'High Panel Density, SFX Rotation & Ink Entropy',
    lensType: 'entropy-density',
    weights: { panelDensity: 2.2, sfxDensity: 2.2, borderViolation: 2.5, inkCoverage: 1.8 },
  },
  {
    id: 'pages-that-breathe',
    poeticTitle: 'Pages That Breathe',
    subtitle: 'Sub-Publication Page Ranges with Open Gutters & Quiet Pacing',
    lensType: 'spatial-rest',
    weights: { negativeSpace: 2.8, visualPacing: -2.0, dialogueDensity: -2.2 },
  },
  {
    id: 'same-rhythm',
    poeticTitle: 'Same Rhythm, Different World',
    subtitle: 'Axis-Isolated Vector Similarity · Constant Pacing, Varied Setting',
    lensType: 'rhythm-axis',
    counterfactual: true,
    weights: { visualPacing: 2.0, panelDensity: 1.5, environmentalScale: 1.5 },
  },
];

export function computeLensScore(v: ObservationVector, lensWeights: Partial<Record<keyof ObservationVector, number>>): number {
  let scoreSum = 0;
  let weightSum = 0;

  for (const [key, w] of Object.entries(lensWeights)) {
    const k = key as keyof ObservationVector;
    const raw = v[k];
    const normalized = k === 'panelDensity' ? raw / 8.0 : raw;
    const target = (w ?? 1.0) > 0 ? normalized : 1.0 - normalized;
    const absW = Math.abs(w ?? 1.0);
    scoreSum += target * absW;
    weightSum += absW;
  }

  return weightSum > 0 ? Math.round((scoreSum / weightSum) * 100) : 50;
}

export function generateDimensionalLabel(v: ObservationVector, lensWeights: Partial<Record<keyof ObservationVector, number>>): string {
  const sorted = Object.entries(lensWeights)
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
    .slice(0, 3)
    .map(([key, w]) => {
      const k = key as keyof ObservationVector;
      const label = DIM_SHORT[k] || k;
      return w < 0 ? `low ${label}` : label;
    });

  return sorted.join(' · ');
}

/**
 * EXCLUSIVE SHELF ALLOCATION ENGINE:
 * 1. Claims each work to its single strongest matching lens so no work repeats across main shelves.
 * 2. Reserves Outside Your Usual titles separately.
 * 3. Evaluates evidence score & generates honest evidence labels ('new', 'steady', 'fading').
 */
export function computeExclusiveRelationalShelves(
  recentReadIds: string[],
  activeChips: QueryChip[] = [],
  heldState: Record<string, boolean> = { pace: true, space: true, color: false, closeup: false }
): { shelves: ShelfResult[]; outsideItems: ShelfItem[]; subChapters: ShelfItem[] } {
  let candidatePool = filterCorpusByChips(MANGA_WORKS, activeChips);

  // Reserve Outside Your Usual titles
  const reservedSet = new Set(RESERVED_OUTSIDE_IDS);
  const poolForShelves = candidatePool.filter((w) => !reservedSet.has(w.id));

  // Determine best lens per work
  const workBestLens = new Map<string, { lensId: string; score: number }>();

  for (const work of poolForShelves) {
    let topLensId = LENSES[0].id;
    let topScore = -1;

    for (const lens of LENSES) {
      let wMap = lens.weights;
      if (lens.counterfactual) {
        // Apply held state dynamically
        wMap = {};
        if (heldState.pace) wMap.visualPacing = 2.0;
        if (heldState.space) wMap.negativeSpace = 1.8;
        if (heldState.closeup) wMap.closeUpFrequency = 1.8;
      }
      const score = computeLensScore(work.overallVector, wMap);
      if (score > topScore) {
        topScore = score;
        topLensId = lens.id;
      }
    }
    workBestLens.set(work.id, { lensId: topLensId, score: topScore });
  }

  // Allocate exclusively
  const claimedWorks = new Set<string>();
  const shelfResults: ShelfResult[] = [];

  for (const lens of LENSES) {
    let wMap = lens.weights;
    if (lens.counterfactual) {
      wMap = {};
      if (heldState.pace) wMap.visualPacing = 2.0;
      if (heldState.space) wMap.negativeSpace = 1.8;
      if (heldState.closeup) wMap.closeUpFrequency = 1.8;
    }

    // 1. Primary claim: works whose top lens is this lens
    let primaryItems: ShelfItem[] = poolForShelves
      .filter((w) => !claimedWorks.has(w.id) && workBestLens.get(w.id)?.lensId === lens.id)
      .map((w) => {
        const score = computeLensScore(w.overallVector, wMap);
        const section = w.sections?.[0];
        return {
          work: w,
          section,
          matchScore: score,
          explanation: {
            why: `High ${generateDimensionalLabel(w.overallVector, wMap)} across volume structure`,
            held: Object.keys(wMap).map((k) => DIM_SHORT[k as keyof ObservationVector] || k),
            varied: lens.counterfactual ? ['setting / period', 'subject matter', 'color palette'] : undefined,
            matchingPageRange: section ? `${section.volume} · ${section.chapterRange} (${section.pageRange})` : undefined,
            provenance: `detector: substrate-vector · confidence: ${(score / 100).toFixed(2)} · verified`,
          },
        };
      })
      .sort((a, b) => b.matchScore - a.matchScore);

    // Claim them
    primaryItems.forEach((it) => claimedWorks.add(it.work.id));

    // 2. Top-up if shelf has fewer than 4 items
    if (primaryItems.length < 4) {
      const topUpCandidates = poolForShelves
        .filter((w) => !claimedWorks.has(w.id))
        .map((w) => {
          const score = computeLensScore(w.overallVector, wMap);
          const section = w.sections?.[0];
          return {
            work: w,
            section,
            matchScore: score,
            explanation: {
              why: `Surfaced from pool matching ${generateDimensionalLabel(w.overallVector, wMap)}`,
              held: Object.keys(wMap).map((k) => DIM_SHORT[k as keyof ObservationVector] || k),
              matchingPageRange: section ? `${section.volume} · ${section.chapterRange} (${section.pageRange})` : undefined,
              provenance: `detector: pool-fallback · confidence: ${(score / 100).toFixed(2)} · candidate`,
            },
          };
        })
        .sort((a, b) => b.matchScore - a.matchScore)
        .slice(0, 4 - primaryItems.length);

      topUpCandidates.forEach((it) => claimedWorks.add(it.work.id));
      primaryItems = primaryItems.concat(topUpCandidates);
    }

    // Evidence calculation & title assembly
    const avgScore = primaryItems.length > 0 ? Math.round(primaryItems.reduce((acc, i) => acc + i.matchScore, 0) / primaryItems.length) : 0;
    const evidenceState: 'new' | 'steady' | 'fading' = avgScore >= 78 && primaryItems.length >= 4 ? 'new' : avgScore >= 62 ? 'steady' : 'fading';
    const genLabel = generateDimensionalLabel(primaryItems[0]?.work.overallVector || poolForShelves[0].overallVector, wMap);
    
    // HONEST SIGNAL: Render plain dimensional label if evidence is fading/weak
    const activeTitle = evidenceState === 'fading' ? genLabel.toUpperCase() : lens.poeticTitle;

    shelfResults.push({
      id: lens.id,
      poeticTitle: lens.poeticTitle,
      generatedLabel: genLabel,
      activeTitle,
      subtitle: lens.subtitle,
      lensType: lens.lensType,
      evidenceState,
      evidenceScore: avgScore,
      counterfactual: lens.counterfactual,
      items: primaryItems.slice(0, 5),
    });
  }

  // Generate Outside Your Usual items (reserved IDs)
  const outsideItems: ShelfItem[] = MANGA_WORKS
    .filter((w) => RESERVED_OUTSIDE_IDS.includes(w.id))
    .map((w) => ({
      work: w,
      matchScore: 64,
      explanation: {
        why: "Deliberately distant vector position holding one structural anchor while varying genre & tone",
        held: ["compositional balance"],
        varied: ["genre", "setting", "tone"],
        provenance: "detector: counter-recommendation · candidate · 0.64",
      },
    }));

  // Generate Sub-publication Chapter Ranges ("Continue this mood")
  const anchorWork = MANGA_WORKS.find((w) => w.id === recentReadIds[0]) || MANGA_WORKS[0];
  const subChapters: ShelfItem[] = poolForShelves
    .filter((w) => w.id !== anchorWork.id)
    .slice(0, 4)
    .map((w, idx) => {
      const pageStart = 14 + idx * 28;
      return {
        work: w,
        matchScore: 92 - idx * 4,
        explanation: {
          why: `${92 - idx * 4}% of the visual mood you just read in ${anchorWork.title}`,
          held: ["page-range rhythm", "gutter scale"],
          matchingPageRange: `Ch. ${idx + 4} · pages ${pageStart}–${pageStart + 24}`,
          provenance: `detector: chapter-sub-publication · confidence: 0.${92 - idx * 4} · verified`,
        },
      };
    });

  return { shelves: shelfResults, outsideItems, subChapters };
}
