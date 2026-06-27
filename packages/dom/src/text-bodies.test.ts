/**
 * textBodies tests — the Range-geometry slice of #257. Exercised against tiny fake elements and a
 * fake document (recorded attributes/styles + stub Range/getClientRects), the same no-real-DOM
 * pattern as platform.test.ts: granularity selection, span contract (body token, strength, the
 * visual-binding pair), disposal, and annotate idempotency.
 */
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { textBodies } from './text-bodies.ts';

const rect = (x: number, y: number, w: number, h: number): DOMRect =>
  ({ left: x, top: y, width: w, height: h, right: x + w, bottom: y + h, x, y }) as DOMRect;

interface FakeEl {
  tagName: string;
  nodeType: number;
  childNodes: unknown[];
  children: FakeEl[];
  attrs: Record<string, string>;
  styles: Record<string, string>;
  parentNode: FakeEl | null;
  setAttribute(k: string, v: string): void;
  getAttribute(k: string): string | null;
  style: { setProperty(k: string, v: string): void };
  appendChild(c: FakeEl): FakeEl;
  removeChild(c: FakeEl): FakeEl;
}

function makeEl(tag: string): FakeEl {
  const attrs: Record<string, string> = {};
  const styles: Record<string, string> = {};
  const children: FakeEl[] = [];
  const el: FakeEl = {
    tagName: tag,
    nodeType: 1,
    childNodes: children,
    children,
    attrs,
    styles,
    parentNode: null,
    setAttribute: (k, v) => void (attrs[k] = v),
    getAttribute: (k) => attrs[k] ?? null,
    style: { setProperty: (k, v) => void (styles[k] = v) },
    appendChild(c) {
      children.push(c);
      c.parentNode = el;
      return c;
    },
    removeChild(c) {
      const i = children.indexOf(c);
      if (i >= 0) children.splice(i, 1);
      c.parentNode = null;
      return c;
    },
  };
  return el;
}

/** A fake text node whose `rectsFor(start, end)` supplies the word-range geometry. */
function textNode(text: string, rectsFor: (start: number, end: number) => DOMRect[] = () => []) {
  return { nodeType: 3, textContent: text, childNodes: [] as unknown[], rectsFor };
}

interface FakeView {
  scrollX: number;
  scrollY: number;
  ResizeObserver?: unknown;
}

interface FakeDoc {
  body: FakeEl;
  defaultView: FakeView;
  createElement(tag: string): FakeEl;
  createRange(): unknown;
  /** every (node, start, end) word range the helper created, in order */
  wordRanges: Array<{ text: string; start: number; end: number }>;
}

function fakeDoc(view: FakeView = { scrollX: 0, scrollY: 0 }): FakeDoc {
  const wordRanges: FakeDoc['wordRanges'] = [];
  const doc: FakeDoc = {
    body: makeEl('body'),
    defaultView: view,
    createElement: makeEl,
    wordRanges,
    createRange() {
      const r = {
        node: null as ReturnType<typeof textNode> | null,
        contents: null as { lineRects?: DOMRect[] } | null,
        start: 0,
        end: 0,
        setStart(n: ReturnType<typeof textNode>, o: number) {
          r.node = n;
          r.start = o;
        },
        setEnd(_n: unknown, o: number) {
          r.end = o;
          if (r.node) wordRanges.push({ text: (r.node.textContent ?? '').slice(r.start, o), start: r.start, end: o });
        },
        selectNodeContents(n: { lineRects?: DOMRect[] }) {
          r.contents = n;
        },
        getClientRects(): DOMRect[] {
          if (r.contents) return r.contents.lineRects ?? [];
          return r.node ? r.node.rectsFor(r.start, r.end) : [];
        },
      };
      return r;
    },
  };
  return doc;
}

/** A fake source element bound to a fake document. */
function sourceEl(doc: FakeDoc, opts: { id?: string; rect?: DOMRect; lineRects?: DOMRect[] } = {}) {
  const el = makeEl('p') as FakeEl & {
    id: string;
    ownerDocument: FakeDoc;
    lineRects?: DOMRect[];
    getBoundingClientRect(): DOMRect;
  };
  el.id = opts.id ?? '';
  el.ownerDocument = doc;
  el.lineRects = opts.lineRects;
  el.getBoundingClientRect = () => opts.rect ?? rect(10, 20, 300, 40);
  return el;
}

const asHTML = (el: unknown) => el as HTMLElement;

/**
 * A fake ResizeObserver that records observed targets and lets a test fire a resize. `instances`
 * collects every observer the helper constructs, so a test can assert wiring and trigger a callback.
 */
function fakeResizeObserver() {
  const instances: Array<{
    cb: () => void;
    observed: unknown[];
    disconnected: boolean;
    fire(): void;
  }> = [];
  class FakeRO {
    cb: () => void;
    observed: unknown[] = [];
    disconnected = false;
    constructor(cb: () => void) {
      this.cb = cb;
      instances.push(this);
    }
    observe(t: unknown) {
      this.observed.push(t);
    }
    disconnect() {
      this.disconnected = true;
    }
    fire() {
      if (!this.disconnected) this.cb();
    }
  }
  return { FakeRO, instances };
}

test("granularity 'box' measures the element's own box (the homepage behavior, via API)", () => {
  const doc = fakeDoc();
  const el = sourceEl(doc, { rect: rect(10, 20, 300, 40) });
  const { boxes } = textBodies(asHTML(el), { granularity: 'box' });
  assert.equal(boxes.length, 1);
  assert.equal(boxes[0]!.left, 10);
  assert.equal(boxes[0]!.width, 300);
});

test("granularity 'box' drops a zero-size element", () => {
  const doc = fakeDoc();
  const el = sourceEl(doc, { rect: rect(0, 0, 0, 0) });
  assert.equal(textBodies(asHTML(el), { granularity: 'box' }).boxes.length, 0);
});

test("granularity 'line' takes the content Range's line boxes, zero-size fragments dropped", () => {
  const doc = fakeDoc();
  const el = sourceEl(doc, { lineRects: [rect(0, 0, 200, 24), rect(0, 24, 0, 24), rect(0, 48, 150, 24)] });
  const { boxes } = textBodies(asHTML(el), { granularity: 'line' });
  assert.equal(boxes.length, 2, 'the zero-width fragment is dropped');
  assert.equal(boxes[1]!.top, 48);
});

test("granularity 'word' (the default) ranges each whitespace-delimited run, across nested text nodes", () => {
  const doc = fakeDoc();
  const el = sourceEl(doc);
  const wordRect = (s: number) => [rect(s * 10, 0, 30, 20)];
  const inner = makeEl('em');
  inner.childNodes.push(textNode('flows along', wordRect));
  el.childNodes.length = 0;
  el.childNodes.push(textNode('  matter ', wordRect), inner);
  const { boxes } = textBodies(asHTML(el));
  assert.deepEqual(
    doc.wordRanges.map((w) => w.text),
    ['matter', 'flows', 'along'],
    'one range per word, nested elements walked'
  );
  assert.deepEqual(
    doc.wordRanges.map((w) => [w.start, w.end]),
    [
      [2, 8], // '  matter ' → offsets within ITS OWN node
      [0, 5], // 'flows'
      [6, 11], // 'along'
    ]
  );
  assert.equal(boxes.length, 3);
});

test('annotate() emits boundary spans carrying the full contract', () => {
  const doc = fakeDoc({ scrollX: 5, scrollY: 100 });
  const el = sourceEl(doc, { id: 'headline', rect: rect(10, 20, 300, 40) });
  textBodies(asHTML(el), { granularity: 'box', body: 'wall', strength: 2 }).annotate();

  assert.equal(doc.body.children.length, 1, 'one container appended to body');
  const container = doc.body.children[0]!;
  assert.equal(container.attrs['aria-hidden'], 'true');
  assert.equal(container.styles['pointer-events'], 'none');

  assert.equal(container.children.length, 1);
  const span = container.children[0]!;
  assert.equal(span.attrs['data-body'], 'wall', 'the boundary token');
  assert.equal(span.attrs['data-strength'], '2');
  assert.equal(span.attrs['data-range'], '300', 'range hugs the box (max dimension)');
  assert.equal(span.attrs['data-field-visual-for'], 'headline', 'visual-binding pair → the source');
  assert.equal(span.attrs['data-field-visual-role'], 'representation');
  assert.equal(span.attrs['aria-hidden'], 'true', 'AT reads only the semantic source');
  assert.equal(span.styles['pointer-events'], 'none');
  assert.equal(span.styles['position'], 'absolute');
  assert.equal(span.styles['left'], '15px', 'page coordinates: viewport left + scrollX');
  assert.equal(span.styles['top'], '120px', 'page coordinates: viewport top + scrollY');
  assert.equal(span.styles['width'], '300px');
  assert.equal(span.styles['height'], '40px');
});

test('annotate() defaults: shear body, strength 1, and assigns the source an id when missing', () => {
  const doc = fakeDoc();
  const el = sourceEl(doc, { id: '' });
  textBodies(asHTML(el), { granularity: 'box' }).annotate();
  const span = doc.body.children[0]!.children[0]!;
  assert.equal(span.attrs['data-body'], 'shear');
  assert.equal(span.attrs['data-strength'], '1');
  assert.ok(el.id, 'source got a generated id');
  assert.equal(span.attrs['data-field-visual-for'], el.id);
});

test('the disposer removes the whole span set', () => {
  const doc = fakeDoc();
  const el = sourceEl(doc, { id: 's' });
  const dispose = textBodies(asHTML(el), { granularity: 'box' }).annotate();
  assert.equal(doc.body.children.length, 1);
  dispose();
  assert.equal(doc.body.children.length, 0, 'container removed');
  dispose(); // double-dispose is harmless
  assert.equal(doc.body.children.length, 0);
});

test('annotate() is idempotent — re-calling disposes the previous set first', () => {
  const doc = fakeDoc();
  const el = sourceEl(doc, { id: 's' });
  const handle = textBodies(asHTML(el), { granularity: 'box' });
  handle.annotate();
  const disposeSecond = handle.annotate();
  assert.equal(doc.body.children.length, 1, 'one live span set, not two');
  disposeSecond();
  assert.equal(doc.body.children.length, 0);
});

test('observe: re-annotates on source resize, debounced, and the disposer disconnects the observer', (t) => {
  t.after(() => mock.timers.reset());
  mock.timers.enable({ apis: ['setTimeout'] });
  const { FakeRO, instances } = fakeResizeObserver();
  const doc = fakeDoc({ scrollX: 0, scrollY: 0, ResizeObserver: FakeRO });
  const el = sourceEl(doc, { id: 's', rect: rect(10, 20, 300, 40) });

  const dispose = textBodies(asHTML(el), { granularity: 'box', observe: true }).annotate();
  assert.equal(instances.length, 1, 'one ResizeObserver constructed');
  assert.deepEqual(instances[0]!.observed, [el], 'it observes the source element');
  assert.equal(doc.body.children.length, 1, 'spans rendered up front');
  const first = doc.body.children[0]!;

  // A resize fires; debounced, so nothing happens until the timer elapses.
  instances[0]!.fire();
  assert.equal(doc.body.children.length, 1, 'still the original set before the debounce');
  mock.timers.tick(100);
  assert.equal(doc.body.children.length, 1, 'still exactly one set after re-measure');
  assert.notEqual(doc.body.children[0], first, 'the span set was replaced (re-measured)');

  // Coalesced: two quick resizes → a single re-annotate.
  const beforeBurst = doc.body.children[0]!;
  instances[0]!.fire();
  instances[0]!.fire();
  mock.timers.tick(100);
  assert.equal(doc.body.children.length, 1);
  assert.notEqual(doc.body.children[0], beforeBurst, 're-measured once for the burst');

  dispose();
  assert.equal(instances[0]!.disconnected, true, 'disposer disconnects the observer');
  assert.equal(doc.body.children.length, 0, 'and removes the spans');

  // A late resize after disposal is inert (timer cleared, observer gone).
  instances[0]!.fire();
  mock.timers.tick(100);
  assert.equal(doc.body.children.length, 0, 'no resurrection after dispose');
});

test('observe accepts a custom debounce in ms', (t) => {
  t.after(() => mock.timers.reset());
  mock.timers.enable({ apis: ['setTimeout'] });
  const { FakeRO, instances } = fakeResizeObserver();
  const doc = fakeDoc({ scrollX: 0, scrollY: 0, ResizeObserver: FakeRO });
  const el = sourceEl(doc, { id: 's', rect: rect(10, 20, 300, 40) });

  textBodies(asHTML(el), { granularity: 'box', observe: 250 }).annotate();
  const first = doc.body.children[0]!;
  instances[0]!.fire();
  mock.timers.tick(100);
  assert.equal(doc.body.children[0], first, 'not yet re-measured at 100ms');
  mock.timers.tick(150);
  assert.notEqual(doc.body.children[0], first, 're-measured once the 250ms debounce elapses');
});

test('observe is off by default and a no-op when ResizeObserver is unavailable', () => {
  // default: no observer wired even when one is present
  const { FakeRO, instances } = fakeResizeObserver();
  const withRO = fakeDoc({ scrollX: 0, scrollY: 0, ResizeObserver: FakeRO });
  const a = sourceEl(withRO, { id: 'a', rect: rect(0, 0, 10, 10) });
  textBodies(asHTML(a), { granularity: 'box' }).annotate();
  assert.equal(instances.length, 0, 'no observer constructed by default');

  // observe requested but the runtime lacks ResizeObserver → snapshot still renders, no throw
  const noRO = fakeDoc();
  const b = sourceEl(noRO, { id: 'b', rect: rect(0, 0, 10, 10) });
  const dispose = textBodies(asHTML(b), { granularity: 'box', observe: true }).annotate();
  assert.equal(noRO.body.children.length, 1, 'spans still rendered without a ResizeObserver');
  dispose();
  assert.equal(noRO.body.children.length, 0);
});
