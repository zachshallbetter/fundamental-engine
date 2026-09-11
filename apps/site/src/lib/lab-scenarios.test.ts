/**
 * Lab scenario tags — every curated tag is a real, working scenario. Structural checks
 * (hash-safe ids, indices that exist, one default per force) plus the empirical one: run
 * each tag through `runScenario` on the real engine and require every invariant of its
 * effective expectation list to pass, and every tag-owned check of any kind. A non-default
 * tag is allowed to fail the catalog's `exact` Δv (the Lab shows those as "default-only",
 * the same as a tuned knob), since an exact check pins one geometry.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EXPERIMENTS, allForces, runScenario, type ForceConformance } from '@fundamental-engine/core';
import { LAB_SCENARIO_TAGS, applyScenarioTag, findTag, isDefaultTag, tagsFor } from './lab-scenarios.ts';

const byForce = new Map<string, ForceConformance>();
for (const e of EXPERIMENTS) byForce.set(e.scenario.force, e);
const forces = allForces();
const entries = Object.entries(LAB_SCENARIO_TAGS);

test('every tagged force has a conformance experiment', () => {
  assert.ok(entries.length > 0);
  for (const [force] of entries) assert.ok(byForce.has(force), `${force} is not in EXPERIMENTS`);
});

test('ids are hash-safe and unique per force; at most one default tag per force', () => {
  for (const [force, tags] of entries) {
    const ids = tags.map((t) => t.id);
    assert.equal(new Set(ids).size, ids.length, `${force}: duplicate tag ids`);
    for (const t of tags) {
      assert.match(t.id, /^[a-z0-9-]+$/, `${force}/${t.id}: id must be [a-z0-9-]+ (it goes in the share hash)`);
      assert.ok(t.label.length > 0 && t.desc.length > 0, `${force}/${t.id}: label + desc required`);
    }
    assert.ok(tags.filter(isDefaultTag).length <= 1, `${force}: more than one default tag`);
  }
});

test('every particle patch index exists in the base scenario', () => {
  for (const [force, tags] of entries) {
    const base = byForce.get(force)!.scenario;
    for (const t of tags)
      for (const k of Object.keys(t.patch.particles ?? {}))
        assert.ok(base.particles[Number(k)], `${force}/${t.id}: particles[${k}] does not exist in the catalog scenario`);
  }
});

test('tagsFor / findTag / isDefaultTag', () => {
  assert.deepEqual(tagsFor('no-such-force'), []);
  assert.equal(findTag('collide', 'no-such-tag'), null);
  assert.equal(findTag('collide', null), null);
  assert.equal(findTag('collide', ''), null);
  const glancing = findTag('collide', 'glancing');
  assert.ok(glancing && !isDefaultTag(glancing));
  const headOn = findTag('collide', 'head-on');
  assert.ok(headOn && isDefaultTag(headOn));
});

test('applyScenarioTag is pure and patches only what the tag names', () => {
  const base = byForce.get('collide')!.scenario;
  const before = JSON.stringify(base);
  const same = applyScenarioTag(base, null);
  assert.notEqual(same, base);
  assert.deepEqual(same, base);
  const glancing = applyScenarioTag(base, findTag('collide', 'glancing'));
  assert.equal(JSON.stringify(base), before, 'base scenario was mutated');
  assert.equal(glancing.particles[1]!.y, 305);
  assert.equal(glancing.particles[1]!.x, base.particles[1]!.x);
  assert.deepEqual(glancing.particles[0], base.particles[0]);
  assert.equal(glancing.label, 'Two discs in a glancing collision (5px impact parameter)');
  assert.equal(glancing.frames, base.frames);
  const far = applyScenarioTag(byForce.get('jet')!.scenario, findTag('jet', 'far-field'));
  assert.equal(far.frames, 120);
  assert.equal(far.particles[0]!.x, -200);
  assert.equal(far.seed, byForce.get('jet')!.scenario.seed);
});

test('every tag produces the behaviour it names on the real engine', () => {
  let ran = 0;
  for (const [force, tags] of entries) {
    const exp = byForce.get(force)!;
    for (const t of tags) {
      const r = runScenario(applyScenarioTag(exp.scenario, t), forces);
      const list = t.expectations ?? exp.expectations;
      for (const e of list) {
        const res = e.check(r);
        // a tag-owned list must pass in full; a catalog list must pass every invariant (the
        // exact Δv pins the catalog geometry and is "default-only" in the Lab for any non-default tag)
        if (t.expectations || e.kind === 'invariant' || isDefaultTag(t))
          assert.ok(res.pass, `${force}/${t.id}: "${e.label}" failed — measured ${res.measured}, expected ${res.expected}`);
      }
      ran++;
    }
  }
  assert.ok(ran >= 20, `only ${ran} tags ran`);
});
