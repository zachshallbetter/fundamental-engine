// SEEDING + IDENTITY — putting your records into the matter, and picking them back out.
//
// Pooled particles normally have no meaning. `seed(atoms)` attaches your records to particles;
// `readParticleIds` reads their STABLE IDS back each frame (parallel to `readParticles`, same pool
// order), and `atomAt(x, y)` picks up the record on the nearest seeded particle within ~24px —
// the hover-to-inspect affordance.
//
// The engine carries the identity; you keep the payload.
import { createField, headlessHost, seededRng } from '@fundamental-engine/core';

export interface SeedingResult {
  /** live particles in the pool. */
  particles: number;
  /** stable ids read back into a caller-owned buffer — one per live particle. */
  idsRead: number;
  /** ids are unique (identity, not position). */
  idsUnique: boolean;
  /** the label of the record found at the first seeded particle's position. */
  foundLabel: string | null;
  /** a point far from any seeded particle returns null rather than a nearest-anything guess. */
  emptySpaceIsNull: boolean;
}

export function runSeeding(): SeedingResult {
  const host = headlessHost({ width: 1000, height: 700 });
  const field = createField(undefined as unknown as HTMLCanvasElement, {
    host,
    render: 'none',
    density: 0.3,
    rng: seededRng(13),
  });

  // your records become the matter — `weight` drives the particle's mass/size
  field.seed([
    { weight: 0.9, label: 'alpha' },
    { weight: 0.5, label: 'beta' },
    { weight: 0.2, label: 'gamma' },
  ]);
  host.tick();

  const particles = field.particleCount();

  // zero-allocation read-back into buffers you own
  const ids = new Uint32Array(particles);
  const idsRead = field.readParticleIds(ids);
  const idsUnique = new Set(ids.slice(0, idsRead)).size === idsRead;

  // find where a seeded particle actually is, then pick its record up from there
  const xs = new Float32Array(particles);
  const ys = new Float32Array(particles);
  field.readParticleChannels(['x', 'y'], [xs, ys]);

  let foundLabel: string | null = null;
  for (let i = 0; i < particles && foundLabel === null; i++) {
    const atom = field.atomAt(xs[i]!, ys[i]!);
    if (atom && typeof atom.label === 'string') foundLabel = atom.label;
  }

  // far outside the volume there is nothing to find
  const emptySpaceIsNull = field.atomAt(-5000, -5000) === null;

  field.destroy();
  return { particles, idsRead, idsUnique, foundLabel, emptySpaceIsNull };
}
