/**
 * `<field-root>` consumer-surface completeness (#541 attribute reflection + #542 full handle access).
 * The element class needs no DOM here: its methods are exercised via the prototype with a stubbed
 * `this` that records field calls + attribute writes (the same no-DOM approach as option-attrs.test).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FieldField } from './index.ts';

/** a stub `<field-root>`: an object whose prototype IS the element's, so inherited methods (setRender,
 *  reflect, attributeChangedCallback, the getters) run against own-property stubs for the field +
 *  attribute store. No DOM needed. */
type Stub = Record<string, (...a: unknown[]) => unknown> & { reflecting: boolean };
function makeStub() {
  const attrs = new Map<string, string>();
  const calls: string[] = [];
  const field = {
    setRender: (m: string) => calls.push(`setRender:${m}`),
    setOverlay: (m: unknown) => calls.push(`setOverlay:${Array.isArray(m) ? m.join(',') : m}`),
    setFormation: (n: string) => calls.push(`setFormation:${n}`),
    setAccent: (h: string) => calls.push(`setAccent:${h}`),
    setBackground: (m: string) => calls.push(`setBackground:${m}`),
    setHeatmap: (o: boolean) => calls.push(`setHeatmap:${o}`),
    setAttention: (o: boolean) => calls.push(`setAttention:${o}`),
    setVisible: (o: boolean) => calls.push(`setVisible:${o}`),
    scrollV: () => 42,
  };
  const stub = Object.assign(Object.create(FieldField.prototype) as Stub, {
    reflecting: false,
    field,
    overlayCanvas: undefined,
    getAttribute: (k: string) => (attrs.has(k) ? attrs.get(k)! : null),
    setAttribute: (k: string, v: string) => void attrs.set(k, v),
    removeAttribute: (k: string) => void attrs.delete(k),
    hasAttribute: (k: string) => attrs.has(k),
  });
  return { stub, attrs, calls };
}

// ── #541: imperative setters reflect to the element attribute ─────────────────

test('setRender reflects the mode to the render attribute (#541)', () => {
  const { stub, attrs, calls } = makeStub();
  stub.setRender('links');
  assert.ok(calls.includes('setRender:links'), 'the field was updated');
  assert.equal(attrs.get('render'), 'links', 'and the attribute now shows the live mode (not stale)');
});

test('setFormation reflects to the formation attribute (#541)', () => {
  const { stub, attrs, calls } = makeStub();
  stub.setFormation('wells');
  assert.ok(calls.includes('setFormation:wells'));
  assert.equal(attrs.get('formation'), 'wells');
});

test('setOverlay serializes a single mode, a stack, and clears on "off" (#541)', () => {
  const { stub, attrs } = makeStub();
  stub.setOverlay('grid');
  assert.equal(attrs.get('overlay'), 'grid', 'single mode');
  stub.setOverlay(['grid', 'path']);
  assert.equal(attrs.get('overlay'), 'grid path', 'a stack is space-separated');
  stub.setOverlay('off');
  assert.equal(attrs.has('overlay'), false, "'off' removes the attribute");
});

test('boolean + color setters reflect (background/heatmap/attention/accent) (#541)', () => {
  const { stub, attrs } = makeStub();
  stub.setBackground('transparent');
  assert.equal(attrs.get('background'), 'transparent');
  stub.setHeatmap(true);
  assert.equal(attrs.get('heatmap'), 'true');
  stub.setAttention(false);
  assert.equal(attrs.get('attention'), 'false');
  stub.setAccent('#ff6e9c');
  assert.equal(attrs.get('accent'), '#ff6e9c');
});

test('reflection is guarded — attributeChangedCallback skips re-apply while reflecting (#541)', () => {
  const { stub, attrs, calls } = makeStub();
  attrs.set('render', 'links');
  // while a setter is mid-reflect, the callback must NOT re-apply to the field (no double-apply).
  stub.reflecting = true;
  stub.attributeChangedCallback('render', 'dots', 'links');
  assert.equal(calls.length, 0, 'guarded: no field call');
  // a genuine external attribute change (not reflecting) DOES apply.
  stub.reflecting = false;
  stub.attributeChangedCallback('render', 'dots', 'links');
  assert.ok(calls.includes('setRender:links'), 'external change applies to the field');
});

// ── #676: lazy overlay-canvas creation ─────────────────────────────────────────

/** access the private `ensureOverlayCanvas` through the prototype (no DOM needed for the short-circuit). */
const ensureOverlayCanvas = (
  FieldField.prototype as unknown as { ensureOverlayCanvas: () => HTMLCanvasElement | null }
).ensureOverlayCanvas;

test('ensureOverlayCanvas returns the existing canvas without creating a second one (idempotent, #676)', () => {
  const existing = { tag: 'existing-canvas' } as unknown as HTMLCanvasElement;
  const self = { overlayCanvas: existing };
  const got = ensureOverlayCanvas.call(self as unknown as FieldField);
  assert.equal(got, existing, 'returns the already-owned canvas');
  assert.equal(self.overlayCanvas, existing, 'and never replaces it');
});

test('ensureOverlayCanvas creates + appends exactly one light-DOM canvas on first call (#676)', () => {
  // stub just enough `document` to observe a single create/append, then restore it.
  const appended: unknown[] = [];
  const fakeCanvas = () => {
    const attrs: Record<string, string> = {};
    return {
      setAttribute: (k: string, v: string) => void (attrs[k] = v),
      style: {} as Record<string, string>,
      _attrs: attrs,
    };
  };
  const prevDoc = (globalThis as { document?: unknown }).document;
  (globalThis as { document?: unknown }).document = {
    createElement: () => fakeCanvas(),
    body: { appendChild: (el: unknown) => void appended.push(el) },
  };
  try {
    const self: { overlayCanvas?: HTMLCanvasElement } = {};
    const first = ensureOverlayCanvas.call(self as unknown as FieldField);
    assert.ok(first, 'a canvas is created');
    assert.equal(appended.length, 1, 'appended to the light DOM exactly once');
    assert.equal((first as unknown as { _attrs: Record<string, string> })._attrs['data-field-overlay'], '', 'marked data-field-overlay');
    // a second call must reuse — no new create/append.
    const second = ensureOverlayCanvas.call(self as unknown as FieldField);
    assert.equal(second, first, 'reused on the second call');
    assert.equal(appended.length, 1, 'still only one canvas in the DOM');
  } finally {
    (globalThis as { document?: unknown }).document = prevDoc;
  }
});

test('ensureOverlayCanvas is a no-op (null) with no document — SSR-safe (#676)', () => {
  const prevDoc = (globalThis as { document?: unknown }).document;
  delete (globalThis as { document?: unknown }).document;
  try {
    const self: { overlayCanvas?: HTMLCanvasElement } = {};
    assert.equal(ensureOverlayCanvas.call(self as unknown as FieldField), null, 'no DOM → no canvas');
    assert.equal(self.overlayCanvas, undefined, 'and nothing is cached');
  } finally {
    (globalThis as { document?: unknown }).document = prevDoc;
  }
});

// ── #542: full handle access ──────────────────────────────────────────────────

test('.handle exposes the live FieldHandle (#542)', () => {
  const { stub } = makeStub();
  const handleGet = Object.getOwnPropertyDescriptor(FieldField.prototype, 'handle')!.get!;
  assert.equal(handleGet.call(stub), stub.field, 'returns the live field');
  assert.equal(handleGet.call({ field: undefined }), undefined, 'undefined before mount');
});

test('scrollV and setVisible are forwarded to the handle (#542)', () => {
  const { stub, calls } = makeStub();
  assert.equal(stub.scrollV(), 42, 'scrollV reads through');
  const bare = Object.create(FieldField.prototype) as { scrollV(): number };
  assert.equal(bare.scrollV(), 0, '0 before mount');
  stub.setVisible(false);
  assert.ok(calls.includes('setVisible:false'));
});

test('formation is an observed attribute (round-trips, #541)', () => {
  assert.ok(FieldField.observedAttributes.includes('formation'));
});
