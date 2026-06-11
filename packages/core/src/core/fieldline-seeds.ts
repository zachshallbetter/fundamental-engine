/**
 * Field-line seeds — *which* bodies radiate and *where* to start tracing so the diagram is the
 * body's real field structure, not arbitrary rings. The geometric seeders (`dipoleSeeds`,
 * `monopoleSeeds`) and `SeedBody` live in `fieldlines.ts`; this module is the dispatcher over a
 * set of live bodies: it reads each body's tokens + visibility, picks the right seeder, and feeds
 * `traceFieldLines` over the NET field.
 *
 *   · DIPOLE bodies (`magnetism`): the perpendicular-bisector seeds → one clean N→S loop per seed.
 *   · MONOPOLE bodies (`charge`, `gravity`): a tight ring → radial spokes.
 *   · bodies with no field-bearing token radiate nothing → no seeds (no "Mass starburst").
 *
 * Because the seeds feed the *net* field, lines between two magnets link them: the geometry between
 * bodies emerges from the math. Pure — the one source of this dispatch (mirrors the Swift port).
 */
import { dipoleSeeds, monopoleSeeds, type Pt, type SeedBody } from './fieldlines.ts';

/** The forces that define a `field()` hook — only these bodies radiate followable structure. */
export const FIELD_BEARING_TOKENS: ReadonlySet<string> = new Set(['magnetism', 'charge', 'gravity']);

/** A seed body (geometry) plus the token/visibility info that selects WHICH bodies radiate. */
export interface FieldLineBody extends SeedBody {
  tokens: readonly string[];
  vis: boolean;
}

/** Seed points for the field-line diagram of a set of bodies (visible, field-bearing only). */
export function fieldLineSeeds(bodies: readonly FieldLineBody[], dipoleRings = 8): Pt[] {
  const seeds: Pt[] = [];
  for (const b of bodies) {
    if (!b.vis || b.tokens.length === 0) continue;
    if (b.tokens.includes('magnetism')) seeds.push(...dipoleSeeds(b, dipoleRings));
    else if (b.tokens.includes('charge') || b.tokens.includes('gravity')) seeds.push(...monopoleSeeds(b));
    // no field-bearing token ⇒ no seeds (an attract/sink/… body radiates nothing)
  }
  return seeds;
}
