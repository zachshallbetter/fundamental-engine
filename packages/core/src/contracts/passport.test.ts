/**
 * Force-passport conformance: every registered force has a passport, and the passport's structural
 * claims (family, class, ownsField) match the live registry + the conformance catalog. This is what
 * keeps a passport from drifting away from the implementation it describes.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { allForces } from '../conformance/run.ts';
import { EXPERIMENTS } from '../conformance/experiments.ts';
import { PASSPORTS, passportFor, validatePassports } from './passport.ts';

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

test('modifiers and sources are flagged from their class', () => {
  assert.equal(passportFor('resonate')?.isModifier, true);
  assert.equal(passportFor('spotlight')?.isModifier, true);
  assert.equal(passportFor('spawn')?.isSource, true);
  assert.equal(passportFor('attract')?.isModifier, false);
  assert.equal(passportFor('attract')?.isSource, false);
});
