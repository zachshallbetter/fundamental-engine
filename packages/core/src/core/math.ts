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
 * Free-particle color: cool centre → warm edge by `rs` (= normalized dist²),
 * then blended toward the travelling `accent` by `heat` (§20.8 / the prototype).
 */
export function particleRGB(rs: number, heat: number, accent: RGB): RGB {
  return particleRGBInto([0, 0, 0], rs, heat, accent);
}

/** `particleRGB` writing into a caller-owned `out` — identical color, zero allocation. The draw
 *  loop calls this with a shared scratch so it doesn't allocate an `[r,g,b]` per particle per
 *  frame. `out` is returned for convenience. */
export function particleRGBInto(out: RGB, rs: number, heat: number, accent: RGB): RGB {
  let r = COOL[0] + (WARM[0] - COOL[0]) * rs;
  let g = COOL[1] + (WARM[1] - COOL[1]) * rs;
  let b = COOL[2] + (WARM[2] - COOL[2]) * rs;
  r += (accent[0] - r) * heat;
  g += (accent[1] - g) * heat;
  b += (accent[2] - b) * heat;
  out[0] = r;
  out[1] = g;
  out[2] = b;
  return out;
}

/** `[r, g, b]` → `#rrggbb`. */
export function rgbToHex([r, g, b]: RGB): string {
  const h = (v: number): string => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

/** Lerp two hex colors by `t` ∈ [0,1] — conserved pigment mixing (§20.8). */
export function mixHex(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  const k = t < 0 ? 0 : t > 1 ? 1 : t;
  return rgbToHex([ar + (br - ar) * k, ag + (bg - ag) * k, ab + (bb - ab) * k]);
}

/** Sample a color ramp at `frac` ∈ [0,1] — the accent journey (§9). */
export function sampleStops(stops: readonly RGB[], frac: number): RGB {
  if (stops.length === 0) return [77, 163, 255];
  if (stops.length === 1) return stops[0]!;
  const f = clamp(frac, 0, 1) * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(f));
  const t = f - i;
  const a = stops[i]!;
  const b = stops[i + 1]!;
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

/**
 * The `screen` attenuation factor (workover v0.3 §"`screen` modifier") — pure:
 *
 *   falloff      = max(0, 1 − d/range)²
 *   screenFactor = clamp(1 − S·falloff, min, 1)
 *
 * A body carrying the `screen` token damps OTHER bodies' forces on matter within its
 * range by this factor (applied in the integrator's force pass). Smooth at the edge
 * (falloff → 0 as d → range; no hard cliff); `min` clamps the floor (`data-screen-min`,
 * default 0 = full cancellation at the core is allowed); a non-positive range is inert
 * (returns 1 — screens are always local, never global), which also guarantees no NaN
 * at zero range.
 */
export function screenFactor(d: number, range: number, strength: number, min = 0): number {
  if (!(range > 0)) return 1;
  const fall = Math.max(0, 1 - d / range);
  const factor = 1 - strength * fall * fall;
  const floor = Math.min(Math.max(min, 0), 1);
  return factor < floor ? floor : factor > 1 ? 1 : factor;
}
