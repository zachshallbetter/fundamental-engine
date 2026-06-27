import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lintPlatform, registerLintRule, type LintRule } from './lint.ts';

/** Minimal PlatformLike stub that satisfies lintPlatform without a real DOM. */
function makePlatform() {
  const fakeRoot = { querySelectorAll: () => [], querySelector: () => null } as unknown as ParentNode & Element;
  return {
    root: fakeRoot,
    measure: { has: () => false, elements: () => [] },
    state: { elements: () => [] },
    feedback: { boundVars: () => [], feedbackActivity: () => [] },
    relationships: { size: 0 },
    visuals: { lint: () => [] },
    overlays: { all: () => [] },
    scheduler: { violations: () => [] },
  } as any;
}

test('lintPlatform accepts and runs inline rules', () => {
  const fired: string[] = [];
  const rule: LintRule = {
    id: 'test-inline',
    run: (_root, warnings) => {
      fired.push('inline');
      warnings.push({ code: 'feedback-var-unused' as any, severity: 'warning', message: 'custom inline rule', element: null! });
    },
  };
  const warns = lintPlatform(makePlatform(), { rules: [rule] });
  assert.ok(fired.includes('inline'), 'inline rule ran');
  assert.ok(warns.some(w => w.message === 'custom inline rule'));
});

test('registerLintRule adds to global registry and unregisters cleanly', () => {
  const fired: string[] = [];
  const rule: LintRule = {
    id: 'test-global',
    run: (_root, _warns) => { fired.push('global'); },
  };
  const unreg = registerLintRule(rule);
  lintPlatform(makePlatform());
  assert.ok(fired.includes('global'), 'global rule ran');
  unreg();
  lintPlatform(makePlatform()); // test-global is unregistered; fired should not grow
  assert.equal(fired.length, 1, 'rule did not run after unregister');
});
