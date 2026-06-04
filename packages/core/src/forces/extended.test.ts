import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  lens,
  gate,
  buoyancy,
  shear,
  crystallize,
  align,
  wind,
  cohesion,
  resonate,
  spotlight,
  pigment,
  curlNoise,
  extendedForces,
} from './extended.ts';
import type { Body, Env, Particle } from '../core/types.ts';

const body = (o: Partial<Body> = {}): Body => ({
  el: {} as HTMLElement,
  tokens: [],
  strength: 1,
  range: 300,
  absorbR: 64,
  capacity: 60,
  spin: 1,
  angle: 0,
  ux: 1,
  uy: 0,
  when: '',
  feedback: false,
  fmin: 0,
  fmax: 0,
  opsz: '',
  M: 1,
  cx: 0,
  cy: 0,
  hw: 0,
  hh: 0,
  on: false,
  vis: true,
  accreted: 0,
  count: 0,
  d: 0,
  ...o,
});

const part = (o: Partial<Particle> = {}): Particle => ({
  x: 0,
  y: 0,
  vx: 0,
  vy: 0,
  m: 1,
  heat: 0,
  size: 1,
  cap: null,
  ...o,
});

const env = (o: Partial<Env> = {}): Env => ({
  dx: 0,
  dy: 0,
  dist: 1,
  form: { driftX: 0, wander: 0, orbit: 0, spread: 0, conv: 0 },
  W: 1000,
  H: 800,
  t: 0,
  frameN: 0,
  dt: 1,
  c: 12,
  G: 1,
  spark: () => {},
  supernova: () => {},
  spawn: () => {},
  neighbors: () => [],
  grid: () => ({ sample: () => 0, deposit: () => {}, gradient: () => ({ x: 0, y: 0 }) }),
  ...o,
});

const near = (a: number, b: number, tol = 1e-4): boolean => Math.abs(a - b) < tol;

test('extended forces expose the §20.3 class [A] set', () => {
  assert.deepEqual(
    extendedForces.map((f) => f.token),
    [
      'lens',
      'gate',
      'buoyancy',
      'shear',
      'crystallize',
      'align',
      'wind',
      'cohesion',
      'resonate',
      'spotlight',
      'pigment',
    ],
  );
});

test('resonate is a pure modifier: S(t) = 1 + sin(ω·t), spin tunes the rate (§20.3)', () => {
  const p = part();
  const b = body({ spin: 1 });
  assert.equal(resonate.apply(b, p, env()), undefined); // apply is a no-op
  assert.ok(near(resonate.modify!(b, p, env({ t: 0 })).strength!, 1)); // 1 + sin 0
  assert.ok(near(resonate.modify!(b, p, env({ t: Math.PI / 6 })).strength!, 2)); // ω=3 → 3·π/6 = π/2
  // spin doubles the rate: t = π/12 reaches the peak
  assert.ok(near(resonate.modify!(body({ spin: 2 }), p, env({ t: Math.PI / 12 })).strength!, 2));
});

test('spotlight gates siblings to the heading cone (§20.3)', () => {
  const p = part();
  const b = body({ ux: 1, uy: 0 }); // heading +x
  // straight ahead (body → particle along +x): inside the cone
  assert.equal(spotlight.modify!(b, p, env({ dx: -100, dy: 0, dist: 100 })).gate, false);
  // behind: outside
  assert.equal(spotlight.modify!(b, p, env({ dx: 100, dy: 0, dist: 100 })).gate, true);
  // 90° to the side: outside the ~60° cone
  assert.equal(spotlight.modify!(b, p, env({ dx: 0, dy: -100, dist: 100 })).gate, true);
});

test('lens rotates velocity by θ_max·(1−d/d_max)·sign (§20.3)', () => {
  const p = part({ vx: 1, vy: 0 });
  // θ_max=π/2, d=150, range=300 → θ = (π/2)·0.5 = π/4; rotate (1,0) → (√½, √½).
  lens.apply(body({ strength: Math.PI / 2, range: 300, spin: 1 }), p, env({ dist: 150 }));
  assert.ok(near(p.vx, Math.SQRT1_2));
  assert.ok(near(p.vy, Math.SQRT1_2));
});

test('lens preserves speed exactly (a path bend, no energy)', () => {
  const p = part({ vx: 2, vy: -1 });
  const speed0 = Math.hypot(p.vx, p.vy);
  lens.apply(body({ strength: 1.3, range: 300, spin: 1 }), p, env({ dist: 90 }));
  assert.ok(near(Math.hypot(p.vx, p.vy), speed0));
});

test('lens sign (spin) flips the bend direction', () => {
  const p = part({ vx: 1, vy: 0 });
  lens.apply(body({ strength: Math.PI / 2, range: 300, spin: -1 }), p, env({ dist: 150 }));
  assert.ok(near(p.vx, Math.SQRT1_2)); // θ = −π/4
  assert.ok(near(p.vy, -Math.SQRT1_2));
});

test('lens bend vanishes at the rim and is inert beyond range', () => {
  const atRim = part({ vx: 1, vy: 0 });
  lens.apply(body({ strength: Math.PI / 2, range: 300, spin: 1 }), atRim, env({ dist: 300 }));
  assert.ok(near(atRim.vx, 1)); // (1 − 300/300) = 0 → no rotation
  assert.ok(near(atRim.vy, 0));
  const beyond = part({ vx: 1, vy: 0 });
  lens.apply(body({ strength: Math.PI / 2, range: 300 }), beyond, env({ dist: 350 }));
  assert.equal(beyond.vx, 1);
  assert.equal(beyond.vy, 0);
});

// gate is box-sized (like reflect): cx/cy = 0, hw=50, hh=20; n from ux/uy.
const gateBody = (o: Partial<Body> = {}) => body({ hw: 50, hh: 20, ux: 1, uy: 0, ...o });

test('gate reflects a wrong-way crosser back along its heading (§20.3)', () => {
  const p = part({ x: 0, y: 0, vx: -1, vy: 0 }); // moving −x, against n = +x
  gate.apply(gateBody(), p, env());
  assert.ok(near(p.vx, 1)); // v·n was −1 → flipped to travel with n
  assert.ok(near(p.vy, 0));
});

test('gate passes right-way and tangential matter unchanged', () => {
  const along = part({ x: 0, y: 0, vx: 1, vy: 0 }); // with n
  gate.apply(gateBody(), along, env());
  assert.ok(near(along.vx, 1));
  const tangent = part({ x: 0, y: 0, vx: 0, vy: 1 }); // v·n = 0 (not < 0)
  gate.apply(gateBody(), tangent, env());
  assert.ok(near(tangent.vy, 1));
});

test('gate only acts on matter inside the element box', () => {
  const outside = part({ x: 100, y: 0, vx: -1, vy: 0 }); // |100| ≥ hw+pad
  gate.apply(gateBody(), outside, env());
  assert.equal(outside.vx, -1); // untouched
});

test('gate heading orients the membrane', () => {
  const p = part({ x: 0, y: 0, vx: 0, vy: -1 }); // against n = +y
  gate.apply(gateBody({ ux: 0, uy: 1 }), p, env());
  assert.ok(near(p.vy, 1)); // reflected to +y
});

test('buoyancy: a unit-size, cool particle is neutrally buoyant (§20.3)', () => {
  const p = part({ size: 1, heat: 0 }); // ρ_p = 1 = ρ_med
  buoyancy.apply(body({ strength: 2, range: 0 }), p, env());
  assert.equal(p.vy, 0);
});

test('buoyancy: hot/light matter rises (−y)', () => {
  const p = part({ size: 1, heat: 1 }); // ρ_p = 0.5 < ρ_med → lift
  buoyancy.apply(body({ strength: 2, range: 0 }), p, env());
  assert.ok(near(p.vy, -1)); // −(1 − 0.5)·2
});

test('buoyancy: dense matter settles (+y)', () => {
  const p = part({ size: 0.5, heat: 0 }); // ρ_p = 2 > ρ_med → sink
  buoyancy.apply(body({ strength: 2, range: 0 }), p, env());
  assert.ok(near(p.vy, 2)); // −(1 − 2)·2
});

test('buoyancy: range 0 is global, range>0 cuts off', () => {
  const global = part({ size: 1, heat: 1 });
  buoyancy.apply(body({ strength: 2, range: 0 }), global, env({ dist: 9999 }));
  assert.ok(near(global.vy, -1)); // still acts far away
  const ranged = part({ size: 1, heat: 1 });
  buoyancy.apply(body({ strength: 2, range: 100 }), ranged, env({ dist: 200 }));
  assert.equal(ranged.vy, 0); // beyond range → inert
});

// shear: flow axis +x (ux=1, uy=0); perpendicular offset is the particle's y.
test('shear drags matter forward on one side, back on the other (§20.3)', () => {
  const above = part({ x: 0, y: 100, vx: 0, vy: 0 });
  shear.apply(body({ strength: 1, range: 200 }), above, env({ dist: 100 }));
  assert.ok(near(above.vx, 0.25)); // 1·(100/200)·(1−100/200)
  assert.ok(near(above.vy, 0)); // motion stays along the flow axis
  const below = part({ x: 0, y: -100, vx: 0, vy: 0 });
  shear.apply(body({ strength: 1, range: 200 }), below, env({ dist: 100 }));
  assert.ok(near(below.vx, -0.25)); // opposite side → dragged the other way
});

test('shear is null on the flow axis and inert beyond range', () => {
  const onAxis = part({ x: 100, y: 0, vx: 0, vy: 0 }); // offset_⊥ = 0
  shear.apply(body({ strength: 1, range: 200 }), onAxis, env({ dist: 100 }));
  assert.equal(onAxis.vx, 0);
  const beyond = part({ x: 0, y: 100, vx: 0, vy: 0 });
  shear.apply(body({ strength: 1, range: 200 }), beyond, env({ dist: 250 }));
  assert.equal(beyond.vx, 0);
});

// crystallize: lattice cell 32, anchored at body centre (0,0); freezes below heat 0.5.
test('crystallize snaps cool matter toward its nearest lattice node (§20.3)', () => {
  const p = part({ x: 10, y: 0, heat: 0 }); // nearest node is 0 (round(10/32)=0)
  crystallize.apply(body({ strength: 0.1, range: 300 }), p, env({ dist: 10 }));
  assert.ok(near(p.vx, -0.9)); // (0−10)·0.1 = −1, then ×0.9 damping
  assert.ok(near(p.vy, 0));
  const q = part({ x: 30, y: 0, heat: 0 }); // nearest node is 32 (round(30/32)=1)
  crystallize.apply(body({ strength: 0.1, range: 300 }), q, env({ dist: 30 }));
  assert.ok(near(q.vx, 0.18)); // (32−30)·0.1 = 0.2, ×0.9
});

test('crystallize melts (frees) hot matter', () => {
  const p = part({ x: 10, y: 0, vx: 0.4, heat: 0.8 }); // ≥ FREEZE → free
  crystallize.apply(body({ strength: 0.1, range: 300 }), p, env({ dist: 10 }));
  assert.equal(p.vx, 0.4); // untouched
});

test('crystallize damps a settled (on-node) particle and respects range', () => {
  const settled = part({ x: 0, y: 0, vx: 1, vy: 0, heat: 0 }); // already on a node
  crystallize.apply(body({ strength: 0.1, range: 300 }), settled, env({ dist: 1 }));
  assert.ok(near(settled.vx, 0.9)); // no pull (offset 0), just the ×0.9 damping
  const beyond = part({ x: 10, y: 0, vx: 0, heat: 0 });
  crystallize.apply(body({ strength: 0.1, range: 300 }), beyond, env({ dist: 350 }));
  assert.equal(beyond.vx, 0); // beyond range → inert
});

// align: heading +x (ux=1, uy=0); k_align = strength.
test('align steers velocity toward the heading, preserving speed (§20.3)', () => {
  const p = part({ vx: 0, vy: 1 }); // moving +y, |v| = 1
  align.apply(body({ strength: 1, range: 300 }), p, env({ dist: 100 }));
  assert.ok(near(p.vx, 1)); // k=1 → v becomes ĥ·|v| = (1, 0)
  assert.ok(near(p.vy, 0));
});

test('align eases partway at k<1 and leaves an aligned particle be', () => {
  const turning = part({ vx: 0, vy: 1 });
  align.apply(body({ strength: 0.5, range: 300 }), turning, env({ dist: 100 }));
  assert.ok(near(turning.vx, 0.5)); // halfway from (0,1) toward (1,0)
  assert.ok(near(turning.vy, 0.5));
  const aligned = part({ vx: 1, vy: 0 }); // already on the heading
  align.apply(body({ strength: 0.5, range: 300 }), aligned, env({ dist: 100 }));
  assert.ok(near(aligned.vx, 1));
  assert.ok(near(aligned.vy, 0));
});

test('align is safe at zero speed and inert beyond range', () => {
  const still = part({ vx: 0, vy: 0 });
  align.apply(body({ strength: 1, range: 300 }), still, env({ dist: 100 }));
  assert.equal(still.vx, 0); // target is 0·ĥ = 0 → no NaN, no kick
  const beyond = part({ vx: 0, vy: 1 });
  align.apply(body({ strength: 1, range: 300 }), beyond, env({ dist: 350 }));
  assert.equal(beyond.vy, 1);
});

test('align [B]: steers toward the neighbour-mean heading when it has neighbours (§20.3)', () => {
  const p = part({ vx: 1, vy: 0 }); // moving +x, |v| = 1
  // two neighbours both heading +y → mean heading (0, 1); heading default (1,0) is overridden
  const neighbours: Partial<Env> = {
    neighbors: () => [part({ vx: 0, vy: 3 }), part({ vx: 0, vy: 0.5 })],
  };
  align.apply(body({ strength: 1, range: 300 }), p, env({ dist: 100, ...neighbours }));
  assert.ok(near(p.vx, 0)); // k=1 → v becomes mean-heading·|v| = (0, 1)
  assert.ok(near(p.vy, 1));
});

test('curlNoise matches its closed form and is divergence-free (§20.3)', () => {
  const s = 0.1;
  const c = curlNoise(10, 20, 0, s); // a = 1, b = 2
  assert.ok(near(c.x, -s * Math.sin(1) * Math.sin(2)));
  assert.ok(near(c.y, -s * Math.cos(1) * Math.cos(2)));
  // numerical divergence ∂vx/∂x + ∂vy/∂y ≈ 0 (central differences)
  const h = 1e-3;
  const dvx = (curlNoise(10 + h, 20, 0, s).x - curlNoise(10 - h, 20, 0, s).x) / (2 * h);
  const dvy = (curlNoise(10, 20 + h, 0, s).y - curlNoise(10, 20 - h, 0, s).y) / (2 * h);
  assert.ok(Math.abs(dvx + dvy) < 1e-6);
});

test('wind applies the curl field scaled by strength; range 0 is global (§20.3)', () => {
  const p = part({ x: 10, y: 20, vx: 0, vy: 0 });
  wind.apply(body({ strength: 100, range: 0 }), p, env({ t: 0, dist: 9999 }));
  const c = curlNoise(10, 20, 0, 0.01);
  assert.ok(near(p.vx, c.x * 100));
  assert.ok(near(p.vy, c.y * 100));
  const beyond = part({ x: 10, y: 20, vx: 0, vy: 0 });
  wind.apply(body({ strength: 100, range: 100 }), beyond, env({ t: 0, dist: 200 }));
  assert.equal(beyond.vx, 0); // ranged gust, beyond reach → inert
});

// cohesion uses env.neighbors; range r1=200 → rest r0=100. k = strength.
const withNeighbor = (n: Partial<Particle>): Partial<Env> => ({ neighbors: () => [part(n)] });

test('cohesion pushes apart inside the rest distance (pressure, §20.3)', () => {
  const p = part({ x: 0, y: 0 });
  cohesion.apply(body({ strength: 0.5, range: 200 }), p, env({ dist: 10, ...withNeighbor({ x: 50, y: 0 }) }));
  assert.ok(near(p.vx, -0.25)); // d=50<r0=100 → −k·(100−50)/100 = −0.25 along +x neighbour
});

test('cohesion pulls together beyond the rest distance (skin, §20.3)', () => {
  const p = part({ x: 0, y: 0 });
  cohesion.apply(body({ strength: 0.5, range: 200 }), p, env({ dist: 10, ...withNeighbor({ x: 150, y: 0 }) }));
  assert.ok(near(p.vx, 0.25)); // d=150 → +k·(150−100)/(200−100) = +0.25 toward neighbour
});

test('cohesion is neutral exactly at the rest distance', () => {
  const p = part({ x: 0, y: 0 });
  cohesion.apply(body({ strength: 0.5, range: 200 }), p, env({ dist: 10, ...withNeighbor({ x: 100, y: 0 }) }));
  assert.ok(near(p.vx, 0)); // d = r0 → zero on both branches
});

test('cohesion is inert beyond the body range', () => {
  const p = part({ x: 0, y: 0 });
  cohesion.apply(body({ strength: 0.5, range: 100 }), p, env({ dist: 200, ...withNeighbor({ x: 50, y: 0 }) }));
  assert.equal(p.vx, 0);
});

test('pigment stains overlapping matter with the body tint, then advects it', () => {
  // first contact: adopt the tint outright
  const fresh = part({});
  pigment.apply(body({ tint: '#ff0000', range: 100 }), fresh, env({ dist: 10 }));
  assert.equal(fresh.color, '#ff0000');
  // already carrying a colour: advect toward the tint (mix — doesn't snap)
  const carrying = part({ color: '#000000' });
  pigment.apply(body({ tint: '#ffffff', range: 100 }), carrying, env({ dist: 10 }));
  assert.notEqual(carrying.color, '#000000'); // it moved
  assert.notEqual(carrying.color, '#ffffff'); // but not all the way
});

test('pigment is inert without a tint or beyond the overlap radius', () => {
  const noTint = part({});
  pigment.apply(body({ range: 100 }), noTint, env({ dist: 10 }));
  assert.equal(noTint.color, undefined); // nothing to stain with

  const farOff = part({});
  pigment.apply(body({ tint: '#ff0000', range: 100 }), farOff, env({ dist: 90 }));
  assert.equal(farOff.color, undefined); // beyond 0.6·range = overlap radius
});
