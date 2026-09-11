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
  endsFartherOut,
  exactDelta,
  followsGradient,
  gatesOutsideCone,
  modulatesStrength,
  momentumConserved,
  movesAway,
  movesToward,
  noEffectBeyondRange,
  recedesFromBody,
  separates,
  speedPreserved,
  speedReduced,
  unaffectedWhenNeutral,
} from './expectations.ts';

const f3 = (n: number) => (Math.abs(n) < 1e-9 ? '0' : n.toFixed(3));

/**
 * Build an inline one-off expectation. `why` is REQUIRED here (the interface keeps it
 * optional) so no catalog check can ship without its plain-words explanation — the Lab's
 * per-check "why" expansion reads it, and `expectations-why.test.ts` guards the whole set.
 */
function check(
  label: string,
  kind: 'invariant' | 'exact',
  why: string,
  fn: (r: ScenarioResult) => { pass: boolean; measured: string; expected: string },
): Expectation {
  return { label, kind, why, check: fn };
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
      force: 'swirl',
      label: 'A particle 150px from a swirl (spin +1)',
      family: 'canonical',
      klass: 'A',
      body: { cx: 150, range: 300, strength: 1, spin: 1 },
      particles: [{ x: 0, y: 0 }],
      frames: 120, // long enough to show the swirl arc (canonical swirl retains shape lightly)
    },
    expectations: [
      // canonical swirl is swirl-dominant with only light inward retention (0.12); it does
      // NOT bind into an inward spiral — that is a preset (whirlpool / blackhole). So the
      // check is tangential dominance, not movesToward.
      exactDelta(0.020462, -0.170518, 2e-3), // first-frame Δv: tangential −0.1705 ≫ inward 0.0205
      check(
        'the swirl dominates the inward pull (§6.8)',
        'invariant',
        'A swirl should mostly spin matter around the body, not suck it in — the sideways part of the first kick has to be several times bigger than the inward part. Binding into a spiral is a preset, not the canonical swirl.',
        (r) => {
          const d = r.applyDelta[0]!;
          const tangential = Math.abs(d.dvy);
          const inward = Math.abs(d.dvx);
          return {
            pass: tangential > inward * 4,
            measured: `|Δvᵧ| / |Δvₓ| = ${f3(tangential / Math.max(inward, 1e-9))}`,
            expected: 'tangential > 4× inward',
          };
        },
      ),
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
      force: 'viscosity',
      label: 'A moving particle entering a viscosity field',
      family: 'canonical',
      klass: 'A',
      body: { cx: 150, range: 300, strength: 1 },
      particles: [{ x: 0, y: 0, vx: 5, vy: 0 }],
      frames: 30,
    },
    expectations: [
      speedReduced(),
      exactDelta(-0.3, 0),
      check(
        'direction unchanged (no redirection)',
        'invariant',
        'Viscosity only removes speed along the direction the particle is already moving. If any sideways component appeared, the field would be steering matter instead of just slowing it.',
        (r) => {
          // viscosity is v -= v·k, so Δv is anti-parallel to v: it has NO perpendicular
          // component, at any velocity (not just horizontal motion).
          const a = r.applyDelta[0]!;
          const p0 = r.scenario.particles[0]!;
          const vx = p0.vx ?? 0, vy = p0.vy ?? 0;
          const speed = Math.hypot(vx, vy) || 1;
          const cross = (a.dvx * vy - a.dvy * vx) / speed; // ⟂ component of Δv ⇒ redirection
          return { pass: Math.abs(cross) < 1e-6, measured: `⟂ Δv = ${f3(cross)}`, expected: '0 (no redirect)' };
        },
      ),
    ],
  },
  {
    scenario: {
      force: 'jet',
      label: 'A particle relaunched from the jet nozzle (the jet)',
      family: 'canonical',
      klass: 'A',
      body: { cx: 0, cy: 0, range: 300, strength: 1, angle: 0 }, // jet heading +x
      particles: [{ x: -15, y: 0 }], // inside the nozzle (d < 24) → relaunched outward
      frames: 40,
      seed: 3, // the jet's spread cone uses RNG — seed it for reproducibility
    },
    expectations: [
      check(
        'relaunched as a fast jet (not a gentle pull)',
        'invariant',
        'Matter inside the nozzle is thrown out hard: the first kick must be clearly larger than the gentle feed that draws matter in. That size gap is what separates a jet from an attractor.',
        (r) => {
          const a = r.applyDelta[0]!;
          const sp = Math.hypot(a.dvx, a.dvy);
          return { pass: sp > 2, measured: `|Δv| = ${f3(sp)}`, expected: '> 2 (a jet, not the feed)' };
        },
      ),
      check(
        'ejected along the heading',
        'invariant',
        'The relaunched particle must leave close to the direction the nozzle points, so a jet aimed one way actually sprays that way (within its spread cone) rather than in a random direction.',
        (r) => {
          const a = r.applyDelta[0]!;
          const sp = Math.hypot(a.dvx, a.dvy) || 1;
          const along = (a.dvx * r.body.ux + a.dvy * r.body.uy) / sp;
          return { pass: along > 0.7, measured: `along ${f3(along)}`, expected: '> 0.7 (follows the nozzle heading)' };
        },
      ),
      recedesFromBody(),
    ],
  },
  {
    scenario: {
      force: 'tether',
      label: 'A particle inside a tether rest shell (compressed)',
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
      force: 'wall',
      label: 'A particle hitting a wall',
      family: 'canonical',
      klass: 'A',
      body: { cx: 0, cy: 0, hw: 40, hh: 40 },
      particles: [{ x: 30, y: 0, vx: 3, vy: 0 }],
      frames: 4,
    },
    expectations: [
      check(
        'velocity reverses off the wall',
        'invariant',
        'A particle moving into the wall must come out moving the other way. A wall that lets matter keep going in the same direction is not a wall.',
        (r) => {
          const a = r.applyDelta[0]!;
          const after = 3 + a.dvx;
          return { pass: after < 0, measured: `vx 3 → ${f3(after)}`, expected: '< 0 (reversed)' };
        },
      ),
      check(
        'bounce is damped (e ≈ 0.85)',
        'invariant',
        'The rebound must be a little slower than the approach — the wall absorbs some energy on impact. A perfectly elastic wall would let matter rattle forever.',
        (r) => {
          const a = r.applyDelta[0]!;
          const after = Math.abs(3 + a.dvx);
          return { pass: after < 3, measured: `|vx| ${f3(after)}`, expected: '< 3 (energy lost)' };
        },
      ),
    ],
  },
  {
    scenario: {
      force: 'sink',
      label: 'A particle drifting into a sink',
      family: 'canonical',
      klass: 'A',
      body: { cx: 0, cy: 0, range: 300, absorbR: 64, capacity: 60 },
      particles: [{ x: 30, y: 0 }],
      frames: 20,
    },
    expectations: [
      check(
        'particle is captured',
        'invariant',
        'Matter that drifts into the sink\'s capture radius must be taken out of the field and counted by the body. The count going up is the proof that the sink actually absorbs, not merely attracts.',
        (r) => {
          const n = r.body.accreted;
          return { pass: n > 0, measured: `accreted = ${n}`, expected: '> 0' };
        },
      ),
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
    // perpendicularToVelocity() checked Euler's exact Δv⊥v; the rotation implementation
    // preserves speed to float precision (better), so use the tighter speed check instead.
    expectations: [speedPreserved(1e-5)],
  },
  {
    scenario: {
      force: 'fieldflow',
      label: 'Neutral matter following a charge field line',
      family: 'extended',
      klass: 'A',
      // a `charge` sources the field; `fieldflow` follows it. The particle is NEUTRAL, so
      // charge itself cannot move it — only fieldflow advects it, streaming OUT along the
      // radial field lines (the field direction at a point left of a + source points away).
      tokens: ['charge', 'fieldflow'],
      body: { cx: 120, range: 300, M: 2000, spin: 1, strength: 1 },
      particles: [{ x: 0, y: 0 }],
      frames: 60,
    },
    expectations: [movesAway(), recedesFromBody(), noEffectBeyondRange()],
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
      check(
        'agitated into motion',
        'invariant',
        'A particle sitting still in a thermal bath has to start moving at some point — the random kicks must actually deliver energy rather than cancel out to nothing.',
        (r) => {
          const moved = r.trajectory.some((fr) => fr[0]!.speed > 0.05);
          return { pass: moved, measured: 'speed > 0 occurs', expected: 'kicked into motion' };
        },
      ),
      check(
        'isotropic kicks (comparable spread on both axes)',
        'invariant',
        'Heat has no preferred direction, so across a whole cloud of particles the spread of motion left-right and up-down must come out roughly equal. A lopsided ratio would mean the noise carries a hidden bias.',
        (r) => {
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
        },
      ),
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
      check(
        'the discs bounce (relative velocity reverses)',
        'invariant',
        'Two discs that approached each other must end up moving apart, each heading back the way it came. That reversal shows a real collision happened instead of the discs passing through one another.',
        (r) => {
          const last = r.trajectory[r.trajectory.length - 1]!;
          // they approached (+x and −x); after the bounce each moves the other way
          const ok = last[0]!.vx < 0 && last[1]!.vx > 0;
          return { pass: ok, measured: `vx ${f3(last[0]!.vx)}, ${f3(last[1]!.vx)}`, expected: 'reversed (bounced)' };
        },
      ),
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
      body: { cx: 0, cy: 0, range: 300, strength: 2, on: true },
      particles: [{ x: 40, y: 0 }],
      frames: 60,
    },
    expectations: [endsFartherOut()],
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
      check(
        'rotated by θ = θmax·(1−d/r)·spin',
        'exact',
        'The lens must turn the particle\'s heading by exactly the angle the formula predicts for its distance from the centre — the bend is a precise function of position, not just a nudge in the right sense.',
        (r) => {
          const a = r.applyDelta[0]!;
          const ang = headingAngle(5 + a.dvx, 0 + a.dvy);
          const expected = 0.3 * (1 - 150 / 300) * 1; // 0.15
          return {
            pass: Math.abs(ang - expected) < 2e-3,
            measured: `θ = ${f3(ang)} rad`,
            expected: `${f3(expected)} rad`,
          };
        },
      ),
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
      check(
        'reflects the wrong-way crosser back along n',
        'invariant',
        'A particle trying to cross the membrane against its allowed direction must be bounced back the way it came. Letting it through would make the gate a two-way door.',
        (r) => {
          const a = r.applyDelta[0]!;
          const after = -3 + a.dvx;
          return { pass: after > 0, measured: `vx -3 → ${f3(after)}`, expected: '> 0 (reflected back along +n)' };
        },
      ),
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
      check(
        'light matter rises (−y)',
        'invariant',
        'A hot, light particle should be lifted upward by buoyancy, so the first kick must point up the screen. That upward drift is the whole effect: hot rises, cold sinks.',
        (r) => {
          const a = r.applyDelta[0]!;
          return { pass: a.dvy < -1e-6, measured: `Δvy = ${f3(a.dvy)}`, expected: '< 0 (up)' };
        },
      ),
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
      check(
        'dragged along the flow axis by its ⟂ offset',
        'invariant',
        'A particle off to one side of the shear axis should be dragged along that axis and nowhere else — the kick has a component along the flow and none across it, whatever the heading is set to.',
        (r) => {
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
        },
      ),
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
      check(
        'snaps toward the nearest lattice node',
        'invariant',
        'A cool particle that has drifted off a lattice point must be nudged toward the nearest node, in both x and y. That snap is how crystallize builds a regular grid out of loose matter.',
        (r) => {
          const a = r.applyDelta[0]!;
          // nearest node to (20,8) is (32,0): Δv should point +x, −y
          return {
            pass: a.dvx > 0 && a.dvy < 0,
            measured: `Δv = (${f3(a.dvx)}, ${f3(a.dvy)})`,
            expected: 'toward node (32, 0)',
          };
        },
      ),
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
      check(
        'steers toward the neighbour-mean heading (+y)',
        'invariant',
        'A particle surrounded by neighbours all heading the same way must begin turning toward their shared direction. That gradual alignment is what turns a crowd into a flock.',
        (r) => {
          const a = r.applyDelta[0]!;
          const ang0 = 0; // +x
          const ang1 = headingAngle(5 + a.dvx, 0 + a.dvy);
          return { pass: ang1 > ang0 + 1e-3, measured: `heading 0 → ${f3(ang1)} rad`, expected: 'turns toward +y' };
        },
      ),
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
      check(
        'receives a non-zero curl-noise push',
        'invariant',
        'Even a lone particle in the wind must get a clearly non-zero shove from the turbulence field. If the push read zero, the gust would be invisible.',
        (r) => {
          const a = r.applyDelta[0]!;
          const mag = Math.hypot(a.dvx, a.dvy);
          return { pass: mag > 0.01, measured: `|Δv| = ${f3(mag)}`, expected: '> 0.01 (clearly stirred)' };
        },
      ),
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
      check(
        'mid-range neighbours draw together (surface tension)',
        'invariant',
        'Two particles inside the cohesion band must finish closer together than they started — the surface-tension pull is real and overcomes friction over the run.',
        (r) => {
          const start = gap(r, 0, 0, 1);
          const end = gap(r, r.trajectory.length - 1, 0, 1);
          return { pass: end < start - 1e-6, measured: `gap ${f3(start)} → ${f3(end)}`, expected: 'converge' };
        },
      ),
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
      check(
        'over-dense matter spreads to an even fill',
        'invariant',
        'A pair of particles crowded far inside the rest spacing is over-dense, so pressure must push them apart until they end the run with a wider gap. That relaxation is what keeps matter evenly filled.',
        (r) => {
          const start = gap(r, 0, 0, 1);
          const end = gap(r, r.trajectory.length - 1, 0, 1);
          return { pass: end > start + 1e-6, measured: `gap ${f3(start)} → ${f3(end)}`, expected: 'spread apart' };
        },
      ),
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
      check(
        'the predator accelerates toward the prey',
        'invariant',
        'The predator must end the run moving toward the prey. A hunter that does not close in is not hunting.',
        (r) => {
          const last = r.trajectory[r.trajectory.length - 1]!;
          return { pass: last[0]!.vx > 0, measured: `predator vx ${f3(last[0]!.vx)}`, expected: '> 0 (toward prey)' };
        },
      ),
      check(
        'the prey flees away from the predator',
        'invariant',
        'The prey must end the run moving away from the predator. Flight is the other half of the chase; without it the pair would simply collide.',
        (r) => {
          const last = r.trajectory[r.trajectory.length - 1]!;
          return { pass: last[1]!.vx > 0, measured: `prey vx ${f3(last[1]!.vx)}`, expected: '> 0 (fleeing)' };
        },
      ),
      check(
        'a particle ignores its own species',
        'invariant',
        'Both particles migrate the same way only because they are different species — the predator chases the prey, not itself. If species were ignored, the pair would pull on each other and go nowhere.',
        (r) => {
          // both move the same way only because they are different species; a self-pair
          // check is implicit — the predator's target must be the prey, not itself.
          const first = r.trajectory[0]!;
          const last = r.trajectory[r.trajectory.length - 1]!;
          const migrated = last[0]!.x - first[0]!.x > 1 && last[1]!.x - first[1]!.x > 1;
          return { pass: migrated, measured: `Δx ${f3(last[0]!.x - first[0]!.x)}, ${f3(last[1]!.x - first[1]!.x)}`, expected: 'both migrate +x' };
        },
      ),
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
      check(
        'the source creates matter over time',
        'invariant',
        'A source starting from nothing must end the run with more particles than it began with. The growing count is the direct proof that spawn makes matter.',
        (r) => {
          const start = r.trajectory[0]!.length;
          const end = r.trajectory[r.trajectory.length - 1]!.length;
          return { pass: end > start, measured: `${start} → ${end} particles`, expected: 'grows' };
        },
      ),
      check(
        'emitted matter carries the heading (+x)',
        'invariant',
        'The matter a source emits must, on average, move in the direction the source is pointed. A source that sprayed randomly would ignore its own heading.',
        (r) => {
          const last = r.trajectory[r.trajectory.length - 1]!;
          if (!last.length) return { pass: false, measured: 'no matter emitted', expected: 'mean vx > 0' };
          const mean = last.reduce((s, p) => s + p.vx, 0) / last.length;
          return { pass: mean > 0, measured: `mean vx ${f3(mean)}`, expected: '> 0 (along the heading)' };
        },
      ),
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
      check(
        'a stretched bond pulls back toward its rest length',
        'invariant',
        'Two linked particles pulled apart past the bond\'s rest length must move back toward it — closing the gap without collapsing all the way. That spring-like recovery is what makes a link a bond.',
        (r) => {
          const start = gap(r, 0, 0, 1);
          const end = gap(r, r.trajectory.length - 1, 0, 1);
          return { pass: end < start - 1e-6 && end > 40, measured: `gap ${f3(start)} → ${f3(end)}`, expected: 'toward L ≈ 70' };
        },
      ),
    ],
  },
  {
    scenario: {
      force: 'morph',
      label: 'Matter assembling into a three-point mark',
      family: 'extended',
      klass: 'D',
      // three particles, each hashed (by gx) to a distinct target — they tether out from
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
      check(
        'each particle settles on its assigned mark',
        'invariant',
        'Every particle must finish close to the target point it was assigned, and closer than it started. This is morph doing its job: matter assembling into the mark, each piece on its own spot.',
        (r) => {
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
        },
      ),
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
    // screen is a CROSS-BODY modifier (workover v0.3): the quiet zone damps OTHER bodies'
    // forces on matter inside its radius. Two identical attract wells act on two identical
    // particles; one particle sits at the screen's core (factor → 0), the far pair is well
    // outside the screen's range and must behave as plain attract.
    scenario: {
      force: 'screen',
      label: "A quiet zone attenuating a neighbour attractor's pull",
      family: 'extended',
      klass: 'modifier',
      body: { cx: 0, cy: 0, range: 200, strength: 1 }, // the screen: full cancellation at its core
      extraBodies: [
        { tokens: ['attract'], attrs: { cx: 150, cy: 0, range: 300, strength: 1 } }, // shielded pair
        { tokens: ['attract'], attrs: { cx: 150, cy: 1200, range: 300, strength: 1 } }, // free pair
      ],
      particles: [
        { x: 0, y: 0 }, // inside the screen (d = 0 → screenFactor 0)
        { x: 0, y: 1200 }, // far outside the screen — the control
      ],
      frames: 30,
    },
    expectations: [
      check(
        'matter inside the quiet zone is measurably attenuated vs outside',
        'invariant',
        'A particle sitting inside the screen\'s quiet zone must barely move, while an identical particle outside it is pulled freely by the same kind of attractor. The gap between the two is the shielding at work.',
        (r) => {
          const last = r.trajectory[r.trajectory.length - 1]!;
          const first = r.trajectory[0]!;
          const dispIn = Math.hypot(last[0]!.x - first[0]!.x, last[0]!.y - first[0]!.y);
          const dispOut = Math.hypot(last[1]!.x - first[1]!.x, last[1]!.y - first[1]!.y);
          return {
            pass: dispOut > 1 && dispIn < dispOut * 0.05,
            measured: `inside ${f3(dispIn)}px vs outside ${f3(dispOut)}px`,
            expected: 'inside < 5% of outside (and outside actually moves)',
          };
        },
      ),
      check(
        'no effect outside the radius — the control feels plain attract',
        'exact',
        'The control particle, far outside the screen, must feel exactly the plain attractor\'s pull with friction applied — no attenuation at all. This proves the screen is strictly local.',
        (r) => {
          // frame 1 = one step: attract's Δvx 0.125 at d=150 (S=1, r=300), then friction ×0.95.
          const vx = r.trajectory[1]![1]!.vx;
          const want = 0.125 * 0.95;
          return {
            pass: Math.abs(vx - want) < 1e-9,
            measured: `vx ${vx.toFixed(6)}`,
            expected: `${want.toFixed(6)} (unattenuated attract × friction)`,
          };
        },
      ),
      check(
        'the screen itself never moves matter (a pure modifier)',
        'invariant',
        'The screen\'s own first-frame kick must be exactly zero. It only damps other bodies\' forces; if it pushed or pulled by itself it would no longer be a pure modifier.',
        (r) => {
          const d = r.applyDelta[0]!;
          return {
            pass: d.dvx === 0 && d.dvy === 0,
            measured: `Δv (${f3(d.dvx)}, ${f3(d.dvy)})`,
            expected: '(0, 0) — apply is a no-op',
          };
        },
      ),
    ],
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
  {
    // warp is position-dependent (reads warpX/warpY) and in NO_OFFSET, so coords are absolute.
    scenario: {
      force: 'warp',
      label: 'A particle entering a warp throat relocates to its pair (conserved)',
      family: 'extended',
      klass: 'A',
      body: { cx: 2000, cy: 2000, absorbR: 64, warpHas: true, warpX: 3000, warpY: 2000, twist: 0, warpScale: 1 },
      particles: [{ x: 1990, y: 2000 }], // 10px inside throat A
      frames: 5,
    },
    expectations: [
      check(
        'relocates to the paired throat',
        'invariant',
        'A particle entering one warp throat must reappear next to its paired throat. That jump is the warp: matter is transported, not destroyed.',
        (r) => {
          const last = r.trajectory[r.trajectory.length - 1]![0]!;
          const dxPair = Math.hypot(last.x - 3000, last.y - 2000);
          return { pass: dxPair < 90, measured: `${f3(dxPair)}px from the pair`, expected: '< ~throat (arrived at pair B)' };
        },
      ),
      check(
        'leaves the entry throat — conserved, not captured',
        'invariant',
        'After the jump the particle must be well clear of the throat it entered and the particle count must be unchanged. The warp moves matter without swallowing it, unlike a sink.',
        (r) => {
          const last = r.trajectory[r.trajectory.length - 1]![0]!;
          const fromA = Math.hypot(last.x - 2000, last.y - 2000);
          const count = r.trajectory[r.trajectory.length - 1]!.length;
          return { pass: fromA > 64 && count === 1, measured: `${f3(fromA)}px from throat A, ${count} particle(s)`, expected: '> absorbR, count unchanged' };
        },
      ),
    ],
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
      check(
        'composes to no net force',
        'invariant',
        'An attractor and a repeller of equal strength on one body must cancel exactly, leaving the particle with no first-frame kick at all. That cancellation shows forces compose by adding, not by overriding.',
        (r) => {
          const d = r.applyDelta[0]!;
          const mag = Math.hypot(d.dvx, d.dvy);
          return { pass: mag < 1e-6, measured: `|Δv| = ${f3(mag)}`, expected: '≈ 0 (cancelled)' };
        },
      ),
    ],
  },
  {
    // attract + swirl compose into an inward spiral: inward pull + tangential swirl.
    scenario: {
      force: 'attract swirl',
      tokens: ['attract', 'swirl'],
      label: 'A particle in a composed attract + swirl (a spiral)',
      family: 'canonical',
      klass: 'A',
      body: { cx: 150, range: 300, strength: 1, spin: 1 },
      particles: [{ x: 0, y: 0 }],
      frames: 90,
    },
    expectations: [
      movesToward(),
      check(
        'acquires a tangential (swirl) component',
        'invariant',
        'Adding swirl to an attractor must give the particle a clear sideways component in its first kick, on top of the inward pull. Without it, the composition would be just attract.',
        (r) => {
          const d = r.applyDelta[0]!;
          return { pass: Math.abs(d.dvy) > 0.05, measured: `Δvᵧ = ${f3(d.dvy)}`, expected: '|Δvᵧ| > 0.05 (swirl)' };
        },
      ),
      check(
        'composes to the sum of its parts (inward + swirl)',
        'exact',
        'The composed first-frame kick must equal the attractor\'s kick plus the swirl\'s kick, within tolerance. Composition is plain addition — no force is scaled or dropped when it shares a body.',
        (r) => {
          const d = r.applyDelta[0]!;
          // attract Δv (0.125, 0) + swirl Δv (0.0205, −0.1705) on a still particle 150px out
          const ok = Math.abs(d.dvx - 0.1455) < 0.005 && Math.abs(d.dvy + 0.1705) < 0.005;
          return { pass: ok, measured: `(${f3(d.dvx)}, ${f3(d.dvy)})`, expected: '(0.1455, −0.1705) ±0.005' };
        },
      ),
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
      check(
        'the gate lets the fast particle through, blocks the slow one',
        'invariant',
        'With a fast-only condition on the attractor, the fast particle must be pulled clearly toward the body while the slow one is left almost where it started. That split proves the condition gate really filters which matter a force acts on.',
        (r) => {
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
        },
      ),
    ],
  },
];
