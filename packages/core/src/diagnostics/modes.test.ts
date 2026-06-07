/**
 * The four debug/graph render modes (topology, inspector, causality, prediction). The drawing is
 * thin canvas glue verified in the browser; the pure data/geometry functions are tested here.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { topologyEdges, inspectorRows, causalityBars, ghostTrajectory } from './modes.ts';
import type { RelationshipAgent } from '../agents/relationship.ts';
import type { Body, Force, ForceRegistry } from '../core/types.ts';
import type { CausalContribution } from './probes.ts';

test('topologyEdges resolves placed agents and drops unplaced endpoints', () => {
  const agents: RelationshipAgent[] = [
    { id: 'r1', from: 'a', to: 'b', type: 'cites', strength: 0.8, tension: 0, memory: 0.5, active: true },
    { id: 'r2', from: 'a', to: 'ghost', type: 'cites', strength: 0.3, tension: 0, memory: 0.1, active: false },
  ];
  const pos: Record<string, { x: number; y: number }> = { a: { x: 0, y: 0 }, b: { x: 10, y: 10 } };
  const edges = topologyEdges(agents, (id) => pos[id]);
  assert.equal(edges.length, 1, 'the agent with an unplaced endpoint is dropped');
  assert.deepEqual(edges[0]!.from, { x: 0, y: 0 });
  assert.deepEqual(edges[0]!.to, { x: 10, y: 10 });
  assert.equal(edges[0]!.strength, 0.8);
  assert.equal(edges[0]!.active, true);
});

test('inspectorRows emits counts then metrics, formatting numbers', () => {
  const rows = inspectorRows({ bodies: 3, particles: 120, agents: 4, metrics: { coherence: 0.6666, mode: 'beautiful' } });
  assert.deepEqual(rows, [
    { label: 'bodies', value: '3' },
    { label: 'particles', value: '120' },
    { label: 'agents', value: '4' },
    { label: 'coherence', value: '0.667' },
    { label: 'mode', value: 'beautiful' },
  ]);
  assert.deepEqual(inspectorRows({}), [], 'empty snapshot → no rows');
});

test('causalityBars rank by magnitude desc with fractions summing to 1', () => {
  const contribs: CausalContribution[] = [
    { token: 'gravity', dvx: 3, dvy: 4 }, // |5|
    { token: 'drag', dvx: 0, dvy: 0 }, // |0|
    { token: 'wind', dvx: 5, dvy: 0 }, // |5|
  ];
  const bars = causalityBars(contribs);
  assert.equal(bars[0]!.magnitude, 5);
  assert.equal(bars[bars.length - 1]!.token, 'drag', 'zero contribution sinks to the bottom');
  const sum = bars.reduce((s, b) => s + b.fraction, 0);
  assert.ok(Math.abs(sum - 1) < 1e-9, 'fractions sum to 1');
});

test('causalityBars with all-zero contributions does not divide by zero', () => {
  const bars = causalityBars([{ token: 'a', dvx: 0, dvy: 0 }]);
  assert.equal(bars[0]!.fraction, 0);
});

test('ghostTrajectory is deterministic and pulls toward an attractor', () => {
  // a single attractor at (100,0): a probe to its left should drift right (toward it).
  const attract: Force = {
    apply(b: Body, p) {
      const dx = b.cx - p.x;
      const dy = b.cy - p.y;
      const d = Math.max(Math.hypot(dx, dy), 1);
      p.vx += dx / d; // unit pull toward the body
      p.vy += dy / d;
    },
  } as unknown as Force;
  const forces: ForceRegistry = { attract } as unknown as ForceRegistry;
  const body = { cx: 100, cy: 0 } as unknown as Body;
  const start = { x: 0, y: 0, vx: 0, vy: 0 };
  const a = ghostTrajectory(forces, ['attract'], [body], start, { steps: 20 });
  const b = ghostTrajectory(forces, ['attract'], [body], start, { steps: 20 });
  assert.equal(a.length, 21, 'steps + 1 points');
  assert.deepEqual(a, b, 'same inputs → identical path (deterministic)');
  assert.ok(a[a.length - 1]!.x > a[0]!.x, 'drifts toward the attractor on the right');
  assert.ok(a[1]!.x > 0 && a[1]!.x < a[2]!.x, 'accelerates from rest toward the body');
});

test('ghostTrajectory with no matching tokens coasts on initial velocity', () => {
  const forces: ForceRegistry = {} as unknown as ForceRegistry;
  const path = ghostTrajectory(forces, ['nope'], [], { x: 0, y: 0, vx: 2, vy: 0 }, { steps: 3, friction: 1 });
  assert.deepEqual(
    path.map((p) => p.x),
    [0, 2, 4, 6],
    'no force → constant-velocity coast (friction 1)',
  );
});
