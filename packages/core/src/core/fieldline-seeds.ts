/**
 * Field-line seeds — *where* to start tracing so the diagram is the body's real field
 * structure, not arbitrary rings. Feeds `traceFieldLines` (fieldlines.ts) over the NET field.
 *
 *   · DIPOLE bodies (`magnetism`): seed along the perpendicular bisector of the heading axis —
 *     the centre plus ring offsets either side. Each offset lies on a distinct nested field
 *     line, so tracing both directions closes one clean N→S loop per seed: the bar-magnet diagram.
 *   · MONOPOLE bodies (`charge`, `gravity`): a tight ring around the core → radial spokes
 *     (out of `+`, into `−`; inward for gravity).
 *   · bodies with no field-bearing token radiate nothing, so they get no seeds (seeding them
 *     only traces a neighbour's field and crowds the picture — the "Mass starburst").
 *
 * Because the seeds feed the *net* field, the lines between two magnets link them: the geometry
 * between bodies emerges from the math, never drawn by hand. Pure — the one source of this
 * algorithm, shared by every renderer (mirrors the Swift port's `FieldLineSeeds.swift`).
 */
import type { Pt } from './fieldlines.ts';
import { polePair, type AxisRect } from './geometry.ts';

/** The body subset the seeders read: an `AxisRect` (for `polePair`) plus reach, tokens, visibility. */
export interface SeedBody extends AxisRect {
  range: number;
  tokens: readonly string[];
  vis: boolean;
}

/** The forces that define a `field()` hook — only these bodies radiate followable structure. */
export const FIELD_BEARING_TOKENS: ReadonlySet<string> = new Set(['magnetism', 'charge', 'gravity']);

/** Seed points for the field-line diagram of a set of bodies (visible, field-bearing only). */
export function fieldLineSeeds(bodies: readonly SeedBody[], dipoleRings = 8): Pt[] {
  const seeds: Pt[] = [];
  for (const b of bodies) {
    if (!b.vis || b.tokens.length === 0) continue;
    if (b.tokens.includes('magnetism')) seeds.push(...dipoleSeeds(b, dipoleRings));
    else if (b.tokens.includes('charge') || b.tokens.includes('gravity')) seeds.push(...monopoleSeeds(b));
    // no field-bearing token ⇒ no seeds (an attract/sink/… body radiates nothing)
  }
  return seeds;
}

/**
 * Dipole seeds: centre + `rings` offsets either side of the heading's perpendicular bisector.
 * Uses the same synthesized-pole fallback the field math (`dipoleField`) uses, so a near-point
 * body still reads as a full dipole rather than collapsing to one line.
 */
export function dipoleSeeds(b: SeedBody, rings = 8): Pt[] {
  let [pA, pB] = polePair(b);
  let sep = Math.hypot(pA.x - pB.x, pA.y - pB.y);
  if (sep < Math.max(b.range * 0.06, 8)) {
    const half = Math.max(b.range * 0.18, 60);
    const s = b.spin < 0 ? -1 : 1;
    pA = { x: b.cx + b.ux * half, y: b.cy + b.uy * half, q: s };
    pB = { x: b.cx - b.ux * half, y: b.cy - b.uy * half, q: -s };
    sep = Math.hypot(pA.x - pB.x, pA.y - pB.y);
  }
  // unit perpendicular to the heading, in-plane: cross(ẑ, heading) = (−uy, ux)
  const plen = Math.hypot(b.uy, b.ux) || 1;
  const px = -b.uy / plen;
  const py = b.ux / plen;
  const spacing = Math.max(sep * 0.13, 18);
  const seeds: Pt[] = [{ x: b.cx, y: b.cy }]; // the central axial line through both poles
  for (let i = 1; i <= rings; i++) {
    const off = i * spacing;
    seeds.push({ x: b.cx + px * off, y: b.cy + py * off });
    seeds.push({ x: b.cx - px * off, y: b.cy - py * off });
  }
  return seeds;
}

/** Monopole seeds: a tight ring close to the core → radial spokes. */
export function monopoleSeeds(b: SeedBody, count = 18): Pt[] {
  const r0 = Math.max(Math.min(b.hw, b.hh) * 0.8, 24);
  const seeds: Pt[] = [];
  for (let k = 0; k < count; k++) {
    const a = (k / count) * Math.PI * 2;
    seeds.push({ x: b.cx + Math.cos(a) * r0, y: b.cy + Math.sin(a) * r0 });
  }
  return seeds;
}
