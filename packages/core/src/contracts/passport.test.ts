/**
 * Force-passport conformance: every registered force has a passport, and the passport's structural
 * claims (family, class, ownsField) match the live registry + the conformance catalog. This is what
 * keeps a passport from drifting away from the implementation it describes.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { allForces } from '../conformance/run.ts';
import { EXPERIMENTS } from '../conformance/experiments.ts';
import { PASSPORTS, passportFor, validatePassports, conformanceTests, TRUTH_MODES } from './passport.ts';
import { FORCE_KIND } from '../config/manual.ts';

test('every force passport is consistent with the registry and conformance catalog', () => {
  const problems = validatePassports(allForces(), EXPERIMENTS);
  assert.deepEqual(
    problems,
    [],
    `passport mismatches:\n${problems.map((p) => `  ${p.token}: ${p.issue}`).join('\n')}`,
  );
});

test('passport coverage: every registered force is documented', () => {
  const registry = allForces();
  const undocumented = Object.keys(registry).filter((t) => !passportFor(t));
  assert.deepEqual(undocumented, [], `forces without a passport: ${undocumented.join(', ')}`);
  // and no passport for a force that is not registered
  const orphan = Object.keys(PASSPORTS).filter((t) => !(t in registry));
  assert.deepEqual(orphan, [], `passports without a force: ${orphan.join(', ')}`);
});

test('FORCE_KIND "metric" forces are never passported as physical (memory is semantic)', () => {
  // memory lives in natural.ts (file grouping → passport family "natural") but it is a persistence
  // METRIC (FORCE_KIND = 'metric'), not a physical law. The metric-ness is carried by FORCE_KIND +
  // truthMode, NOT by `family`. Guard against drifting back to truthMode "physical" (see issue #227).
  const memory = passportFor('memory');
  assert.ok(memory, 'memory has a passport');
  assert.equal(FORCE_KIND['memory'], 'metric', 'memory is FORCE_KIND "metric"');
  assert.equal(memory!.truthMode, 'semantic', 'memory truthMode is "semantic", not "physical"');
  // general drift guard: no force the manual classifies as a "metric" may claim to be physical.
  const offenders = Object.keys(PASSPORTS).filter(
    (t) => FORCE_KIND[t] === 'metric' && passportFor(t)?.truthMode === 'physical',
  );
  assert.deepEqual(offenders, [], `metric-kind forces wrongly marked physical: ${offenders.join(', ')}`);
});

test('magnetism passport encodes the Lorentz facts (no work, needs charge + motion)', () => {
  const m = passportFor('magnetism');
  assert.ok(m);
  assert.equal(m.doesWork, false, 'magnetism does no work');
  assert.equal(m.conservesSpeed, true, 'magnetism preserves speed');
  assert.equal(m.requiresCharge, true);
  assert.equal(m.requiresVelocity, true, 'a still charge feels no force');
  assert.equal(m.affectsNeutralMatter, false, 'neutral matter is unaffected');
  assert.equal(m.ownsField, true, 'magnetism owns a dipole field()');
});

test('fieldflow passport encodes field-aligned transport (carries neutral matter)', () => {
  const f = passportFor('fieldflow');
  assert.ok(f);
  assert.equal(f.usesFieldAt, true, 'fieldflow reads env.fieldAt()');
  assert.equal(f.affectsNeutralMatter, true, 'fieldflow carries neutral matter (magnetism does not)');
  assert.equal(f.ownsField, false, 'fieldflow follows other forces’ fields, it owns none');
  assert.equal(f.doesWork, true);
});

test('charge requires charge and owns a field; gravity does neither-charge but affects all matter', () => {
  const c = passportFor('charge');
  const g = passportFor('gravity');
  assert.ok(c && g);
  assert.equal(c.requiresCharge, true);
  assert.equal(c.affectsNeutralMatter, false);
  assert.equal(c.ownsField, true);
  assert.equal(g.requiresCharge, false);
  assert.equal(g.affectsNeutralMatter, true);
});

test('gravity now owns a field() and can render field lines (BA1)', () => {
  const g = passportFor('gravity');
  assert.ok(g);
  assert.equal(g.ownsField, true, 'gravity owns a radial field()');
  assert.equal(g.canVisualizeFieldLines, true);
  assert.ok(g.bestRenderModes.includes('field-lines'));
});

test('natural forces are truth-mode "physical"; the 6-mode taxonomy is published', () => {
  assert.equal(passportFor('gravity')?.truthMode, 'physical');
  assert.equal(passportFor('charge')?.truthMode, 'physical');
  assert.equal(passportFor('attract')?.truthMode, 'designed');
  assert.equal(passportFor('fieldflow')?.truthMode, 'hybrid');
  for (const m of ['physical', 'designed', 'hybrid', 'diagnostic', 'poetic', 'semantic'])
    assert.ok(m in TRUTH_MODES, `${m} is a documented truth mode`);
});

test('memory is a semantic metric, not a physical natural force (kind/truth-mode coherence)', () => {
  const mem = passportFor('memory')!;
  assert.equal(mem.truthMode, 'semantic', 'memory maps meaning→metric; it is not a physical law');
  assert.notEqual(mem.truthMode, 'physical');
  assert.equal(FORCE_KIND['memory'], 'metric', 'FORCE_KIND agrees: memory is a metric');
  // drift guard: no token classified kind:'metric' may also claim to be a physical law
  for (const [token, kind] of Object.entries(FORCE_KIND)) {
    if (kind !== 'metric') continue;
    const p = passportFor(token);
    if (p) assert.notEqual(p.truthMode, 'physical', `${token} (kind=metric) must not be truthMode 'physical'`);
  }
});

test('every passport carries bestRenderModes + commonComposites; conformanceTests is derived', () => {
  for (const t of Object.keys(PASSPORTS)) {
    assert.ok(Array.isArray(passportFor(t)!.bestRenderModes) && passportFor(t)!.bestRenderModes.length > 0);
    assert.ok(Array.isArray(passportFor(t)!.commonComposites));
  }
  // conformanceTests pulls live check labels from the catalog (no drift)
  assert.ok(conformanceTests('magnetism').length >= 1);
  assert.deepEqual(conformanceTests('not-a-force'), []);
});

test('modifiers and sources are flagged from their class', () => {
  assert.equal(passportFor('resonate')?.isModifier, true);
  assert.equal(passportFor('spotlight')?.isModifier, true);
  assert.equal(passportFor('spawn')?.isSource, true);
  assert.equal(passportFor('attract')?.isModifier, false);
  assert.equal(passportFor('attract')?.isSource, false);
});
