/**
 * createRegistry API — the force/condition registry (§4).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRegistry } from './registry.ts';
import { registerCoreForces, coreForces } from '../forces/index.ts';
import { registerNaturalForces, naturalForces } from '../forces/natural.ts';
import { registerExtendedForces, extendedForces } from '../forces/extended.ts';
import { allForces } from '../conformance/run.ts';
import type { Particle, Body, Env } from './types.ts';

test('createRegistry() starts empty (no forces, built-in conditions only)', () => {
  const reg = createRegistry();
  assert.equal(Object.keys(reg.forces).length, 0);
  // built-in conditions are pre-seeded (active, fast, slow, hot, cool, …)
  assert.ok(Object.keys(reg.conditions).length > 0);
});

test('reg.force() registers by token and is immediately accessible', () => {
  const reg = createRegistry();
  const noop = () => {};
  reg.force({ token: 'myforce', label: 'My', apply: noop, meta: { desc: 'test' } });
  assert.equal(typeof reg.forces['myforce'], 'object');
  assert.equal(reg.forces['myforce']?.token, 'myforce');
});

test('registering the same token twice overwrites the first', () => {
  const reg = createRegistry();
  const v1 = { token: 'dup', label: 'V1', apply: () => {}, meta: { desc: 'v1' } };
  const v2 = { token: 'dup', label: 'V2', apply: () => {}, meta: { desc: 'v2' } };
  reg.force(v1);
  reg.force(v2);
  assert.equal(reg.forces['dup']?.label, 'V2');
});

test('reg.condition() registers a custom condition callable by id', () => {
  const reg = createRegistry();
  reg.condition('mygate', (p: Particle, _b: Body, _e: Env) => p.heat > 0.5);
  assert.equal(typeof reg.conditions['mygate'], 'function');
  // a hot particle passes, a cool one does not
  const hot = { heat: 0.9 } as Particle;
  const cool = { heat: 0.1 } as Particle;
  const stub = {} as Body;
  const env = {} as Env;
  assert.ok(reg.conditions['mygate']!(hot, stub, env));
  assert.ok(!reg.conditions['mygate']!(cool, stub, env));
});

test('registerCoreForces() installs all 9 canonical forces', () => {
  const reg = createRegistry();
  registerCoreForces(reg);
  assert.equal(Object.keys(reg.forces).length, coreForces.length);
  for (const f of coreForces) {
    assert.ok(reg.forces[f.token], `missing: ${f.token}`);
  }
});

test('registerNaturalForces() installs all 8 natural primitives', () => {
  const reg = createRegistry();
  registerNaturalForces(reg);
  assert.equal(Object.keys(reg.forces).length, naturalForces.length);
  for (const f of naturalForces) {
    assert.ok(reg.forces[f.token], `missing: ${f.token}`);
  }
});

test('registerExtendedForces() installs all designed-extended forces', () => {
  const reg = createRegistry();
  registerExtendedForces(reg);
  assert.equal(Object.keys(reg.forces).length, extendedForces.length);
  for (const f of extendedForces) {
    assert.ok(reg.forces[f.token], `missing: ${f.token}`);
  }
});

test('allForces() covers all 36 forces (9 canonical + 8 natural + 19 extended)', () => {
  const forces = allForces();
  const tokens = Object.keys(forces);
  assert.equal(tokens.length, coreForces.length + naturalForces.length + extendedForces.length);
  // each force has an apply function
  for (const [tok, f] of Object.entries(forces)) {
    assert.equal(typeof f.apply, 'function', `${tok}.apply is not a function`);
    assert.equal(typeof f.token, 'string', `${tok}.token missing`);
  }
});

test('each registered force has the required shape (token, label, apply, meta)', () => {
  const all = allForces();
  for (const [tok, f] of Object.entries(all)) {
    assert.equal(f.token, tok, `token mismatch: ${f.token} !== ${tok}`);
    assert.equal(typeof f.label, 'string', `${tok}: label missing`);
    assert.equal(typeof f.apply, 'function', `${tok}: apply missing`);
    assert.equal(typeof f.meta?.desc, 'string', `${tok}: meta.desc missing`);
  }
});
