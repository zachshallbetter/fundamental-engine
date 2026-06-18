/**
 * textBodies tests — the Range-geometry slice of #257. Exercised against tiny fake elements and a
 * fake document (recorded attributes/styles + stub Range/getClientRects), the same no-real-DOM
 * pattern as platform.test.ts: granularity selection, span contract (body token, strength, the
 * visual-binding pair), disposal, and annotate idempotency.
 */
import { test } from 'node:test';
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

interface FakeDoc {
  body: FakeEl;
  defaultView: { scrollX: number; scrollY: number };
  createElement(tag: string): FakeEl;
  createRange(): unknown;
  /** every (node, start, end) word range the helper created, in order */
  wordRanges: Array<{ text: string; start: number; end: number }>;
}

function fakeDoc(view = { scrollX: 0, scrollY: 0 }): FakeDoc {
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
