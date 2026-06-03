/** Small, dependency-free math helpers. */

export const clamp = (v: number, lo: number, hi: number): number =>
  v < lo ? lo : v > hi ? hi : v;

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** distance between two points. */
export const dist = (ax: number, ay: number, bx: number, by: number): number =>
  Math.hypot(ax - bx, ay - by);

/** parse `#rrggbb` (or `#rgb`) → `[r, g, b]`, falling back to a cool blue. */
export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const x = h.length === 3 ? h.replace(/./g, (c) => c + c) : h;
  const n = Number.parseInt(x.slice(0, 6), 16);
  if (Number.isNaN(n)) return [77, 163, 255];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
