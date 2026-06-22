/**
 * Cross-plane conformance — the JS golden-vector emitter (RC / #526).
 *
 * Fires the canonical deterministic forces (read only dist/vector + scalar body params + particle
 * velocity — no neighbours, scalar grid, RNG, or service closures) at a fan of probe particles,
 * records each force's *frame-0 velocity delta* (`dv`) as the f64 JS engine computes it, and writes a
 * golden JSON the Swift `GoldenConformanceTests` loads and must reproduce within tolerance. This pins
 * the FORCE MATH across planes; a single apply (no integration accumulation) keeps f32↔f64 drift
 * sub-tolerance while still catching a real divergence (wrong coefficient, missing leg, sign flip).
 *
 *   pnpm gen:golden     # regenerate after an engine change
 *   pnpm check:golden   # CI gate: regenerate + fail if the committed golden drifted from JS
 *
 * Lives in scripts/ (not packages/core/src) on purpose: it imports node:fs, and the core package is
 * deliberately Node-free / DOM-free, so its tsconfig would reject node:* imports. Plain JS — the .ts
 * engine it imports is type-stripped by `node --experimental-strip-types`. Follow-up coverage (the
 * EM/grid/RNG/extended forces, heat parity) extends the same harness.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { allForces } from '../packages/core/src/conformance/run.ts';

const reg = allForces();

// canonical, deterministic, env-simple. (wall=box+spark, jet=RNG, sink=stateful → follow-up.)
const FORCES = ['attract', 'repel', 'swirl', 'stream', 'tether', 'viscosity'];

const makeBody = (over) => ({
  el: {}, tokens: [], strength: 1, range: 300, absorbR: 64, capacity: 60, spin: 1,
  angle: 0, ux: 1, uy: 0, when: '', feedback: false, fmin: 0, fmax: 0, opsz: '',
  M: 1, cx: 0, cy: 0, hw: 0, hh: 0, on: false, vis: true, accreted: 0, count: 0, d: 0,
  ...over,
});

const makeParticle = (over) => ({ x: 0, y: 0, vx: 0, vy: 0, vz: 0, m: 1, heat: 0, size: 1, cap: null, ...over });

const makeEnv = ({ orbit = 0, ...rest }) => ({
  dx: 0, dy: 0, dz: 0, dist: 1, t: 0, dt: 1, frameN: 0, c: 12, G: 1, scrollV: 0,
  vol: { x: 6000, y: 4000, z: 0 }, form: { orbit },
  spark: () => {}, supernova: () => {}, spawn: () => {},
  neighbors: () => [], grid: () => ({ sample: () => 0, gradient: () => ({ x: 0, y: 0 }) }),
  ...rest,
});

// body at the origin; a probe particle sits at (px,py) with optional velocity. The integrator's env
// geometry is then dx = cx − px = −px, dy = −py, dist = max(|·|, 1).
const PROBES = [
  { px: 100, py: 0 },
  { px: 0, py: 150 },
  { px: 200, py: 200 },
  { px: 350, py: 0 }, // outside range 300 → expect dv ≈ 0 (the falloff edge)
  { px: 60, py: 80, vx: 2, vy: -1 }, // a moving probe (viscosity/heat paths)
];

const VARIANTS = [
  { label: 'rest', body: {} },
  { label: 'engaged', body: { on: true } },
  { label: 'orbit', body: {}, orbit: 0.5 }, // stresses the e.form.orbit tangential leg
  { label: 'strong', body: { strength: 2.5, range: 250 } },
];

const cases = [];
for (const force of FORCES) {
  const f = reg[force];
  if (!f) throw new Error(`force '${force}' not in the registry`);
  for (const v of VARIANTS) {
    for (const probe of PROBES) {
      const b = makeBody({ tokens: [force], strength: 1, range: 300, spin: 1, ux: 1, uy: 0, ...v.body });
      const p = makeParticle({ vx: probe.vx ?? 0, vy: probe.vy ?? 0 });
      const dist = Math.max(Math.hypot(probe.px, probe.py), 1);
      const e = makeEnv({ dx: -probe.px, dy: -probe.py, dz: 0, dist, orbit: v.orbit ?? 0 });
      const vx0 = p.vx, vy0 = p.vy, vz0 = p.vz;
      f.apply(b, p, e);
      cases.push({
        force, label: v.label, px: probe.px, py: probe.py,
        body: { strength: b.strength, range: b.range, spin: b.spin, on: b.on, ux: b.ux, uy: b.uy },
        env: { dx: e.dx, dy: e.dy, dz: e.dz, dist: e.dist, orbit: e.form.orbit },
        particle: { vx: vx0, vy: vy0, vz: vz0 },
        dv: { x: p.vx - vx0, y: p.vy - vy0, z: p.vz - vz0 },
      });
    }
  }
}

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, '..', 'swift', 'Tests', 'FundamentalCoreTests', 'Fixtures', 'conformance-golden.json');
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify({ generated: 'scripts/gen-conformance-golden.mjs', forces: FORCES, count: cases.length, cases }, null, 2) + '\n');
console.log(`wrote ${cases.length} golden cases (${FORCES.length} forces × ${VARIANTS.length} variants × ${PROBES.length} probes) → ${out}`);
