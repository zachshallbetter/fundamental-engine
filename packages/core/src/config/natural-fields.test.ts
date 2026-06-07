/**
 * Natural Field Translation System — the classification must cover the whole catalog and stay
 * consistent, so the manual cards / Lab badges / docs that read it can't drift from the engine.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MANUAL_FORCES, FORCE_KIND, FORCE_FIELD, NATURAL_FIELDS, classifyForce } from './manual.ts';

const TOKENS = MANUAL_FORCES.map((f) => f.token);

test('FORCE_KIND classifies every force token, and only real tokens', () => {
  for (const t of TOKENS) assert.ok(FORCE_KIND[t], `${t} has a kind`);
  for (const t of Object.keys(FORCE_KIND)) assert.ok(TOKENS.includes(t), `FORCE_KIND token ${t} is a real force`);
});

test('FORCE_FIELD parents are a subset of tokens and use the four fields', () => {
  const fields = new Set(['gravity', 'electromagnetic', 'strong', 'weak']);
  for (const [t, f] of Object.entries(FORCE_FIELD)) {
    assert.ok(TOKENS.includes(t), `${t} is a real force`);
    assert.ok(fields.has(f), `${t} → ${f} is one of the four fields`);
  }
});

test('canonical forces are designed verbs (not natural translations)', () => {
  for (const f of MANUAL_FORCES.filter((m) => m.family === 'canonical')) {
    assert.equal(FORCE_KIND[f.token], 'designed', `${f.token} is a designed verb`);
    assert.equal(FORCE_FIELD[f.token], undefined, `${f.token} has no fundamental parent (attract is not gravity)`);
  }
});

test('the marquee translations are classified as the brief specifies', () => {
  assert.deepEqual(classifyForce('gravity'), { kind: 'primitive', field: 'gravity' });
  assert.deepEqual(classifyForce('charge'), { kind: 'primitive', field: 'electromagnetic' });
  assert.deepEqual(classifyForce('magnetism'), { kind: 'primitive', field: 'electromagnetic' });
  assert.deepEqual(classifyForce('cohesion'), { kind: 'analogue', field: 'strong' });
  assert.deepEqual(classifyForce('morph'), { kind: 'analogue', field: 'weak' });
  assert.equal(classifyForce('fieldflow').kind, 'transport');
  assert.equal(classifyForce('memory').kind, 'metric');
  assert.equal(classifyForce('thermal').kind, 'derived');
  assert.equal(classifyForce('attract').field, undefined);
});

test('NATURAL_FIELDS is the four fields, each deriving its expressions from FORCE_FIELD', () => {
  assert.deepEqual(NATURAL_FIELDS.map((f) => f.field), ['gravity', 'electromagnetic', 'strong', 'weak']);
  for (const nf of NATURAL_FIELDS) {
    const expected = Object.keys(FORCE_FIELD).filter((t) => FORCE_FIELD[t] === nf.field).sort();
    assert.deepEqual([...nf.expressions].sort(), expected, `${nf.field} expressions match FORCE_FIELD`);
  }
  // gravity + electromagnetic + strong have shipped expressions; weak has its one analogue (morph)
  assert.ok(NATURAL_FIELDS.find((f) => f.field === 'electromagnetic')!.expressions.includes('magnetism'));
  assert.deepEqual(NATURAL_FIELDS.find((f) => f.field === 'weak')!.expressions, ['morph']);
});
