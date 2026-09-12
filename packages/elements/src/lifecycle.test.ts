/**
 * `<field-root>` lifecycle contract (RC-3 / #320) — the unmount beat.
 *
 * `disconnectedCallback` is the web-component teardown: it must disconnect the visibility observer,
 * destroy the field, remove the owned overlay canvas, destroy the platform runtime, drop the
 * cross-document continuity seam (#679 — its pagehide listener; nothing is written on unmount), and
 * clear every handle to `undefined` (so a re-connect rebuilds cleanly). We run it against a prototype stub — the
 * same no-DOM approach as `field-root-surface.test.ts` — recording which teardown calls fired.
 *
 * See `docs/canonical/lifecycle-contract.md`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FieldField } from './index.ts';

function makeMountedStub() {
  const calls: string[] = [];
  return {
    calls,
    visibilityObserver: { disconnect: () => calls.push('observer.disconnect') },
    field: { destroy: () => calls.push('field.destroy') },
    overlayCanvas: { remove: () => calls.push('overlay.remove') },
    platformRuntime: { destroy: () => calls.push('runtime.destroy') },
    sessionContinuity: { restored: 0, teardown: () => calls.push('continuity.teardown') },
  };
}

test('disconnectedCallback tears down every owned resource (the unmount contract)', () => {
  const stub = makeMountedStub();
  FieldField.prototype.disconnectedCallback.call(stub as unknown as FieldField);

  // every resource the element owns is released, in the documented order.
  assert.deepEqual(stub.calls, [
    'observer.disconnect',
    'field.destroy',
    'overlay.remove',
    'runtime.destroy',
    'continuity.teardown',
  ]);
});

test('disconnectedCallback clears every handle to undefined (so re-connect rebuilds clean)', () => {
  const stub = makeMountedStub() as Record<string, unknown>;
  FieldField.prototype.disconnectedCallback.call(stub as unknown as FieldField);

  assert.equal(stub.visibilityObserver, undefined);
  assert.equal(stub.field, undefined);
  assert.equal(stub.overlayCanvas, undefined);
  assert.equal(stub.platformRuntime, undefined);
  assert.equal(stub.sessionContinuity, undefined);
});

test('disconnectedCallback on an already-bare element is a no-op (idempotent unmount)', () => {
  // a field-root that never connected (or disconnected twice) has all handles undefined.
  const bare = {
    visibilityObserver: undefined,
    field: undefined,
    overlayCanvas: undefined,
    platformRuntime: undefined,
    sessionContinuity: undefined,
  };
  assert.doesNotThrow(() => FieldField.prototype.disconnectedCallback.call(bare as unknown as FieldField));
});
