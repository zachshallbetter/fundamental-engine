/**
 * NavGrid (#439) — obstacle-aware navigation and goal flow-fields.
 *
 * The ticket names the bug this exists to kill: *"the rabbit stuck on the wrong side of the fence"*.
 * A reactive seeker walks into the near side of a wall and stays, because from where it stands the
 * goal is that way. So the headline test is a literal fence with a literal gap, walked step by step,
 * and it fails if the walker ever enters geometry or stops short.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  navGrid, navFlowField, navFlowAt, navCellAt, navBlockedAt, navReachable,
  NAV_UNREACHABLE, NAV_CELL,
} from './nav-grid.ts';

/** Walk the flow field from a start point and report the route. */
function walk(g: ReturnType<typeof navGrid>, sx: number, sy: number, maxSteps = 400) {
  const path: Array<[number, number]> = [[sx, sy]];
  let x = sx;
  let y = sy;
  for (let i = 0; i < maxSteps; i++) {
    const d = navFlowAt(g, x, y);
    if (d.x === 0 && d.y === 0) break;
    x += d.x * (g.cell * 0.5);
    y += d.y * (g.cell * 0.5);
    path.push([x, y]);
  }
  return { path, x, y, steps: path.length - 1 };
}

test('an empty field points straight at the goal', () => {
  const g = navFlowField(navGrid(480, 480), 460, 240);
  const d = navFlowAt(g, 20, 240);
  assert.ok(d.x > 0.9 && Math.abs(d.y) < 0.2, `straight toward it: ${JSON.stringify(d)}`);
  assert.deepEqual(navFlowAt(g, 460, 240), { x: 0, y: 0 }, 'and nothing to do once there');
});

test('THE RABBIT AND THE FENCE: a wall with one gap is routed around, never through', () => {
  // A full-height fence at x≈240 with a gap at the bottom. The goal is directly to the EAST of the
  // start, so every reactive rule sends the walker into the fence. The flow field must send it
  // SOUTH first — the wrong way, locally — and it must arrive.
  const W = 480;
  const H = 480;
  const fence = [
    { x: 228, y: 0, width: 24, height: 384 }, // gap is y ∈ [384, 480)
  ];
  const g = navFlowField(navGrid(W, H, fence), 460, 60);

  const startX = 60;
  const startY = 60;
  assert.ok(navReachable(g, startX, startY), 'the goal is reachable around the fence');

  const first = navFlowAt(g, startX, startY);
  assert.ok(first.y > 0, `the first move is SOUTH, away from the goal — the whole point: ${JSON.stringify(first)}`);

  const { path, x, y, steps } = walk(g, startX, startY);
  for (const [px, py] of path)
    assert.ok(!navBlockedAt(g, px, py), `the route never enters the fence (at ${px.toFixed(0)},${py.toFixed(0)})`);
  assert.ok(x > 252, `it got past the fence: ended at x=${x.toFixed(0)}`);
  assert.ok(Math.hypot(x - 460, y - 60) < g.cell * 2, `and arrived: ${x.toFixed(0)},${y.toFixed(0)} after ${steps} steps`);
});

test('and the same walker with NO fence takes a much shorter route — the detour is real', () => {
  // Non-vacuity: without this, "it arrived" would pass on a field that ignored the obstacle.
  const open = navFlowField(navGrid(480, 480), 460, 60);
  const fenced = navFlowField(navGrid(480, 480, [{ x: 228, y: 0, width: 24, height: 384 }]), 460, 60);
  const a = walk(open, 60, 60).steps;
  const b = walk(fenced, 60, 60).steps;
  assert.ok(b > a * 1.5, `the fence forces a real detour: ${b} steps vs ${a} in the open`);
});

test('a sealed region is reported unreachable rather than left to jitter', () => {
  // A box the walker is inside, with the goal outside it. The honest answer is "you cannot get
  // there" — an agent that instead reads a garbage direction twitches, and twitching reads as a bug.
  const walls = [
    { x: 96, y: 96, width: 192, height: 24 },
    { x: 96, y: 264, width: 192, height: 24 },
    { x: 96, y: 96, width: 24, height: 192 },
    { x: 264, y: 96, width: 24, height: 192 },
  ];
  const g = navFlowField(navGrid(480, 480, walls), 440, 440);
  assert.equal(navReachable(g, 192, 192), false, 'sealed in');
  assert.deepEqual(navFlowAt(g, 192, 192), { x: 0, y: 0 }, 'so it holds still');
  assert.ok(navReachable(g, 440, 400), 'while the outside is fine');
});

test('a goal inside geometry yields no field at all, rather than a field toward nowhere', () => {
  const g = navFlowField(navGrid(480, 480, [{ x: 200, y: 200, width: 80, height: 80 }]), 240, 240);
  assert.equal(g.goal, -1, 'the goal was refused');
  assert.deepEqual(navFlowAt(g, 60, 60), { x: 0, y: 0 }, 'and nothing moves toward it');
});

test('the sweep is four-connected: no diagonal squeeze between two blocked corners', () => {
  // Two blocks meeting at a corner leave a diagonal seam. An eight-connected sweep routes through
  // it — a path that looks right on a grid and is impassable to anything with a body.
  const g = navFlowField(
    navGrid(240, 240, [
      { x: 96, y: 0, width: 24, height: 120 },   // above the seam
      { x: 120, y: 120, width: 24, height: 120 }, // below-right of it, sharing only the corner
    ]),
    220, 220,
  );
  const { path } = walk(g, 20, 20);
  for (const [px, py] of path) assert.ok(!navBlockedAt(g, px, py), `never clips geometry at ${px.toFixed(0)},${py.toFixed(0)}`);
});

test('one sweep serves every agent — the field is read, not recomputed', () => {
  // The property that makes this a flow FIELD and not a path: a thousand seekers cost one sweep.
  const g = navFlowField(navGrid(480, 480, [{ x: 228, y: 0, width: 24, height: 384 }]), 460, 60);
  const snapshot = [...g.dist];
  for (let i = 0; i < 200; i++) navFlowAt(g, 20 + (i % 400), 20 + ((i * 7) % 400));
  assert.deepEqual([...g.dist], snapshot, 'reading the field never mutates it');
});

test('geometry, bounds and degenerate input are all answered rather than thrown', () => {
  const g = navGrid(100, 100);
  assert.equal(navCellAt(g, -1, 50), -1, 'off the left edge');
  assert.equal(navCellAt(g, 50, 999), -1, 'off the bottom');
  assert.deepEqual(navFlowAt(g, 50, 50), { x: 0, y: 0 }, 'no goal set yet ⇒ no direction');
  assert.equal(navGrid(0, 0).cols >= 1, true, 'a zero viewport still yields a usable grid');
  const zeroObstacle = navGrid(100, 100, [{ x: 10, y: 10, width: 0, height: 50 }]);
  assert.equal(zeroObstacle.blocked.reduce((a, b) => a + b, 0), 0, 'a zero-width obstacle blocks nothing');
  assert.equal(navGrid(100, 100, [], 0).cell, NAV_CELL, 'a zero cell size falls back to the default');
});

test('obstacles over-block by design — a route that grazes a wall is not a route', () => {
  // An obstacle covering part of a cell blocks the whole cell. That is deliberate: an agent has a
  // body, and under-blocking produces paths that look correct and stick.
  const g = navGrid(96, 96, [{ x: 25, y: 25, width: 2, height: 2 }], 24);
  assert.equal(g.blocked[navCellAt(g, 26, 26)], 1, 'the touched cell is blocked outright');
  assert.equal(g.dist[0], NAV_UNREACHABLE, 'and nothing is swept until a goal is set');
});

test('every direction is STRICTLY downhill — following one never lands on an equal or worse cell', () => {
  // The invariant `>= here` exists for, checked across a whole grid rather than at one point.
  // Admitting level neighbours pulls the direction sideways on a plateau and an agent circles;
  // nothing else in this suite notices, because the fence route happens to survive it.
  const g = navFlowField(navGrid(480, 480, [{ x: 228, y: 0, width: 24, height: 384 }]), 460, 60);
  let checked = 0;
  for (let y = g.cell / 2; y < 480; y += g.cell) {
    for (let x = g.cell / 2; x < 480; x += g.cell) {
      const at = navCellAt(g, x, y);
      if (at < 0 || g.blocked[at] || g.dist[at] === NAV_UNREACHABLE || at === g.goal) continue;
      const d = navFlowAt(g, x, y);
      if (d.x === 0 && d.y === 0) continue;
      const nx = navCellAt(g, x + d.x * g.cell, y + d.y * g.cell);
      assert.ok(nx >= 0 && !g.blocked[nx], `the step stays on the grid and out of geometry from ${x},${y}`);
      assert.ok(
        g.dist[nx]! < g.dist[at]!,
        `strictly closer: ${x},${y} dist ${g.dist[at]} → dist ${g.dist[nx]}`,
      );
      checked++;
    }
  }
  assert.ok(checked > 100, `the sweep covered a real grid, not a handful of cells: ${checked}`);
});
