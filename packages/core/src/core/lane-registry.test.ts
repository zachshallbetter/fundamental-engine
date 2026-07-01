import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LANE_WORDS, laneOf, lintWordLanes, type WordLane } from './lane-registry.ts';
import { PASSPORTS } from '../contracts/passport.ts';

test('the registry indexes the shipped catalogs by lane', () => {
  assert.equal(LANE_WORDS.force.length, Object.keys(PASSPORTS).length, 'every force token is in the force lane');
  assert.ok(LANE_WORDS.force.includes('attract'));
  assert.ok(LANE_WORDS.formation.includes('wells'));
  assert.ok(LANE_WORDS.condition.includes('scrolling'));
  assert.ok(!LANE_WORDS.condition.includes(''), '"Always" (empty id) is not a keyword');
  assert.ok(LANE_WORDS.visualization.includes('dots'));
  assert.ok(LANE_WORDS.visualization.includes('causality'));
});

test('laneOf resolves a word to its lane, undefined for unknown words', () => {
  assert.equal(laneOf('attract'), 'force');
  assert.equal(laneOf('wells'), 'formation');
  assert.equal(laneOf('hot'), 'condition');
  assert.equal(laneOf('streamlines'), 'visualization');
  assert.equal(laneOf('not-a-word'), undefined);
});

test('the shipped vocabulary keeps its lanes separate — no word lives in two lanes', () => {
  const warnings = lintWordLanes();
  assert.deepEqual(warnings, [], warnings.length ? `collisions: ${warnings.map((w) => w.subject).join(', ')}` : 'lane separation holds');
});

test('lintWordLanes reports a collision when a word is in two lanes (guards future drift)', () => {
  const drifted: Record<WordLane, readonly string[]> = {
    force: ['attract', 'overlap'],
    formation: ['wells', 'overlap'], // a hypothetical future formation colliding with a force token
    condition: ['hot'],
    visualization: ['dots'],
  };
  const warnings = lintWordLanes(drifted);
  assert.equal(warnings.length, 1);
  assert.equal(warnings[0]!.rule, 'field/no-word-in-two-lanes');
  assert.equal(warnings[0]!.severity, 'error');
  assert.equal(warnings[0]!.subject, 'overlap');
  assert.match(warnings[0]!.message, /force/);
  assert.match(warnings[0]!.message, /formation/);
});
