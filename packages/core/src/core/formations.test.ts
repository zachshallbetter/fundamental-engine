import { test } from 'node:test';
import assert from 'node:assert/strict';
import { easeFormation, accretionTarget } from './formations.ts';
import type { Body, Formation } from './types.ts';

const f = (o: Partial<Formation> = {}): Formation => ({
  driftX: 0,
  wander: 0,
  orbit: 0,
  spread: 0,
  conv: 0,
  ...o,
});

test('easeFormation lerps each term toward the target', () => {
  const cur = f();
  easeFormation(cur, f({ driftX: 1, wander: 1 }), 0.03);
  assert.ok(Math.abs(cur.driftX - 0.03) < 1e-9);
  assert.ok(Math.abs(cur.wander - 0.03) < 1e-9);
  assert.equal(cur.orbit, 0);
});

test('easeFormation converges over many frames', () => {
  const cur = f();
  const target = f({ orbit: 0.85 });
  for (let i = 0; i < 500; i++) easeFormation(cur, target, 0.03);
  assert.ok(Math.abs(cur.orbit - 0.85) < 1e-3);
});

test('accretionTarget returns the first visible absorb body', () => {
  const mk = (tokens: string[], vis: boolean): Body =>
    ({ tokens, vis } as unknown as Body);
  const bodies = [mk(['attract'], true), mk(['absorb', 'attract'], true), mk(['absorb'], true)];
  assert.equal(accretionTarget(bodies), bodies[1]);
  assert.equal(accretionTarget([mk(['absorb'], false)]), null);
  assert.equal(accretionTarget([mk(['attract'], true)]), null);
});
