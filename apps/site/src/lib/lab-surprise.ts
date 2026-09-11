/**
 * Lab exploration mode — the seeded "Surprise me" randomizer (#697).
 *
 * Pure and DOM-free so it is unit-testable: given a seed, the list of calibrated forces,
 * and a way to read a force's tunable knobs, it picks one force and a set of sane random
 * overrides. Everything is drawn from one `mulberry32(seed)` stream in a fixed order, so
 * the same seed always reproduces the same pick — that is what makes the copied Lab link
 * (`#force;k=v;…;surprise=N`) an honest record of what was fired.
 *
 * `mulberry32` lives here (moved from lab.astro) because core's `seededRng` is not part
 * of the package's public surface; the Lab's scatter placement uses the same generator.
 */

/** mulberry32 — the PRNG family `runScenario` seeds `Math.random` with for `Scenario.seed`. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** the largest seed the Lab's seed input accepts (its `max`); seeds are 1…MAX so 0 never reads as "unset". */
export const SURPRISE_SEED_MAX = 99999;

/** an integer seed in [1, SURPRISE_SEED_MAX], from any `random()` in [0, 1). */
export function rollSurpriseSeed(random: () => number = Math.random): number {
  const r = Math.min(Math.max(random(), 0), 1 - 1e-12);
  return 1 + Math.floor(r * SURPRISE_SEED_MAX);
}

/** one tunable knob as the Lab's param panel describes it (a subset of its spec object). */
export interface SurpriseSpec {
  key: string;
  def: number;
  min: number;
  max: number;
  step: number;
}

export interface SurprisePick {
  seed: number;
  force: string;
  /** only the knobs the draw moved, each different from its default. */
  overrides: Record<string, number>;
}

/** the fraction of knobs a surprise actually moves — not every dial, or the pick reads as noise. */
const MOVE_P = 0.6;
const SPINS = [-1.5, -1, -0.5, 0.5, 1, 1.5];
const COUNTS = [1, 6, 12, 24];

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const snap = (v: number, step: number) => {
  if (!(step > 0)) return v;
  const d = step < 1 ? (String(step).split('.')[1] || '').length : 0;
  return Number((Math.round(v / step) * step).toFixed(d));
};
const between = (rng: () => number, lo: number, hi: number) => lo + rng() * (hi - lo);
const pickOf = <T>(rng: () => number, xs: readonly T[]): T => xs[Math.floor(rng() * xs.length)]!;

/**
 * Draw a sane random value for one knob, or `undefined` to leave it alone. The bands are
 * deliberately conservative — strong enough to look different, never so wild the chamber
 * view collapses (strength 0, spin 0, a 40-particle burst on every pick).
 */
function drawKnob(rng: () => number, sp: SurpriseSpec): number | undefined {
  const d = sp.def;
  let v: number;
  switch (sp.key) {
    case 'strength': {
      const base = d !== 0 ? Math.abs(d) : Math.max(sp.step, (sp.max - sp.min) / 4);
      v = between(rng, 0.3 * base, 2.5 * base);
      v = clamp(snap(v, sp.step), Math.max(sp.min, sp.step || 1e-9), sp.max);
      return v === d || v <= 0 ? undefined : v;
    }
    case 'range': {
      const base = d > 0 ? d : (sp.min + sp.max) / 2;
      v = snap(clamp(between(rng, 0.5 * base, 1.6 * base), sp.min, sp.max), sp.step);
      break;
    }
    case 'spin':
      v = clamp(pickOf(rng, SPINS), sp.min, sp.max);
      if (v === 0) return undefined;
      break;
    case 'angle':
      v = 15 * Math.round(between(rng, -180, 180) / 15);
      v = clamp(v, sp.min, sp.max);
      break;
    case 'box':
    case 'absorbR': {
      const base = d > 0 ? d : (sp.min + sp.max) / 2;
      v = snap(clamp(between(rng, 0.6 * base, 1.6 * base), sp.min, sp.max), sp.step);
      break;
    }
    case 'vx':
    case 'vy':
      v = clamp(0.5 * Math.round(between(rng, -6, 6) / 0.5), sp.min, sp.max);
      break;
    case 'count':
      v = clamp(pickOf(rng, COUNTS), sp.min, sp.max);
      break;
    default:
      return undefined; // an unknown knob is never touched
  }
  return v === d ? undefined : v;
}

/**
 * Deterministic: `seed` → one force from `forces` + sane overrides for a subset of its
 * knobs. `specsOf(force)` returns the knobs in the Lab's own order; the RNG is consumed in
 * that order (one draw to decide whether a knob moves, then its value), so a given seed
 * reproduces the same pick for as long as the catalog and the knob list are unchanged.
 */
export function surpriseFrom(
  seed: number,
  forces: readonly string[],
  specsOf: (force: string) => readonly SurpriseSpec[],
): SurprisePick {
  const rng = mulberry32(seed);
  const force = forces.length ? pickOf(rng, forces) : '';
  const overrides: Record<string, number> = {};
  if (!force) return { seed, force, overrides };
  for (const sp of specsOf(force)) {
    const move = rng() < MOVE_P;
    const v = drawKnob(rng, sp); // always consumed, so a skipped knob does not reshuffle the rest
    if (!move || v === undefined || !Number.isFinite(v)) continue;
    overrides[sp.key] = v;
  }
  return { seed, force, overrides };
}
