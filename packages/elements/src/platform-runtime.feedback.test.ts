/**
 * Phase D3 — makeFeedbackSink routes engine feedback channels through the platform's
 * FeedbackRegistry: density → --d + --field-density, heatmap, load → --load/--mass, and lit → --lit
 * plus a one-time thresholded field:lit/field:dim. Tested against a recording fake platform.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeFeedbackSink } from './platform-runtime.ts';
import { cssFeedbackSink } from '@fundamental-engine/core';
import type { FieldPlatform } from '@fundamental-engine/dom';

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

test('load routes to --load; heatmap to --field-heatmap-density', () => {
  const { platform, sets } = fakePlatform();
  const sink = makeFeedbackSink(platform);
  const el = {} as HTMLElement;
  sink(el, { load: 0.3, heatmapDensity: 0.2 });
  const flat = Object.assign({}, ...sets.map((s) => s.vars));
  assert.deepEqual(flat, { '--load': '0.300', '--field-heatmap-density': '0.200' });
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

test('measured thermodynamics mirror the engine sink: bare --entropy / --coherence / --temperature (workover v0.3)', () => {
  const { platform, sets } = fakePlatform();
  const sink = makeFeedbackSink(platform);
  const el = {} as HTMLElement;
  sink(el, { entropy: 0.25, coherence: 0.75, temperature: 0.123456 });
  const flat = Object.assign({}, ...sets.map((s) => s.vars));
  assert.deepEqual(flat, {
    '--entropy': '0.250',
    '--coherence': '0.750',
    '--temperature': '0.123',
  });
  // bare names only — the platform's --field-entropy/--field-coherence lanes are a different,
  // inferred signal and must NOT be written from the engine's measured channels.
  for (const s of sets) {
    assert.ok(!('--field-entropy' in s.vars) && !('--field-coherence' in s.vars));
  }
});

test('a channel-less call writes nothing', () => {
  const { platform, sets, states, thresholds } = fakePlatform();
  makeFeedbackSink(platform)({} as HTMLElement, {});
  assert.equal(sets.length + states.length + thresholds.length, 0);
});

test('pulse routes to --field-pulse, and the platform route matches the engine default byte for byte (#567)', () => {
  const { platform, sets } = fakePlatform();
  const sink = makeFeedbackSink(platform);
  const el = {} as HTMLElement;
  sink(el, { pulse: 0.5 });
  assert.deepEqual(Object.assign({}, ...sets.map((s) => s.vars)), { '--field-pulse': '0.500' });

  // the parity that matters: the two sinks are meant to be interchangeable, so a channel added to
  // one and forgotten in the other is the failure mode. Run the SAME channels through the engine's
  // default sink and assert the same property/value pairs come out.
  const direct: Array<[string, string]> = [];
  const el2 = {
    dataset: {},
    style: { setProperty: (n: string, v: string) => void direct.push([n, v]) },
  } as unknown as HTMLElement;
  const { platform: p2, sets: s2 } = fakePlatform();
  const channels = { density: 0.25, pulse: 0.75, load: 0.5, temperature: 0.1 };
  cssFeedbackSink(el2, channels);
  makeFeedbackSink(p2)(el2, channels);
  assert.deepEqual(
    Object.assign({}, ...s2.map((s) => s.vars)),
    Object.fromEntries(direct),
    'the platform sink and the engine default sink write the same variables',
  );
});
