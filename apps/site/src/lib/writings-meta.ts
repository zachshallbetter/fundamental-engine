// Per-category wayfinding meta for the writings family — color + glyph, the writings analogue of
// the docs-nav group meta. Shared by WritingLayout (sidebar + breadcrumb) and the writings index.
export interface WritingCat {
  key: string;
  label: string;
  color: string;
  glyph: string;
}

export const WRITING_CATS: WritingCat[] = [
  { key: 'research', label: 'Research', color: '#4da3ff', glyph: '✦' },
  { key: 'release', label: 'Releases', color: '#2dd4bf', glyph: '▲' },
  { key: 'feature', label: 'Features', color: '#a78bfa', glyph: '◆' },
  { key: 'note', label: 'Notes', color: '#ff9d5c', glyph: '∴' },
];

const BY_KEY = new Map(WRITING_CATS.map((c) => [c.key, c]));

export const writingCat = (key?: string): WritingCat | undefined =>
  key != null ? BY_KEY.get(key) : undefined;
export const writingCatColor = (key?: string): string => writingCat(key)?.color ?? '#9aa7b4';
export const writingCatLabel = (key?: string): string => writingCat(key)?.label ?? (key ?? '');
