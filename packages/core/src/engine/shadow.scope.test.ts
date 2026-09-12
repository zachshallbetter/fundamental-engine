/**
 * Scoped participation + portals for event-registered hosts (docs/engine-reference/shadow-dom.md
 * §17–§19, §29 "Field Portals"; #681). A host registers with an optional `scope` / `field` on its
 * `RegisterBodyDetail`; `ShadowRegistry.bodies(build, root)` then builds it only for the field that
 * owns it. The DEFAULT path (no `scope`, no `field`) is pinned first: every field that hears the
 * event adopts the host, exactly as before — including when the asking field passes its root.
 *
 * Exercised over a fake composed tree (parent chains, attribute `closest()`, `getRootNode()` hops
 * across a fake shadow root, `matches()` on ids) — no jsdom, mirroring `scanner.boundary.test.ts`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ShadowRegistry, fieldAdopts, nearestFieldBoundary, isPageRoot, type RegisterBodyDetail } from './shadow.ts';
import { bodyFromElement, FIELD_BOUNDARY_ATTR, FIELD_BOUNDARY_SELECTOR, ownedByScanRoot } from './scanner.ts';
import { createField } from './field.ts';
import type { FieldHost } from './host.ts';

// ── a minimal composed tree ──────────────────────────────────────────────────────────────────────
interface FakeNode {
  nodeType: number;
  attrs: Record<string, string>;
  parent: FakeNode | null;
  /** the tree this node lives in: the document, or a shadow root (whose `host` is a FakeNode). */
  treeRoot: FakeNode;
  host?: FakeNode; // set on a shadow root
  ownerDocument: FakeNode | null;
  documentElement?: FakeNode; // set on the document
  isConnected: boolean;
  dataset: Record<string, string>;
  style: { setProperty(): void; removeProperty(): void };
  getAttribute(n: string): string | null;
  hasAttribute(n: string): boolean;
  closest(sel: string): FakeNode | null;
  matches(sel: string): boolean;
  getRootNode(): FakeNode;
  getBoundingClientRect(): DOMRect;
  querySelectorAll(sel: string): FakeNode[];
  querySelector(): null;
  contains(): boolean;
}

function makeDoc(): FakeNode {
  const doc = { nodeType: 9, attrs: {}, parent: null, ownerDocument: null, isConnected: true } as FakeNode;
  doc.treeRoot = doc;
  doc.querySelectorAll = () => [];
  doc.querySelector = () => null;
  doc.contains = () => false;
  const html = el({}, doc);
  doc.documentElement = html;
  return doc;
}

/** an element under `parent`, in `parent`'s tree unless `tree` (a shadow root) is given. */
function el(attrs: Record<string, string>, parent: FakeNode, tree?: FakeNode): FakeNode {
  const node: FakeNode = {
    nodeType: 1,
    attrs: { ...attrs },
    parent,
    treeRoot: tree ?? parent.treeRoot,
    ownerDocument: parent.nodeType === 9 ? parent : parent.ownerDocument,
    isConnected: true,
    dataset: {},
    style: { setProperty() {}, removeProperty() {} },
    getAttribute: (n) => node.attrs[n] ?? null,
    hasAttribute: (n) => n in node.attrs,
    closest(sel) {
      assert.equal(sel, FIELD_BOUNDARY_SELECTOR, 'only the boundary marker is ever asked for');
      // closest() never crosses a shadow root: walk parents within this node's own tree only.
      let cur: FakeNode | null = node;
      while (cur && cur.treeRoot === node.treeRoot && cur.nodeType === 1) {
        if (FIELD_BOUNDARY_ATTR in cur.attrs) return cur;
        cur = cur.parent;
      }
      return null;
    },
    matches: (sel) => sel === `#${node.attrs.id}`,
    getRootNode: () => node.treeRoot,
    getBoundingClientRect: () =>
      ({ left: 120, top: 80, width: 100, height: 40, right: 220, bottom: 120, x: 120, y: 80 }) as DOMRect,
    querySelectorAll: () => [],
    querySelector: () => null,
    contains: () => false,
  };
  return node;
}

/** a shadow root attached to `host`; children created with `el(attrs, host, shadow)` live inside it. */
function attachShadow(host: FakeNode): FakeNode {
  const shadow = { nodeType: 11, attrs: {}, parent: null, host, ownerDocument: host.ownerDocument, isConnected: true } as FakeNode;
  shadow.treeRoot = shadow;
  return shadow;
}

/** document > html > page-host, card[data-field-boundary] > card-host; both hosts are bodies. */
function tree() {
  const doc = makeDoc();
  const html = doc.documentElement!;
  const pageHost = el({ 'data-body': 'attract' }, html);
  const card = el({ [FIELD_BOUNDARY_ATTR]: '', id: 'card' }, html);
  const cardHost = el({ 'data-body': 'attract' }, card);
  return { doc, html, pageHost, card, cardHost };
}

const asEl = (n: FakeNode) => n as unknown as HTMLElement;
const asRoot = (n: FakeNode) => n as unknown as ParentNode;
const built = (reg: ShadowRegistry, root?: FakeNode) => reg.bodies(bodyFromElement, root && asRoot(root)).map((b) => b.el);

// ── the default path, pinned ─────────────────────────────────────────────────────────────────────

test('PIN: a detail without scope/field is built by EVERY asking field — page and card alike, root or not', () => {
  const { doc, card, cardHost, pageHost } = tree();
  const reg = new ShadowRegistry();
  reg.register({ element: asEl(cardHost) });
  reg.register({ element: asEl(pageHost) });
  // no root (headless / harness hosts): unchanged signature, every live host.
  assert.deepEqual(built(reg), [cardHost, pageHost]);
  // with a root — the field.ts call site now passes host.root — still every live host, both fields.
  assert.deepEqual(built(reg, doc), [cardHost, pageHost], 'the page field adopts both (as before)');
  assert.deepEqual(built(reg, card), [cardHost, pageHost], 'the contained field adopts both (as before)');
  // and the light-DOM scanner's rule is NOT applied to the default event path — that is the #980
  // gap this feature closes only when a host opts in.
  assert.equal(ownedByScanRoot(cardHost as unknown as Element, asRoot(doc)), false);
  assert.equal(fieldAdopts({ element: asEl(cardHost) }, asRoot(doc)), true);
});

test("PIN: scope 'global' is the explicit spelling of the default", () => {
  const { doc, card, cardHost } = tree();
  const reg = new ShadowRegistry();
  reg.register({ element: asEl(cardHost), scope: 'global' });
  assert.deepEqual(built(reg, doc), [cardHost]);
  assert.deepEqual(built(reg, card), [cardHost]);
});

// ── scope: 'nearest' ─────────────────────────────────────────────────────────────────────────────

test("scope 'nearest' inside a boundary → only the contained (card) field builds the host", () => {
  const { doc, card, cardHost } = tree();
  const reg = new ShadowRegistry();
  reg.register({ element: asEl(cardHost), scope: 'nearest' });
  assert.deepEqual(built(reg, doc), [], 'the page field skips it — no second --d writer');
  assert.deepEqual(built(reg, card), [cardHost]);
  assert.equal(reg.size, 1, 'not adopted ≠ pruned: the host stays registered');
});

test("scope 'nearest' with no enclosing boundary → the page field builds it (both root spellings)", () => {
  const { doc, html, card, pageHost } = tree();
  const reg = new ShadowRegistry();
  reg.register({ element: asEl(pageHost), scope: 'nearest' });
  assert.deepEqual(built(reg, doc), [pageHost], 'document root (browserHost)');
  assert.deepEqual(built(reg, html), [pageHost], 'documentElement root (platform runtime)');
  assert.deepEqual(built(reg, card), [], 'a contained field never adopts a body outside its bounds');
});

test("scope 'nearest': nested boundaries resolve to the NEAREST", () => {
  const { doc, card } = tree();
  const inner = el({ [FIELD_BOUNDARY_ATTR]: '' }, card);
  const innerHost = el({ 'data-body': 'attract' }, inner);
  const reg = new ShadowRegistry();
  reg.register({ element: asEl(innerHost), scope: 'nearest' });
  assert.deepEqual(built(reg, doc), []);
  assert.deepEqual(built(reg, card), []);
  assert.deepEqual(built(reg, inner), [innerHost]);
});

test("scope 'nearest' resolves ACROSS a shadow boundary — a host nested in another component's shadow tree", () => {
  const { doc, card } = tree();
  // card > outer-component (light DOM) ⇢ #shadow-root > nested-host
  const outer = el({}, card);
  const shadow = attachShadow(outer);
  const nested = el({ 'data-body': 'attract' }, outer, shadow);
  assert.equal(nested.closest(FIELD_BOUNDARY_SELECTOR), null, 'closest() alone stops at the shadow root');
  assert.equal(nearestFieldBoundary(nested as unknown as Element), card as unknown as Element, 'the hop to the host finds it');
  const reg = new ShadowRegistry();
  reg.register({ element: asEl(nested), scope: 'nearest' });
  assert.deepEqual(built(reg, doc), []);
  assert.deepEqual(built(reg, card), [nested]);
});

test("scope 'nearest' on an element without closest (programmatic/stub host) is always owned — the scanner's rule", () => {
  const bare = {
    isConnected: true,
    getAttribute: (n: string) => (n === 'data-body' ? 'attract' : null),
    hasAttribute: (n: string) => n === 'data-body',
    dataset: {},
    style: { setProperty() {}, removeProperty() {} },
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 10, height: 10 }) as DOMRect,
  } as unknown as HTMLElement;
  const { doc, card } = tree();
  const reg = new ShadowRegistry();
  reg.register({ element: bare, scope: 'nearest' });
  assert.deepEqual(built(reg, doc), [bare]);
  assert.deepEqual(built(reg, card), [bare]);
  assert.equal(nearestFieldBoundary(bare as unknown as Element), null);
});

// ── field: portals ───────────────────────────────────────────────────────────────────────────────

test("field: 'root' bypasses the contained field the host sits in — only the page field adopts it", () => {
  const { doc, html, card, cardHost } = tree();
  const reg = new ShadowRegistry();
  reg.register({ element: asEl(cardHost), field: 'root' });
  assert.deepEqual(built(reg, card), [], 'the local field is bypassed (§29: "data-scope global bypasses local cell")');
  assert.deepEqual(built(reg, doc), [cardHost]);
  assert.deepEqual(built(reg, html), [cardHost], 'the platform runtime scans documentElement — also the page');
  assert.equal(isPageRoot(asRoot(doc)), true);
  assert.equal(isPageRoot(asRoot(html)), true);
  assert.equal(isPageRoot(asRoot(card)), false);
  assert.equal(isPageRoot({} as ParentNode), false, 'a headless stub is not the page');
});

test('field: "#selector" targets the field whose scan root matches — from anywhere in the tree', () => {
  const { doc, card, pageHost } = tree();
  const reg = new ShadowRegistry();
  // a page-level host portals INTO the card's field
  reg.register({ element: asEl(pageHost), field: '#card' });
  assert.deepEqual(built(reg, doc), [], 'the page field, which the host sits in, does not adopt it');
  assert.deepEqual(built(reg, card), [pageHost]);
});

test('field: Element targets the field whose scan root IS that element', () => {
  const { doc, card, pageHost } = tree();
  const reg = new ShadowRegistry();
  reg.register({ element: asEl(pageHost), field: card as unknown as Element });
  assert.deepEqual(built(reg, doc), []);
  assert.deepEqual(built(reg, card), [pageHost]);
});

test('field: a target no field matches → adopted by no field (inert until one exists), never thrown', () => {
  const { doc, card, pageHost } = tree();
  const reg = new ShadowRegistry();
  reg.register({ element: asEl(pageHost), field: '#nope' });
  assert.deepEqual(built(reg, doc), []);
  assert.deepEqual(built(reg, card), []);
  assert.equal(reg.size, 1);
  // a document root has no matches() — a selector target simply never matches the page field.
  assert.equal(fieldAdopts({ element: asEl(pageHost), field: '#card' }, asRoot(doc)), false);
});

test('field beats scope when both are set (§17 resolution order)', () => {
  const { doc, card, cardHost } = tree();
  const d: RegisterBodyDetail = { element: asEl(cardHost), scope: 'nearest', field: 'root' };
  assert.equal(fieldAdopts(d, asRoot(card)), false, "'nearest' alone would pick the card…");
  assert.equal(fieldAdopts(d, asRoot(doc)), true, '…but the explicit target wins');
});

test('a disconnected host is still pruned even when the asking field would not adopt it', () => {
  const { doc, cardHost } = tree();
  const reg = new ShadowRegistry();
  reg.register({ element: asEl(cardHost), scope: 'nearest' });
  cardHost.isConnected = false;
  assert.deepEqual(built(reg, doc), []);
  assert.equal(reg.size, 0);
});

// ── the engine-level pin: the default event path yields the same bodies as the light-DOM scan ───
//
// A seeded headless field (determinism.test.ts style) whose one body arrives (a) through the
// register-body event path — the ShadowRegistry now handed host.root — versus (b) the untouched
// light-DOM scanner, for the SAME element. Before this change the two paths built identical bodies
// (both `bodyFromElement`); they still must, so the free-matter fingerprint is byte-identical.

function lcg(seed: number): () => number {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

function headlessHost(root: FakeNode) {
  let frame: ((t: number) => void) | null = null;
  let t = 0;
  const handlers: Record<string, (e: Event) => void> = {};
  const host: FieldHost = {
    root: asRoot(root),
    viewport: () => ({ width: 400, height: 300, dpr: 1 }),
    scrollY: () => 0,
    scrollHeight: () => 300,
    reducedMotion: () => false,
    hidden: () => false,
    raf: (cb) => { frame = cb; return 1; },
    cancelRaf: () => { frame = null; },
    createCanvas: () => { throw new Error('no canvas'); },
    onResize: () => () => {},
    onScroll: () => () => {},
    onVisibility: () => () => {},
    onInput: () => () => {},
    onBodyEvent: (type, cb) => { handlers[type] = cb; return () => {}; },
  };
  return { host, handlers, tick: () => { t += 1000 / 60; const cb = frame; frame = null; cb?.(t); } };
}

async function fingerprint(seed: number, via: 'event' | 'scan', detail: Partial<RegisterBodyDetail> = {}): Promise<string> {
  const { doc, html } = tree();
  const body = el({ 'data-body': 'attract', 'data-strength': '2', 'data-range': '200' }, html);
  if (via === 'scan') doc.querySelectorAll = (sel: string) => (sel === '[data-body]' ? [body] : []);
  const { host, handlers, tick } = headlessHost(doc);
  const field = createField(undefined as never, { host, render: 'none', rng: lcg(seed), now: () => 0 });
  if (via === 'event') {
    handlers['field:register-body']!({ detail: { element: asEl(body), ...detail } } as unknown as Event);
    await Promise.resolve(); // the coalesced rescan runs on a microtask
  }
  assert.equal(field.snapshot().bodies.length, 1, `${via}: the body is in the field`);
  for (let i = 0; i < 40; i++) tick();
  const snap = field.snapshot({ includeParticles: true });
  const fp = (snap.particles ?? []).map((p) => `${p.x.toFixed(6)},${p.y.toFixed(6)},${p.heat.toFixed(6)}`).join('|');
  field.destroy();
  return fp;
}

test('PIN: a default-registered host drives the seeded field byte-identically to the light-DOM scan of the same element', async () => {
  const viaScan = await fingerprint(11, 'scan');
  const viaEvent = await fingerprint(11, 'event');
  assert.ok(viaScan.length > 0, 'the pool has free matter to fingerprint');
  assert.equal(viaEvent, viaScan);
  assert.equal(await fingerprint(11, 'event'), viaEvent, 'and run-to-run identical');
  // opting in where the page field IS the owner changes nothing either.
  assert.equal(await fingerprint(11, 'event', { scope: 'nearest' }), viaScan);
  assert.equal(await fingerprint(11, 'event', { field: 'root' }), viaScan);
});

test('the fingerprint genuinely depends on the body (a filtered-out host leaves the field body-less)', async () => {
  const { doc, html } = tree();
  const body = el({ 'data-body': 'attract' }, html);
  const { host, handlers } = headlessHost(doc);
  const field = createField(undefined as never, { host, render: 'none', rng: lcg(1), now: () => 0 });
  handlers['field:register-body']!({ detail: { element: asEl(body), field: '#card' } } as unknown as Event);
  await Promise.resolve();
  assert.equal(field.snapshot().bodies.length, 0, 'portal to a contained field: the page field builds nothing');
  field.destroy();
});
