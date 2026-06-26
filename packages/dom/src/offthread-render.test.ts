import { test } from 'node:test';
import assert from 'node:assert/strict';

test('attachOffthreadRender returns supported=false when OffscreenCanvas unavailable (Node)', async () => {
  // In Node, OffscreenCanvas is not available → should return { supported: false }
  const { attachOffthreadRender } = await import('./worker/offthread-bridge.ts');
  const fakeField = { particleCount: () => 0, readParticles: () => 0 } as any;
  const fakeCanvas = { width: 400, height: 300, transferControlToOffscreen: undefined } as any;
  const result = attachOffthreadRender(fakeField, fakeCanvas);
  assert.equal(result.supported, false, 'graceful fallback in Node/no-OffscreenCanvas env');
  result.teardown(); // should not throw
});
