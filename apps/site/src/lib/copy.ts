// Centralised user-facing copy for the Evidence Field.
// Both the server-rendered HTML (evidence.astro) and the client runtime
// (EvidenceRuntime.ts) import from here so the initial SSR output always
// matches what the JS-driven controls would write on first interaction.

export type Signal = 'consensus' | 'recency' | 'balanced';
export type Lens = 'field' | 'recency' | 'trust';

export const EVIDENCE = {
  hints: {
    consensus: '<b>size</b> = citations — how much the field leans on each work',
    recency: '<b>size</b> = year — newest work rises, regardless of citations',
    balanced: '<b>size</b> = blend of citations and recency',
  } satisfies Record<Signal, string>,

  lensHints: {
    field: '<b>color</b> = research subfield — the discipline each work binds to',
    recency: '<b>color</b> = year — cool (older) fades to warm (newer)',
    trust: '<b>color</b> = off — size carries the whole signal',
  } satisfies Record<Lens, string>,
} as const;
