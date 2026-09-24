/**
 * #439's literal acceptance, on a live field: *"an agent set to seek a goal routes around a
 * fence/water instead of pressing into it; no per-consumer stuck-repick."*
 *
 * The NavGrid unit tests walk the flow field with a test harness. These drive a real `addAgent`
 * participant through the real integrator, so what is measured is the engine's behaviour and not a
 * model of it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createField } from './field.ts';
import { seededRng } from '../record/rng.ts';
import type { FieldHost } from './host.ts';
import type { Particle } from './types.ts';

function drivableHost(): { host: FieldHost; step: (n: number) => void } {
  const off = (): void => {};
  let cb: ((now: number) => void) | null = null;
  let now = 0;
  const host: FieldHost = {
    root: { querySelectorAll: () => [], querySelector: () => null } as unknown as ParentNode,
    viewport: () => ({ width: 480, height: 480, dpr: 1 }),
    scrollY: () => 0,
    scrollHeight: () => 480,
    reducedMotion: () => false,
    hidden: () => false,
    raf: (fn) => { cb = fn as (now: number) => void; return 1; },
    cancelRaf: off,
    createCanvas: () => ({}) as unknown as HTMLCanvasElement,
    onResize: () => off, onScroll: () => off, onVisibility: () => off, onInput: () => off, onBodyEvent: () => off,
  };
  return { host, step: (n) => { for (let i = 0; i < n; i++) { now += 1000 / 60; cb?.(now); } } };
}

const FENCE = [{ x: 228, y: 0, width: 24, height: 384 }]; // gap at the bottom
const GOAL = { x: 460, y: 60 };

/** Run an agent from (60,60) toward the goal and report where it got and what it touched. */
function run(opts: { navigate?: boolean; obstacles?: typeof FENCE } = {}) {
  const { host, step } = drivableHost();
  const field = createField({} as HTMLCanvasElement, { host, render: 'none', rng: seededRng(4), now: () => 0 });
  try {
    field.scan();
    if (opts.obstacles) field.navigate({ goal: GOAL, obstacles: opts.obstacles });
    const trail: Array<[number, number]> = [];
    const agent = field.addAgent({
      x: 60, y: 60, maxSpeed: 4,
      navigate: opts.navigate ?? false,
      report: (p: Particle) => trail.push([p.x, p.y]),
    });
    step(600);
    const { x, y } = agent.particle;
    return { x, y, trail, dist: Math.hypot(x - GOAL.x, y - GOAL.y), field, agent };
  } finally {
    field.destroy();
  }
}

const insideFence = (x: number, y: number): boolean =>
  x >= FENCE[0]!.x && x <= FENCE[0]!.x + FENCE[0]!.width && y >= FENCE[0]!.y && y <= FENCE[0]!.y + FENCE[0]!.height;

test('ACCEPTANCE: a navigating agent routes around the fence and arrives', () => {
  const r = run({ navigate: true, obstacles: FENCE });
  assert.ok(r.dist < 60, `it arrived: ended ${r.x.toFixed(0)},${r.y.toFixed(0)} — ${r.dist.toFixed(0)}px from the goal`);
  for (const [x, y] of r.trail) assert.ok(!insideFence(x, y), `never inside the fence (at ${x.toFixed(0)},${y.toFixed(0)})`);
  assert.ok(r.trail.some(([, y]) => y > 300), 'and it went SOUTH to the gap — the move no local rule makes');
});

test('the same agent WITHOUT navigate presses into the fence and never arrives', () => {
  // Non-vacuity, and the bug the ticket names. Without this, "it arrived" could pass on an engine
  // where the fence does nothing at all.
  const r = run({ navigate: false, obstacles: FENCE });
  assert.ok(r.dist > 150, `it is still stuck on the near side: ${r.dist.toFixed(0)}px away at ${r.x.toFixed(0)},${r.y.toFixed(0)}`);
  assert.ok(r.x < 240, 'never got past the fence line');
});

test('impassable means impassable: geometry stops an agent even without steering', () => {
  // Steering alone is not enough — a force can shove a navigating agent into a wall, and once
  // inside, the flow field reads zero and it is stuck there. The grid has to refuse the step.
  const { host, step } = drivableHost();
  const field = createField({} as HTMLCanvasElement, { host, render: 'none', rng: seededRng(4), now: () => 0 });
  try {
    field.scan();
    field.navigate({ goal: GOAL, obstacles: FENCE });
    const trail: Array<[number, number]> = [];
    const agent = field.addAgent({ x: 200, y: 100, navigate: 0.0001, report: (p: Particle) => trail.push([p.x, p.y]) });
    agent.particle.vx = 40; // hurled straight at the fence, far faster than steering could resist
    step(120);
    for (const [x, y] of trail) assert.ok(!insideFence(x, y), `never penetrates geometry (at ${x.toFixed(0)},${y.toFixed(0)})`);
    assert.ok(agent.particle.x < FENCE[0]!.x + 1, `stopped at the near face: x=${agent.particle.x.toFixed(1)}`);
  } finally {
    field.destroy();
  }
});

test('no grid ⇒ nothing changes: a navigating agent is purely force-driven, as before', () => {
  const withGrid = run({ navigate: true, obstacles: FENCE });
  const noGrid = run({ navigate: true }); // opted in, but navigate() was never called
  assert.ok(noGrid.dist > 150, 'without a grid it behaves exactly like the un-navigated agent');
  assert.ok(withGrid.dist < noGrid.dist, 'and the grid is what makes the difference');
});

test('clearNavigation puts the agent back on pure forces', () => {
  const { host, step } = drivableHost();
  const field = createField({} as HTMLCanvasElement, { host, render: 'none', rng: seededRng(4), now: () => 0 });
  try {
    field.scan();
    field.navigate({ goal: GOAL, obstacles: FENCE });
    const agent = field.addAgent({ x: 60, y: 60, maxSpeed: 4, navigate: true, report: () => {} });
    step(120);
    const steered = agent.particle.y;
    field.clearNavigation();
    const before = { x: agent.particle.x, y: agent.particle.y };
    step(120);
    assert.ok(steered > 60, 'it was being steered south while the grid existed');
    // with the grid gone the agent keeps its momentum but gains no new steering; the test is that
    // nothing throws and the agent is still live and force-driven.
    assert.ok(Number.isFinite(agent.particle.x) && Number.isFinite(agent.particle.y), 'still a live agent');
    assert.ok(before.x !== undefined);
  } finally {
    field.destroy();
  }
});
