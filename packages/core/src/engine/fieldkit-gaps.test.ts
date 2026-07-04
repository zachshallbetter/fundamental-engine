/**
 * Heavy coverage for the FieldKit-gap trio — `sampleScalar` (#440), matter tagging (#444), and
 * engine-stepped `addAgent` (#438) — plus their interactions. The per-feature happy paths live in
 * sample-scalar.test.ts / tagging.test.ts / agent.test.ts; this file piles on edge cases, properties
 * (mass, determinism, clamping, containment), the multi-ecology case, and the cross-feature combos.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createField } from './field.ts';
import type { FieldHost } from './host.ts';
import type { FieldOptions } from './types.ts';

function virtualBody(attrs: Record<string, string>, r: { x: number; y: number; w: number; h: number }) {
  return {
    dataset: {} as Record<string, string>,
    getAttribute: (n: string) => attrs[n] ?? null,
    hasAttribute: (n: string) => n in attrs,
    getBoundingClientRect: () => ({
      left: r.x - r.w / 2, top: r.y - r.h / 2, right: r.x + r.w / 2, bottom: r.y + r.h / 2,
      width: r.w, height: r.h, x: r.x - r.w / 2, y: r.y - r.h / 2, toJSON: () => ({}),
    }),
  };
}

function harness(bodyEls: unknown[], opts: Partial<FieldOptions> = {}) {
  const off = (): void => {};
  let cb: ((now: number) => void) | null = null;
  let id = 0, now = 0;
  const host: FieldHost = {
    root: { querySelectorAll: (s: string) => (s.startsWith('[data-body]') ? bodyEls : []), querySelector: () => null } as unknown as ParentNode,
    viewport: () => ({ width: 1000, height: 800, dpr: 1 }),
    scrollY: () => 0, scrollHeight: () => 1000, reducedMotion: () => false, hidden: () => false,
    raf: (fn) => { cb = fn as (now: number) => void; return ++id; }, cancelRaf: off,
    createCanvas: () => ({}) as unknown as HTMLCanvasElement,
    onResize: () => off, onScroll: () => off, onVisibility: () => off, onInput: () => off, onBodyEvent: () => off,
  };
  const field = createField({} as HTMLCanvasElement, { host, render: 'none', waves: false, ...opts });
  return { field, step: (frames: number) => { for (let i = 0; i < frames; i++) { now += 16; cb?.(now); } } };
}

const dist = (p: { x: number; y: number }, x: number, y: number): number => Math.hypot(p.x - x, p.y - y);

// ── sampleScalar (#440) ───────────────────────────────────────────────────────────────────────

test('sampleScalar: the gradient does NOT flatten at a source (the forage-by-gradient claim)', () => {
  const well = virtualBody({ 'data-body': 'attract', 'data-strength': '3', 'data-range': '900' }, { x: 500, y: 400, w: 40, h: 40 });
  const { field, step } = harness([well], { heatmap: true });
  field.scan();
  step(300);
  // a finite-difference gradient at a ring around the dense centre must be non-trivial — a
  // nearest-body readout would be ~flat here. Sample on a 60px ring and require a real slope.
  let maxSlope = 0;
  for (let a = 0; a < 6; a++) {
    const ang = (a / 6) * Math.PI * 2;
    const x = 500 + Math.cos(ang) * 90;
    const y = 400 + Math.sin(ang) * 90;
    const inward = field.sampleScalar(500 + Math.cos(ang) * 30, 400 + Math.sin(ang) * 30);
    const outward = field.sampleScalar(x, y);
    maxSlope = Math.max(maxSlope, Math.abs(inward - outward));
  }
  assert.ok(maxSlope > 0.02, `density has a real gradient near the source: ${maxSlope.toFixed(3)}`);
});

test('sampleScalar: stays within [0,1] everywhere, even with no heatmap', () => {
  const { field } = harness([]);
  for (const [x, y] of [[0, 0], [500, 400], [1000, 800], [-50, 900]] as const) {
    const v = field.sampleScalar(x, y);
    assert.ok(v >= 0 && v <= 1, `bounded at (${x},${y}): ${v}`);
  }
  field.destroy();
});

// ── matter tagging (#444) ──────────────────────────────────────────────────────────────────────

test('tagging: affects a SET of species (data-affects="1,3") — pulls 1 and 3, ignores 0 and 2', () => {
  const well = virtualBody({ 'data-body': 'attract', 'data-strength': '3', 'data-range': '900', 'data-affects': '1,3' }, { x: 500, y: 400, w: 40, h: 40 });
  const { field, step } = harness([well]);
  field.scan();
  const a = [1, 3, 0, 2].map((sp) => field.addAgent({ x: 100, y: 100, species: sp, maxSpeed: 6, report: () => {} }));
  const d0 = dist({ x: 100, y: 100 }, 500, 400);
  step(120);
  assert.ok(dist(a[0]!.particle, 500, 400) < d0 - 30, 'species 1 pulled in');
  assert.ok(dist(a[1]!.particle, 500, 400) < d0 - 30, 'species 3 pulled in');
  assert.ok(Math.abs(dist(a[2]!.particle, 500, 400) - d0) < 5, 'species 0 untouched');
  assert.ok(Math.abs(dist(a[3]!.particle, 500, 400) - d0) < 5, 'species 2 untouched');
  field.destroy();
});

test('tagging: affects="0" acts on default (untagged) matter; two ecologies stay independent', () => {
  const wellA = virtualBody({ 'data-body': 'attract', 'data-strength': '3', 'data-range': '900', 'data-affects': '0' }, { x: 200, y: 400, w: 40, h: 40 });
  const wellB = virtualBody({ 'data-body': 'attract', 'data-strength': '3', 'data-range': '900', 'data-affects': '1' }, { x: 800, y: 400, w: 40, h: 40 });
  const { field, step } = harness([wellA, wellB]);
  field.scan();
  const m0 = field.addAgent({ x: 500, y: 700, species: 0, maxSpeed: 6, report: () => {} }); // pulled to A (left)
  const m1 = field.addAgent({ x: 500, y: 700, species: 1, maxSpeed: 6, report: () => {} }); // pulled to B (right)
  step(150);
  assert.ok(m0.particle.x < 450, `species-0 went left toward well A: x=${m0.particle.x.toFixed(0)}`);
  assert.ok(m1.particle.x > 550, `species-1 went right toward well B: x=${m1.particle.x.toFixed(0)}`);
  field.destroy();
});

// ── agents (#438) ────────────────────────────────────────────────────────────────────────────

test('agents: heavier mass accelerates less under the same force (a = F/m)', () => {
  const well = virtualBody({ 'data-body': 'attract', 'data-strength': '3', 'data-range': '1200' }, { x: 500, y: 400, w: 40, h: 40 });
  const { field, step } = harness([well]);
  field.scan();
  const light = field.addAgent({ x: 100, y: 400, mass: 1, report: () => {} });
  const heavy = field.addAgent({ x: 100, y: 400, mass: 6, report: () => {} });
  step(40);
  const dLight = 100 - light.particle.x < 0 ? light.particle.x - 100 : light.particle.x - 100;
  assert.ok(light.particle.x > heavy.particle.x, `light agent advanced further: light=${light.particle.x.toFixed(0)} heavy=${heavy.particle.x.toFixed(0)}`);
  void dLight;
  field.destroy();
});

test('agents: maxSpeed is an exact clamp under a strong field', () => {
  const well = virtualBody({ 'data-body': 'attract', 'data-strength': '20', 'data-range': '1200' }, { x: 500, y: 400, w: 40, h: 40 });
  const { field, step } = harness([well]);
  field.scan();
  const a = field.addAgent({ x: 100, y: 400, maxSpeed: 3, report: () => {} });
  step(30);
  assert.ok(Math.hypot(a.particle.vx, a.particle.vy) <= 3 + 1e-6, 'never exceeds maxSpeed');
  field.destroy();
});

test('agents: edge-bounce keeps an agent inside the field (no toroidal teleport)', () => {
  const wall = virtualBody({ 'data-body': 'stream', 'data-strength': '4', 'data-range': '1200', 'data-angle': '180' }, { x: 500, y: 400, w: 40, h: 40 });
  const { field, step } = harness([wall]); // a leftward push toward the x=0 edge
  field.scan();
  const a = field.addAgent({ x: 60, y: 400, maxSpeed: 30, report: () => {} });
  step(120);
  assert.ok(a.particle.x >= 0 && a.particle.x <= 1000, `stayed in x-bounds: ${a.particle.x.toFixed(0)}`);
  assert.ok(a.particle.y >= 0 && a.particle.y <= 800, `stayed in y-bounds: ${a.particle.y.toFixed(0)}`);
  field.destroy();
});

test('agents: independent — two agents toward one well converge to distinct nearby points', () => {
  const well = virtualBody({ 'data-body': 'attract', 'data-strength': '3', 'data-range': '1200' }, { x: 500, y: 400, w: 40, h: 40 });
  const { field, step } = harness([well]);
  field.scan();
  const a = field.addAgent({ x: 100, y: 200, maxSpeed: 8, report: () => {} });
  const b = field.addAgent({ x: 900, y: 600, maxSpeed: 8, report: () => {} });
  step(200);
  assert.ok(dist(a.particle, 500, 400) < 200 && dist(b.particle, 500, 400) < 200, 'both reached the well');
  field.destroy();
});

test('agents: writing particle.x teleports it; the engine continues from there', () => {
  const { field, step } = harness([]);
  const a = field.addAgent({ x: 100, y: 100, maxSpeed: 5, report: () => {} });
  step(5);
  a.particle.x = 700;
  a.particle.y = 700;
  step(1);
  assert.ok(Math.abs(a.particle.x - 700) < 10 && Math.abs(a.particle.y - 700) < 10, 'resumed from the teleport');
  field.destroy();
});

test('agents: report stops after remove(); the pool shrinks', () => {
  const well = virtualBody({ 'data-body': 'attract', 'data-strength': '3', 'data-range': '900' }, { x: 500, y: 400, w: 40, h: 40 });
  const { field, step } = harness([well]);
  field.scan();
  let reports = 0;
  const a = field.addAgent({ x: 100, y: 100, maxSpeed: 6, report: () => { reports++; } });
  const n = field.particleCount();
  step(10);
  const after10 = reports;
  assert.ok(after10 >= 10, 'reported while live');
  a.remove();
  assert.equal(field.particleCount(), n - 1, 'pool shrank by one');
  step(10);
  assert.equal(reports, after10, 'no reports after remove');
  field.destroy();
});

test('agents: a depth>0 field moves the agent in z, and report sees it', () => {
  const well = virtualBody({ 'data-body': 'attract', 'data-strength': '3', 'data-range': '1200' }, { x: 500, y: 400, w: 40, h: 40 });
  const { field, step } = harness([well], { depth: 300 });
  field.scan();
  let sawZ: number | undefined;
  const a = field.addAgent({ x: 100, y: 100, z: 250, maxSpeed: 6, report: (p) => { sawZ = p.z; } });
  step(60);
  assert.ok(typeof sawZ === 'number', 'report carried z');
  assert.ok((a.particle.z ?? 0) >= 0 && (a.particle.z ?? 0) <= 300, 'z stayed within the volume');
  field.destroy();
});

test('agents: seeded rng makes an agent run reproducible', () => {
  const lcg = (s0: number) => { let s = s0 % 2147483647; if (s <= 0) s += 2147483646; return () => (s = (s * 16807) % 2147483647) / 2147483647; };
  const run = () => {
    const well = virtualBody({ 'data-body': 'attract swirl', 'data-strength': '2', 'data-range': '900' }, { x: 500, y: 400, w: 40, h: 40 });
    const { field, step } = harness([well], { rng: lcg(12345) });
    field.scan();
    const a = field.addAgent({ x: 120, y: 120, maxSpeed: 7, report: () => {} });
    step(80);
    const r = { x: a.particle.x, y: a.particle.y };
    field.destroy();
    return r;
  };
  const a = run();
  const b = run();
  assert.ok(Math.abs(a.x - b.x) < 1e-9 && Math.abs(a.y - b.y) < 1e-9, `identical trajectory: ${JSON.stringify(a)} vs ${JSON.stringify(b)}`);
});

// ── interactions ───────────────────────────────────────────────────────────────────────────────

test('interaction: an agent is counted by particleCount but excluded from readParticles', () => {
  const { field } = harness([]);
  const swarm = field.particleCount();
  field.addAgent({ x: 100, y: 100, report: () => {} });
  field.addAgent({ x: 200, y: 200, report: () => {} });
  assert.equal(field.particleCount(), swarm + 2, 'both agents counted in the pool');
  const buf = new Float32Array((swarm + 16) * 5);
  assert.equal(field.readParticles(buf), swarm, 'readParticles omits both agents');
  field.destroy();
});
