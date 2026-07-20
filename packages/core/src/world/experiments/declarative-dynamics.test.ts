/**
 * F1.5 — Declarative FieldDynamics experiment tests. For each force: declarative interpretation matches
 * the imperative law under tolerance, OR it is honestly classified opaque-only with a reason. The
 * experiment reaches a PARTIAL result; the IR is not expanded into JavaScript-as-data.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { FORCE_CORPUS, characterize, runExperiment, evalExpr } from './declarative-dynamics.ts';

const TOL = 1e-9;

test('F1.5 representability: each declarative force matches its imperative law at every sample', () => {
  for (const force of FORCE_CORPUS) {
    if (force.declarative === null) continue;
    const c = characterize(force, TOL);
    assert.equal(c.matchesUnderTolerance, true, `${force.id}: maxDelta ${c.maxDelta}`);
  }
});

test('F1.5 boundary: opaque forces are declarative:null with an explicit reason (IR not forced to grow)', () => {
  const opaque = FORCE_CORPUS.filter((f) => f.classification === 'opaque-only');
  assert.ok(opaque.length >= 3, 'expected multiple opaque-only forces at the boundary');
  for (const f of opaque) {
    assert.equal(f.declarative, null, `${f.id} must not be forced into the IR`);
    assert.ok(f.reason, `${f.id} must record why it is opaque`);
  }
  // the specific boundary categories
  const reasons = new Set(opaque.map((f) => f.reason));
  assert.ok(reasons.has('unsupported-input')); // nonlinear time
  assert.ok(reasons.has('hidden-mutable-state')); // closure state
  assert.ok(reasons.has('callback-dependence')); // host callback
});

test('F1.5 stateful: surfaced prior-state threads correctly (declarative-stateful)', () => {
  const stateful = FORCE_CORPUS.find((f) => f.classification === 'declarative-stateful')!;
  // acc' = accPrior + strength
  assert.equal(evalExpr(stateful.declarative!, { accPrior: 3, strength: 2 }), 5);
  const c = characterize(stateful, TOL);
  assert.equal(c.matchesUnderTolerance, true);
});

test('F1.5 outcome: partial-with-opaque-extensions; non-trivial forces are representable', () => {
  const result = runExperiment(TOL);
  assert.equal(result.outcome, 'partial-with-opaque-extensions');
  assert.ok(result.byClass['declarative-expression'] >= 5);
  assert.ok(result.byClass['opaque-only'] >= 3);
  assert.ok(result.nonTrivialDeclarative >= 4, 'not only trivial constants are representable');
});

test('F1.5 stop-condition guard: the IR/interpreter uses no eval / Function / dynamic execution escape', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const src = readFileSync(join(here, 'declarative-dynamics.ts'), 'utf8');
  assert.ok(!/\beval\s*\(/.test(src), 'no eval');
  assert.ok(!/\bnew Function\b/.test(src), 'no Function constructor');
  assert.ok(!/\bFunction\s*\(/.test(src), 'no Function() call');
});
