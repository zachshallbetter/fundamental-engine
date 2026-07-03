/**
 * Physics conformance suite — the systematic "did the expected behavior occur?" pass.
 * (1) every registered force has an experiment; (2) for each experiment, the simulated
 * result satisfies every expectation. Deterministic: RNG forces are seeded.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EXPERIMENTS, COMPOSITE_EXPERIMENTS } from './experiments.ts';
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

for (const exp of [...EXPERIMENTS, ...COMPOSITE_EXPERIMENTS]) {
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

// ─── Runner determinism guard (#981: injected rng seam, no global Math.random patch) ──────────────
// A seeded scenario must reproduce EXACTLY across runs, and it must do so through the injected `Env.rng`
// seam — NOT by monkey-patching the global `Math.random`. This guards the drop of the old global patch:
// if a randomness-drawing force (e.g. thermal's Box–Muller) stopped honoring `e.rng` and fell back to the
// raw global, seeded runs would diverge (there is no longer a patch to make the global deterministic).
const thermalSeeded = {
  force: 'thermal' as const,
  label: 'seeded thermal cloud (determinism guard)',
  family: 'natural' as const,
  klass: 'A' as const,
  body: { cx: 0, cy: 0, range: 300, strength: 1 },
  particles: Array.from({ length: 40 }, () => ({ x: 40, y: 0, vx: 0, vy: 0 })),
  frames: 30,
  seed: 7,
};

test('runScenario is exactly reproducible for a seeded RNG scenario (injected rng, no global patch)', () => {
  const a = runScenario(thermalSeeded);
  const b = runScenario(thermalSeeded);
  // final frame identical to the last bit — only true if the seeded rng drove the run deterministically.
  assert.deepEqual(
    a.trajectory.at(-1),
    b.trajectory.at(-1),
    'two runs of the same seeded thermal scenario diverged — a randomness-drawing force is not honoring Env.rng',
  );
  // and the frame-0 delta (which also draws from the seam) reproduces.
  assert.deepEqual(a.applyDelta, b.applyDelta, 'seeded frame-0 apply deltas diverged across runs');
});

test('runScenario does NOT patch the global Math.random (the seam, not a monkey-patch)', () => {
  const before = Math.random;
  const captured: Array<() => number> = [];
  const spy = (): number => {
    captured.push(Math.random);
    return 0.5;
  };
  Math.random = spy;
  try {
    runScenario(thermalSeeded); // seeded → must NOT touch the global at all
    assert.equal(Math.random, spy, 'runScenario replaced the global Math.random — it must inject rng instead');
    // the seeded run must not have called the global spy: it draws from the injected seam only.
    assert.equal(captured.length, 0, 'a seeded runScenario called the global Math.random — it is not using the injected rng seam');
  } finally {
    Math.random = before;
  }
});
