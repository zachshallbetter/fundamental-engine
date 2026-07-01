import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lintDimensionCoupling } from './governance.ts';
import { PASSPORTS } from '../contracts/passport.ts';
import type { ForcePassport } from '../contracts/passport.ts';

test('the shipped passports satisfy the dimension-coupling rule — no gaps', () => {
  const warnings = lintDimensionCoupling();
  assert.deepEqual(warnings, [], warnings.length ? `gaps: ${warnings.map((w) => `${w.subject}:${w.message}`).join(' | ')}` : 'all couplers declared');
});

test('every speed-conserving force declares couplesDimensions (wall, magnetism)', () => {
  const conservers = Object.values(PASSPORTS).filter((p) => p.movesParticles && p.conservesSpeed);
  assert.ok(conservers.length >= 2, 'at least wall + magnetism conserve speed');
  for (const p of conservers) {
    assert.ok((p.couplesDimensions?.length ?? 0) > 0, `${p.token} declares a coupling`);
  }
  assert.deepEqual(PASSPORTS.wall.couplesDimensions, ['linear']);
  assert.deepEqual(PASSPORTS.magnetism.couplesDimensions, ['linear']);
});

test('lint flags a speed-conserving force that declares no coupling', () => {
  const bad: ForcePassport = { ...PASSPORTS.wall, token: 'phantom' as never, couplesDimensions: undefined };
  const warnings = lintDimensionCoupling([bad]);
  assert.equal(warnings.length, 1);
  assert.equal(warnings[0]!.rule, 'field/no-dimension-coupling-without-passport');
  assert.equal(warnings[0]!.severity, 'error');
  assert.equal(warnings[0]!.subject, 'phantom');
});

test('lint warns on an unknown declared dimension name (non-conserving force → warning only)', () => {
  // attract does NOT conserve speed, so it needs no coupling — a stray unknown lane is just a warning.
  const typo: ForcePassport = { ...PASSPORTS.attract, token: 'typo' as never, couplesDimensions: ['lateral'] };
  const warnings = lintDimensionCoupling([typo]);
  assert.equal(warnings.length, 1);
  assert.equal(warnings[0]!.severity, 'warning');
  assert.match(warnings[0]!.message, /not a known dimension lane/);
});

test('a speed-conserving force that declares ONLY an invalid lane still errors (codex P2)', () => {
  // 'lienar' is a typo of 'linear' — declared.length is non-zero, but there is no VALID coupling, so the
  // no-coupling error must NOT be skipped (plus the unknown-lane warning).
  const typo: ForcePassport = { ...PASSPORTS.wall, token: 'typo' as never, couplesDimensions: ['lienar'] };
  const warnings = lintDimensionCoupling([typo]);
  assert.equal(warnings.length, 2, 'error (no valid coupling) + warning (unknown lane)');
  const err = warnings.find((w) => w.severity === 'error');
  assert.ok(err, 'errors: no valid coupling');
  assert.match(err!.message, /no VALID couplesDimensions/);
  assert.ok(warnings.some((w) => w.severity === 'warning' && /not a known dimension lane/.test(w.message)));
});

test('a non-conserving force without a declaration is fine (most forces couple nothing)', () => {
  const warnings = lintDimensionCoupling([PASSPORTS.attract]);
  assert.deepEqual(warnings, []);
});
