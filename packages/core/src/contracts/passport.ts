/**
 * Force passports (system-contracts §3, testing-and-conformance §2).
 *
 * Every force declares a passport: what it is, what it mutates, whether it does work, whether it
 * needs charge or velocity, whether it touches neutral matter, and how it can be visualized. The
 * passport is the inspectable, lintable description that prose alone used to carry — and it is
 * cross-checked against ground truth (the live registry + the conformance catalog) by the test
 * suite, so it cannot silently drift from the implementation.
 *
 * Structural facts (family, class, ownsField, isSource, isModifier) are validated against the live
 * `Force` objects and the conformance experiments. Physics semantics (doesWork, conservesSpeed,
 * requiresCharge/Velocity, affectsNeutralMatter, usesFieldAt) are declared here and, where the
 * conformance catalog proves them, cross-checked too.
 */
import type { Token, Force } from '../core/types.ts';
import type { ForceClass, ForceConformance } from '../conformance/types.ts';

export type TruthMode =
  | 'natural' // a real physical law (gravity, Lorentz, Langevin, diffusion)
  | 'designed' // a tuned interface verb (the canonical nine, most extended forces)
  | 'hybrid'; // a designed primitive operating over natural geometry (fieldflow)

export type RenderMode = 'dots' | 'trails' | 'links' | 'streamlines' | 'metaballs' | 'voronoi';

/** A force's complete, inspectable contract description. */
export interface ForcePassport {
  token: Token;
  label: string;
  family: 'canonical' | 'natural' | 'extended';
  /** input class (§20.1): A body→particle · B particle↔particle · C field-grid · D shape · S source · modifier. */
  klass: ForceClass;
  truthMode: TruthMode;
  /** defines `field()` — a renderable field structure (charge, magnetism). */
  ownsField: boolean;
  /** reads `env.fieldAt()` to follow field geometry (transport). */
  usesFieldAt: boolean;
  /** moves particles (a non-no-op `apply`). False for pure modifiers and colour-only forces. */
  movesParticles: boolean;
  /** changes a particle's kinetic energy. */
  doesWork: boolean;
  /** preserves |v| — a pure rotation or elastic reflection. */
  conservesSpeed: boolean;
  /** no effect on charge-free matter (q = 0). */
  requiresCharge: boolean;
  /** no effect on a still particle (needs motion). */
  requiresVelocity: boolean;
  /** acts on neutral (uncharged) matter. */
  affectsNeutralMatter: boolean;
  /** creates matter via `env.spawn` (class S) — must be budgeted. */
  isSource: boolean;
  /** affects sibling forces via `modify()` rather than moving matter directly. */
  isModifier: boolean;
  /** can be drawn as field lines (iff it owns a `field()`). */
  canVisualizeFieldLines: boolean;
  /** can be drawn as force vectors via a probe (iff it moves particles). */
  canVisualizeForceVectors: boolean;
  designUse: string;
  physicsNote: string;
}

/** Shorthand for the per-force authored rows below. */
type Row = Omit<
  ForcePassport,
  'isSource' | 'isModifier' | 'canVisualizeFieldLines' | 'canVisualizeForceVectors'
>;

// Derived fields (isSource, isModifier, canVisualize*) are computed from klass + ownsField +
// movesParticles in `finish()`, so they can never contradict the structural facts.
function finish(r: Row): ForcePassport {
  return {
    ...r,
    isSource: r.klass === 'S',
    isModifier: r.klass === 'modifier',
    canVisualizeFieldLines: r.ownsField,
    canVisualizeForceVectors: r.movesParticles,
  };
}

const C = 'canonical' as const;
const N = 'natural' as const;
const E = 'extended' as const;

const ROWS: Row[] = [
  // ── canonical nine (§6): designed interface verbs, class A ───────────────────────────────
  { token: 'attract', label: 'Attract', family: C, klass: 'A', truthMode: 'designed', ownsField: false, usesFieldAt: false, movesParticles: true, doesWork: true, conservesSpeed: false, requiresCharge: false, requiresVelocity: false, affectsNeutralMatter: true, designUse: 'draw matter into a focus / well', physicsNote: 'soft (1 − d/r)² inward pull, optional orbital swirl' },
  { token: 'repel', label: 'Repel', family: C, klass: 'A', truthMode: 'designed', ownsField: false, usesFieldAt: false, movesParticles: true, doesWork: true, conservesSpeed: false, requiresCharge: false, requiresVelocity: false, affectsNeutralMatter: true, designUse: 'carve a void / keep-clear region', physicsNote: 'soft (1 − d/r)² outward push' },
  { token: 'swirl', label: 'Swirl', family: C, klass: 'A', truthMode: 'designed', ownsField: false, usesFieldAt: false, movesParticles: true, doesWork: true, conservesSpeed: false, requiresCharge: false, requiresVelocity: false, affectsNeutralMatter: true, designUse: 'rotate matter around a centre', physicsNote: 'tangential-dominant swirl with light inward retention' },
  { token: 'stream', label: 'Stream', family: C, klass: 'A', truthMode: 'designed', ownsField: false, usesFieldAt: false, movesParticles: true, doesWork: true, conservesSpeed: false, requiresCharge: false, requiresVelocity: false, affectsNeutralMatter: true, designUse: 'flow matter along a heading', physicsNote: 'directional push along data-angle' },
  { token: 'viscosity', label: 'Viscosity', family: C, klass: 'A', truthMode: 'designed', ownsField: false, usesFieldAt: false, movesParticles: true, doesWork: true, conservesSpeed: false, requiresCharge: false, requiresVelocity: true, affectsNeutralMatter: true, designUse: 'damp motion / calm a region', physicsNote: 'linear drag −γv (removes kinetic energy)' },
  { token: 'jet', label: 'Jet', family: C, klass: 'A', truthMode: 'designed', ownsField: false, usesFieldAt: false, movesParticles: true, doesWork: true, conservesSpeed: false, requiresCharge: false, requiresVelocity: false, affectsNeutralMatter: true, designUse: 'launch matter at a heading', physicsNote: 'velocity-replacing relaunch (kinematic)' },
  { token: 'tether', label: 'Tether', family: C, klass: 'A', truthMode: 'designed', ownsField: false, usesFieldAt: false, movesParticles: true, doesWork: true, conservesSpeed: false, requiresCharge: false, requiresVelocity: false, affectsNeutralMatter: true, designUse: 'bind matter to an anchor', physicsNote: 'spring toward a rest length' },
  { token: 'wall', label: 'Wall', family: C, klass: 'A', truthMode: 'designed', ownsField: false, usesFieldAt: false, movesParticles: true, doesWork: false, conservesSpeed: true, requiresCharge: false, requiresVelocity: true, affectsNeutralMatter: true, designUse: 'bounce matter off a boundary', physicsNote: 'velocity-replacing elastic reflection (kinematic, speed preserved)' },
  { token: 'sink', label: 'Sink', family: C, klass: 'A', truthMode: 'designed', ownsField: false, usesFieldAt: false, movesParticles: true, doesWork: true, conservesSpeed: false, requiresCharge: false, requiresVelocity: false, affectsNeutralMatter: true, designUse: 'capture matter (accretion well)', physicsNote: 'pull + capture within data-absorb radius, budgeted by data-max' },

  // ── natural primitives (§20.10): real field laws ─────────────────────────────────────────
  { token: 'gravity', label: 'Gravity', family: N, klass: 'A', truthMode: 'natural', ownsField: false, usesFieldAt: false, movesParticles: true, doesWork: true, conservesSpeed: false, requiresCharge: false, requiresVelocity: false, affectsNeutralMatter: true, designUse: 'universal attraction toward mass', physicsNote: 'softened inverse-square GM/(d² + ε²), always attractive' },
  { token: 'charge', label: 'Charge', family: N, klass: 'A', truthMode: 'natural', ownsField: true, usesFieldAt: false, movesParticles: true, doesWork: true, conservesSpeed: false, requiresCharge: true, requiresVelocity: false, affectsNeutralMatter: false, designUse: 'attract/repel charged matter', physicsNote: 'F = σ·q·GM/(d² + ε²); like repels, opposite attracts; monopole E field()' },
  { token: 'magnetism', label: 'Magnetism', family: N, klass: 'A', truthMode: 'natural', ownsField: true, usesFieldAt: false, movesParticles: true, doesWork: false, conservesSpeed: true, requiresCharge: true, requiresVelocity: true, affectsNeutralMatter: false, designUse: 'curve moving charges (cyclotron)', physicsNote: 'Lorentz F = q(v × B); perpendicular, does no work; dipole B field()' },
  { token: 'thermal', label: 'Thermal', family: N, klass: 'A', truthMode: 'natural', ownsField: false, usesFieldAt: false, movesParticles: true, doesWork: true, conservesSpeed: false, requiresCharge: false, requiresVelocity: false, affectsNeutralMatter: true, designUse: 'agitate matter at a temperature', physicsNote: 'Langevin/Brownian kicks, σ = √(2T)' },
  { token: 'collide', label: 'Collide', family: N, klass: 'B', truthMode: 'natural', ownsField: false, usesFieldAt: false, movesParticles: true, doesWork: true, conservesSpeed: false, requiresCharge: false, requiresVelocity: true, affectsNeutralMatter: true, designUse: 'hard-sphere / granular collision', physicsNote: 'elastic pairwise impulse, momentum-conserving (energy too at e = 1)' },
  { token: 'diffuse', label: 'Diffuse', family: N, klass: 'C', truthMode: 'natural', ownsField: false, usesFieldAt: false, movesParticles: true, doesWork: true, conservesSpeed: false, requiresCharge: false, requiresVelocity: false, affectsNeutralMatter: true, designUse: 'spread a quantity over the medium', physicsNote: 'scalar diffusion over env.grid' },
  { token: 'propagate', label: 'Propagate', family: N, klass: 'C', truthMode: 'natural', ownsField: false, usesFieldAt: false, movesParticles: true, doesWork: true, conservesSpeed: false, requiresCharge: false, requiresVelocity: false, affectsNeutralMatter: true, designUse: 'travelling waves through the medium', physicsNote: 'wave propagation over env.grid' },
  { token: 'memory', label: 'Memory', family: N, klass: 'C', truthMode: 'natural', ownsField: false, usesFieldAt: false, movesParticles: true, doesWork: true, conservesSpeed: false, requiresCharge: false, requiresVelocity: false, affectsNeutralMatter: true, designUse: 'a decaying trail / hysteresis', physicsNote: 'decaying density memory on env.grid' },

  // ── extended designed forces (§20.3) ─────────────────────────────────────────────────────
  { token: 'fieldflow', label: 'Fieldflow', family: E, klass: 'A', truthMode: 'hybrid', ownsField: false, usesFieldAt: true, movesParticles: true, doesWork: true, conservesSpeed: false, requiresCharge: false, requiresVelocity: false, affectsNeutralMatter: true, designUse: 'solar prominences, aurora, plasma streams, guided matter', physicsNote: 'field-aligned transport: steers + accelerates matter along env.fieldAt(); carries neutral matter (magnetism does not)' },
  { token: 'lens', label: 'Lens', family: E, klass: 'A', truthMode: 'designed', ownsField: false, usesFieldAt: false, movesParticles: true, doesWork: true, conservesSpeed: false, requiresCharge: false, requiresVelocity: true, affectsNeutralMatter: true, designUse: 'bend passing matter (refraction)', physicsNote: 'velocity-replacing deflection (kinematic)' },
  { token: 'gate', label: 'Gate', family: E, klass: 'A', truthMode: 'designed', ownsField: false, usesFieldAt: false, movesParticles: true, doesWork: true, conservesSpeed: false, requiresCharge: false, requiresVelocity: true, affectsNeutralMatter: true, designUse: 'admit or deflect matter at a boundary', physicsNote: 'velocity-replacing gate (kinematic)' },
  { token: 'buoyancy', label: 'Buoyancy', family: E, klass: 'A', truthMode: 'designed', ownsField: false, usesFieldAt: false, movesParticles: true, doesWork: true, conservesSpeed: false, requiresCharge: false, requiresVelocity: false, affectsNeutralMatter: true, designUse: 'sort matter by size/mass vertically', physicsNote: 'size-graded vertical lift' },
  { token: 'shear', label: 'Shear', family: E, klass: 'A', truthMode: 'designed', ownsField: false, usesFieldAt: false, movesParticles: true, doesWork: true, conservesSpeed: false, requiresCharge: false, requiresVelocity: false, affectsNeutralMatter: true, designUse: 'a velocity gradient across a region', physicsNote: 'position-dependent directional shear' },
  { token: 'crystallize', label: 'Crystallize', family: E, klass: 'A', truthMode: 'designed', ownsField: false, usesFieldAt: false, movesParticles: true, doesWork: true, conservesSpeed: false, requiresCharge: false, requiresVelocity: false, affectsNeutralMatter: true, designUse: 'snap matter onto a lattice', physicsNote: 'pull toward nearest lattice site' },
  { token: 'align', label: 'Align', family: E, klass: 'B', truthMode: 'designed', ownsField: false, usesFieldAt: false, movesParticles: true, doesWork: true, conservesSpeed: false, requiresCharge: false, requiresVelocity: true, affectsNeutralMatter: true, designUse: 'flocking — match neighbour heading', physicsNote: 'neighbour velocity averaging (boids alignment)' },
  { token: 'wind', label: 'Wind', family: E, klass: 'A', truthMode: 'designed', ownsField: false, usesFieldAt: false, movesParticles: true, doesWork: true, conservesSpeed: false, requiresCharge: false, requiresVelocity: false, affectsNeutralMatter: true, designUse: 'a directional ambient current', physicsNote: 'uniform directional push' },
  { token: 'cohesion', label: 'Cohesion', family: E, klass: 'B', truthMode: 'designed', ownsField: false, usesFieldAt: false, movesParticles: true, doesWork: true, conservesSpeed: false, requiresCharge: false, requiresVelocity: false, affectsNeutralMatter: true, designUse: 'flocking — pull toward neighbours', physicsNote: 'steer toward local neighbour centroid (boids cohesion)' },
  { token: 'pressure', label: 'Pressure', family: E, klass: 'B', truthMode: 'designed', ownsField: false, usesFieldAt: false, movesParticles: true, doesWork: true, conservesSpeed: false, requiresCharge: false, requiresVelocity: false, affectsNeutralMatter: true, designUse: 'relax crowding (incompressibility)', physicsNote: 'SPH density relaxation, momentum-conserving' },
  { token: 'hunt', label: 'Hunt', family: E, klass: 'B', truthMode: 'designed', ownsField: false, usesFieldAt: false, movesParticles: true, doesWork: true, conservesSpeed: false, requiresCharge: false, requiresVelocity: false, affectsNeutralMatter: true, designUse: 'predator/prey pursuit and flight', physicsNote: 'species-dependent neighbour pursuit/evasion' },
  { token: 'spawn', label: 'Spawn', family: E, klass: 'S', truthMode: 'designed', ownsField: false, usesFieldAt: false, movesParticles: false, doesWork: true, conservesSpeed: false, requiresCharge: false, requiresVelocity: false, affectsNeutralMatter: true, designUse: 'emit new matter (a budgeted source)', physicsNote: 'creates matter via env.spawn, once per body per frame; budgeted by lifespan + pool ceiling' },
  { token: 'link', label: 'Link', family: E, klass: 'B', truthMode: 'designed', ownsField: false, usesFieldAt: false, movesParticles: true, doesWork: true, conservesSpeed: false, requiresCharge: false, requiresVelocity: false, affectsNeutralMatter: true, designUse: 'ropes / cloth between neighbours', physicsNote: 'Verlet rest-length bonds to neighbours in radius' },
  { token: 'morph', label: 'Morph', family: E, klass: 'D', truthMode: 'designed', ownsField: false, usesFieldAt: false, movesParticles: true, doesWork: true, conservesSpeed: false, requiresCharge: false, requiresVelocity: false, affectsNeutralMatter: true, designUse: 'assemble matter into a mark/shape (never words, §11)', physicsNote: 'springs matter to body.targets marks' },
  { token: 'resonate', label: 'Resonate', family: E, klass: 'modifier', truthMode: 'designed', ownsField: false, usesFieldAt: false, movesParticles: false, doesWork: false, conservesSpeed: true, requiresCharge: false, requiresVelocity: false, affectsNeutralMatter: false, designUse: 'amplify sibling forces rhythmically', physicsNote: 'no-op apply; modify() scales sibling strength per frame' },
  { token: 'spotlight', label: 'Spotlight', family: E, klass: 'modifier', truthMode: 'designed', ownsField: false, usesFieldAt: false, movesParticles: false, doesWork: false, conservesSpeed: true, requiresCharge: false, requiresVelocity: false, affectsNeutralMatter: false, designUse: 'gate sibling forces by region/condition', physicsNote: 'no-op apply; modify() gates siblings' },
  { token: 'pigment', label: 'Pigment', family: E, klass: 'A', truthMode: 'designed', ownsField: false, usesFieldAt: false, movesParticles: false, doesWork: false, conservesSpeed: true, requiresCharge: false, requiresVelocity: false, affectsNeutralMatter: true, designUse: 'transport colour through matter', physicsNote: 'tints particle colour; does not change motion' },
];

/** The passport registry — `token → passport`, derived fields filled in. */
export const PASSPORTS: Readonly<Record<Token, ForcePassport>> = Object.freeze(
  Object.fromEntries(ROWS.map((r) => [r.token, finish(r)])),
);

/** The passport for a force token, or `undefined` if none is registered. */
export function passportFor(token: Token): ForcePassport | undefined {
  return PASSPORTS[token];
}

/** A problem found while validating passports against ground truth. */
export interface PassportProblem {
  token: string;
  issue: string;
}

/**
 * Validate the authored passports against the live registry and the conformance catalog. Returns
 * every mismatch (empty array = all consistent). Used by the test suite — this is what keeps a
 * passport honest: structural claims must match the implementation and the conformance class.
 */
export function validatePassports(
  registry: Readonly<Record<Token, Force>>,
  catalog: readonly ForceConformance[],
): PassportProblem[] {
  const problems: PassportProblem[] = [];
  const byToken = new Map(catalog.map((c) => [c.scenario.force, c.scenario]));

  for (const token of Object.keys(registry)) {
    const p = PASSPORTS[token];
    if (!p) {
      problems.push({ token, issue: 'no passport (every force needs one)' });
      continue;
    }
    const force = registry[token]!;
    const ownsField = typeof force.field === 'function';
    if (p.ownsField !== ownsField)
      problems.push({ token, issue: `ownsField=${p.ownsField} but force.field ${ownsField ? 'exists' : 'is absent'}` });
    if (p.canVisualizeFieldLines !== ownsField)
      problems.push({ token, issue: 'canVisualizeFieldLines must equal ownsField' });

    const scenario = byToken.get(token);
    if (scenario) {
      if (p.family !== scenario.family)
        problems.push({ token, issue: `family=${p.family} but conformance says ${scenario.family}` });
      if (p.klass !== scenario.klass)
        problems.push({ token, issue: `klass=${p.klass} but conformance says ${scenario.klass}` });
    }
    if (p.isSource !== (p.klass === 'S'))
      problems.push({ token, issue: 'isSource must equal (klass === S)' });
    if (p.isModifier !== (p.klass === 'modifier'))
      problems.push({ token, issue: 'isModifier must equal (klass === modifier)' });
  }
  return problems;
}
