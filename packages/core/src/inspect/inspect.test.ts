/**
 * Inspection & productization tests (Phase 8). Snapshots are deterministic and detect change; the
 * budget inspector flags over-budget counts; the system report confirms the build's coverage
 * invariants (every force passported + conformance-covered).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { captureSnapshot, compareSnapshot } from './snapshot.ts';
import { inspectBudget, withinBudget } from './budget.ts';
import { systemReport, reportText } from './report.ts';
import { EXPERIMENTS } from '../conformance/experiments.ts';
import { DEFAULT_BUDGET } from '../contracts/types.ts';

test('snapshots are deterministic and compareSnapshot detects a change', () => {
  const scenario = EXPERIMENTS[0]!.scenario; // attract
  const a = captureSnapshot(scenario);
  const b = captureSnapshot(scenario);
  assert.deepEqual(compareSnapshot(a, b), [], 'same scenario → identical snapshot');
  const drifted = { ...a, meanSpeed: a.meanSpeed + 0.5 };
  assert.ok(compareSnapshot(a, drifted).some((d) => /meanSpeed/.test(d)), 'detects a drift');
});

test('every conformance experiment produces a capturable snapshot', () => {
  for (const e of EXPERIMENTS.slice(0, 8)) {
    const s = captureSnapshot(e.scenario);
    assert.equal(s.force, e.scenario.force);
    assert.ok(Number.isFinite(s.meanSpeed));
    assert.ok(s.particleCount >= 0);
  }
});

test('budget inspector flags over-budget counts only', () => {
  const findings = inspectBudget({ particles: 900, bodies: 10, dprCap: 3 });
  const fields = findings.map((f) => f.field);
  assert.ok(fields.includes('particles'), '900 > 600');
  assert.ok(fields.includes('dprCap'), '3 > 2');
  assert.ok(!fields.includes('bodies'), '10 < 80 is fine');
  assert.equal(withinBudget({ particles: 100, bodies: 5 }), true);
  assert.equal(withinBudget({ particles: 999 }, DEFAULT_BUDGET), false);
});

test('system report proves full coverage (every force passported + conformance-covered)', () => {
  const r = systemReport();
  assert.ok(r.forces >= 34, `at least 34 forces (got ${r.forces})`);
  assert.deepEqual(r.forcesMissingPassport, [], 'every force has a passport');
  assert.deepEqual(r.forcesMissingConformance, [], 'every force has a conformance experiment');
  assert.ok(r.contracts >= 11, 'foundational + agent + visual + recipe contracts');
  assert.ok(r.recipes >= 6);
  assert.match(reportText(r), /# field-ui system report/);
  assert.match(reportText(r), /✓ none/);
});
