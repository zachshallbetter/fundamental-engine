/**
 * Lab scenario tags — the curated per-force set-ups are data, so pin (a) their shape
 * (every force exists in the catalog, ids are hash-safe and unique, exactly one default
 * per force, patched particle indices exist) and (b) their physics: every tag, applied to
 * its catalog scenario and run through the real engine, passes its effective expectation
 * list — the tag's own checks when it carries them, else the catalog's invariants (a
 * non-default tag marks the catalog's `exact` checks default-only in the Lab, so those
 * are not required here).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EXPERIMENTS, allForces, runScenario, type Scenario } from '@fundamental-engine/core';
import { LAB_SCENARIO_TAGS, applyScenarioTag, findTag, isDefaultTag, tagsFor } from './lab-scenarios.ts';

const byForce = new Map(EXPERIMENTS.map((e) => [e.scenario.force, e]));
const forces = allForces();
const entries = Object.entries(LAB_SCENARIO_TAGS);

test('every tagged force has a conformance experiment', () => {
  for (const [force] of entries) assert.ok(byForce.has(force), `${force} is not in EXPERIMENTS`);
  assert.ok(entries.length >= 10, 'the first cut covers ten forces');
});

test('ids are hash-safe and unique per force; exactly one default tag, listed first', () => {
  for (const [force, tags] of entries) {
    const ids = tags.map((t) => t.id);
    assert.equal(new Set(ids).size, ids.length, `${force}: duplicate tag ids`);
    for (const t of tags) {
      assert.match(t.id, /^[a-z0-9-]+$/, `${force}/${t.id}: id must be url-safe (it rides the share hash)`);
      assert.ok(t.label.length > 0 && t.desc.length > 0, `${force}/${t.id}: label + desc required`);
    }
    const defaults = tags.filter(isDefaultTag);
    assert.equal(defaults.length, 1, `${force}: exactly one default tag`);
    assert.ok(isDefaultTag(tags[0]!), `${force}: the default tag is listed first`);
  }
});

test('every patched particle index exists in the base scenario', () => {
  for (const [force, tags] of entries) {
    const n = byForce.get(force)!.scenario.particles.length;
    for (const t of tags)
      for (const k of Object.keys(t.patch.particles ?? {}))
        assert.ok(Number(k) >= 0 && Number(k) < n, `${force}/${t.id}: particle index ${k} out of range (${n})`);
  }
});

test('tagsFor / findTag', () => {
  assert.deepEqual(tagsFor('memory'), []);
  assert.equal(findTag('collide', 'glancing')?.label, 'glancing');
  assert.equal(findTag('collide', 'nope'), null);
  assert.equal(findTag('collide', null), null);
  assert.equal(findTag('collide', ''), null);
  assert.equal(findTag('memory', 'glancing'), null);
});

test('applyScenarioTag is pure and layers the patch over the catalog scenario', () => {
  const base = byForce.get('collide')!.scenario;
  const snapshot = JSON.stringify(base);
  const plain = applyScenarioTag(base, null);
  assert.deepEqual(plain, base);
  assert.notEqual(plain, base);
  assert.notEqual(plain.particles, base.particles);

  const tagged = applyScenarioTag(base, findTag('collide', 'glancing'));
  assert.equal(tagged.particles[1]!.y, 305);
  assert.equal(tagged.particles[1]!.x, base.particles[1]!.x, 'untouched fields carry over');
  assert.equal(tagged.particles[0]!.vx, base.particles[0]!.vx);
  assert.equal(tagged.label, 'Two discs in a glancing collision (5px impact parameter)');
  assert.equal(JSON.stringify(base), snapshot, 'the catalog scenario is never mutated');

  const far = applyScenarioTag(byForce.get('jet')!.scenario, findTag('jet', 'far-field'));
  assert.equal(far.frames, 120);
  assert.equal(far.particles[0]!.x, -200);
  assert.equal(far.seed, 3, 'the catalog seed survives when the patch has none');

  // indices beyond the base are ignored, not appended
  const bogus = applyScenarioTag(base, { id: 'x', label: 'x', desc: 'x', patch: { particles: { 7: { x: 1 } } } });
  assert.equal(bogus.particles.length, base.particles.length);
});

test('every tag passes its effective expectations on the real engine', () => {
  for (const [force, tags] of entries) {
    const exp = byForce.get(force)!;
    for (const t of tags) {
      const scenario: Scenario = applyScenarioTag(exp.scenario, isDefaultTag(t) ? null : t);
      const r = runScenario(scenario, forces);
      const own = t.expectations != null;
      const list = t.expectations ?? exp.expectations;
      for (const e of list) {
        // catalog `exact` checks pin the default geometry — the Lab marks them default-only
        // under a non-default tag, so only the invariants must hold there
        if (!own && !isDefaultTag(t) && e.kind === 'exact') continue;
        const res = e.check(r);
        assert.ok(res.pass, `${force}/${t.id}: "${e.label}" — measured ${res.measured}, expected ${res.expected}`);
      }
    }
  }
});
