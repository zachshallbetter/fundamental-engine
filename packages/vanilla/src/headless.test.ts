import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createField, headlessHost } from './index.ts';

// The non-visual consumer path: a field running on a DOM-free host, drawing nothing (render:'none'),
// driven by manual ticks, with bodies registered via addBody and read back through onFeedback. This
// is the agent / native-sidecar substrate.
test('createField runs headlessly on headlessHost + render:none, driven by tick()', () => {
  const host = headlessHost({ width: 400, height: 300 });
  const field = createField(undefined as never, { host, render: 'none' });

  let feedbacks = 0;
  const body = field.addBody({
    tokens: ['attract'],
    strength: 1,
    range: 220,
    rect: () => ({ left: 180, top: 130, width: 40, height: 40 }),
    onFeedback: () => {
      feedbacks++;
    },
  });

  assert.ok(field.particleCount() > 0, 'the field seeds matter headlessly (no DOM, no canvas)');
  for (let i = 0; i < 60; i++) host.tick();
  const mid = field.particleCount();
  for (let i = 0; i < 60; i++) host.tick();
  const end = field.particleCount();
  // the pool ramps to its steady-state target then holds — bounded, never runaway.
  assert.ok(end > 0, 'the field is live headlessly across 120 ticks');
  assert.ok(Math.abs(end - mid) <= 4, `the headless field settles to a stable count (mid ${mid}, end ${end})`);
  assert.ok(feedbacks > 0, 'onFeedback fired — per-body signals flow with no DOM, the agent read-out');

  body.remove();
  assert.doesNotThrow(() => field.destroy());
});

test('headlessHost.resize re-volumes the field without a DOM resize event', () => {
  const host = headlessHost({ width: 200, height: 200 });
  const field = createField(undefined as never, { host, render: 'none' });
  host.tick();
  host.resize(800, 600);
  assert.doesNotThrow(() => host.tick(), 'a re-sized headless volume keeps stepping');
  field.destroy();
});
