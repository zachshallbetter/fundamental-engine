import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FORCES, FORMATIONS, CONDITIONS, PALETTE, FORCE_BY } from './forces.config.ts';

test('the canonical catalog has the nine forces', () => {
  assert.equal(FORCES.length, 9);
});

test('five formations and seven conditions', () => {
  assert.equal(FORMATIONS.length, 5);
  assert.equal(CONDITIONS.length, 7);
});

test('the palette mirrors the force colors, in order', () => {
  assert.equal(PALETTE.length, FORCES.length);
  assert.deepEqual(
    PALETTE,
    FORCES.map((f) => f.color)
  );
});

test('FORCE_BY indexes every force by id', () => {
  for (const f of FORCES) {
    assert.equal(FORCE_BY[f.id], f);
  }
});

// ── body-token classification (the modifier contract, workover v0.3) ───────────────────

test('classifyBodyTokens splits {modifiers, forces, sources}; unknown tokens are plain forces', async () => {
  const { classifyBodyTokens } = await import('./forces.config.ts');
  const c = classifyBodyTokens(['attract', 'resonate', 'spawn', 'mystery', 'spotlight']);
  assert.deepEqual(c.modifiers, ['spotlight', 'resonate']); // sorted into contract order
  assert.deepEqual(c.forces, ['attract', 'mystery']); // authored order; unknown stays a force
  assert.deepEqual(c.sources, ['spawn']);
});

test('modifiers sort into the formalized order spotlight → screen → resonate, whatever the authoring order', async () => {
  const { classifyBodyTokens, MODIFIER_ORDER } = await import('./forces.config.ts');
  assert.deepEqual(MODIFIER_ORDER, ['spotlight', 'screen', 'resonate']);
  const c = classifyBodyTokens(['resonate', 'screen', 'spotlight']);
  assert.deepEqual(c.modifiers, ['spotlight', 'screen', 'resonate']);
});

test('the classification table agrees with the force passports (klass modifier/S)', async () => {
  const { MODIFIER_ORDER, SOURCE_TOKENS } = await import('./forces.config.ts');
  const { PASSPORTS } = await import('../contracts/passport.ts');
  const modifiers = Object.values(PASSPORTS).filter((p) => p.klass === 'modifier').map((p) => p.token).sort();
  const sources = Object.values(PASSPORTS).filter((p) => p.klass === 'S').map((p) => p.token).sort();
  assert.deepEqual([...MODIFIER_ORDER].sort(), modifiers, 'MODIFIER_ORDER must list exactly the passported modifiers');
  assert.deepEqual([...SOURCE_TOKENS].sort(), sources, 'SOURCE_TOKENS must list exactly the passported [S] sources');
});

test('the safe source defaults are the documented contract values (life 300, cap 120)', async () => {
  const { SOURCE_DEFAULT_LIFE, SOURCE_DEFAULT_CAP } = await import('./forces.config.ts');
  assert.equal(SOURCE_DEFAULT_LIFE, 300);
  assert.equal(SOURCE_DEFAULT_CAP, 120);
});
