/**
 * The conformance catalog — one experiment per registered force, each pairing a
 * scenario (a known particle fired into the force with known attributes) with the
 * expectations that define "appropriate reaction". Invariants are the headline checks;
 * exact-Δv checks pin the spec formula where the math is clean. This is the single
 * source of truth shared by `conformance.test.ts` and the Lab detector.
 */
import type { Expectation, ForceConformance, ScenarioResult } from './types.ts';
import {
  adoptsTint,
  approachesBody,
  exactDelta,
  followsGradient,
  gatesOutsideCone,
  modulatesStrength,
  momentumConserved,
  movesAway,
  movesToward,
  noEffectBeyondRange,
  perpendicularToVelocity,
  recedesFromBody,
  separates,
  speedPreserved,
  speedReduced,
  unaffectedWhenNeutral,
} from './expectations.ts';

const f3 = (n: number) => (Math.abs(n) < 1e-9 ? '0' : n.toFixed(3));

/** Build an inline one-off expectation. */
function check(
  label: string,
  kind: 'invariant' | 'exact',
  fn: (r: ScenarioResult) => { pass: boolean; measured: string; expected: string },
): Expectation {
  return { label, kind, check: fn };
}

const headingAngle = (vx: number, vy: number) => Math.atan2(vy, vx);
const gap = (r: ScenarioResult, frame: number, i: number, j: number) => {
  const a = r.trajectory[frame]![i]!;
  const b = r.trajectory[frame]![j]!;
  return Math.hypot(a.x - b.x, a.y - b.y);
};

export const EXPERIMENTS: ForceConformance[] = [
  // ── canonical nine ────────────────────────────────────────────────────────
  {
    scenario: {
      force: 'attract',
      label: 'A particle 150px from an attractor',
      family: 'canonical',
      klass: 'A',
      body: { cx: 150, range: 300, strength: 1 },
      particles: [{ x: 0, y: 0 }],
      frames: 60,
    },
    expectations: [movesToward(), exactDelta(0.125, 0), approachesBody(), noEffectBeyondRange()],
  },
  {
    scenario: {
      force: 'repel',
      label: 'A particle 150px from a repeller',
      family: 'canonical',
      klass: 'A',
      body: { cx: 150, range: 300, strength: 1 },
      particles: [{ x: 0, y: 0 }],
      frames: 60,
    },
    expectations: [movesAway(), exactDelta(-0.125, 0), recedesFromBody(), noEffectBeyondRange()],
  },
  {
    scenario: {
      force: 'vortex',
      label: 'A particle 150px from a vortex (spin +1)',
      family: 'canonical',
      klass: 'A',
      body: { cx: 150, range: 300, strength: 1, spin: 1 },
      particles: [{ x: 0, y: 0 }],
      frames: 60,
    },
    expectations: [
      movesToward(), // the 0.12 inward retention
      exactDelta(0.020462, -0.170518, 2e-3), // mostly tangential
      noEffectBeyondRange(),
    ],
  },
  {
    scenario: {
      force: 'stream',
      label: 'A particle in a stream along +x',
      family: 'canonical',
      klass: 'A',
      body: { cx: 150, range: 300, strength: 1, angle: 0 },
      particles: [{ x: 0, y: 0 }],
      frames: 60,
    },
    expectations: [exactDelta(0.233258, 0, 1e-3), approachesBody(), noEffectBeyondRange()],
  },
  {
    scenario: {
      force: 'drag',
      label: 'A moving particle entering a drag field',
      family: 'canonical',
      klass: 'A',
      body: { cx: 150, range: 300, strength: 1 },
      particles: [{ x: 0, y: 0, vx: 5, vy: 0 }],
      frames: 30,
    },
    expectations: [
      speedReduced(),
      exactDelta(-0.3, 0),
      check('direction unchanged (no redirection)', 'invariant', (r) => {
        const a = r.applyDelta[0]!;
        return { pass: Math.abs(a.dvy) < 1e-9, measured: `Δvy = ${f3(a.dvy)}`, expected: '0' };
      }),
    ],
  },
  {
    scenario: {
      force: 'emitter',
      label: 'A particle in an emitter feed (outside the nozzle)',
      family: 'canonical',
      klass: 'A',
      body: { cx: 150, range: 300, strength: 1, angle: 0 },
      particles: [{ x: 0, y: 0 }],
      frames: 40,
    },
    expectations: [movesToward(), exactDelta(0.1, 0)],
  },
  {
    scenario: {
      force: 'spring',
      label: 'A particle inside a spring rest shell (compressed)',
      family: 'canonical',
      klass: 'A',
      body: { cx: 150, range: 300, strength: 1 },
      particles: [{ x: 0, y: 0 }],
      frames: 60,
    },
    // rest = 180; the particle at 150 is inside → pushed out, with light damping
    expectations: [movesAway(), exactDelta(-0.5319, 0, 2e-3)],
  },
  {
    scenario: {
      force: 'reflect',
      label: 'A particle hitting a reflect wall',
      family: 'canonical',
      klass: 'A',
      body: { cx: 0, cy: 0, hw: 40, hh: 40 },
      particles: [{ x: 30, y: 0, vx: 3, vy: 0 }],
      frames: 4,
    },
    expectations: [
      check('velocity reverses off the wall', 'invariant', (r) => {
        const a = r.applyDelta[0]!;
        const after = 3 + a.dvx;
        return { pass: after < 0, measured: `vx 3 → ${f3(after)}`, expected: '< 0 (reversed)' };
      }),
      check('bounce is damped (e ≈ 0.85)', 'invariant', (r) => {
        const a = r.applyDelta[0]!;
        const after = Math.abs(3 + a.dvx);
        return { pass: after < 3, measured: `|vx| ${f3(after)}`, expected: '< 3 (energy lost)' };
      }),
    ],
  },
  {
    scenario: {
      force: 'absorb',
      label: 'A particle drifting into an absorber',
      family: 'canonical',
      klass: 'A',
      body: { cx: 0, cy: 0, range: 300, absorbR: 64, capacity: 60 },
      particles: [{ x: 30, y: 0 }],
      frames: 20,
    },
    expectations: [
      check('particle is captured', 'invariant', (r) => {
        const n = r.body.accreted;
        return { pass: n > 0, measured: `accreted = ${n}`, expected: '> 0' };
      }),
      approachesBody(),
    ],
  },

  // ── natural primitives ────────────────────────────────────────────────────
  {
    scenario: {
      force: 'gravity',
      label: 'A particle near a massive body',
      family: 'natural',
      klass: 'A',
      body: { cx: 120, range: 300, M: 2000 },
      particles: [{ x: 0, y: 0 }],
      frames: 60,
    },
    expectations: [movesToward(), approachesBody(), noEffectBeyondRange()],
  },
  {
    scenario: {
      force: 'charge',
      label: 'A like-signed charge near a charged body',
      family: 'natural',
      klass: 'A',
      body: { cx: 120, range: 300, M: 2000, spin: 1 },
      particles: [{ x: 0, y: 0, charge: 1 }],
      frames: 60,
    },
    expectations: [movesAway(), unaffectedWhenNeutral(), recedesFromBody()],
  },
  {
    scenario: {
      force: 'magnetism',
      label: 'A moving charge in a magnetic field',
      family: 'natural',
      klass: 'A',
      body: { cx: 0, cy: 0, range: 400, strength: 0.05, spin: 1 },
      particles: [{ x: 0, y: 0, vx: 5, vy: 0, charge: 1 }],
      frames: 40,
    },
    expectations: [perpendicularToVelocity(), speedPreserved(0.02)],
  },
  {
    scenario: {
      force: 'thermal',
      label: 'A particle in a thermal bath',
      family: 'natural',
      klass: 'A',
      body: { cx: 0, cy: 0, range: 300, strength: 1 },
      particles: [{ x: 40, y: 0, vx: 0, vy: 0 }],
      frames: 160,
      seed: 7,
    },
    expectations: [
      check('agitated into motion', 'invariant', (r) => {
        const moved = r.trajectory.some((fr) => fr[0]!.speed > 0.05);
        return { pass: moved, measured: 'speed > 0 occurs', expected: 'kicked into motion' };
      }),
      check('isotropic kicks (comparable spread on both axes)', 'invariant', (r) => {
        // an isotropic 2-D kick gives similar RMS velocity in x and y
        let sx = 0;
        let sy = 0;
        for (const fr of r.trajectory) {
          sx += fr[0]!.vx * fr[0]!.vx;
          sy += fr[0]!.vy * fr[0]!.vy;
        }
        const rx = Math.sqrt(sx / r.trajectory.length);
        const ry = Math.sqrt(sy / r.trajectory.length);
        const ratio = rx / (ry || 1e-9);
        return {
          pass: rx > 0.1 && ry > 0.1 && ratio > 0.4 && ratio < 2.5,
          measured: `rms (${f3(rx)}, ${f3(ry)}), ratio ${f3(ratio)}`,
          expected: 'both > 0, ratio ≈ 1',
        };
      }),
    ],
  },
  {
    scenario: {
      force: 'collide',
      label: 'Two discs in a head-on elastic collision',
      family: 'natural',
      klass: 'B',
      body: { cx: 0, cy: 0, range: 300, strength: 1 },
      particles: [
        { x: -4, y: 0, vx: 2, vy: 0, size: 5 },
        { x: 4, y: 0, vx: -2, vy: 0, size: 5 },
      ],
      frames: 24,
    },
    expectations: [momentumConserved(1e-6), separates(0, 1)],
  },
  {
    scenario: {
      force: 'diffuse',
      label: 'A particle following a pheromone gradient',
      family: 'natural',
      klass: 'C',
      body: { cx: 0, cy: 0, range: 300, strength: 0.5 },
      particles: [{ x: 50, y: 0 }],
      frames: 30,
    },
    expectations: [followsGradient(2, 0)],
  },
  {
    scenario: {
      force: 'propagate',
      label: 'A particle riding a propagating wavefront',
      family: 'natural',
      klass: 'C',
      body: { cx: 0, cy: 0, range: 300, strength: 1, on: true },
      particles: [{ x: 50, y: 0 }],
      frames: 30,
    },
    expectations: [followsGradient(2, 0)],
  },
  {
    scenario: {
      force: 'memory',
      label: 'A particle wearing in a remembered path',
      family: 'natural',
      klass: 'C',
      body: { cx: 120, range: 300, strength: 1 },
      particles: [{ x: 0, y: 0 }],
      frames: 40,
    },
    expectations: [
      movesToward(), // memory amplifies an attractive pull
      noEffectBeyondRange(),
    ],
  },

  // ── designed-extended ─────────────────────────────────────────────────────
  {
    scenario: {
      force: 'lens',
      label: 'A moving particle bent by a lens',
      family: 'extended',
      klass: 'A',
      body: { cx: 150, range: 300, strength: 0.3, spin: 1 },
      particles: [{ x: 0, y: 0, vx: 5, vy: 0 }],
      frames: 40,
    },
    expectations: [
      speedPreserved(1e-3), // pure rotation
      check('rotated by θ = θmax·(1−d/r)·spin', 'exact', (r) => {
        const a = r.applyDelta[0]!;
        const ang = headingAngle(5 + a.dvx, 0 + a.dvy);
        const expected = 0.3 * (1 - 150 / 300) * 1; // 0.15
        return {
          pass: Math.abs(ang - expected) < 2e-3,
          measured: `θ = ${f3(ang)} rad`,
          expected: `${f3(expected)} rad`,
        };
      }),
    ],
  },
  {
    scenario: {
      force: 'gate',
      label: 'A wrong-way crosser at a one-way membrane',
      family: 'extended',
      klass: 'A',
      body: { cx: 0, cy: 0, hw: 40, hh: 40, angle: 0 },
      particles: [{ x: 0, y: 0, vx: -3, vy: 0 }], // moving against the heading (+x)
      frames: 4,
    },
    expectations: [
      check('reflects the wrong-way crosser back along n', 'invariant', (r) => {
        const a = r.applyDelta[0]!;
        const after = -3 + a.dvx;
        return { pass: after > 0, measured: `vx -3 → ${f3(after)}`, expected: '> 0 (passed through)' };
      }),
    ],
  },
  {
    scenario: {
      force: 'buoyancy',
      label: 'A hot, light particle in a buoyancy field',
      family: 'extended',
      klass: 'A',
      body: { cx: 0, cy: 0, range: 0, strength: 0.5 }, // range 0 = global
      particles: [{ x: 0, y: 0, size: 2, heat: 0.8 }], // light → rises
      frames: 30,
    },
    expectations: [
      check('light matter rises (−y)', 'invariant', (r) => {
        const a = r.applyDelta[0]!;
        return { pass: a.dvy < -1e-6, measured: `Δvy = ${f3(a.dvy)}`, expected: '< 0 (up)' };
      }),
    ],
  },
  {
    scenario: {
      force: 'shear',
      label: 'An off-axis particle in a shear gradient',
      family: 'extended',
      klass: 'A',
      body: { cx: 0, cy: 0, range: 300, strength: 1, angle: 0 }, // flow axis +x
      particles: [{ x: 0, y: 80 }], // offset perpendicular to the axis
      frames: 30,
    },
    expectations: [
      check('dragged along the flow axis by its ⟂ offset', 'invariant', (r) => {
        const a = r.applyDelta[0]!;
        return {
          pass: Math.abs(a.dvx) > 1e-6 && Math.abs(a.dvy) < 1e-9,
          measured: `Δv = (${f3(a.dvx)}, ${f3(a.dvy)})`,
          expected: 'along +x only',
        };
      }),
    ],
  },
  {
    scenario: {
      force: 'crystallize',
      label: 'A cool particle snapping onto a lattice',
      family: 'extended',
      klass: 'A',
      body: { cx: 0, cy: 0, range: 300, strength: 0.3 },
      particles: [{ x: 20, y: 8, heat: 0.1 }], // cool, off-node → snaps to (32, 0)
      frames: 40,
    },
    expectations: [
      check('snaps toward the nearest lattice node', 'invariant', (r) => {
        const a = r.applyDelta[0]!;
        // nearest node to (20,8) is (32,0): Δv should point +x, −y
        return {
          pass: a.dvx > 0 && a.dvy < 0,
          measured: `Δv = (${f3(a.dvx)}, ${f3(a.dvy)})`,
          expected: 'toward node (32, 0)',
        };
      }),
    ],
  },
  {
    scenario: {
      force: 'align',
      label: 'A particle steering to its neighbours’ heading',
      family: 'extended',
      klass: 'B',
      body: { cx: 0, cy: 0, range: 300, strength: 0.1 },
      particles: [
        { x: 0, y: 0, vx: 5, vy: 0 }, // moving +x
        { x: 20, y: 0, vx: 0, vy: 5 }, // neighbours moving +y
        { x: -20, y: 0, vx: 0, vy: 5 },
        { x: 0, y: 20, vx: 0, vy: 5 },
      ],
      frames: 30,
    },
    expectations: [
      check('steers toward the neighbour-mean heading (+y)', 'invariant', (r) => {
        const a = r.applyDelta[0]!;
        const ang0 = 0; // +x
        const ang1 = headingAngle(5 + a.dvx, 0 + a.dvy);
        return { pass: ang1 > ang0 + 1e-3, measured: `heading 0 → ${f3(ang1)} rad`, expected: 'turns toward +y' };
      }),
    ],
  },
  {
    scenario: {
      force: 'wind',
      label: 'A particle in curl-noise turbulence',
      family: 'extended',
      klass: 'A',
      body: { cx: 0, cy: 0, range: 0, strength: 1 }, // global gust
      particles: [{ x: 137, y: 89 }],
      frames: 30,
    },
    expectations: [
      check('receives a non-zero curl-noise push', 'invariant', (r) => {
        const a = r.applyDelta[0]!;
        const mag = Math.hypot(a.dvx, a.dvy);
        return { pass: mag > 1e-6, measured: `|Δv| = ${f3(mag)}`, expected: '> 0 (stirred)' };
      }),
    ],
  },
  {
    scenario: {
      force: 'cohesion',
      label: 'Two particles at cohesion range',
      family: 'extended',
      klass: 'B',
      body: { cx: 0, cy: 0, range: 200, strength: 1 },
      particles: [
        { x: 0, y: 0 },
        { x: 150, y: 0 }, // between r0 (100) and r1 (200) → pulled together
      ],
      frames: 30,
    },
    expectations: [
      check('mid-range neighbours draw together (surface tension)', 'invariant', (r) => {
        const start = gap(r, 0, 0, 1);
        const end = gap(r, r.trajectory.length - 1, 0, 1);
        return { pass: end < start - 1e-6, measured: `gap ${f3(start)} → ${f3(end)}`, expected: 'converge' };
      }),
    ],
  },
  {
    scenario: {
      force: 'resonate',
      tokens: ['resonate', 'attract'],
      label: 'A resonator pulsing an attractor',
      family: 'extended',
      klass: 'modifier',
      body: { cx: 150, range: 300, strength: 1, spin: 1 },
      particles: [{ x: 0, y: 0 }],
      frames: 1,
    },
    expectations: [modulatesStrength()],
  },
  {
    scenario: {
      force: 'spotlight',
      tokens: ['spotlight', 'stream'],
      label: 'A spotlight gating a stream to its cone',
      family: 'extended',
      klass: 'modifier',
      body: { cx: 0, cy: 0, range: 300, strength: 1, angle: 0 }, // heading +x
      particles: [{ x: 0, y: 0 }],
      frames: 1,
    },
    expectations: [gatesOutsideCone(0, Math.PI)],
  },
  {
    scenario: {
      force: 'pigment',
      label: 'A particle overlapping a pigment body',
      family: 'extended',
      klass: 'A',
      body: { cx: 0, cy: 0, range: 100, tint: '#ff0000' },
      particles: [{ x: 10, y: 0 }], // within 0.6·range = 60 → stains
      frames: 4,
    },
    expectations: [adoptsTint()],
  },
];

/**
 * Beyond the per-force catalog: forces **compose** (a body can carry several tokens)
 * and **gate** on conditions (`data-when`). These experiments verify those two
 * mechanisms. They are not per-force, so they live in their own catalog; the
 * conformance test runs them alongside `EXPERIMENTS`.
 */
export const COMPOSITE_EXPERIMENTS: ForceConformance[] = [
  {
    // attract + repel at equal strength cancel — the net force is zero.
    scenario: {
      force: 'attract repel',
      tokens: ['attract', 'repel'],
      label: 'A particle between an equal attractor + repeller (they cancel)',
      family: 'canonical',
      klass: 'A',
      body: { cx: 150, range: 300, strength: 1 },
      particles: [{ x: 0, y: 0 }],
      frames: 30,
    },
    expectations: [
      exactDelta(0, 0),
      check('composes to no net force', 'invariant', (r) => {
        const d = r.applyDelta[0]!;
        const mag = Math.hypot(d.dvx, d.dvy);
        return { pass: mag < 1e-6, measured: `|Δv| = ${f3(mag)}`, expected: '≈ 0 (cancelled)' };
      }),
    ],
  },
  {
    // attract + vortex compose into an inward spiral: inward pull + tangential swirl.
    scenario: {
      force: 'attract vortex',
      tokens: ['attract', 'vortex'],
      label: 'A particle in a composed attract + vortex (a spiral)',
      family: 'canonical',
      klass: 'A',
      body: { cx: 150, range: 300, strength: 1, spin: 1 },
      particles: [{ x: 0, y: 0 }],
      frames: 90,
    },
    expectations: [
      movesToward(),
      check('acquires a tangential (swirl) component', 'invariant', (r) => {
        const d = r.applyDelta[0]!;
        return { pass: Math.abs(d.dvy) > 0.05, measured: `Δvᵧ = ${f3(d.dvy)}`, expected: '|Δvᵧ| > 0.05 (swirl)' };
      }),
      check('composes to the sum of its parts (inward + swirl)', 'exact', (r) => {
        const d = r.applyDelta[0]!;
        // attract Δv (0.125, 0) + vortex Δv (0.0205, −0.1705) on a still particle 150px out
        const ok = Math.abs(d.dvx - 0.1455) < 0.005 && Math.abs(d.dvy + 0.1705) < 0.005;
        return { pass: ok, measured: `(${f3(d.dvx)}, ${f3(d.dvy)})`, expected: '(0.1455, −0.1705) ±0.005' };
      }),
    ],
  },
  {
    // a condition gate: attract only acts on a *fast* particle. Two particles fired
    // in — the fast one is pulled toward the body, the slow one is left alone.
    scenario: {
      force: 'attract',
      label: 'A gated attractor (data-when="fast"): pulls the fast particle, not the slow',
      family: 'canonical',
      klass: 'A',
      body: { cx: 150, range: 300, strength: 2, when: 'fast' },
      particles: [
        { x: 0, y: 0, vy: 6 }, // fast → passes the gate
        { x: 0, y: 0, vy: 0.1 }, // slow → blocked
      ],
      frames: 60,
    },
    expectations: [
      check('the gate lets the fast particle through, blocks the slow one', 'invariant', (r) => {
        const last = r.trajectory[r.trajectory.length - 1]!;
        const fastX = last[0]!.x;
        const slowX = last[1]!.x;
        const pass = fastX - slowX > 10 && slowX < 5;
        return {
          pass,
          measured: `fast x = ${f3(fastX)}, slow x = ${f3(slowX)}`,
          expected: 'fast pulled toward the body, slow ~unmoved',
        };
      }),
    ],
  },
];
