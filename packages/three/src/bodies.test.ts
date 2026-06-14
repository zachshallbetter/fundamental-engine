/**
 * `FieldBodyRegistry` — meshes as field bodies. Pins the virtual-element the engine reads (token
 * attrs + a rect projected from the mesh's world position), the carried `data` record, the feedback
 * routed back to the body, and add/remove. Renderer-free: `Object3D` + `PlaneProjection` are pure.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Object3D } from 'three';
import { PlaneProjection } from './project.ts';
import { FieldBodyRegistry } from './bodies.ts';

const els = (reg: FieldBodyRegistry): { getAttribute(n: string): string | null; hasAttribute(n: string): boolean; getBoundingClientRect(): { left: number; top: number; width: number; height: number } }[] =>
  (reg.root.querySelectorAll('[data-body]') as unknown as never[]);

test('a registered mesh becomes a body element with token attrs + a projected rect', () => {
  const projection = new PlaneProjection({ width: 1000, height: 600, scale: 0.01 });
  const reg = new FieldBodyRegistry(projection);

  const mesh = new Object3D(); // at world origin → field centre (500, 300)
  const body = reg.add(mesh, { tokens: ['attract', 'swirl'], strength: 1.6, range: 420, sizePx: 30, data: { genome: 'rose' } });

  const found = els(reg);
  assert.equal(found.length, 1, 'one body element registered');
  const el = found[0]!;
  assert.equal(el.getAttribute('data-body'), 'attract swirl', 'tokens joined');
  assert.equal(el.getAttribute('data-strength'), '1.6');
  assert.equal(el.getAttribute('data-range'), '420');
  assert.ok(el.hasAttribute('data-feedback'), 'feedback opted in by default');

  const r = el.getBoundingClientRect();
  assert.ok(Math.abs(r.left + r.width / 2 - 500) < 1e-6, 'rect centred at the projected field x');
  assert.ok(Math.abs(r.top + r.height / 2 - 300) < 1e-6, 'rect centred at the projected field y');
  assert.equal(r.width, 30, 'rect uses sizePx');

  assert.deepEqual(body.data, { genome: 'rose' }, 'the body carries its data record');
});

test('spec.color lands on the virtual element dataset (the pigment tint the scanner reads)', () => {
  const reg = new FieldBodyRegistry(new PlaneProjection());
  reg.add(new Object3D(), { tokens: 'attract pigment', color: '#e86fa4' });
  const el = (reg.root.querySelectorAll('[data-body]') as unknown as { dataset: Record<string, string> }[])[0]!;
  assert.equal(el.dataset.color, '#e86fa4', 'dataset.color carries the tint');
});

test('the rect tracks the mesh as it moves', () => {
  const projection = new PlaneProjection({ width: 1000, height: 600, scale: 0.01 });
  const reg = new FieldBodyRegistry(projection);
  const mesh = new Object3D();
  reg.add(mesh, { tokens: 'gravity' });

  const before = els(reg)[0]!.getBoundingClientRect();
  mesh.position.set(1, 0, 0); // +1 world unit in x → +100 field px (scale 0.01)
  const after = els(reg)[0]!.getBoundingClientRect();
  assert.ok(after.left - before.left - 100 < 1e-6 && after.left > before.left, 'rect follows the mesh');
});

test('species + affects land as data-* attrs (matter tagging)', () => {
  const reg = new FieldBodyRegistry(new PlaneProjection());
  reg.add(new Object3D(), { tokens: 'spawn', species: 2 });
  reg.add(new Object3D(), { tokens: 'attract', affects: [1, 2] });
  const list = els(reg);
  assert.equal(list[0]!.getAttribute('data-species'), '2', 'source stamps its species');
  assert.equal(list[1]!.getAttribute('data-affects'), '1,2', 'selective body lists its species');
});

test('set() mutates the attrs the engine re-reads (reactive params, no re-scan)', () => {
  const reg = new FieldBodyRegistry(new PlaneProjection());
  const body = reg.add(new Object3D(), { tokens: 'attract', strength: 0.5, range: 300 });
  const el = els(reg)[0]!;
  assert.equal(el.getAttribute('data-strength'), '0.5');

  body.set({ strength: 2.4, range: 500, angle: 90 });
  assert.equal(el.getAttribute('data-strength'), '2.4', 'live strength visible to the scanner');
  assert.equal(el.getAttribute('data-range'), '500');
  assert.equal(el.getAttribute('data-angle'), '90', 'angle in degrees');
});

test('feedback routes to the body; remove unregisters', () => {
  const projection = new PlaneProjection();
  const reg = new FieldBodyRegistry(projection);
  const mesh = new Object3D();
  let seen: number | undefined;
  const body = reg.add(mesh, { tokens: 'attract', onFeedback: (ch) => (seen = ch.density) });

  // simulate the engine's write through the sink (sink receives the body's virtual element)
  const el = (reg.root.querySelectorAll('[data-body]') as unknown as never[])[0]!;
  reg.sink(el as never, { density: 0.42, load: 0.1 });
  assert.equal(seen, 0.42, 'onFeedback fired with the channel');
  assert.equal(body.channels.density, 0.42, 'channels stored on the body');

  body.remove();
  assert.equal((reg.root.querySelectorAll('[data-body]') as unknown as never[]).length, 0, 'removed');
});
