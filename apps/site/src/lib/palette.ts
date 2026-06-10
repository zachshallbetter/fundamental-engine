// The example family's lens palette — six copies across pages (evidence, catalog, library's
// artist hash, …). NOT core's PALETTES (those are the engine's accent journeys); this is the
// family's categorical 8-color lens set, now with one home.

export const FIELD_PALETTE = [
  "#4da3ff",
  "#2dd4bf",
  "#ff9d5c",
  "#a78bfa",
  "#86e57f",
  "#fbbf24",
  "#f0abfc",
  "#38bdf8",
] as const;

/** Stable category → palette color via insertion order (the evidence/catalog pattern). */
export function categoryColors(categories: Iterable<string>): Map<string, string> {
  const m = new Map<string, string>();
  for (const c of categories) {
    if (!m.has(c)) m.set(c, FIELD_PALETTE[m.size % FIELD_PALETTE.length]!);
  }
  return m;
}

/** Stable name → palette color via a cheap string hash (the library artist-lens pattern). */
export function hashColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return FIELD_PALETTE[Math.abs(h) % FIELD_PALETTE.length]!;
}
