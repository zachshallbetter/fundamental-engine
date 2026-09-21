/**
 * The Lab's snippet export (#1184).
 *
 * The thing worth guarding is not that a string is produced — it is that the string names the
 * attributes the SCANNER actually reads, with the units it reads them in. A snippet that emits
 * `data-absorb-r` or radians-as-degrees still looks like working code, pastes cleanly, and quietly
 * does nothing. So these assert against the scanner's real surface, not against the emitter's own
 * idea of itself.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  angleDegrees,
  bodyAttributes,
  createFieldSnippet,
  labSnippet,
  markupSnippet,
  SCANNER_DEFAULTS,
} from './lab-snippet.ts';

const base = { force: 'attract', label: 'Attract', symbol: '⊕' };

test('an attribute is emitted only when it differs from the scanner default', () => {
  // A body sitting entirely on defaults needs nothing but the token — the default IS what
  // reproduces it, and emitting it anyway would make every line of the snippet un-load-bearing.
  const onDefaults = bodyAttributes({
    ...base,
    body: {
      strength: SCANNER_DEFAULTS.strength,
      range: SCANNER_DEFAULTS.range,
      spin: SCANNER_DEFAULTS.spin,
      angle: 0,
    },
  });
  assert.deepEqual(onDefaults, [['data-body', 'attract']], `got ${JSON.stringify(onDefaults)}`);

  const tuned = bodyAttributes({ ...base, body: { strength: 2.5, range: 300 } });
  assert.deepEqual(tuned, [
    ['data-body', 'attract'],
    ['data-strength', '2.5'],
    ['data-range', '300'],
  ]);
});

test('angle is emitted in DEGREES, because the scanner reads degrees', () => {
  // The scenario carries radians; `data-angle` is degrees (scanner.ts: num('angle', 0) * PI / 180).
  // Emitting the radian value would produce a body pointing somewhere else entirely.
  assert.equal(angleDegrees({ angle: Math.PI }), 180);
  const attrs = bodyAttributes({ ...base, body: { angle: Math.PI / 2 } });
  assert.deepEqual(attrs.find(([k]) => k === 'data-angle'), ['data-angle', '90']);
});

test('the capture radius is data-absorb, not data-absorbR', () => {
  // The attribute is `absorb`; the engine field is `absorbR`. Emitting the field name would look
  // right and do nothing.
  const attrs = bodyAttributes({ ...base, force: 'sink', body: { absorbR: 120 } });
  assert.deepEqual(attrs.find(([k]) => k.startsWith('data-absorb')), ['data-absorb', '120']);
});

test('composed tokens survive as a space-separated list', () => {
  const attrs = bodyAttributes({ ...base, body: { tokens: ['attract', 'swirl'] } });
  assert.deepEqual(attrs[0], ['data-body', 'attract swirl']);
  // and a bare string form is accepted too
  assert.deepEqual(bodyAttributes({ ...base, body: { tokens: 'attract swirl' } })[0], [
    'data-body',
    'attract swirl',
  ]);
});

test('the body falls back to the current force when the scenario carries no tokens', () => {
  assert.deepEqual(bodyAttributes({ ...base, force: 'repel', body: {} })[0], ['data-body', 'repel']);
});

test('markup carries the box as a style, because the DOM takes it from CSS not an attribute', () => {
  // hw/hh are HALF-extents, so the element is twice each.
  const out = markupSnippet({ ...base, body: { hw: 40, hh: 25 } });
  assert.match(out, /style="width:80px;height:50px"/, out);
});

test('markup omits the style when the body has no box', () => {
  const out = markupSnippet({ ...base, body: { strength: 1 } });
  assert.ok(!out.includes('style='), `no phantom box: ${out}`);
});

test('the imperative form compiles to the documented API shape', () => {
  const out = createFieldSnippet({ ...base, body: { tokens: ['attract'], strength: 1.5, range: 300 } });
  assert.match(out, /import \{ createField \} from '@fundamental-engine\/vanilla';/);
  assert.match(out, /field\.addBody\(\{/);
  assert.match(out, /tokens: \['attract'\],/);
  assert.match(out, /strength: 1\.5,/);
  // addBody takes `absorbR` (the engine field), NOT the attribute name — the two forms differ here
  // and that difference is the whole reason both are emitted.
  const sink = createFieldSnippet({ ...base, force: 'sink', body: { absorbR: 90 } });
  assert.match(sink, /absorbR: 90,/);
  assert.ok(!sink.includes('data-absorb'), 'the imperative form uses the field name, not the attribute');
});

test('a rect is always supplied, because a programmatic body has no DOM box to measure', () => {
  const out = createFieldSnippet({ ...base, body: {} });
  assert.match(out, /rect: \(\) =>/, out);
});

test('the full snippet carries both forms and the link back', () => {
  const out = labSnippet({
    ...base,
    body: { tokens: ['swirl'], strength: 2, spin: -1 },
    link: 'https://example.test/lab#swirl;strength=2',
  });
  assert.match(out, /Declarative/);
  assert.match(out, /Imperative/);
  assert.match(out, /data-body="swirl"/);
  assert.match(out, /spin: -1,/);
  assert.match(out, /Reopen this exact configuration: https:\/\/example\.test\/lab#swirl;strength=2/);
});

test('numbers are trimmed, not printed at full float width', () => {
  const attrs = bodyAttributes({ ...base, body: { strength: 1 / 3 } });
  assert.deepEqual(attrs[1], ['data-strength', '0.333'], 'a readable value, not 0.3333333333333333');
});
