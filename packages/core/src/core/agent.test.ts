/**
 * `FieldHandle.addAgent` — the engine-stepped agent (the creatures primitive #438). An agent lives in
 * the particle pool, so the integrator moves it and it feels the same forces the swarm feels; each
 * step its `report` fires so an external transform follows it. Pins: the engine pulls an agent toward
 * an attract well, `report` carries the live state, `maxSpeed` caps it, `readParticles` excludes
 * agents, `remove()` retires it, and a tagged body (`affects`) steers an agent selectively (#444).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createField } from './field.ts';
import type { FieldHost } from './host.ts';

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

function drivableHost(bodyEls: unknown[]): { host: FieldHost; step: (frames: number) => void } {
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
  return { host, step: (frames) => { for (let i = 0; i < frames; i++) { now += 16; cb?.(now); } } };
}

test('the engine moves an agent toward an attract well; report carries the live state', () => {
  const well = virtualBody({ 'data-body': 'attract', 'data-strength': '2', 'data-range': '900' }, { x: 500, y: 400, w: 40, h: 40 });
  const { host, step } = drivableHost([well]);
  const field = createField({} as HTMLCanvasElement, { host, render: 'none', waves: false });
  try {
    field.scan();
    let reports = 0;
    let last = { x: 0, y: 0 };
    const a = field.addAgent({ x: 120, y: 120, maxSpeed: 6, report: (p) => { reports++; last = { x: p.x, y: p.y }; } });
    const d0 = Math.hypot(120 - 500, 120 - 400);
    step(120);
    assert.ok(reports >= 100, `report fired each step: ${reports}`);
    const d1 = Math.hypot(a.particle.x - 500, a.particle.y - 400);
    assert.ok(d1 < d0, `the engine pulled the agent inward: ${d0.toFixed(0)} → ${d1.toFixed(0)}`);
    assert.ok(Math.abs(last.x - a.particle.x) < 1e-9, 'report saw the live particle');
  } finally {
    field.destroy();
  }
});

test('maxSpeed caps the agent; readParticles excludes agents; remove() retires it', () => {
  const well = virtualBody({ 'data-body': 'attract', 'data-strength': '5', 'data-range': '900' }, { x: 500, y: 400, w: 40, h: 40 });
  const { host, step } = drivableHost([well]);
  const field = createField({} as HTMLCanvasElement, { host, render: 'none', waves: false });
  try {
    field.scan();
    const swarm = field.particleCount();
    const a = field.addAgent({ x: 100, y: 400, maxSpeed: 4, report: () => {} });
    assert.equal(field.particleCount(), swarm + 1, 'agent joined the pool');

    step(60);
    const speed = Math.hypot(a.particle.vx, a.particle.vy);
    assert.ok(speed <= 4 + 1e-6, `capped at maxSpeed: ${speed.toFixed(3)}`);

    const buf = new Float32Array((swarm + 8) * 5);
    assert.equal(field.readParticles(buf), swarm, 'readParticles omits the agent');

    a.remove();
    assert.equal(field.particleCount(), swarm, 'remove() retired the agent');
  } finally {
    field.destroy();
  }
});

test('a tagged body (affects) steers an agent of its species and ignores others (#444)', () => {
  // an attract well that only acts on species 1
  const well = virtualBody({ 'data-body': 'attract', 'data-strength': '3', 'data-range': '900', 'data-affects': '1' }, { x: 500, y: 400, w: 40, h: 40 });
  const { host, step } = drivableHost([well]);
  const field = createField({} as HTMLCanvasElement, { host, render: 'none', waves: false });
  try {
    field.scan();
    const tagged = field.addAgent({ x: 120, y: 120, species: 1, maxSpeed: 6, report: () => {} });
    const plain = field.addAgent({ x: 880, y: 680, species: 0, maxSpeed: 6, report: () => {} });
    const td0 = Math.hypot(120 - 500, 120 - 400);
    const pd0 = Math.hypot(880 - 500, 680 - 400);
    step(120);
    const td1 = Math.hypot(tagged.particle.x - 500, tagged.particle.y - 400);
    const pd1 = Math.hypot(plain.particle.x - 500, plain.particle.y - 400);
    assert.ok(td1 < td0 - 20, `species-1 agent pulled in: ${td0.toFixed(0)} → ${td1.toFixed(0)}`);
    assert.ok(Math.abs(pd1 - pd0) < 20, `species-0 agent ignored by the tagged well: ${pd0.toFixed(0)} → ${pd1.toFixed(0)}`);
  } finally {
    field.destroy();
  }
});
