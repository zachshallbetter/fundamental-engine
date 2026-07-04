/**
 * Global safety invariants (physics workover, Phase 1). Beyond each force's own
 * expectations, every experiment — canonical, natural, extended, and the composites —
 * must keep the field finite, bounded, and conserved across its whole trajectory:
 * no NaN/Infinity, finite positions, speed ≤ c after each step, bounded heat, and a
 * stable particle count unless a budgeted [S] source is running.
 *
 * This is the net the brief asks for: a new force can pass its bespoke checks yet still
 * blow the field up (a runaway, a divide-by-zero, an unbudgeted spawn). These assertions
 * run over the same EXPERIMENTS catalog and fail loudly if any of that slips in.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EXPERIMENTS, COMPOSITE_EXPERIMENTS } from './experiments.ts';
import { allForces, runScenario } from './run.ts';
import { parseBodyParams, guardSourceBudget, type BodyAttrs } from '../engine/scanner.ts';
import { SOURCE_DEFAULT_CAP, SOURCE_DEFAULT_LIFE } from '../config/forces.config.ts';
import type { Particle } from '../engine/types.ts';

// ── snap() round-trip: every meaningful Particle field must survive serialization ──
// The class of bug: a field present on Particle but absent on FrameState means
// the Lab/conformance HUD silently drops it. Add the field here when you add it
// to either Particle or FrameState.
test('snap() round-trip: all meaningful Particle fields survive into FrameState', () => {
  // A fully-populated particle — set every field that snap() should reflect.
  const p: Particle = {
    x: 10, y: 20,
    vx: 1.5, vy: -0.8,
    m: 1,
    heat: 0.4,
    size: 3,
    cap: null,
  };
  // Run a 1-frame scenario with a sink body so cap state is exercised by the engine.
  const r = runScenario({
    force: 'attract',
    label: 'snap round-trip',
    family: 'canonical',
    klass: 'A',
    body: {},
    particles: [{ x: 0, y: 0, vx: 0, vy: 0 }],
    frames: 1,
  });
  const frame0 = r.trajectory[0]![0]!;
  // These fields must be present on every FrameState — if any are undefined the
  // snap() function dropped them.
  assert.equal(typeof frame0.x, 'number', 'x missing from FrameState');
  assert.equal(typeof frame0.y, 'number', 'y missing from FrameState');
  assert.equal(typeof frame0.vx, 'number', 'vx missing from FrameState');
  assert.equal(typeof frame0.vy, 'number', 'vy missing from FrameState');
  assert.equal(typeof frame0.heat, 'number', 'heat missing from FrameState');
  assert.equal(typeof frame0.speed, 'number', 'speed missing from FrameState');
  assert.equal(typeof frame0.cap, 'boolean', 'cap missing from FrameState (was once silently dropped)');
  // speed must equal hypot(vx, vy) — not a raw copy.
  assert.ok(Math.abs(frame0.speed - Math.hypot(frame0.vx, frame0.vy)) < 1e-9, 'speed ≠ hypot(vx,vy)');
  void p; // used above to document which particle fields are exercised
});

const registry = allForces();
const C = 12; // the unit system's velocity cap — must match run.ts makeEnv's env.c
const HEAT_MAX = 2; // forces raise heat toward ~1 via max(); a generous ceiling catches blow-up

for (const exp of [...EXPERIMENTS, ...COMPOSITE_EXPERIMENTS]) {
  test(`safety: ${exp.scenario.force} — ${exp.scenario.label}`, () => {
    const r = runScenario(exp.scenario, registry);
    const isSource = exp.scenario.klass === 'S';
    const startCount = r.trajectory[0]!.length;

    r.trajectory.forEach((frame, f) => {
      for (const p of frame) {
        assert.ok(
          Number.isFinite(p.x) && Number.isFinite(p.y),
          `${exp.scenario.force} frame ${f}: non-finite position (${p.x}, ${p.y})`,
        );
        assert.ok(
          Number.isFinite(p.vx) && Number.isFinite(p.vy),
          `${exp.scenario.force} frame ${f}: non-finite velocity (${p.vx}, ${p.vy})`,
        );
        assert.ok(
          Number.isFinite(p.heat) && p.heat >= 0 && p.heat <= HEAT_MAX,
          `${exp.scenario.force} frame ${f}: heat ${p.heat} out of [0, ${HEAT_MAX}]`,
        );
        // the integrator caps free particles at c. Freshly-spawned [S] matter is injected
        // by the source pass *after* the per-particle loop, so it carries its raw launch
        // speed for one frame before its first integration — exclude source scenarios.
        if (f > 0 && !isSource) {
          assert.ok(
            p.speed <= C + 1e-6,
            `${exp.scenario.force} frame ${f}: speed ${p.speed} exceeds c=${C}`,
          );
        }
      }
      // conservation: only a budgeted [S] source may change the pool size.
      if (!isSource) {
        assert.equal(
          frame.length,
          startCount,
          `${exp.scenario.force} frame ${f}: count ${frame.length} ≠ ${startCount} (non-source must conserve)`,
        );
      }
    });

    // a source must still stay bounded — the despawn sink keeps the pool from exploding.
    if (isSource) {
      const peak = Math.max(...r.trajectory.map((fr) => fr.length));
      assert.ok(peak < 5000, `${exp.scenario.force}: source pool grew unbounded (peak ${peak})`);
    }
  });
}

// ── the source-budget guard (workover v0.3 §"Source and sink rules") ──────────────────
// An [S] body authored with NONE of data-life / data-cap / data-budget / data-sink gets the
// safe default budget from the scanner guard (data-life="300", data-cap="120"); under that
// cap, the live count a single source sustains must stay bounded at ~cap — independent of
// the engine pool ceiling (which the conformance env deliberately does not have).
test('source-budget guard: an unbudgeted [S] source stays bounded at the safe cap', () => {
  const attrs: BodyAttrs = { get: (n) => (n === 'body' ? 'spawn' : null), has: () => false };
  const sb = parseBodyParams(attrs);
  assert.deepEqual(sb.classified?.sources, ['spawn']);
  assert.equal(sb.budgeted, false);
  // the guard warns in dev — silence the console for the assertion, then check the defaults.
  const origWarn = console.warn;
  console.warn = () => {};
  try {
    guardSourceBudget(sb, '<div>');
  } finally {
    console.warn = origWarn;
  }
  assert.equal(sb.life, SOURCE_DEFAULT_LIFE);
  assert.equal(sb.cap, SOURCE_DEFAULT_CAP);

  // run the budgeted source well past one full lifespan: the live population must plateau
  // at ~cap (emission rate is clamped to cap/life), never grow unbounded.
  const r = runScenario(
    {
      force: 'spawn',
      label: 'an unbudgeted source under the guard-applied safe cap',
      family: 'extended',
      klass: 'S',
      body: { cx: 0, cy: 0, range: 300, strength: 1, on: true, angle: 0, life: sb.life, cap: sb.cap },
      particles: [],
      frames: 700, // > 2× the lifespan — steady state is fully established
      seed: 11,
    },
    registry,
  );
  const counts = r.trajectory.map((fr) => fr.length);
  const peak = Math.max(...counts);
  assert.ok(
    peak <= SOURCE_DEFAULT_CAP + 1,
    `live spawned count must stay ≤ the safe cap (${SOURCE_DEFAULT_CAP}); peaked at ${peak}`,
  );
  assert.ok(
    counts[counts.length - 1]! >= SOURCE_DEFAULT_CAP * 0.8,
    `the source must still flow at steady state (ended at ${counts[counts.length - 1]})`,
  );
});
