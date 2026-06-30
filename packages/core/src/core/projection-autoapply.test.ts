import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createField } from './field.ts';
import { agentJsonTarget, agentJsonProjection } from './projection-agent-json.ts';
import type { FieldProjectionTarget } from './types.ts';
import type { FieldHost } from './host.ts';

// A headless host that lets the test pump frames by hand (the rAF callback is stashed, then invoked).
function tickHost(width = 800, height = 600): { host: FieldHost; tick: (t?: number) => void } {
  let frame: ((t: number) => void) | null = null;
  let t = 0;
  const root = { querySelectorAll: () => [], querySelector: () => null, contains: () => false } as unknown as ParentNode;
  const host: FieldHost = {
    root,
    viewport: () => ({ width, height, dpr: 1 }),
    scrollY: () => 0,
    scrollHeight: () => height,
    reducedMotion: () => false,
    hidden: () => false,
    raf: (cb) => { frame = cb; return 1; },
    cancelRaf: () => { frame = null; },
    createCanvas: () => { throw new Error('no canvas'); },
    onResize: () => () => {},
    onScroll: () => () => {},
    onVisibility: () => () => {},
    onInput: () => () => {},
    onBodyEvent: () => () => {},
  };
  return { host, tick: (at) => { t = at ?? t + 1000 / 60; const cb = frame; frame = null; cb?.(t); } };
}

test('agentJsonTarget captures the last reading and serializes it', () => {
  const tgt = agentJsonTarget();
  assert.equal(tgt.value(), null, 'null before first write');
  assert.equal(tgt.json(), 'null');
  tgt.receive({ density: 0.4, attention: 0.9 });
  assert.deepEqual(tgt.value(), { density: 0.4, attention: 0.9 });
  assert.equal(tgt.json(), JSON.stringify({ density: 0.4, attention: 0.9 }));
  // captured by value — mutating the source later does not change what was received
  const src = { density: 1 };
  tgt.receive(src);
  src.density = 99;
  assert.equal(tgt.value()!.density, 1, 'stored a copy, not a reference');
});

test('agentJsonProjection writes through the registry apply() into an agent-json target', () => {
  const { host } = tickHost();
  const field = createField(undefined as never, { host, render: 'none' });
  const tgt = agentJsonTarget();
  field.projections.register(agentJsonProjection('agent', ['density'], { label: 'Agent view' }));
  field.projections.apply('agent', { density: 0.5 }, tgt);
  assert.deepEqual(tgt.value(), { density: 0.5 });
  field.destroy?.();
});

test('bind auto-applies a projection each write phase; unbind stops it', () => {
  const { host, tick } = tickHost();
  const field = createField(undefined as never, { host, render: 'none' });
  const tgt = agentJsonTarget();
  let n = 0;
  field.projections.register(agentJsonProjection('live', ['k']));
  const unbind = field.projections.bind('live', tgt, () => ({ k: ++n }));
  assert.equal(tgt.value(), null, 'no write before the first frame');
  tick();
  const afterOne = tgt.value()!.k;
  assert.ok(afterOne >= 1, 'projection applied on the write phase');
  tick();
  assert.ok(tgt.value()!.k > afterOne, 'applied again on the next frame');
  const stoppedAt = tgt.value()!.k;
  unbind();
  tick();
  assert.equal(tgt.value()!.k, stoppedAt, 'no further writes after unbind');
  field.destroy?.();
});

test('a bound projection never perturbs the simulation (read-only)', () => {
  const baseline = (() => {
    const { host, tick } = tickHost();
    const f = createField(undefined as never, { host, render: 'none', density: 1 });
    for (let i = 0; i < 10; i++) tick();
    const c = f.particleCount();
    f.destroy?.();
    return c;
  })();
  const { host, tick } = tickHost();
  const f = createField(undefined as never, { host, render: 'none', density: 1 });
  f.projections.register(agentJsonProjection('p', ['density']));
  f.projections.bind('p', agentJsonTarget(), () => ({ density: 1 }));
  for (let i = 0; i < 10; i++) tick();
  assert.equal(f.particleCount(), baseline, 'particle count identical with a projection bound');
  f.destroy?.();
});

// binding an unknown / apply-less id is inert (no throw)
test('binding an unregistered id is inert', () => {
  const { host, tick } = tickHost();
  const field = createField(undefined as never, { host, render: 'none' });
  const tgt: FieldProjectionTarget = { setAttribute: () => { throw new Error('should not be called'); } };
  field.projections.bind('nope', tgt, () => ({ x: 1 }));
  assert.doesNotThrow(() => tick());
  field.destroy?.();
});
