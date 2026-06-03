import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MANUAL_FORCES, MANUAL_PRESETS } from './manual.ts';
import { coreForces } from '../forces/index.ts';
import { naturalForces } from '../forces/natural.ts';
import { extendedForces } from '../forces/extended.ts';
import { PRESETS } from './presets.ts';

test('the manual defines exactly the registered forces (no drift)', () => {
  const registered = [...coreForces, ...naturalForces, ...extendedForces].map((f) => f.token).sort();
  const documented = MANUAL_FORCES.map((e) => e.token).sort();
  assert.deepEqual(documented, registered);
});

test('every manual entry is complete (formula + description)', () => {
  for (const e of MANUAL_FORCES) {
    assert.ok(e.formula.length > 0, `${e.token}: missing formula`);
    assert.ok(e.desc.length > 0, `${e.token}: missing description`);
    assert.ok(e.label.length > 0, `${e.token}: missing label`);
  }
});

test('manual force families partition the catalog', () => {
  const families = new Set(MANUAL_FORCES.map((e) => e.family));
  assert.deepEqual([...families].sort(), ['canonical', 'extended', 'natural']);
  assert.equal(MANUAL_FORCES.filter((e) => e.family === 'canonical').length, 9);
});

test('the manual documents exactly the registered presets', () => {
  const documented = MANUAL_PRESETS.map((p) => p.name).sort();
  assert.deepEqual(documented, Object.keys(PRESETS).sort());
});

test('every preset composes only documented force tokens', () => {
  const known = new Set(MANUAL_FORCES.map((e) => e.token));
  for (const p of MANUAL_PRESETS) {
    for (const tok of p.tokens) assert.ok(known.has(tok), `${p.name}: unknown token ${tok}`);
  }
});
