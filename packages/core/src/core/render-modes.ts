/** Opacity of a particle↔particle link by separation (§20.6 links mode). */
export function linkAlpha(d: number, r: number, max = 0.12): number {
  if (d >= r) return 0;
  return (1 - d / r) * max;
}
