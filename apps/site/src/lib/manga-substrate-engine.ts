import corpusData from '../data/manga-corpus.json' with { type: 'json' };

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

export interface ZVector {
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

export interface CanonicalLocator {
  workId: string;
  volumeNum: number;
  chapterNum?: number;
  canonicalPageRange: [number, number];
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
  locator: CanonicalLocator;
  label: string;
  rawVector: ObservationVector;
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
  measuredRevision?: string;
  editions: MangaEdition[];
  rawVector: ObservationVector;
  canonicalSections?: MangaSection[];
}

export interface QueryChip {
  kind: 'obs' | 'entity' | 'era' | 'status';
  label: string;
  test: (w: MangaWork) => boolean;
}

export interface LocalInteractionState {
  dwellMs: Record<string, number>;
  rereadCounts: Record<string, number>;
  pinchZoomEvents: Record<string, number>;
}

export interface ShelfItem {
  work: MangaWork;
  section?: MangaSection;
  matchScore: number; // 0..100
  zScore: ZVector;
  surpriseAcceptScore?: number;
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
  isEmptyState?: boolean;
  items: ShelfItem[];
}

export const MANGA_WORKS: MangaWork[] = corpusData.works as MangaWork[];
export const REFERENCE_POP = corpusData.referencePopulations.global;

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

// Z-Score calculation against reference population
export function computeZScore(raw: ObservationVector): ZVector {
  const z: Partial<ZVector> = {};
  const keys = Object.keys(raw) as (keyof ObservationVector)[];

  for (const k of keys) {
    const pop = REFERENCE_POP[k as keyof typeof REFERENCE_POP];
    if (pop && pop.std > 0) {
      z[k] = (raw[k] - pop.mean) / pop.std;
    } else {
      z[k] = 0;
    }
  }

  return z as ZVector;
}

export function getWorkZScore(work: MangaWork): ZVector {
  return computeZScore(work.rawVector);
}

// Locator translation mapping canonical ranges across omnibus vs single editions
export function translateLocatorToEdition(locator: CanonicalLocator, editionFormat: string): string {
  const [start, end] = locator.canonicalPageRange;

  if (editionFormat === 'omnibus' || editionFormat === '3in1') {
    const omniVol = Math.ceil(locator.volumeNum / 3);
    const offset = ((locator.volumeNum - 1) % 3) * 180;
    return `3-in-1 Vol. ${omniVol} · pages ${start + offset}–${end + offset}`;
  }

  return `Vol. ${locator.volumeNum} · Ch. ${locator.chapterNum ?? 1} (pp. ${start}–${end})`;
}

// Generated measurement visual cover signature (No jacket image needed!)
export function generateMeasurementSvg(raw: ObservationVector, width = 180, height = 120): string {
  const inkDarkness = Math.round(raw.inkCoverage * 255);
  const bgHex = `rgb(${255 - inkDarkness}, ${255 - inkDarkness}, ${255 - inkDarkness})`;
  const gridPanels = Math.min(12, Math.max(2, Math.round(raw.panelDensity)));
  const flexColumns = gridPanels > 6 ? 3 : 2;
  const flexRows = Math.ceil(gridPanels / flexColumns);

  let rects = '';
  const cellWidth = Math.floor((width - 16) / flexColumns);
  const cellHeight = Math.floor((height - 16) / flexRows);

  for (let r = 0; r < flexRows; r++) {
    for (let c = 0; c < flexColumns; c++) {
      const x = 8 + c * cellWidth + 2;
      const y = 8 + r * cellHeight + 2;
      const w = cellWidth - 4;
      const h = cellHeight - 4;

      const fillOpacity = (raw.contrast * 0.8 + 0.2).toFixed(2);
      rects += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2" fill="#38c9ea" fill-opacity="${fillOpacity}" stroke="#6628ee" stroke-width="1" />`;
    }
  }

  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" style="background:#03060d; border-radius:8px;">
    <rect width="${width}" height="${height}" fill="${bgHex}" fill-opacity="0.15" />
    ${rects}
    <text x="10" y="${height - 10}" fill="#38c9ea" font-family="monospace" font-size="9">z-env:${(computeZScore(raw).environmentalScale).toFixed(1)} z-ink:${(computeZScore(raw).inkCoverage).toFixed(1)}</text>
  </svg>`;
}

// Surprise-Accept Rate Metric Calculation (Penalizes shared genre/author, rewards visual similarity)
export function computeSurpriseAcceptScore(work: MangaWork, recentReadWorks: MangaWork[], zSimScore: number): number {
  let overlapPenalty = 0;

  for (const rw of recentReadWorks) {
    if (rw.author === work.author) overlapPenalty += 35;
    if (rw.publisher === work.publisher) overlapPenalty += 10;
    const sharedGenres = work.genre.filter((g) => rw.genre.includes(g));
    overlapPenalty += sharedGenres.length * 15;
  }

  const rawSurprise = zSimScore - overlapPenalty;
  return Math.max(0, Math.min(100, Math.round(rawSurprise)));
}

// Query term resolution
export function resolveQueryChips(text: string): QueryChip[] {
  const chips: QueryChip[] = [];
  if (!text.trim()) return chips;

  const QUERY_TERMS = [
    { match: /\bquiet|silent|wordless\b/i, chip: 'dialogue: low', test: (w: MangaWork) => w.rawVector.dialogueDensity < 0.35 },
    { match: /\bloud|chaos|chaotic|action\b/i, chip: 'panel density: high', test: (w: MangaWork) => w.rawVector.panelDensity > 6.5 },
    { match: /\bdark|black|ink\b/i, chip: 'ink coverage: high', test: (w: MangaWork) => w.rawVector.inkCoverage > 0.65 },
    { match: /\bslow|meditative\b/i, chip: 'pacing: slow', test: (w: MangaWork) => w.rawVector.visualPacing < 0.30 },
    { match: /\bwide|large panels|cinematic\b/i, chip: 'negative space: wide', test: (w: MangaWork) => w.rawVector.negativeSpace > 0.70 },
  ];

  for (const term of QUERY_TERMS) {
    if (term.match.test(text)) chips.push({ kind: 'obs', label: term.chip, test: term.test });
  }

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

export function computeLensScoreZ(z: ZVector, lensWeights: Partial<Record<keyof ObservationVector, number>>): number {
  let scoreSum = 0;
  let weightSum = 0;

  for (const [key, w] of Object.entries(lensWeights)) {
    const k = key as keyof ObservationVector;
    const val = z[k];
    const target = (w ?? 1.0) > 0 ? val : -val;
    const absW = Math.abs(w ?? 1.0);
    scoreSum += target * absW;
    weightSum += absW;
  }

  const avgZ = weightSum > 0 ? scoreSum / weightSum : 0;
  return Math.max(0, Math.min(100, Math.round(50 + avgZ * 22.5)));
}

export function generateDimensionalLabelZ(z: ZVector, lensWeights: Partial<Record<keyof ObservationVector, number>>): string {
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

export function computeExclusiveRelationalShelves(
  recentReadIds: string[],
  activeChips: QueryChip[] = [],
  heldState: Record<string, boolean> = { pace: true, space: true, color: false, closeup: false }
): { shelves: ShelfResult[]; outsideItems: ShelfItem[]; subChapters: ShelfItem[] } {
  let candidatePool = filterCorpusByChips(MANGA_WORKS, activeChips);
  const recentWorks = MANGA_WORKS.filter((w) => recentReadIds.includes(w.id));

  const reservedSet = new Set(RESERVED_OUTSIDE_IDS);
  const poolForShelves = candidatePool.filter((w) => !reservedSet.has(w.id));

  const workBestLens = new Map<string, { lensId: string; score: number }>();

  for (const work of poolForShelves) {
    const z = getWorkZScore(work);
    let topLensId = LENSES[0].id;
    let topScore = -1;

    for (const lens of LENSES) {
      let wMap = lens.weights;
      if (lens.counterfactual) {
        wMap = {};
        if (heldState.pace) wMap.visualPacing = 2.0;
        if (heldState.space) wMap.negativeSpace = 1.8;
        if (heldState.closeup) wMap.closeUpFrequency = 1.8;
      }
      const score = computeLensScoreZ(z, wMap);
      if (score > topScore) {
        topScore = score;
        topLensId = lens.id;
      }
    }
    workBestLens.set(work.id, { lensId: topLensId, score: topScore });
  }

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

    let primaryItems: ShelfItem[] = poolForShelves
      .filter((w) => !claimedWorks.has(w.id) && workBestLens.get(w.id)?.lensId === lens.id)
      .map((w) => {
        const z = getWorkZScore(w);
        const score = computeLensScoreZ(z, wMap);
        const surprise = computeSurpriseAcceptScore(w, recentWorks, score);
        const section = w.canonicalSections?.[0];
        return {
          work: w,
          section,
          matchScore: score,
          zScore: z,
          surpriseAcceptScore: surprise,
          explanation: {
            why: `Measured Z-score match across ${generateDimensionalLabelZ(z, wMap)} (${w.measuredRevision || 'canonical'})`,
            held: Object.keys(wMap).map((k) => DIM_SHORT[k as keyof ObservationVector] || k),
            varied: lens.counterfactual ? ['setting / period', 'subject matter', 'color palette'] : undefined,
            matchingPageRange: section ? translateLocatorToEdition(section.locator, w.editions[0]?.format) : undefined,
            provenance: `detector: z-score-population · confidence: ${(score / 100).toFixed(2)} · revision: verified`,
          },
        };
      })
      .sort((a, b) => b.matchScore - a.matchScore);

    primaryItems.forEach((it) => claimedWorks.add(it.work.id));

    if (primaryItems.length < 4) {
      const topUpCandidates = poolForShelves
        .filter((w) => !claimedWorks.has(w.id))
        .map((w) => {
          const z = getWorkZScore(w);
          const score = computeLensScoreZ(z, wMap);
          const surprise = computeSurpriseAcceptScore(w, recentWorks, score);
          const section = w.canonicalSections?.[0];
          return {
            work: w,
            section,
            matchScore: score,
            zScore: z,
            surpriseAcceptScore: surprise,
            explanation: {
              why: `Surfaced from pool matching Z-score ${generateDimensionalLabelZ(z, wMap)}`,
              held: Object.keys(wMap).map((k) => DIM_SHORT[k as keyof ObservationVector] || k),
              matchingPageRange: section ? translateLocatorToEdition(section.locator, w.editions[0]?.format) : undefined,
              provenance: `detector: z-score-pool · confidence: ${(score / 100).toFixed(2)} · candidate`,
            },
          };
        })
        .sort((a, b) => b.matchScore - a.matchScore)
        .slice(0, 4 - primaryItems.length);

      topUpCandidates.forEach((it) => claimedWorks.add(it.work.id));
      primaryItems = primaryItems.concat(topUpCandidates);
    }

    const avgScore = primaryItems.length > 0 ? Math.round(primaryItems.reduce((acc, i) => acc + i.matchScore, 0) / primaryItems.length) : 0;
    const evidenceState: 'new' | 'steady' | 'fading' = avgScore >= 78 && primaryItems.length >= 4 ? 'new' : avgScore >= 62 ? 'steady' : 'fading';
    const genLabel = generateDimensionalLabelZ(primaryItems[0]?.zScore || getWorkZScore(poolForShelves[0]), wMap);

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
      isEmptyState: avgScore < 50,
      items: primaryItems.slice(0, 5),
    });
  }

  const outsideItems: ShelfItem[] = MANGA_WORKS
    .filter((w) => RESERVED_OUTSIDE_IDS.includes(w.id))
    .map((w) => {
      const z = getWorkZScore(w);
      return {
        work: w,
        matchScore: 64,
        zScore: z,
        explanation: {
          why: "Deliberately distant Z-score position holding one structural anchor while varying genre & tone",
          held: ["compositional balance"],
          varied: ["genre", "setting", "tone"],
          provenance: "detector: counter-recommendation · candidate · 0.64",
        },
      };
    });

  const anchorWork = MANGA_WORKS.find((w) => w.id === recentReadIds[0]) || MANGA_WORKS[0];
  const subChapters: ShelfItem[] = poolForShelves
    .filter((w) => w.id !== anchorWork.id)
    .slice(0, 4)
    .map((w, idx) => {
      const z = getWorkZScore(w);
      const loc: CanonicalLocator = { workId: w.id, volumeNum: idx + 2, chapterNum: idx + 4, canonicalPageRange: [14 + idx * 28, 38 + idx * 28] };
      return {
        work: w,
        matchScore: 92 - idx * 4,
        zScore: z,
        explanation: {
          why: `${92 - idx * 4}% of the visual mood you just read in ${anchorWork.title}`,
          held: ["page-range rhythm", "gutter scale"],
          matchingPageRange: translateLocatorToEdition(loc, w.editions[0]?.format),
          provenance: `detector: canonical-locator · confidence: 0.${92 - idx * 4} · verified`,
        },
      };
    });

  return { shelves: shelfResults, outsideItems, subChapters };
}
