/**
 * Nearest-enclosing-field ownership (#980) — a body belongs to the NEAREST enclosing
 * `[data-field-boundary]` marker (the containment semantic, like CSS/event scoping). A
 * document-rooted scan skips bodies inside a marked boundary; a boundary-rooted scan owns exactly
 * its subtree; nested boundaries resolve to the nearest; removing the marker hands the bodies back
 * to the outer scan. Tested over stub elements (parent chains + a selector-aware querySelectorAll),
 * no DOM needed — mirrors `scanner.bodies.test.ts`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  scanBodies,
  bodyElements,
  ownedByScanRoot,
  FIELD_BOUNDARY_ATTR,
  FIELD_BOUNDARY_SELECTOR,
} from './scanner.ts';

interface FakeEl {
  attrs: Record<string, string>;
  parent: FakeEl | null;
  children: FakeEl[];
  dataset: Record<string, string | undefined>;
  getAttribute(n: string): string | null;
  hasAttribute(n: string): boolean;
  setAttribute(n: string, v: string): void;
  removeAttribute(n: string): void;
  closest(sel: string): FakeEl | null;
  querySelectorAll(sel: string): FakeEl[];
}

/** A minimal element with a real ancestor chain, attribute closest(), and a scanner-shaped
 *  querySelectorAll (supports exactly the selectors `scanBodies`/`bodyElements` issue). */
function el(attrs: Record<string, string>, parent: FakeEl | null = null): FakeEl {
  const node: FakeEl = {
    attrs,
    parent,
    children: [],
    dataset: {},
    getAttribute: (n) => attrs[n] ?? null,
    hasAttribute: (n) => n in attrs,
    setAttribute: (n, v) => {
      attrs[n] = v;
    },
    removeAttribute: (n) => {
      delete attrs[n];
    },
    closest(sel: string): FakeEl | null {
      assert.equal(sel, FIELD_BOUNDARY_SELECTOR, 'the scanner asks only for the boundary marker');
      // eslint-disable-next-line @typescript-eslint/no-this-alias
      let cur: FakeEl | null = node;
      while (cur) {
        if (FIELD_BOUNDARY_ATTR in cur.attrs) return cur;
        cur = cur.parent;
      }
      return null;
    },
    querySelectorAll(sel: string): FakeEl[] {
      // depth-first over descendants (document order), matching the scanner's selector clauses.
      const out: FakeEl[] = [];
      const visit = (n: FakeEl): void => {
        for (const c of n.children) {
          if (matches(c, sel)) out.push(c);
          visit(c);
        }
      };
      visit(node);
      return out;
    },
  };
  if (parent) parent.children.push(node);
  return node;
}

/** Match the exact selector strings the scanner uses (data-body / data-preset / authored / BODY_SELECTOR). */
function matches(n: FakeEl, sel: string): boolean {
  const has = (a: string) => a in n.attrs;
  return sel
    .split(',')
    .map((s) => s.trim())
    .some((clause) => {
      if (clause === '[data-body]') return has('data-body');
      if (clause === '[data-preset]') return has('data-preset');
      if (clause === '[data-intent]:not([data-body])') return has('data-intent') && !has('data-body');
      if (clause === '[data-field-role]:not([data-body]):not([data-intent])')
        return has('data-field-role') && !has('data-body') && !has('data-intent');
      throw new Error(`unexpected selector clause: ${clause}`);
    });
}

/** doc → section → boundary(list) → rows; plus a free body directly under the section. */
function tree() {
  const doc = el({});
  const section = el({}, doc);
  const free = el({ 'data-body': 'attract' }, section);
  const list = el({ [FIELD_BOUNDARY_ATTR]: '' }, section);
  const row1 = el({ 'data-body': 'attract' }, list);
  const row2 = el({ 'data-body': 'attract' }, list);
  return { doc, section, free, list, row1, row2 };
}

test('a document-rooted scan skips bodies inside a marked boundary (page field stops double-adopting)', () => {
  const { doc, free, list } = tree();
  const bodies = scanBodies(doc as unknown as ParentNode);
  assert.equal(bodies.length, 1, 'only the free body — the contained rows are not the page field’s');
  assert.equal(bodies[0]!.el, free as unknown as HTMLElement);
  // the measurement lane (bodyElements) applies the same ownership rule — no platform drift.
  assert.deepEqual(bodyElements(doc as unknown as ParentNode), [free]);
  assert.equal(ownedByScanRoot(list.children[0] as unknown as Element, doc as unknown as ParentNode), false);
});

test('a boundary-rooted scan owns exactly its subtree (including a body ON the boundary element)', () => {
  const { list, row1, row2 } = tree();
  const bodies = scanBodies(list as unknown as ParentNode);
  assert.deepEqual(
    bodies.map((b) => b.el),
    [row1, row2],
    'the contained field adopts its rows',
  );
  // a body ON the bounds element itself: its nearest boundary is the scan root → owned by it.
  list.attrs['data-body'] = 'attract';
  assert.equal(ownedByScanRoot(list as unknown as Element, list as unknown as ParentNode), true);
  assert.equal(ownedByScanRoot(list as unknown as Element, {} as ParentNode), false, 'and not by anyone else');
});

test('nested boundaries resolve to the NEAREST enclosing field', () => {
  const { doc, list, row1 } = tree();
  const inner = el({ [FIELD_BOUNDARY_ATTR]: '' }, list);
  const innerBody = el({ 'data-body': 'attract' }, inner);
  // the outer boundary scan owns its direct rows but NOT the inner boundary's body…
  assert.deepEqual(
    scanBodies(list as unknown as ParentNode).map((b) => b.el),
    [row1, list.children[1]], // row1, row2
  );
  // …the inner boundary scan owns it…
  assert.deepEqual(
    scanBodies(inner as unknown as ParentNode).map((b) => b.el),
    [innerBody],
  );
  // …and the document scan owns neither level.
  assert.equal(scanBodies(doc as unknown as ParentNode).length, 1);
});

test('marker removed (contained field destroyed) → the outer scan re-adopts on rescan', () => {
  const { doc, list } = tree();
  assert.equal(scanBodies(doc as unknown as ParentNode).length, 1, 'contained rows skipped while marked');
  list.removeAttribute(FIELD_BOUNDARY_ATTR); // what containerHost's detach() does on destroy
  assert.equal(scanBodies(doc as unknown as ParentNode).length, 3, 'free body + both rows re-adopted');
});

test('elements without closest (programmatic/stub bodies) are always owned — no behavior change', () => {
  const bare = { getAttribute: () => null, hasAttribute: () => false } as unknown as Element;
  assert.equal(ownedByScanRoot(bare, {} as ParentNode), true);
});
