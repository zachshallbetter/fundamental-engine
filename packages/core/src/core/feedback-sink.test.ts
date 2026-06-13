/**
 * The internal default feedback sink (#228, Phase 5) — byte-identical to the engine's historical
 * direct writes. These tests pin the exact contract the legacy `writeFeedback`/`writeLit` direct
 * branches had: variable names, `.toFixed(3)` formatting, write order, undefined-channel skipping,
 * and the `field:lit`/`field:dim` hysteresis armed on `data-fx-lit`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultFeedbackSink } from './feedback-sink.ts';

/** A stub element recording setProperty calls in order, with a live dataset + event log. */
function fakeEl(): HTMLElement & { writes: Array<[string, string]>; events: Array<{ type: string; value: number }> } {
  const writes: Array<[string, string]> = [];
  const events: Array<{ type: string; value: number }> = [];
  const el = {
    writes,
    events,
    dataset: {} as Record<string, string>,
    style: {
      setProperty(name: string, value: string) {
        writes.push([name, value]);
      },
    },
    dispatchEvent(e: Event) {
      events.push({ type: e.type, value: (e as CustomEvent<{ value: number }>).detail.value });
      return true;
    },
  };
  return el as unknown as ReturnType<typeof fakeEl>;
}

test('density writes --d + --field-density, three decimals, in order', () => {
  const el = fakeEl();
  defaultFeedbackSink(el, { density: 0.123456 });
  assert.deepEqual(el.writes, [
    ['--d', '0.123'],
    ['--field-density', '0.123'],
  ]);
});

test('heatmapDensity writes --field-heatmap-density', () => {
  const el = fakeEl();
  defaultFeedbackSink(el, { heatmapDensity: 0.5 });
  assert.deepEqual(el.writes, [
    ['--field-heatmap-density', '0.500'],
  ]);
});

test('load writes --load then the --mass back-compat alias', () => {
  const el = fakeEl();
  defaultFeedbackSink(el, { load: 1 });
  assert.deepEqual(el.writes, [
    ['--load', '1.000'],
    ['--mass', '1.000'],
  ]);
});

test('undefined channels write nothing (a lit-only call leaves density untouched)', () => {
  const el = fakeEl();
  defaultFeedbackSink(el, { lit: 0.2 });
  assert.deepEqual(el.writes, [['--lit', '0.200']]);
  assert.deepEqual(el.events, []);
});

test('the full writeFeedback channel set lands in the legacy order: density, heatmap, load', () => {
  const el = fakeEl();
  defaultFeedbackSink(el, { density: 0.25, heatmapDensity: 0.0625, load: 0.75 });
  assert.deepEqual(
    el.writes.map(([n]) => n),
    ['--d', '--field-density', '--field-heatmap-density', '--load', '--mass'],
  );
});

test('lit hysteresis: field:lit above 0.5, field:dim below 0.4, armed via data-fx-lit', () => {
  const el = fakeEl();
  defaultFeedbackSink(el, { lit: 0.6 }); // rising edge → lit
  assert.equal((el.dataset as Record<string, string>).fxLit, '1');
  defaultFeedbackSink(el, { lit: 0.7 }); // already armed → no re-fire
  defaultFeedbackSink(el, { lit: 0.45 }); // in the hysteresis band → nothing
  defaultFeedbackSink(el, { lit: 0.3 }); // falling edge → dim
  assert.equal((el.dataset as Record<string, string>).fxLit, '0');
  defaultFeedbackSink(el, { lit: 0.2 }); // already disarmed → no re-fire
  assert.deepEqual(el.events, [
    { type: 'field:lit', value: 0.6 },
    { type: 'field:dim', value: 0.3 },
  ]);
  // and --lit itself is written every call, three decimals
  assert.deepEqual(
    el.writes,
    [
      ['--lit', '0.600'],
      ['--lit', '0.700'],
      ['--lit', '0.450'],
      ['--lit', '0.300'],
      ['--lit', '0.200'],
    ],
  );
});

test('lit boundary values match the legacy strict comparisons (0.5 does not arm, 0.4 does not dim)', () => {
  const el = fakeEl();
  defaultFeedbackSink(el, { lit: 0.5 }); // lit > 0.5 is strict → no event
  assert.deepEqual(el.events, []);
  defaultFeedbackSink(el, { lit: 0.51 });
  assert.equal(el.events.length, 1);
  defaultFeedbackSink(el, { lit: 0.4 }); // lit < 0.4 is strict → still armed
  assert.equal(el.events.length, 1);
  defaultFeedbackSink(el, { lit: 0.39 });
  assert.deepEqual(el.events[1], { type: 'field:dim', value: 0.39 });
});

test('measured thermodynamics write the bare names --entropy / --coherence / --temperature (workover v0.3)', () => {
  const el = fakeEl();
  defaultFeedbackSink(el, { entropy: 0.123456, coherence: 0.876544, temperature: 0.5 });
  assert.deepEqual(el.writes, [
    ['--entropy', '0.123'],
    ['--coherence', '0.877'],
    ['--temperature', '0.500'],
  ]);
  // independent channels — any subset writes only itself
  const el2 = fakeEl();
  defaultFeedbackSink(el2, { temperature: 0 });
  assert.deepEqual(el2.writes, [['--temperature', '0.000']]);
});

test('thermo channels sit after load and before lit in a full write (the documented order)', () => {
  const el = fakeEl();
  defaultFeedbackSink(el, { density: 0.1, load: 0.2, entropy: 0.3, coherence: 0.7, temperature: 0.4, lit: 0.1 });
  assert.deepEqual(
    el.writes.map(([n]) => n),
    ['--d', '--field-density', '--load', '--mass', '--entropy', '--coherence', '--temperature', '--lit'],
  );
});
