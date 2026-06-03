/** Small, dependency-free math helpers. */

export type RGB = [number, number, number];

export const clamp = (v: number, lo: number, hi: number): number =>
  v < lo ? lo : v > hi ? hi : v;

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** distance between two points. */
export const dist = (ax: number, ay: number, bx: number, by: number): number =>
  Math.hypot(ax - bx, ay - by);

/** parse `#rrggbb` (or `#rgb`) → `[r, g, b]`, falling back to a cool blue. */
export function hexToRgb(hex: string): RGB {
  const h = hex.replace('#', '');
  const x = h.length === 3 ? h.replace(/./g, (c) => c + c) : h;
  const n = Number.parseInt(x.slice(0, 6), 16);
  if (Number.isNaN(n)) return [77, 163, 255];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** The resting (cool) and energized (warm) ends of the free-particle ramp (§20.8). */
export const COOL: RGB = [200, 224, 255];
export const WARM: RGB = [255, 122, 69];

/**
 * Free-particle colour: cool centre → warm edge by `rs` (= normalized dist²),
 * then blended toward the travelling `accent` by `heat` (§20.8 / the prototype).
 */
export function particleRGB(rs: number, heat: number, accent: RGB): RGB {
  let r = COOL[0] + (WARM[0] - COOL[0]) * rs;
  let g = COOL[1] + (WARM[1] - COOL[1]) * rs;
  let b = COOL[2] + (WARM[2] - COOL[2]) * rs;
  r += (accent[0] - r) * heat;
  g += (accent[1] - g) * heat;
  b += (accent[2] - b) * heat;
  return [r, g, b];
}
