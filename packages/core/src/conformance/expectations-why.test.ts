/**
 * Every expectation in the catalog carries a plain-words `why` — what the check proves and
 * why it matters. The Lab's per-check "why" expansion reads it (#697), so a check without
 * one would render an empty explanation. This is the drift guard: a future builder or
 * inline `check(...)` cannot ship without its sentence.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EXPERIMENTS, COMPOSITE_EXPERIMENTS } from './experiments.ts';

const all = [...EXPERIMENTS, ...COMPOSITE_EXPERIMENTS];

test('every catalog expectation carries a plain-words why', () => {
  let n = 0;
  for (const exp of all)
    for (const e of exp.expectations) {
      n++;
      const at = `${exp.scenario.force} › ${e.label}`;
      assert.equal(typeof e.why, 'string', `${at}: why is not a string`);
      const why = e.why!.trim();
      assert.ok(why.length >= 20, `${at}: why is too short to explain anything ("${why}")`);
      assert.notEqual(why, e.label, `${at}: why merely repeats the label`);
    }
  // the catalog is one experiment per force plus the composites — a sanity floor, not a pin
  assert.ok(n >= 60, `expected the catalog to carry dozens of checks, saw ${n}`);
});
