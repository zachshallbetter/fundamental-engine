/**
 * Physics conformance suite — the systematic "did the expected behavior occur?" pass.
 * (1) every registered force has an experiment; (2) for each experiment, the simulated
 * result satisfies every expectation. Deterministic: RNG forces are seeded.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EXPERIMENTS } from './experiments.ts';
import { allForces, runScenario } from './run.ts';

const registry = allForces();

test('every registered force has a conformance experiment', () => {
  const covered = new Set(EXPERIMENTS.map((e) => e.scenario.force));
  const missing = Object.keys(registry).filter((t) => !covered.has(t));
  assert.deepEqual(missing, [], `forces without an experiment: ${missing.join(', ')}`);
});

test('no experiment names an unregistered force', () => {
  const unknown = EXPERIMENTS.map((e) => e.scenario.force).filter((t) => !registry[t]);
  assert.deepEqual(unknown, [], `experiments for unknown forces: ${unknown.join(', ')}`);
});

for (const exp of EXPERIMENTS) {
  test(`${exp.scenario.force}: ${exp.scenario.label}`, () => {
    const result = runScenario(exp.scenario, registry);
    assert.ok(exp.expectations.length > 0, `${exp.scenario.force} has no expectations`);
    for (const e of exp.expectations) {
      const r = e.check(result);
      assert.ok(
        r.pass,
        `[${exp.scenario.force}] ${e.label} — measured ${r.measured}, expected ${r.expected}`,
      );
    }
  });
}
