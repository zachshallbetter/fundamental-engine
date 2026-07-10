/**
 * applyRecipe scoped-field option tests — the `renderless` / `extraMetrics` extraction of the
 * example family's hand-spread idiom (`{ ...base, render: [], metrics: dedupe-append }`).
 * Exercised with the repo's EventTarget-free fake-element pattern (recorded attrs/styles +
 * programmable getBoundingClientRect) against the REAL catalog recipe, so the no-mutation
 * guarantee is tested against the actual shared object the site runtimes pass in.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { patternById } from '@fundamental-engine/core';
import { applyRecipe } from './apply-recipe.ts';

interface FakeEl extends Element {
  attrs: Record<string, string>;
  props: Record<string, string>;
}

/** A fake body element: recorded attributes + styles, fixed rect, never :hover/:focus. */
function fakeEl(rect: { x: number; y: number; w: number; h: number }): FakeEl {
  const attrs: Record<string, string> = {};
  const props: Record<string, string> = {};
  const el = {
    tagName: 'div',
    isConnected: true,
    attrs,
    props,
    getBoundingClientRect: () =>
      ({ left: rect.x, top: rect.y, width: rect.w, height: rect.h, right: rect.x + rect.w, bottom: rect.y + rect.h, x: rect.x, y: rect.y }) as DOMRect,
    getAttribute: (k: string) => attrs[k] ?? null,
    setAttribute: (k: string, v: string) => void (attrs[k] = v),
    removeAttribute: (k: string) => void delete attrs[k],
    hasAttribute: (k: string) => k in attrs,
    matches: () => false,
    contains: (other: unknown) => other === el,
    style: {
      setProperty: (k: string, v: string) => void (props[k] = v),
      removeProperty: (k: string) => void delete props[k],
    },
  };
  return el as unknown as FakeEl;
}

/** A fake root: only what the platform touches (relationship discovery scans it). */
const fakeRoot = (): Element => ({ querySelectorAll: () => [] as unknown as NodeListOf<Element> }) as unknown as Element;

const VP = { width: 1000, height: 1000 };

test('no scoped-field options → the input recipe is used as-is (existing call shape unchanged)', () => {
  const base = patternById('evidence-field')!;
  const el = fakeEl({ x: 450, y: 450, w: 100, h: 100 });
  const applied = applyRecipe(fakeRoot(), base, { bodies: [el], annotateBodies: false, drive: false, reducedMotion: false });
  assert.equal(applied.recipe, base, 'no derived copy when no option asks for one');
  applied.destroy();
});

test('renderless strips render for the applied run; the catalog recipe object is untouched', () => {
  const base = patternById('evidence-field')!;
  const renderBefore = base.render;
  const renderSnapshot = [...base.render];
  const el = fakeEl({ x: 450, y: 450, w: 100, h: 100 });

  const applied = applyRecipe(fakeRoot(), base, {
    bodies: [el],
    annotateBodies: false,
    drive: false,
    reducedMotion: false,
    renderless: true,
  });

  assert.notEqual(applied.recipe, base, 'the handle carries a derived copy, not the catalog object');
  assert.deepEqual(applied.recipe.render, [], 'the applied run is renderless');
  assert.deepEqual(applied.compiled.recipe.render, [], 'the compiled plan saw the effective recipe');
  // the shared catalog object is byte-identical to before
  assert.equal(base.render, renderBefore, 'render array identity untouched');
  assert.deepEqual(base.render, renderSnapshot, 'render contents untouched');
  assert.deepEqual(applied.recipe.metrics, base.metrics, 'metrics pass through unchanged without extraMetrics');
  applied.destroy();
});

test('extraMetrics appends + dedupes, never mutates the input, and the metric actually flows', () => {
  const base = patternById('evidence-field')!;
  const metricsBefore = base.metrics;
  const metricsSnapshot = [...base.metrics]; // ['coherence', 'entropy']
  // centered in the 1000×1000 viewport → proximity 1, fully visible → attention computes to 1
  const el = fakeEl({ x: 450, y: 450, w: 100, h: 100 });

  const applied = applyRecipe(fakeRoot(), base, {
    bodies: [el],
    annotateBodies: false,
    drive: false,
    reducedMotion: false,
    renderless: true,
    extraMetrics: ['attention', 'entropy'], // 'entropy' is already declared — must dedupe
  });

  assert.deepEqual(applied.recipe.metrics, [...metricsSnapshot, 'attention'], 'appended + deduped, original order kept');
  assert.equal(base.metrics, metricsBefore, 'metrics array identity untouched');
  assert.deepEqual(base.metrics, metricsSnapshot, 'metrics contents untouched');
  assert.ok(
    applied.compiled.feedback.some((f) => f.metric === 'attention' && f.var === '--field-attention'),
    'the appended metric gained the standard feedback binding',
  );

  // drive one six-phase frame: discover → read → compute → state → write
  applied.platform.tick(1, VP);
  assert.equal(el.props['--field-attention'], '1.000', 'the appended metric flowed through compute → state → write');
  assert.ok('--field-entropy' in el.props, 'the recipe-declared metrics still flow');

  applied.destroy();
  assert.ok(!('data-body' in el.attrs), 'annotateBodies:false left the element unannotated throughout');
});

test('a supplied field target is DRIVEN by the compiled render plan, and destroy releases it (#370)', () => {
  const calls: string[] = [];
  const field = {
    setRender: (m: string) => void calls.push(`render:${m}`),
    setOverlay: (m: string | string[]) => void calls.push(`overlay:${Array.isArray(m) ? m.join('+') : m}`),
    setHeatmap: (on: boolean) => void calls.push(`heatmap:${on}`),
  };
  const base = patternById('contour-charge')!; // render: ['particles', 'heatmap'] → dots + heatmap
  const el = fakeEl({ x: 450, y: 450, w: 100, h: 100 });
  const applied = applyRecipe(fakeRoot(), base, { bodies: [el], annotateBodies: false, drive: false, reducedMotion: false, field });
  assert.deepEqual(calls, ['render:dots', 'overlay:off', 'heatmap:true'], 'the plan executed on apply');
  calls.length = 0;
  applied.destroy();
  assert.deepEqual(calls, ['render:dots', 'overlay:off', 'heatmap:false'], 'destroy returns the field to rest');
});

test('renderless keeps a supplied field untouched — the guard also covers reduced motion (#370)', () => {
  const calls: string[] = [];
  const field = { setRender: () => void calls.push('x'), setOverlay: () => void calls.push('x'), setHeatmap: () => void calls.push('x') };
  const base = patternById('contour-charge')!;
  const el = fakeEl({ x: 450, y: 450, w: 100, h: 100 });
  applyRecipe(fakeRoot(), base, { bodies: [el], annotateBodies: false, drive: false, reducedMotion: false, field, renderless: true }).destroy();
  assert.deepEqual(calls, [], 'renderless never drives the field (reduced motion shares the same single guard)');
});

test('density metric does not clobber --field-density written by the particle engine', () => {
  // `priority-well` declares metrics: ['density', 'attention', 'priority'].
  // The recipe pipeline must NOT write --field-density = 0 when data-field-density is absent —
  // that would overwrite the engine's own gathered-density write from feedback-sink.
  const base = patternById('priority-well')!;
  assert.ok(base.metrics.includes('density'), 'precondition: recipe declares density metric');
  const el = fakeEl({ x: 450, y: 450, w: 100, h: 100 });

  // Simulate the particle engine having written --field-density before the recipe frame runs.
  el.props['--field-density'] = '0.720';

  const applied = applyRecipe(fakeRoot(), base, { bodies: [el], annotateBodies: false, drive: false, reducedMotion: false });
  applied.platform.tick(1, VP);

  assert.equal(el.props['--field-density'], '0.720', '--field-density must not be overwritten by the recipe metric pipeline');

  applied.destroy();
});
