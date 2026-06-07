/**
 * Phase D3 — makeFeedbackSink routes engine feedback channels through the platform's
 * FeedbackRegistry: density → --d + --field-density, heatmap, load → --load/--mass, and lit → --lit
 * plus a one-time thresholded field:lit/field:dim. Tested against a recording fake platform.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeFeedbackSink } from './platform-runtime.ts';
import type { FieldPlatform } from '@field-ui/platform';

function fakePlatform() {
  const sets: Array<{ el: Element; vars: Record<string, number | string> }> = [];
  const states: Array<{ el: Element; key: string; value: unknown }> = [];
  const thresholds: Array<{ el: Element; event: string }> = [];
  const platform = {
    feedback: {
      set: (el: Element, vars: Record<string, number | string>) => void sets.push({ el, vars }),
      threshold: (el: Element, event: string) => void thresholds.push({ el, event }),
    },
    state: { set: (el: Element, key: string, value: unknown) => void states.push({ el, key, value }) },
  } as unknown as FieldPlatform;
  return { platform, sets, states, thresholds };
}

test('density routes to --d and --field-density (forces mirror is FeedbackRegistry-internal)', () => {
  const { platform, sets } = fakePlatform();
  const sink = makeFeedbackSink(platform);
  const el = {} as HTMLElement;
  sink(el, { density: 0.5 });
  assert.equal(sets.length, 1);
  assert.deepEqual(sets[0]!.vars, { '--d': '0.500', '--field-density': '0.500' }, 'matches legacy toFixed(3) formatting');
});

test('load routes to --load + --mass; heatmap to --field-heatmap-density', () => {
  const { platform, sets } = fakePlatform();
  const sink = makeFeedbackSink(platform);
  const el = {} as HTMLElement;
  sink(el, { load: 0.3, heatmapDensity: 0.2 });
  const flat = Object.assign({}, ...sets.map((s) => s.vars));
  assert.deepEqual(flat, { '--load': '0.300', '--mass': '0.300', '--field-heatmap-density': '0.200' });
});

test('lit writes --lit, sets state, and registers the threshold exactly once per element', () => {
  const { platform, sets, states, thresholds } = fakePlatform();
  const sink = makeFeedbackSink(platform);
  const el = {} as HTMLElement;
  sink(el, { lit: 0.6 });
  sink(el, { lit: 0.7 });
  assert.equal(thresholds.length, 1, 'threshold armed once');
  assert.equal(thresholds[0]!.event, 'field:lit');
  assert.deepEqual(states.map((s) => s.value), [0.6, 0.7]);
  assert.ok(sets.every((s) => '--lit' in s.vars));
});

test('a channel-less call writes nothing', () => {
  const { platform, sets, states, thresholds } = fakePlatform();
  makeFeedbackSink(platform)({} as HTMLElement, {});
  assert.equal(sets.length + states.length + thresholds.length, 0);
});
