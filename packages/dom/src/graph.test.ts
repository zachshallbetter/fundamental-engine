/**
 * PR-B registry tests: relationship normalization (native links → one graph → RelationshipAgents),
 * visual-semantic binding + lint, and overlay segment resolution from measurements. Relationship and
 * visual logic is exercised with fake elements + a resolver, so no document is needed.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { relationshipsFromElement, unresolvedRelationshipsFromElement, RelationshipRegistry } from './relationships.ts';
import { VisualBindingRegistry } from './visual-bindings.ts';
import { OverlayRegistry } from './overlays.ts';
import { MeasurementRegistry } from './measurement.ts';

test('unresolvedRelationshipsFromElement flags declared edges whose target does not resolve', () => {
  const target = fakeEl('section', {}, 'panel');
  const resolve = (id: string) => (id === 'panel' ? target : null);

  // resolves → one resolved edge, nothing unresolved
  const ok = fakeEl('div', { 'data-field-relation': 'supports', 'data-field-target': '#panel' });
  assert.equal(relationshipsFromElement(ok, resolve).length, 1);
  assert.equal(unresolvedRelationshipsFromElement(ok, resolve).length, 0);

  // missing target → no resolved edge, one unresolved (named) — never silently dropped
  const miss = fakeEl('div', { 'data-field-relation': 'supports', 'data-field-target': '#ghost' });
  assert.equal(relationshipsFromElement(miss, resolve).length, 0);
  const u = unresolvedRelationshipsFromElement(miss, resolve);
  assert.equal(u.length, 1);
  assert.equal(u[0]!.type, 'supports');
  assert.equal(u[0]!.target, '#ghost');
});

test('RelationshipRegistry.discover tracks resolved vs unresolved (resolution is real)', () => {
  const panel = fakeEl('section', {}, 'panel');
  const resolve = (id: string) => (id === 'panel' ? panel : null);
  const good = fakeEl('a', { href: '#panel' }, 'g'); // resolves
  const broken = fakeEl('a', { href: '#ghost' }, 'b'); // points at nothing
  const root = { querySelectorAll: () => [good, broken] } as unknown as ParentNode;

  const reg = new RelationshipRegistry();
  reg.discover(root, resolve);
  assert.equal(reg.size, 1, 'one resolved edge');
  assert.equal(reg.unresolvedSize, 1, 'one unresolved declaration — not dropped');
  assert.equal(reg.unresolvedAll()[0]!.target, '#ghost');

  // idempotent: re-discovering the same elements does not multiply unresolved entries
  reg.discover(root, resolve);
  assert.equal(reg.unresolvedSize, 1, 'stable key — no duplicate unresolved on rescan');
});

function fakeEl(tag: string, attrs: Record<string, string> = {}, id = ''): Element {
  return {
    tagName: tag.toUpperCase(),
    id,
    getAttribute: (n: string) => attrs[n] ?? null,
    hasAttribute: (n: string) => n in attrs,
  } as unknown as Element;
}

test('relationshipsFromElement reads native links (a[href#], aria-controls, data-field-relation)', () => {
  const target = fakeEl('section', {}, 'panel');
  const resolve = (id: string) => (id === 'panel' ? target : null);

  const link = fakeEl('a', { href: '#panel' }, 'lnk');
  const linkRels = relationshipsFromElement(link, resolve);
  assert.equal(linkRels[0]!.type, 'references');
  assert.equal(linkRels[0]!.source, 'html');
  assert.equal(linkRels[0]!.to, target);

  const btn = fakeEl('button', { 'aria-controls': 'panel' }, 'b');
  assert.equal(relationshipsFromElement(btn, resolve)[0]!.type, 'controls');

  const term = fakeEl('span', { 'data-field-relation': 'defines', 'data-field-target': '#panel', 'data-field-strength': '0.9' }, 't');
  const def = relationshipsFromElement(term, resolve)[0]!;
  assert.equal(def.type, 'defines');
  assert.equal(def.source, 'data');
  assert.equal(def.strength, 0.9);

  // unresolved target → no relationship
  assert.equal(relationshipsFromElement(fakeEl('a', { href: '#missing' }), () => null).length, 0);
});

test('RelationshipRegistry.add + toAgents maps to core RelationshipAgents', () => {
  const reg = new RelationshipRegistry();
  const a = fakeEl('h2', {}, 'term');
  const b = fakeEl('section', {}, 'def');
  reg.add({ from: a, to: b, type: 'defines', strength: 0.8, source: 'data' });
  assert.equal(reg.size, 1);
  const agent = reg.toAgents()[0]!;
  assert.equal(agent.from, 'term');
  assert.equal(agent.to, 'def');
  assert.equal(agent.type, 'defines');
  assert.equal(agent.strength, 0.8);
});

test('distinct id-less elements to the same target are distinct edges (idOf collision fix)', () => {
  // Regression: a content-hash fallback gave every id-less <a> the same key, so two anchors to the
  // same section collapsed to one edge (and citations got overwritten by TOC links). The WeakMap
  // fallback hands each element a stable, unique id.
  const target = fakeEl('section', {}, 'panel');
  const resolve = (id: string) => (id === 'panel' ? target : null);
  const a1 = fakeEl('a', { href: '#panel' }); // id-less
  const a2 = fakeEl('a', { href: '#panel' }); // id-less, a distinct element to the same target
  const root = { querySelectorAll: () => [a1, a2] } as unknown as ParentNode;

  const reg = new RelationshipRegistry();
  reg.discover(root, resolve);
  assert.equal(reg.size, 2, 'two distinct id-less anchors → two edges, not collapsed into one');

  // stable ids: re-discovering the same elements does not multiply edges
  reg.discover(root, resolve);
  assert.equal(reg.size, 2, 'same elements keep the same id — no duplicate edges on rescan');
});

test('VisualBindingRegistry lints orphan representations + non-hidden decorative visuals', () => {
  const reg = new VisualBindingRegistry();
  const svg = fakeEl('svg', { 'aria-hidden': 'true' });
  const source = fakeEl('h1', {}, 'title');
  reg.bind({ visual: svg, source, role: 'representation' });
  assert.equal(reg.lint().length, 0, 'a bound, hidden representation is clean');

  const orphan = fakeEl('canvas', { 'aria-hidden': 'true' });
  reg.bind({ visual: orphan, role: 'representation' }); // no source → error
  const exposed = fakeEl('svg', {}); // decorative but not hidden → warning
  reg.bind({ visual: exposed, role: 'decorative' });
  const codes = reg.lint().map((w) => w.code).sort();
  assert.deepEqual(codes, ['orphan-representation', 'visual-not-hidden']);
});

test('OverlayRegistry resolves relationship segments between measured element centres', () => {
  const measure = new MeasurementRegistry();
  const a = { isConnected: true, getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100, right: 100, bottom: 100, x: 0, y: 0 }) } as unknown as Element;
  const b = { isConnected: true, getBoundingClientRect: () => ({ left: 200, top: 200, width: 100, height: 100, right: 300, bottom: 300, x: 200, y: 200 }) } as unknown as Element;
  measure.register(a);
  measure.register(b);
  measure.measure(0, { width: 1000, height: 1000 });

  const overlays = new OverlayRegistry();
  overlays.add({ type: 'relationship', sourceElements: [a, b] });
  const segs = overlays.resolveSegments(measure);
  assert.equal(segs.length, 1);
  assert.deepEqual(segs[0]!.from, { x: 50, y: 50 });
  assert.deepEqual(segs[0]!.to, { x: 250, y: 250 });

  // an overlay with an unmeasured endpoint is skipped, not thrown
  overlays.add({ type: 'relationship', sourceElements: [a, fakeEl('div')] });
  assert.equal(overlays.resolveSegments(measure).length, 1);
});
