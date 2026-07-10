/**
 * Focus / attention substrate (experimental) — the shared, source-tagged, decaying attention channel:
 * focus() writes it, focusState() + metrics.salience read it, the `focus` event is the write-back.
 *
 * Lives at the top level (src/*.test.ts). No FieldOptions key is introduced (per-deposit halfLife + a
 * module const), so this feature is deliberately outside the RC-6 contract-coverage scan.
 *
 * Times are in the field's simulation clock (env.t SECONDS, read back via focusState().time), so a
 * deposit `at: now - 8` is one default half-life old.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createField } from './engine/field.ts';
import type { FieldHost } from './engine/host.ts';
import type { FocusEvent } from './engine/types.ts';
import { FOCUS_WELL } from './recipes/focus.ts';
import { validateRecipe, EXPERIMENTAL_PATTERNS } from './recipes/index.ts';
import { FIELD_PATTERNS } from './recipes/catalog.ts';

function drivableHost(reducedMotion = false): { host: FieldHost; step: (frames: number) => void } {
  const off = (): void => {};
  let cb: ((now: number) => void) | null = null;
  let id = 0;
  let now = 0;
  const host: FieldHost = {
    root: { querySelectorAll: () => [], querySelector: () => null } as unknown as ParentNode,
    viewport: () => ({ width: 1000, height: 800, dpr: 1 }),
    scrollY: () => 0,
    scrollHeight: () => 1000,
    reducedMotion: () => reducedMotion,
    hidden: () => false,
    raf: (fn) => { cb = fn as (now: number) => void; return ++id; },
    cancelRaf: off,
    createCanvas: () => ({}) as unknown as HTMLCanvasElement,
    onResize: () => off,
    onScroll: () => off,
    onVisibility: () => off,
    onInput: () => off,
    onBodyEvent: () => off,
  };
  const step = (frames: number): void => { for (let i = 0; i < frames; i++) { now += 16; cb?.(now); } };
  return { host, step };
}

const makeField = (opts = {}): ReturnType<typeof createField> & { _step: (n: number) => void } => {
  const { host, step } = drivableHost();
  const field = createField({} as HTMLCanvasElement, { host, render: 'none', ...opts }) as ReturnType<typeof createField> & { _step: (n: number) => void };
  field._step = step;
  return field;
};
const rectAt = (x: number, y: number) => () => ({ left: x - 20, top: y - 20, width: 40, height: 40 });
/** a seeded PRNG so two fields evolve identically except for the variable under test. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const meanDistTo = (field: ReturnType<typeof createField>, cx: number, cy: number): number => {
  const out = new Float32Array(field.particleCount() * 5);
  const n = field.readParticles(out);
  if (n === 0) return 0;
  let sum = 0;
  for (let i = 0; i < n; i++) sum += Math.hypot((out[i * 5] ?? 0) - cx, (out[i * 5 + 1] ?? 0) - cy);
  return sum / n;
};
const salOf = (field: ReturnType<typeof createField>, id: string): number =>
  field.focusState({ threshold: 0, limit: 50 }).entries.find((e) => e.target === id)?.salience ?? -1;

test('focus: decays by half-life (temporal.freshness) — fresh ≈ 1, one half-life ≈ 0.5, two ≈ 0.25', () => {
  const field = makeField();
  try {
    field._step(2);
    const now = field.focusState().time;
    assert.ok(Number.isFinite(now), 'env.t is finite after a step');
    field.focus('fresh', { at: now });
    field.focus('half', { at: now - 8 }); // one default half-life (8s) old
    field.focus('quarter', { at: now - 16 }); // two half-lives old
    assert.ok(Math.abs(salOf(field, 'fresh') - 1) < 0.02, `fresh ~1, got ${salOf(field, 'fresh')}`);
    assert.ok(Math.abs(salOf(field, 'half') - 0.5) < 0.02, `half ~0.5, got ${salOf(field, 'half')}`);
    assert.ok(Math.abs(salOf(field, 'quarter') - 0.25) < 0.02, `quarter ~0.25, got ${salOf(field, 'quarter')}`);
  } finally { field.destroy(); }
});

test('focus: accumulates decay-then-add (0.3 aged one half-life + 0.3 fresh ≈ 0.45)', () => {
  const field = makeField();
  try {
    field._step(2);
    const now = field.focusState().time;
    field.focus('acc', { amount: 0.3, at: now - 8 }); // decays to 0.15 by now
    field.focus('acc', { amount: 0.3, at: now }); // + 0.3 → 0.45
    assert.ok(Math.abs(salOf(field, 'acc') - 0.45) < 0.02, `accumulates to ~0.45, got ${salOf(field, 'acc')}`);
  } finally { field.destroy(); }
});

test('focus: provenance — operator + agent on one body keep distinct sources AND fire distinct events', () => {
  const field = makeField();
  try {
    const events: FocusEvent[] = [];
    const off = field.on('focus', (e) => events.push(e));
    field._step(1);
    const now = field.focusState().time;
    field.focus('doc', { amount: 0.6, source: 'operator', at: now });
    field.focus('doc', { amount: 0.4, source: 'agent', at: now });
    field._step(1); // flush the coalesced bus events
    const docEvents = events.filter((e) => e.target === 'doc');
    assert.equal(docEvents.length, 2, 'two distinct sources → two events (not last-write collapsed)');
    assert.ok(docEvents.some((e) => e.source === 'operator') && docEvents.some((e) => e.source === 'agent'));
    const entry = field.focusState({ threshold: 0 }).entries.find((e) => e.target === 'doc');
    assert.equal(entry?.sources.length, 2, 'the reading holds BOTH sources');
    off();
  } finally { field.destroy(); }
});

test('focusState: the sharp tip is ranked, thresholded, and capped (small enough to push into a turn)', () => {
  const field = makeField();
  try {
    field._step(2);
    const now = field.focusState().time;
    for (let i = 0; i < 12; i++) field.focus(`b${i}`, { amount: (i + 1) / 12, at: now }); // 0.083 .. 1.0
    const tip = field.focusState(); // default limit 8, threshold 0.05
    assert.ok(tip.entries.length <= 8, `capped at 8, got ${tip.entries.length}`);
    for (let i = 1; i < tip.entries.length; i++)
      assert.ok(tip.entries[i - 1]!.salience >= tip.entries[i]!.salience, 'ranked desc by salience');
    assert.ok(tip.entries.every((e) => e.salience >= 0.05), 'all above threshold');
    assert.ok(JSON.stringify(tip).length < 4000, 'the tip serializes small');
  } finally { field.destroy(); }
});

test('focus: retained for a not-yet-scanned identity, then binds to the body (R1) — salience on query()', () => {
  const field = makeField();
  try {
    field._step(2);
    const now = field.focusState().time;
    field.focus('card:9f3a', { amount: 1, source: 'operator', at: now }); // no body with this id yet
    assert.ok(field.focusState({ threshold: 0 }).entries.some((e) => e.target === 'card:9f3a'), 'retained before a body exists');
    field.addBody({ tokens: 'attract', identity: { id: 'card:9f3a', kind: 'card' }, rect: rectAt(500, 400) });
    field._step(2); // applyFocus joins the ledger to the body
    const body = field.query().bodies.find((b) => b.id === 'card:9f3a');
    assert.ok(body, 'the body is present after addBody + step');
    assert.ok((body!.metrics.salience ?? 0) > 0.5, `salience joined onto the body, got ${body!.metrics.salience}`);
  } finally { field.destroy(); }
});

test('focus: unfocused bodies carry NO salience (the fast path)', () => {
  const field = makeField();
  try {
    field.addBody({ tokens: 'attract', identity: { id: 'plain' }, rect: rectAt(300, 300) });
    field._step(2);
    const body = field.query().bodies.find((b) => b.id === 'plain');
    assert.equal(body?.metrics.salience, undefined, 'an unfocused body has no salience key');
  } finally { field.destroy(); }
});

test('agent safety: focusState is present ONLY with read:focus; the view stays read-only', () => {
  const field = makeField();
  try {
    field._step(2);
    field.focus('x', { amount: 1, source: 'operator', at: field.focusState().time });
    const noFocus = field.forAgent({ capabilities: ['read:metrics'] });
    assert.equal(noFocus.focusState, undefined, 'no focusState without read:focus');
    assert.equal((noFocus as unknown as { focus?: unknown }).focus, undefined, 'no focus() mutator on the read-only view');
    const withFocus = field.forAgent({ capabilities: ['read:focus'] });
    assert.equal(typeof withFocus.focusState, 'function', 'focusState present with read:focus');
    const entry = withFocus.focusState!({ threshold: 0 }).entries.find((e) => e.target === 'x');
    assert.ok(entry && entry.sources.length >= 1, 'per-source provenance present under read:focus');
  } finally { field.destroy(); }
});

test('agent safety: a closed agentRead budget empties the focus digest', () => {
  const field = makeField({ policy: { budgets: { agentRead: 0 } } });
  try {
    field._step(2);
    field.focus('y', { amount: 1, at: field.focusState().time });
    const view = field.forAgent({ capabilities: ['read:focus'] });
    assert.equal(view.focusState!().entries.length, 0, 'closed agentRead budget → empty focus digest');
  } finally { field.destroy(); }
});

test('focus: degrades quietly — empty field is an empty digest; an empty-id target is a no-op', () => {
  const field = makeField();
  try {
    field._step(2);
    assert.deepEqual(field.focusState().entries, [], 'no deposits → empty digest');
    field.focus({ id: '' }, { amount: 1 });
    assert.equal(field.focusState().entries.length, 0, 'an empty-id target records nothing');
  } finally { field.destroy(); }
});

test('focus well (active): a focused attract body gathers matter tighter than an unfocused control', () => {
  const seed = 1234;
  const control = makeField({ rng: mulberry32(seed) });
  const focused = makeField({ rng: mulberry32(seed) }); // identical initial matter
  try {
    for (const f of [control, focused])
      f.addBody({ tokens: 'attract', identity: 'well', strength: 1.4, range: 700, rect: rectAt(500, 400) });
    control._step(2);
    focused._step(2);
    focused.focus('well', { amount: 1, source: 'operator', at: focused.focusState().time }); // salience → 1 → focusMul → 2×
    control._step(60);
    focused._step(60); // same total frames, same rng — the only difference is the focus well
    const dControl = meanDistTo(control, 500, 400);
    const dFocused = meanDistTo(focused, 500, 400);
    assert.ok(dFocused < dControl, `focused well pulls matter tighter: focused ${dFocused.toFixed(1)} < control ${dControl.toFixed(1)}`);
  } finally {
    control.destroy();
    focused.destroy();
  }
});

test('FOCUS_WELL Pattern validates and lives in EXPERIMENTAL_PATTERNS, not the locked 64', () => {
  assert.deepEqual(validateRecipe(FOCUS_WELL), [], 'the focus-well Pattern is valid');
  assert.ok(EXPERIMENTAL_PATTERNS.some((p) => p.id === 'focus-well'), 'surfaced in EXPERIMENTAL_PATTERNS');
  assert.ok(!FIELD_PATTERNS.some((p) => p.id === 'focus-well'), 'NEVER in the locked 64 FIELD_PATTERNS');
});
