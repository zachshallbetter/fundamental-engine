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
