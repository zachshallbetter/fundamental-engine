/**
 * The `<field-root>` runtime's quality governor runs on the display's detected frame budget, not a
 * hard-coded 60 Hz (engine audit 2026-10-14, M6). A steady 30 Hz display (iOS Low Power Mode) used to
 * read every frame as an overrun and sit at tier 2 for good — halved platform ticks, a capped DPR, no
 * heatmap — with nothing actually overloaded. Driven over a manual rAF queue + minimal DOM globals.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { FieldHandle } from '@fundamental-engine/core';
import { startPlatformRuntime } from './platform-runtime.ts';

/** Run the runtime for `frames` rAF ticks, `spacing(i)` ms apart; returns every tier it emitted. */
function run(frames: number, spacing: (i: number) => number): number[] {
  const g = globalThis as Record<string, unknown>;
  const saved = ['window', 'document', 'requestAnimationFrame', 'cancelAnimationFrame', 'CustomEvent'].map(
    (k) => [k, g[k]] as const,
  );
  const pending = new Map<number, (t: number) => void>();
  let id = 0;
  const doc = {
    addEventListener: () => {},
    removeEventListener: () => {},
    documentElement: { style: { setProperty: () => {} } },
  };
  g.window = { innerWidth: 800, innerHeight: 600 };
  g.document = doc;
  g.requestAnimationFrame = (cb: (t: number) => void) => (pending.set(++id, cb), id);
  g.cancelAnimationFrame = (i: number) => void pending.delete(i);
  g.CustomEvent = class {
    type: string;
    constructor(type: string) {
      this.type = type;
    }
  };
  const tiers: number[] = [];
  try {
    const root = {
      ownerDocument: doc,
      querySelectorAll: () => [],
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600, right: 800, bottom: 600, x: 0, y: 0 }),
      getAttribute: () => null,
      hasAttribute: () => false,
      isConnected: true,
      dispatchEvent: () => true,
    } as unknown as Element;
    const runtime = startPlatformRuntime(root);
    runtime.attachHandle({
      scrollV: () => 0,
      setQualityTier: (t: number) => void tiers.push(t),
    } as unknown as FieldHandle);
    let t = 1000;
    for (let i = 0; i < frames; i++) {
      t += spacing(i);
      const cbs = [...pending.values()];
      pending.clear();
      for (const cb of cbs) cb(t);
    }
    runtime.destroy();
  } finally {
    for (const [k, v] of saved) g[k] = v;
  }
  return tiers;
}

test('a steady 30 Hz display stays at full quality', () => {
  assert.deepEqual(run(600, () => 1000 / 30), [], 'on-budget 33 ms frames are not overruns');
});

test('a 60 Hz display that turns heavy still degrades', () => {
  // 60 frames at 60 Hz detect a 16.7 ms budget; then sustained 60 ms frames must escalate.
  const tiers = run(200, (i) => (i < 60 ? 1000 / 60 : 60));
  assert.ok(tiers.length > 0 && tiers[0]! >= 1, `expected an escalation, got ${JSON.stringify(tiers)}`);
});

test('a 30 Hz display that turns heavy still degrades, against its own budget', () => {
  const tiers = run(200, (i) => (i < 60 ? 1000 / 30 : 120));
  assert.ok(tiers.length > 0 && tiers[0]! >= 1, `expected an escalation, got ${JSON.stringify(tiers)}`);
});
