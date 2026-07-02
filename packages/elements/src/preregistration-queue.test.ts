/**
 * SSR pre-registration queue (docs/engine-reference/shadow-dom.md §31.10).
 *
 * The queue captures composed `field:register-body` events dispatched *before* a field boots and
 * replays them once a field is live, so a server-rendered body that upgrades before `<field-root>`
 * still joins the field. The module reads the global `document`; we install a minimal fake DOM (built
 * on Node's real `EventTarget` + `CustomEvent`) that models the one behaviour the queue relies on —
 * a composed event dispatched on an element bubbles to `document` — so the capture → buffer → drain
 * path is exercised for real, DOM-free (the same testable-without-a-DOM approach as the shadow test).
 *
 * Order of concerns proven here mirrors §31.10: buffer early events, dedupe by element (last write
 * wins — an unregister supersedes a pending register), resolve/register on drain, never double-register.
 */
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { REGISTER_BODY, UNREGISTER_BODY } from '@fundamental-engine/core';

// ── a minimal fake DOM: element.dispatchEvent(composed) bubbles to document ──────────────────────
class FakeElement extends EventTarget {
  isConnected = true;
  // real DOM bubbling would carry a composed event up to document; model exactly that hop.
  override dispatchEvent(ev: Event): boolean {
    super.dispatchEvent(ev);
    if ((ev as { bubbles?: boolean }).bubbles && fakeDocument) fakeDocument.dispatchEvent(ev);
    return true;
  }
}
let fakeDocument: EventTarget | undefined;

/** Fresh module state + a fresh fake `document` per test (the module caches install state). */
async function loadQueue() {
  fakeDocument = new EventTarget();
  (globalThis as { document?: unknown }).document = fakeDocument;
  // import fresh each test so the module's install/active flags start clean.
  const mod = await import(`./preregistration-queue.ts?bust=${Math.random()}`);
  mod.installPreRegistrationQueue();
  return mod as typeof import('./preregistration-queue.ts');
}

let queue: Awaited<ReturnType<typeof loadQueue>>;
beforeEach(async () => {
  queue = await loadQueue();
});
afterEach(() => {
  queue.resetPreRegistrationQueue();
  delete (globalThis as { document?: unknown }).document;
  fakeDocument = undefined;
});

/** Dispatch a composed register/unregister event from an element (as FieldController.connect() does). */
function fire(type: string, element: FakeElement): void {
  element.dispatchEvent(new CustomEvent(type, { bubbles: true, composed: true, detail: { element } }));
}

test('an element registered BEFORE the field boots is captured, then registered once on drain (§31.10)', () => {
  const body = new FakeElement();
  // (1) body upgrades before the field: no field is live, so the event is buffered, not lost.
  fire(REGISTER_BODY, body);
  assert.equal(queue.pendingRegistrationCount(), 1, 'early registration buffered');

  // (2) the field boots: it wires its listener, marks itself live, then drains the queue.
  const registered: EventTarget[] = [];
  fakeDocument!.addEventListener(REGISTER_BODY, (e) => registered.push((e as CustomEvent).detail.element));
  queue.markFieldActive();
  queue.flushPreRegistrationQueue();

  // (3) the buffered event replayed and reached the field's listener exactly once — no loss, no dupe.
  assert.deepEqual(registered, [body], 'buffered body registered once on drain');
  assert.equal(queue.pendingRegistrationCount(), 0, 'queue emptied by drain');
});

test('a burst per element collapses (last write wins): unregister supersedes a pending register', () => {
  const body = new FakeElement();
  fire(REGISTER_BODY, body);
  fire(UNREGISTER_BODY, body); // the body connected then disconnected before any field existed
  assert.equal(queue.pendingRegistrationCount(), 1, 'deduped to one entry per element');

  const events: string[] = [];
  fakeDocument!.addEventListener(REGISTER_BODY, () => events.push('register'));
  fakeDocument!.addEventListener(UNREGISTER_BODY, () => events.push('unregister'));
  queue.markFieldActive();
  queue.flushPreRegistrationQueue();

  // only the LAST intent replays — no stale register resurrects a retired body.
  assert.deepEqual(events, ['unregister'], 'only the final intent (unregister) is replayed');
});

test('once a field is live, later registrations are NOT buffered (they reach the field directly)', () => {
  queue.markFieldActive(); // a field is already live
  const body = new FakeElement();
  fire(REGISTER_BODY, body);
  assert.equal(queue.pendingRegistrationCount(), 0, 'live-path event bypasses the queue');
});

test('a disconnected element is skipped on drain (no stale body replayed)', () => {
  const body = new FakeElement();
  fire(REGISTER_BODY, body);
  body.isConnected = false; // element left the DOM during the field-less window

  const registered: EventTarget[] = [];
  fakeDocument!.addEventListener(REGISTER_BODY, (e) => registered.push((e as CustomEvent).detail.element));
  queue.markFieldActive();
  queue.flushPreRegistrationQueue();

  assert.deepEqual(registered, [], 'disconnected element is not replayed');
  assert.equal(queue.pendingRegistrationCount(), 0, 'queue still drained');
});

test('draining an empty queue is a no-op (the common client-only path)', () => {
  queue.markFieldActive();
  assert.doesNotThrow(() => queue.flushPreRegistrationQueue());
  assert.equal(queue.pendingRegistrationCount(), 0);
});

test('SSR-safe: importing and installing with NO document present never throws', async () => {
  // model the server: no `document` global. The module must import (no bare document/window at load)
  // and installPreRegistrationQueue() must no-op rather than throw.
  const savedDoc = (globalThis as { document?: unknown }).document;
  delete (globalThis as { document?: unknown }).document;
  try {
    const mod = await import(`./preregistration-queue.ts?ssr=${Math.random()}`);
    assert.doesNotThrow(() => mod.installPreRegistrationQueue(), 'install is a no-op without document');
    // with nothing installed there is nothing to buffer/drain — the field-less baseline holds.
    assert.equal(mod.pendingRegistrationCount(), 0);
    assert.doesNotThrow(() => mod.flushPreRegistrationQueue());
  } finally {
    if (savedDoc !== undefined) (globalThis as { document?: unknown }).document = savedDoc;
  }
});

test('the queue resumes buffering after the last field tears down', () => {
  queue.markFieldActive();
  assert.equal(queue.isBuffering(), false, 'not buffering while a field is live');
  queue.markFieldInactive();
  assert.equal(queue.isBuffering(), true, 'buffering resumes when no field remains');

  const body = new FakeElement();
  fire(REGISTER_BODY, body);
  assert.equal(queue.pendingRegistrationCount(), 1, 'a (re)connect during a field-less window is captured');
});
