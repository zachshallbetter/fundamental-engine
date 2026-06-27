/**
 * A small, dependency-free seeded PRNG for the record/replay seam.
 *
 * The engine takes its randomness through an injectable `rng: () => number` (FieldOptions.rng / #371),
 * so a deterministic generator is the single thing a recorder needs to make a run reproducible. This is
 * `mulberry32` — a well-known 32-bit generator: tiny, fast, and bit-identical across JS engines (pure
 * integer math, no `Math.random`), so a recording seeded here on one machine replays identically on
 * another. The same seed always produces the same stream.
 *
 * This is NOT a cryptographic generator; it exists purely for reproducible simulation, never for
 * security. Pure: a given `seed` fully determines the sequence.
 */

/** Create a seeded `() => number` (uniform in [0, 1)) from a 32-bit integer seed. */
export function seededRng(seed: number): () => number {
  // coerce to a 32-bit unsigned integer so any number (or 0) gives a valid, stable starting state.
  let a = seed >>> 0;
  return function next(): number {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
