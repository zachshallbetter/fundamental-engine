/**
 * Shadow-DOM participation (docs/engine-reference/shadow-dom.md §29) — the registration contract. Uses tiny
 * EventTarget-backed fake hosts so the logic is exercised without a real DOM or jsdom.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  FieldController,
  ShadowRegistry,
  REGISTER_BODY,
  UNREGISTER_BODY,
  UPDATE_BODY,
} from './shadow.ts';
import { bodyFromElement } from './scanner.ts';

/** A minimal host: an EventTarget carrying `data-*` attrs, a dataset, and isConnected. */
function fakeHost(attrs: Record<string, string> = {}, connected = true): HTMLElement {
  const el = new EventTarget() as unknown as HTMLElement & { __a: Record<string, string> };
  el.__a = { ...attrs };
  (el as unknown as { isConnected: boolean }).isConnected = connected;
  el.getAttribute = (n: string) => (n.startsWith('data-') ? (el.__a[n.slice(5)] ?? null) : null);
  el.hasAttribute = (n: string) => n.startsWith('data-') && n.slice(5) in el.__a;
  (el as unknown as { dataset: Record<string, string> }).dataset = {};
  el.getBoundingClientRect = () =>
    ({ left: 0, top: 0, width: 100, height: 40, right: 100, bottom: 40, x: 0, y: 0 }) as DOMRect;
  (el as unknown as { style: { setProperty: () => void } }).style = { setProperty: () => {} };
  return el;
}

test('the registration event constants carry the field:* namespace', () => {
  assert.equal(REGISTER_BODY, 'field:register-body');
  assert.equal(UNREGISTER_BODY, 'field:unregister-body');
  assert.equal(UPDATE_BODY, 'field:update-body');
});

test('FieldController dispatches composed register/update/unregister carrying the host', () => {
  const host = fakeHost({ body: 'attract' });
  const seen: { type: string; el: unknown; composed: boolean; bubbles: boolean }[] = [];
  const record = (type: string) => (e: Event) => {
    const ce = e as CustomEvent;
    seen.push({ type, el: ce.detail.element, composed: ce.composed, bubbles: ce.bubbles });
  };
  host.addEventListener(REGISTER_BODY, record('register'));
  host.addEventListener(UPDATE_BODY, record('update'));
  host.addEventListener(UNREGISTER_BODY, record('unregister'));

  const c = new FieldController(host);
  c.connect();
  c.update();
  c.disconnect();

  assert.deepEqual(seen.map((s) => s.type), ['register', 'update', 'unregister']);
  assert.ok(seen.every((s) => s.el === host), 'detail.element is always the host');
  assert.ok(seen.every((s) => s.composed && s.bubbles), 'events cross the shadow boundary');
});

test('FieldController fires exactly one event per action — no alias twin', () => {
  const host = fakeHost({ body: 'attract' });
  let count = 0;
  host.addEventListener(REGISTER_BODY, () => void count++);
  const c = new FieldController(host);
  c.connect();
  assert.equal(count, 1, 'connect dispatches one field:register-body, not a twin');
});

test('FieldController forwards extra detail (getRect, writeTarget, attrs)', () => {
  const host = fakeHost();
  const target = fakeHost();
  const rect = () => host.getBoundingClientRect();
  let got: CustomEvent['detail'];
  host.addEventListener(REGISTER_BODY, (e) => {
    got = (e as CustomEvent).detail;
  });
  new FieldController(host, { getRect: rect, writeTarget: target, attrs: { body: 'repel' } }).connect();
  assert.equal(got.element, host);
  assert.equal(got.getRect, rect);
  assert.equal(got.writeTarget, target);
  assert.deepEqual(got.attrs, { body: 'repel' });
});

test('ShadowRegistry builds a body per live host, attaching rect + writeTarget', () => {
  const reg = new ShadowRegistry();
  const host = fakeHost({ body: 'attract', strength: '0.9' });
  const target = fakeHost();
  const rect = () => host.getBoundingClientRect();
  reg.register({ element: host, getRect: rect, writeTarget: target });
  assert.equal(reg.size, 1);

  const bodies = reg.bodies(bodyFromElement);
  assert.equal(bodies.length, 1);
  assert.equal(bodies[0]!.el, host);
  assert.equal(bodies[0]!.tokens[0], 'attract');
  assert.equal(bodies[0]!.strength, 0.9);
  assert.equal(bodies[0]!.rect, rect);
  assert.equal(bodies[0]!.writeTarget, target);
});

test('ShadowRegistry: explicit attrs override the host data-*', () => {
  const reg = new ShadowRegistry();
  const host = fakeHost({ body: 'attract' });
  reg.register({ element: host, attrs: { body: 'repel swirl', strength: '2' } });
  const [b] = reg.bodies(bodyFromElement);
  assert.deepEqual(b!.tokens, ['repel', 'swirl']);
  assert.equal(b!.strength, 2);
});

test('ShadowRegistry prunes a disconnected host on the next build (§15)', () => {
  const reg = new ShadowRegistry();
  const host = fakeHost({ body: 'attract' }, true);
  reg.register({ element: host });
  assert.equal(reg.bodies(bodyFromElement).length, 1);
  (host as unknown as { isConnected: boolean }).isConnected = false;
  assert.equal(reg.bodies(bodyFromElement).length, 0);
  assert.equal(reg.size, 0); // pruned from the map too
});

test('register is idempotent — re-registering refreshes, never duplicates (§15)', () => {
  const reg = new ShadowRegistry();
  const host = fakeHost({ body: 'attract' });
  reg.register({ element: host });
  reg.register({ element: host, attrs: { body: 'repel' } });
  assert.equal(reg.size, 1);
  const [b] = reg.bodies(bodyFromElement);
  assert.deepEqual(b!.tokens, ['repel']);
});
