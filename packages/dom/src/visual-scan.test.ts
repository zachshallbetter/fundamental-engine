/**
 * Declarative visual-binding scan: `VisualBindingRegistry.scan(root, resolve)` discovers
 * [data-field-visual-for] / [data-field-visual-role] visuals and binds them to their semantic source.
 * Exercised with fake elements + an injected resolver (no document needed), mirroring the relationship
 * registry tests.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VisualBindingRegistry } from './visual-bindings.ts';

type Attrs = Record<string, string>;
function fakeEl(attrs: Attrs = {}, connected = true): Element {
  const el = {
    _attrs: { ...attrs },
    isConnected: connected,
    getAttribute(this: { _attrs: Attrs }, name: string): string | null {
      return name in this._attrs ? this._attrs[name]! : null;
    },
  };
  return el as unknown as Element;
}
const attrsOf = (el: Element): Attrs => (el as unknown as { _attrs: Attrs })._attrs;
const rootOf = (visuals: Element[]): ParentNode => ({ querySelectorAll: () => visuals } as unknown as ParentNode);

test('1. valid hidden representation binds + passes lint', () => {
  const reg = new VisualBindingRegistry();
  const source = fakeEl({}, true);
  const svg = fakeEl({ 'aria-hidden': 'true', 'data-field-visual-for': 'title', 'data-field-visual-role': 'representation' });
  const res = reg.scan(rootOf([svg]), (ref) => (ref === 'title' ? source : null));

  assert.equal(res.bound, 1);
  assert.equal(res.unresolved, 0);
  assert.equal(res.warnings.length, 0);
  const b = reg.get(svg)!;
  assert.equal(b.role, 'representation');
  assert.equal(b.semanticSource, source);
  assert.equal(reg.lint().length, 0, 'a bound, hidden representation is clean');
});

test('2. missing target → unresolved scan warning + orphan lint', () => {
  const reg = new VisualBindingRegistry();
  const svg = fakeEl({ 'aria-hidden': 'true', 'data-field-visual-for': 'missing', 'data-field-visual-role': 'representation' });
  const res = reg.scan(rootOf([svg]), () => null);

  assert.equal(res.unresolved, 1);
  assert.equal(res.warnings[0]!.reason, 'unresolved-source');
  assert.equal(res.warnings[0]!.value, 'missing');
  assert.deepEqual(reg.lint().map((w) => w.code), ['orphan-representation']);
});

test('3. not-hidden representation → duplicate-semantics lint', () => {
  const reg = new VisualBindingRegistry();
  const source = fakeEl();
  const svg = fakeEl({ 'data-field-visual-for': 'title', 'data-field-visual-role': 'representation' }); // no aria-hidden
  reg.scan(rootOf([svg]), () => source);
  assert.deepEqual(reg.lint().map((w) => w.code), ['duplicate-semantics']);
});

test('4. decorative may omit a source (hidden → clean)', () => {
  const reg = new VisualBindingRegistry();
  const svg = fakeEl({ 'aria-hidden': 'true', 'data-field-visual-role': 'decorative' });
  const res = reg.scan(rootOf([svg]), () => null);
  assert.equal(res.unresolved, 0);
  assert.equal(reg.get(svg)!.role, 'decorative');
  assert.equal(reg.lint().length, 0);
});

test('5. re-scanning is idempotent (no duplicate bindings)', () => {
  const reg = new VisualBindingRegistry();
  const source = fakeEl();
  const svg = fakeEl({ 'aria-hidden': 'true', 'data-field-visual-for': 'title', 'data-field-visual-role': 'representation' });
  const root = rootOf([svg]);
  reg.scan(root, () => source);
  reg.scan(root, () => source);
  assert.equal(reg.size, 1, 'same visual element → one binding across rescans');
});

test('6. role change updates the binding on rescan', () => {
  const reg = new VisualBindingRegistry();
  const svg = fakeEl({ 'aria-hidden': 'true', 'data-field-visual-role': 'decorative' });
  const root = rootOf([svg]);
  reg.scan(root, () => null);
  assert.equal(reg.get(svg)!.role, 'decorative');

  attrsOf(svg)['data-field-visual-role'] = 'debug';
  reg.scan(root, () => null);
  assert.equal(reg.get(svg)!.role, 'debug');
  assert.equal(reg.size, 1);
});

test('7. target change updates the bound source on rescan', () => {
  const reg = new VisualBindingRegistry();
  const a = fakeEl();
  const b = fakeEl();
  const svg = fakeEl({ 'aria-hidden': 'true', 'data-field-visual-for': 'a', 'data-field-visual-role': 'representation' });
  const root = rootOf([svg]);
  const resolve = (ref: string) => (ref === 'a' ? a : ref === 'b' ? b : null);
  reg.scan(root, resolve);
  assert.equal(reg.get(svg)!.semanticSource, a);

  attrsOf(svg)['data-field-visual-for'] = 'b';
  reg.scan(root, resolve);
  assert.equal(reg.get(svg)!.semanticSource, b);
});

test('invalid role defaults to representation + warns', () => {
  const reg = new VisualBindingRegistry();
  const source = fakeEl();
  const svg = fakeEl({ 'aria-hidden': 'true', 'data-field-visual-for': 'title', 'data-field-visual-role': 'sparkle' });
  const res = reg.scan(rootOf([svg]), () => source);
  assert.equal(reg.get(svg)!.role, 'representation');
  assert.ok(res.warnings.some((w) => w.reason === 'invalid-role' && w.value === 'sparkle'));
});

test('role omitted but data-field-visual-for present → representation', () => {
  const reg = new VisualBindingRegistry();
  const source = fakeEl();
  const svg = fakeEl({ 'aria-hidden': 'true', 'data-field-visual-for': 'title' });
  reg.scan(rootOf([svg]), () => source);
  assert.equal(reg.get(svg)!.role, 'representation');
});

test('data-visual-for alias resolves like data-field-visual-for', () => {
  const reg = new VisualBindingRegistry();
  const source = fakeEl();
  const svg = fakeEl({ 'aria-hidden': 'true', 'data-visual-for': 'title', 'data-field-visual-role': 'representation' });
  reg.scan(rootOf([svg]), (ref) => (ref === 'title' ? source : null));
  assert.equal(reg.get(svg)!.semanticSource, source);
});

test('disconnected visuals are pruned on rescan (navigation hygiene)', () => {
  const reg = new VisualBindingRegistry();
  const svg = fakeEl({ 'aria-hidden': 'true', 'data-field-visual-role': 'decorative' }, true);
  reg.scan(rootOf([svg]), () => null);
  assert.equal(reg.size, 1);
  (svg as unknown as { isConnected: boolean }).isConnected = false;
  reg.scan(rootOf([]), () => null); // svg gone from the DOM
  assert.equal(reg.size, 0, 'a disconnected visual is dropped');
});
