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
  editions: MangaEdition[];
  overallVector: ObservationVector;
  sections?: MangaSection[];
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
  };
}

export interface ShelfResult {
  id: string;
  title: string;
  subtitle: string;
  lensType: string;
  items: ShelfItem[];
}

export const MANGA_WORKS: MangaWork[] = corpusData.works as MangaWork[];

// Vector distance utilities
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

export function vectorDistance(a: ObservationVector, b: ObservationVector, weights?: Partial<Record<keyof ObservationVector, number>>): number {
  let sumSq = 0;
  let weightSum = 0;

  const keys: (keyof ObservationVector)[] = [
    'negativeSpace', 'panelDensity', 'dialogueDensity', 'inkCoverage',
    'closeUpFrequency', 'sfxDensity', 'environmentalScale', 'characterRecurrence',
    'visualPacing', 'borderViolation', 'actionDensity', 'contrast',
  ];

  for (const k of keys) {
    const w = weights?.[k] ?? 1.0;
    // Normalize panelDensity (which is ~2.0-8.0) to 0..1 scale for distance calc
    let diff = 0;
    if (k === 'panelDensity') {
      diff = (a.panelDensity - b.panelDensity) / 6.0;
    } else {
      diff = a[k] - b[k];
    }
    sumSq += w * diff * diff;
    weightSum += w;
  }

  return Math.sqrt(sumSq / weightSum);
}

// Compute dynamic emergent shelves based on recent reading history
export function computeRelationalShelves(recentReadIds: string[]): ShelfResult[] {
  const recentWorks = MANGA_WORKS.filter((w) => recentReadIds.includes(w.id));
  const recentVectors = recentWorks.map((w) => w.overallVector);
  const centroid = computeCentroid(recentVectors);

  const shelves: ShelfResult[] = [];

  // 1. Shelf: "Vast Worlds, Small People"
  const vastItems: ShelfItem[] = MANGA_WORKS
    .map((w) => {
      const v = w.overallVector;
      // High environmental scale, high negative space, low dialogue
      const scoreVal = v.environmentalScale * 0.4 + v.negativeSpace * 0.35 + (1 - v.dialogueDensity) * 0.25;
      const score = Math.round(scoreVal * 100);
      return {
        work: w,
        matchScore: score,
        explanation: {
          why: "High megastructure/landscape scale with sparse dialogue and large open compositions",
          held: ["environmental scale", "negative space", "sparse dialogue"],
        },
      };
    })
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, 5);

  shelves.push({
    id: "vast-worlds",
    title: "Vast Worlds, Small People",
    subtitle: "Emergent Cluster · High Environmental Scale & Sparse Dialogue",
    lensType: "scale-architecture",
    items: vastItems,
  });

  // 2. Shelf: "Complicated Relationships"
  const relationshipItems: ShelfItem[] = MANGA_WORKS
    .flatMap((w) => {
      const results: ShelfItem[] = [];
      // Check sections first if available
      if (w.sections && w.sections.length > 0) {
        for (const sec of w.sections) {
          const v = sec.vector;
          const scoreVal = v.closeUpFrequency * 0.35 + v.dialogueDensity * 0.35 + v.characterRecurrence * 0.30;
          const score = Math.round(scoreVal * 100);
          if (score > 60) {
            results.push({
              work: w,
              section: sec,
              matchScore: score,
              explanation: {
                why: `High dialogue, two-character recurrence, and close-up framing in ${sec.volume}`,
                held: ["close-up frequency", "dialogue density", "character recurrence"],
                matchingPageRange: `${sec.volume} · ${sec.chapterRange} (${sec.pageRange})`,
              },
            });
          }
        }
      } else {
        const v = w.overallVector;
        const scoreVal = v.closeUpFrequency * 0.35 + v.dialogueDensity * 0.35 + v.characterRecurrence * 0.30;
        const score = Math.round(scoreVal * 100);
        if (score > 60) {
          results.push({
            work: w,
            matchScore: score,
            explanation: {
              why: "High dialogue density, reaction shots, and multi-character recurrence",
              held: ["close-up frequency", "dialogue density", "character recurrence"],
            },
          });
        }
      }
      return results;
    })
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, 5);

  shelves.push({
    id: "complicated-relationships",
    title: "Complicated Relationships",
    subtitle: "Emergent Chapter-Range Cluster · High Dialogue & Reaction Framing",
    lensType: "character-dialogue",
    items: relationshipItems,
  });

  // 3. Shelf: "Pages That Breathe"
  const breathingItems: ShelfItem[] = MANGA_WORKS
    .flatMap((w) => {
      const results: ShelfItem[] = [];
      if (w.sections && w.sections.length > 0) {
        for (const sec of w.sections) {
          const v = sec.vector;
          if (v.negativeSpace >= 0.70 && v.dialogueDensity <= 0.25) {
            const score = Math.round((v.negativeSpace * 0.6 + (1 - v.dialogueDensity) * 0.4) * 100);
            results.push({
              work: w,
              section: sec,
              matchScore: score,
              explanation: {
                why: `Specific chapter range with open gutters, minimal dialogue, and quiet pacing`,
                held: ["negative space (>70%)", "minimal text (<15%)", "slow pacing"],
                matchingPageRange: `${sec.volume} · ${sec.chapterRange} (${sec.pageRange})`,
              },
            });
          }
        }
      } else if (w.overallVector.negativeSpace >= 0.65) {
        const v = w.overallVector;
        const score = Math.round((v.negativeSpace * 0.6 + (1 - v.dialogueDensity) * 0.4) * 100);
        results.push({
          work: w,
          matchScore: score,
          explanation: {
            why: "Contemplative page layouts with large negative space and unhurried visual rhythm",
            held: ["negative space", "minimal text", "slow pacing"],
          },
        });
      }
      return results;
    })
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, 5);

  shelves.push({
    id: "pages-that-breathe",
    title: "Pages That Breathe",
    subtitle: "Page-Range Specific Substrate · High Negative Space & Open Gutters",
    lensType: "spatial-rest",
    items: breathingItems,
  });

  // 4. Shelf: "Beautiful Chaos"
  const chaosItems: ShelfItem[] = MANGA_WORKS
    .map((w) => {
      const v = w.overallVector;
      const scoreVal = (v.panelDensity / 8.0) * 0.25 + v.sfxDensity * 0.30 + v.borderViolation * 0.25 + v.inkCoverage * 0.20;
      const score = Math.round(scoreVal * 100);
      return {
        work: w,
        matchScore: score,
        explanation: {
          why: "High panel density, border-bleeding artwork, rotated sound effects, and dense ink",
          held: ["panel density", "SFX area/rotation", "border violations", "ink coverage"],
        },
      };
    })
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, 5);

  shelves.push({
    id: "beautiful-chaos",
    title: "Beautiful Chaos",
    subtitle: "Emergent Cluster · High Panel Density, SFX Rotation & Ink Texture",
    lensType: "entropy-density",
    items: chaosItems,
  });

  // 5. Shelf: "Same Rhythm, Different World"
  const rhythmItems: ShelfItem[] = MANGA_WORKS
    .filter((w) => !recentReadIds.includes(w.id))
    .map((w) => {
      const v = w.overallVector;
      // Distance restricted to visual pacing & panel density lane (holding rhythm constant)
      const pacingDist = Math.abs(v.visualPacing - centroid.visualPacing);
      const densityDist = Math.abs((v.panelDensity - centroid.panelDensity) / 6.0);
      const rhythmSimilarity = 1.0 - (pacingDist * 0.5 + densityDist * 0.5);

      const score = Math.round(rhythmSimilarity * 100);
      return {
        work: w,
        matchScore: score,
        explanation: {
          why: "Matches visual pacing and compositional rhythm while varying setting, genre, and palette",
          held: ["visual pacing", "compositional rhythm", "panel proportions"],
          varied: ["setting / period", "subject matter", "color palette"],
        },
      };
    })
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, 5);

  shelves.push({
    id: "same-rhythm",
    title: "Same Rhythm, Different World",
    subtitle: "Axis-Isolated Vector Similarity · Constant Pacing, Varied Genre",
    lensType: "rhythm-axis",
    items: rhythmItems,
  });

  return shelves;
}
