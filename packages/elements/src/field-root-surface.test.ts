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
      remove: () => {},
      _attrs: attrs,
    };
  };
  const prevDoc = (globalThis as { document?: unknown }).document;
  (globalThis as { document?: unknown }).document = {
    createElement: () => fakeCanvas(),
    body: { appendChild: (el: unknown) => void appended.push(el) },
  };
  try {
    const self = { overlayCanvas: undefined as HTMLCanvasElement | undefined, getAttribute: () => null };
    const first = ensureOverlayCanvas.call(self as unknown as FieldField);
    assert.ok(first, 'a canvas is created');
    assert.equal(appended.length, 1, 'appended to the light DOM exactly once');
    assert.equal((first as unknown as { _attrs: Record<string, string> })._attrs['data-field-overlay'], '', 'marked data-field-overlay');
    assert.equal((first as unknown as { _attrs: Record<string, string> })._attrs['aria-hidden'], 'true', 'aria-hidden');
    assert.equal(
      (first as unknown as { style: Record<string, string> }).style.cssText,
      'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:5;mix-blend-mode:screen',
      'with no overlay-blend / overlay-z attributes the surface is byte-identical to the pre-#721 literal',
    );
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

// ── #721: overlay surface ergonomics — overlay-blend / overlay-z ───────────────

/** a fake document whose canvases record attrs + style; returns the appended list. */
function withFakeDocument<T>(run: () => T): { result: T; appended: Array<{ _attrs: Record<string, string>; style: Record<string, string> }> } {
  const appended: Array<{ _attrs: Record<string, string>; style: Record<string, string> }> = [];
  const prevDoc = (globalThis as { document?: unknown }).document;
  (globalThis as { document?: unknown }).document = {
    createElement: () => {
      const attrs: Record<string, string> = {};
      return { setAttribute: (k: string, v: string) => void (attrs[k] = v), style: {}, remove: () => {}, _attrs: attrs };
    },
    body: { appendChild: (el: unknown) => void appended.push(el as (typeof appended)[number]) },
  };
  try {
    return { result: run(), appended };
  } finally {
    (globalThis as { document?: unknown }).document = prevDoc;
  }
}

test('overlay-blend / overlay-z attributes land in the created overlay surface (#721)', () => {
  const attrs = new Map<string, string>([
    ['overlay-blend', 'multiply'],
    ['overlay-z', '20'],
  ]);
  const { appended } = withFakeDocument(() => {
    // the prototype's getters (overlayBlend / overlayZ) must resolve, so the stub inherits from it.
    const self = Object.assign(Object.create(FieldField.prototype) as object, {
      overlayCanvas: undefined,
      getAttribute: (k: string) => attrs.get(k) ?? null,
    });
    return ensureOverlayCanvas.call(self as unknown as FieldField);
  });
  assert.equal(appended.length, 1);
  assert.equal(
    appended[0]!.style.cssText,
    'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:20;mix-blend-mode:multiply',
  );
  assert.equal(appended[0]!._attrs['data-field-overlay'], '', 'still marked');
});

test('overlay-blend / overlay-z apply live to the existing surface — no rebuild (#721)', () => {
  const { stub, attrs, calls } = makeStub();
  const style: Record<string, string> = {};
  (stub as unknown as { overlayCanvas: unknown }).overlayCanvas = { style };
  // the rebuild path would call field.destroy() + this.start(); make both loud if reached.
  (stub.field as unknown as { destroy: () => void }).destroy = () => calls.push('destroy');
  (stub as unknown as { start: () => void }).start = () => calls.push('start');
  attrs.set('overlay-blend', 'multiply');
  stub.attributeChangedCallback('overlay-blend', 'screen', 'multiply');
  assert.equal(style.mixBlendMode, 'multiply', 'blend applied in place');
  attrs.set('overlay-z', '12');
  stub.attributeChangedCallback('overlay-z', '5', '12');
  assert.equal(style.zIndex, '12', 'z-index applied in place');
  attrs.set('overlay-z', 'auto');
  stub.attributeChangedCallback('overlay-z', '12', 'auto');
  assert.equal(style.zIndex, '5', 'non-numeric falls back to 5');
  assert.deepEqual(calls, [], 'no destroy / start — not a rebuild');
});

test('overlay-blend / overlay-z with no surface yet is a silent no-op — the next ensureOverlayCanvas reads them (#721)', () => {
  const { stub, attrs, calls } = makeStub();
  (stub.field as unknown as { destroy: () => void }).destroy = () => calls.push('destroy');
  (stub as unknown as { start: () => void }).start = () => calls.push('start');
  attrs.set('overlay-blend', 'multiply');
  stub.attributeChangedCallback('overlay-blend', null, 'multiply');
  stub.attributeChangedCallback('overlay-z', null, '9');
  assert.deepEqual(calls, [], 'nothing to apply to, nothing rebuilt');
});

test('setOverlayBlend / setOverlayZ apply + reflect (#721, #541 symmetry)', () => {
  const { stub, attrs } = makeStub();
  const style: Record<string, string> = {};
  (stub as unknown as { overlayCanvas: unknown }).overlayCanvas = { style };
  stub.setOverlayBlend('lighten');
  assert.equal(style.mixBlendMode, 'lighten');
  assert.equal(attrs.get('overlay-blend'), 'lighten');
  stub.setOverlayZ(30);
  assert.equal(style.zIndex, '30');
  assert.equal(attrs.get('overlay-z'), '30');
  // validated like the attributes: an invalid value applies + reflects as the default, never raw.
  stub.setOverlayBlend('screen;pointer-events:auto');
  assert.equal(style.mixBlendMode, 'screen', 'an injected blend applies as the default');
  assert.equal(attrs.get('overlay-blend'), 'screen', 'and reflects as the default');
  stub.setOverlayZ(1.5);
  assert.equal(style.zIndex, '5', 'a fractional z-index applies as 5');
  assert.equal(attrs.get('overlay-z'), '5');
});

const overlayBlendGet = Object.getOwnPropertyDescriptor(FieldField.prototype, 'overlayBlend')!.get!;
const overlayZGet = Object.getOwnPropertyDescriptor(FieldField.prototype, 'overlayZ')!.get!;
const overlayBlendFor = (attr: string | null): string => overlayBlendGet.call({ getAttribute: () => attr });
const overlayZFor = (attr: string | null): number => overlayZGet.call({ getAttribute: () => attr });

test('overlayBlend / overlayZ getters default to the pre-#721 surface (screen / 5)', () => {
  assert.equal(overlayBlendFor(null), 'screen', 'absent ⇒ screen');
  assert.equal(overlayBlendFor(''), 'screen', 'empty ⇒ screen');
  assert.equal(overlayBlendFor('  '), 'screen', 'whitespace ⇒ screen');
  assert.equal(overlayBlendFor(' multiply '), 'multiply', 'trimmed value passes through');
  assert.equal(overlayBlendFor('plus-lighter'), 'plus-lighter', 'hyphenated keyword passes through');
  assert.equal(
    overlayBlendFor('screen;pointer-events:auto'),
    'screen',
    'a value carrying a second declaration is rejected — the attribute reaches the surface cssText, so it must never be able to undo click-through',
  );
  assert.equal(overlayBlendFor('url(x)'), 'screen', 'not a keyword ⇒ screen');
  assert.equal(overlayZFor(null), 5, 'absent ⇒ 5');
  assert.equal(overlayZFor(''), 5, 'empty ⇒ 5');
  assert.equal(overlayZFor('auto'), 5, 'non-numeric ⇒ 5');
  assert.equal(overlayZFor('12'), 12);
  assert.equal(overlayZFor('0'), 0, 'zero is a legitimate stacking level');
  assert.equal(overlayZFor('-1'), -1, 'negative is legitimate too');
  assert.equal(overlayZFor('1.5'), 5, 'fractional ⇒ 5 (CSS z-index is integer-only; the browser would otherwise drop it)');
  assert.equal(overlayZFor('5;pointer-events:auto'), 5, 'a value carrying a second declaration ⇒ 5');
});

test('an injected overlay-blend / overlay-z attribute at creation never reaches the surface cssText (#721)', () => {
  const attrs = new Map<string, string>([
    ['overlay-blend', 'screen;pointer-events:auto'],
    ['overlay-z', '5;pointer-events:auto'],
  ]);
  const { appended } = withFakeDocument(() => {
    const self = Object.assign(Object.create(FieldField.prototype) as object, {
      overlayCanvas: undefined,
      getAttribute: (k: string) => attrs.get(k) ?? null,
    });
    return ensureOverlayCanvas.call(self as unknown as FieldField);
  });
  assert.equal(
    appended[0]!.style.cssText,
    'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:5;mix-blend-mode:screen',
    'both fall back to the defaults — the click-through contract holds',
  );
});

test('overlay-blend / overlay-z are observed attributes (#721)', () => {
  assert.ok(FieldField.observedAttributes.includes('overlay-blend'));
  assert.ok(FieldField.observedAttributes.includes('overlay-z'));
});

test('disconnectedCallback destroys the overlay surface it owns (#721)', () => {
  let destroyed = 0;
  const self = {
    overlaySurface: { destroy: () => void destroyed++ },
    overlayCanvas: {},
    field: undefined,
    fieldActiveMarked: false,
  };
  FieldField.prototype.disconnectedCallback.call(self as unknown as FieldField);
  assert.equal(destroyed, 1, 'surface.destroy() called once');
  assert.equal(self.overlaySurface, undefined);
  assert.equal(self.overlayCanvas, undefined);
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
