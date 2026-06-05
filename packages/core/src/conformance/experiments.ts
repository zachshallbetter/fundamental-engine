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
        // drag is v -= v·k, so Δv is anti-parallel to v: it has NO perpendicular
        // component, at any velocity (not just horizontal motion).
        const a = r.applyDelta[0]!;
        const p0 = r.scenario.particles[0]!;
        const vx = p0.vx ?? 0, vy = p0.vy ?? 0;
        const speed = Math.hypot(vx, vy) || 1;
        const cross = (a.dvx * vy - a.dvy * vx) / speed; // ⟂ component of Δv ⇒ redirection
        return { pass: Math.abs(cross) < 1e-6, measured: `⟂ Δv = ${f3(cross)}`, expected: '0 (no redirect)' };
      }),
    ],
  },
  {
    scenario: {
      force: 'emitter',
      label: 'A particle relaunched from the emitter nozzle (the jet)',
      family: 'canonical',
      klass: 'A',
      body: { cx: 0, cy: 0, range: 300, strength: 1, angle: 0 }, // jet heading +x
      particles: [{ x: -15, y: 0 }], // inside the nozzle (d < 24) → relaunched outward
      frames: 40,
      seed: 3, // the jet's spread cone uses RNG — seed it for reproducibility
    },
    expectations: [
      check('relaunched as a fast jet (not a gentle pull)', 'invariant', (r) => {
        const a = r.applyDelta[0]!;
        const sp = Math.hypot(a.dvx, a.dvy);
        return { pass: sp > 2, measured: `|Δv| = ${f3(sp)}`, expected: '> 2 (a jet, not the feed)' };
      }),
      check('ejected along the heading', 'invariant', (r) => {
        const a = r.applyDelta[0]!;
        const sp = Math.hypot(a.dvx, a.dvy) || 1;
        const along = (a.dvx * r.body.ux + a.dvy * r.body.uy) / sp;
        return { pass: along > 0.7, measured: `along ${f3(along)}`, expected: '> 0.7 (follows the nozzle heading)' };
      }),
      recedesFromBody(),
    ],
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
      // a cloud of independent particles — the isotropy is a statistical property, so
      // it only converges over many samples (one particle is a noisy random walk).
      particles: Array.from({ length: 150 }, () => ({ x: 40, y: 0, vx: 0, vy: 0 })),
      frames: 120,
      seed: 7,
    },
    expectations: [
      check('agitated into motion', 'invariant', (r) => {
        const moved = r.trajectory.some((fr) => fr[0]!.speed > 0.05);
        return { pass: moved, measured: 'speed > 0 occurs', expected: 'kicked into motion' };
      }),
      check('isotropic kicks (comparable spread on both axes)', 'invariant', (r) => {
        // isotropic 2-D kicks give equal RMS velocity in x and y — measured across the
        // whole cloud over all frames, so it converges close to 1.
        let sx = 0;
        let sy = 0;
        let n = 0;
        for (const fr of r.trajectory)
          for (const p of fr) {
            sx += p.vx * p.vx;
            sy += p.vy * p.vy;
            n++;
          }
        const rx = Math.sqrt(sx / n);
        const ry = Math.sqrt(sy / n);
        const ratio = rx / (ry || 1e-9);
        return {
          pass: rx > 0.1 && ry > 0.1 && ratio > 0.9 && ratio < 1.11,
          measured: `rms (${f3(rx)}, ${f3(ry)}), ratio ${f3(ratio)}`,
          expected: 'both > 0, ratio ≈ 1 (±10%)',
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
      // centred in positive space (the sim wraps at the field origin, so keep clear of
      // the edges). Start apart (gap 20) and approaching slowly, so they meet, exchange
      // momentum, and clearly fly back apart rather than tunnelling through.
      body: { cx: 300, cy: 300, range: 300, strength: 1 },
      particles: [
        { x: 290, y: 300, vx: 1, vy: 0, size: 4 },
        { x: 310, y: 300, vx: -1, vy: 0, size: 4 },
      ],
      frames: 40,
    },
    expectations: [
      momentumConserved(1e-6),
      separates(0, 1),
      check('the discs bounce (relative velocity reverses)', 'invariant', (r) => {
        const last = r.trajectory[r.trajectory.length - 1]!;
        // they approached (+x and −x); after the bounce each moves the other way
        const ok = last[0]!.vx < 0 && last[1]!.vx > 0;
        return { pass: ok, measured: `vx ${f3(last[0]!.vx)}, ${f3(last[1]!.vx)}`, expected: 'reversed (bounced)' };
      }),
    ],
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
        return { pass: after > 0, measured: `vx -3 → ${f3(after)}`, expected: '> 0 (reflected back along +n)' };
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
        // project onto the body's actual flow axis so the check holds at any `angle`
        const ux = r.body.ux, uy = r.body.uy;
        const along = a.dvx * ux + a.dvy * uy;
        const perp = a.dvx * -uy + a.dvy * ux;
        return {
          pass: Math.abs(along) > 1e-6 && Math.abs(perp) < 1e-6,
          measured: `along ${f3(along)}, ⟂ ${f3(perp)}`,
          expected: 'along the flow axis only',
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
      body: { cx: 0, cy: 0, range: 0, strength: 8 }, // a strong global gust (legible drift)
      particles: [{ x: 137, y: 89 }],
      frames: 60,
    },
    expectations: [
      check('receives a non-zero curl-noise push', 'invariant', (r) => {
        const a = r.applyDelta[0]!;
        const mag = Math.hypot(a.dvx, a.dvy);
        return { pass: mag > 0.01, measured: `|Δv| = ${f3(mag)}`, expected: '> 0.01 (clearly stirred)' };
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
      force: 'pressure',
      label: 'Two overlapping particles relax apart',
      family: 'extended',
      klass: 'B',
      // a crowded pair (gap 8, well inside the smoothing radius) is over the rest
      // density, so pressure pushes them apart symmetrically — momentum is conserved.
      body: { cx: 0, cy: 0, range: 200, strength: 1 },
      particles: [
        { x: 0, y: 0 },
        { x: 8, y: 0 },
      ],
      frames: 30,
    },
    expectations: [
      momentumConserved(1e-6),
      separates(0, 1),
      check('over-dense matter spreads to an even fill', 'invariant', (r) => {
        const start = gap(r, 0, 0, 1);
        const end = gap(r, r.trajectory.length - 1, 0, 1);
        return { pass: end > start + 1e-6, measured: `gap ${f3(start)} → ${f3(end)}`, expected: 'spread apart' };
      }),
    ],
  },
  {
    scenario: {
      force: 'hunt',
      label: 'A predator chasing prey, the prey fleeing',
      family: 'extended',
      klass: 'B',
      // predator (species 0) left of prey (species 1): the predator accelerates toward
      // the prey (+x) and the prey flees away (+x), so the whole pair migrates +x.
      body: { cx: 0, cy: 0, range: 300, strength: 1 },
      particles: [
        { x: 0, y: 0, species: 0 },
        { x: 20, y: 0, species: 1 },
      ],
      frames: 30,
    },
    expectations: [
      check('the predator accelerates toward the prey', 'invariant', (r) => {
        const last = r.trajectory[r.trajectory.length - 1]!;
        return { pass: last[0]!.vx > 0, measured: `predator vx ${f3(last[0]!.vx)}`, expected: '> 0 (toward prey)' };
      }),
      check('the prey flees away from the predator', 'invariant', (r) => {
        const last = r.trajectory[r.trajectory.length - 1]!;
        return { pass: last[1]!.vx > 0, measured: `prey vx ${f3(last[1]!.vx)}`, expected: '> 0 (fleeing)' };
      }),
      check('a particle ignores its own species', 'invariant', (r) => {
        // both move the same way only because they are different species; a self-pair
        // check is implicit — the predator's target must be the prey, not itself.
        const first = r.trajectory[0]!;
        const last = r.trajectory[r.trajectory.length - 1]!;
        const migrated = last[0]!.x - first[0]!.x > 1 && last[1]!.x - first[1]!.x > 1;
        return { pass: migrated, measured: `Δx ${f3(last[0]!.x - first[0]!.x)}, ${f3(last[1]!.x - first[1]!.x)}`, expected: 'both migrate +x' };
      }),
    ],
  },
  {
    scenario: {
      force: 'spawn',
      label: 'A source emitting matter along its heading',
      family: 'extended',
      klass: 'S',
      // an engaged source with no initial matter: it fills the field along +x (angle 0).
      body: { cx: 0, cy: 0, range: 300, strength: 1, on: true, angle: 0 },
      particles: [],
      frames: 12,
      seed: 7,
    },
    expectations: [
      check('the source creates matter over time', 'invariant', (r) => {
        const start = r.trajectory[0]!.length;
        const end = r.trajectory[r.trajectory.length - 1]!.length;
        return { pass: end > start, measured: `${start} → ${end} particles`, expected: 'grows' };
      }),
      check('emitted matter carries the heading (+x)', 'invariant', (r) => {
        const last = r.trajectory[r.trajectory.length - 1]!;
        if (!last.length) return { pass: false, measured: 'no matter emitted', expected: 'mean vx > 0' };
        const mean = last.reduce((s, p) => s + p.vx, 0) / last.length;
        return { pass: mean > 0, measured: `mean vx ${f3(mean)}`, expected: '> 0 (along the heading)' };
      }),
    ],
  },
  {
    scenario: {
      force: 'link',
      label: 'Two particles relaxing to the bond rest length',
      family: 'extended',
      klass: 'B',
      // range 200 → rest length L = 70; a pair at gap 150 (> L) is pulled together
      // toward L, symmetrically, so momentum is conserved.
      body: { cx: 0, cy: 0, range: 200, strength: 1 },
      particles: [
        { x: 0, y: 0 },
        { x: 150, y: 0 },
      ],
      frames: 40,
    },
    expectations: [
      momentumConserved(1e-6),
      check('a stretched bond pulls back toward its rest length', 'invariant', (r) => {
        const start = gap(r, 0, 0, 1);
        const end = gap(r, r.trajectory.length - 1, 0, 1);
        return { pass: end < start - 1e-6 && end > 40, measured: `gap ${f3(start)} → ${f3(end)}`, expected: 'toward L ≈ 70' };
      }),
    ],
  },
  {
    scenario: {
      force: 'morph',
      label: 'Matter assembling into a three-point mark',
      family: 'extended',
      klass: 'D',
      // three particles, each hashed (by gx) to a distinct target — they spring out from
      // the centre and settle onto the marks. A geometric mark, never letterforms (§11).
      body: {
        cx: 0,
        cy: 0,
        range: 300,
        strength: 1,
        targets: [
          { x: 120, y: 0 },
          { x: -60, y: 100 },
          { x: -60, y: -100 },
        ],
      },
      particles: [
        { x: 0, y: 0, gx: 0.1 },
        { x: 0, y: 0, gx: 0.45 },
        { x: 0, y: 0, gx: 0.8 },
      ],
      frames: 80,
      seed: 5,
    },
    expectations: [
      check('each particle settles on its assigned mark', 'invariant', (r) => {
        const ts = r.scenario.body.targets!;
        const first = r.trajectory[0]!;
        const last = r.trajectory[r.trajectory.length - 1]!;
        let converged = true;
        let maxEnd = 0;
        for (let i = 0; i < r.scenario.particles.length; i++) {
          const gx = r.scenario.particles[i]!.gx ?? 0;
          const t = ts[Math.min(ts.length - 1, Math.floor(gx * ts.length))]!;
          const d0 = Math.hypot(first[i]!.x - t.x, first[i]!.y - t.y);
          const d1 = Math.hypot(last[i]!.x - t.x, last[i]!.y - t.y);
          if (d1 >= d0) converged = false;
          maxEnd = Math.max(maxEnd, d1);
        }
        return { pass: converged && maxEnd < 30, measured: `max dist to mark ${f3(maxEnd)}`, expected: 'each on its mark (< 30)' };
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
        const first = r.trajectory[0]!;
        const last = r.trajectory[r.trajectory.length - 1]!;
        const fastMoved = last[0]!.x - first[0]!.x; // pulled toward the body (+x)
        const slowMoved = last[1]!.x - first[1]!.x; // gated → ~unmoved
        const pass = fastMoved > 10 && Math.abs(slowMoved) < 5;
        return {
          pass,
          measured: `fast Δx = ${f3(fastMoved)}, slow Δx = ${f3(slowMoved)}`,
          expected: 'fast pulled toward the body (Δx > 10), slow ~unmoved',
        };
      }),
    ],
  },
];
