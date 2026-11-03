/**
 * The transient per-body flare (#567) — `FieldHandle.pulse` and the `--field-pulse` channel.
 *
 * What these pin is mostly the DISTINCTIONS, because the primitive is small and the ways to get it
 * wrong are all confusions with something the engine already has:
 *   · a pulse is not a `burst` — it must leave matter untouched (proved against a real burst)
 *   · a pulse is not `--d` — flaring a body must not perturb its measured density
 *   · a pulse is not motion — a reduced-motion field is frozen, but its flares must still resolve
 *     to rest, or the "still" field ends up with a latched highlight nothing can clear
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createField } from './field.ts';
import { pulseAdd, pulseDecay, PULSE_HALF_LIFE, PULSE_FLOOR } from './pulse.ts';
import { defaultFeedbackSink } from './feedback-sink.ts';
import { seededRng } from '../record/rng.ts';
import type { FieldHost } from './host.ts';

const MS = 1000 / 60; // the drivable host's frame interval — exactly 60fps, so a half-life is 9 frames

function drivableHost(opts: { reducedMotion?: boolean } = {}): { host: FieldHost; step: (frames: number) => void } {
  const off = (): void => {};
  let cb: ((now: number) => void) | null = null;
  let id = 0;
  let now = 0;
  const host: FieldHost = {
    root: { querySelectorAll: () => [], querySelector: () => null } as unknown as ParentNode,
    viewport: () => ({ width: 1000, height: 800, dpr: 1 }),
    scrollY: () => 0,
    scrollHeight: () => 1000,
    reducedMotion: () => opts.reducedMotion ?? false,
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
  const step = (frames: number): void => { for (let i = 0; i < frames; i++) { now += MS; cb?.(now); } };
  return { host, step };
}

const rectAt = (x: number, y: number) => () => ({ left: x - 20, top: y - 20, width: 40, height: 40 });

// ── the pure decay ──────────────────────────────────────────────────────────────────────────────

test('pulse math: the half-life is a half-life, and the tail is longer than it looks', () => {
  assert.equal(pulseDecay(1, PULSE_HALF_LIFE), 0.5);
  assert.equal(pulseDecay(1, PULSE_HALF_LIFE * 2), 0.25);
  // the ~0.6s decay hand-rolled consumers converged on: 4 half-lives, so 1/16 of the flare is left.
  assert.equal(pulseDecay(1, 0.6), 1 / 16);
  assert.ok(pulseDecay(1, 0.65) < 0.05, `0.65s → ${pulseDecay(1, 0.65)}`);
  // NOT "over within a second": reaching the 0.0005 write floor takes ~11 half-lives ≈ 1.65s. The
  // tail is invisible (everything under 0.0005 renders as `0.000`) but the channel is still being
  // written, which is the honest cost of a floor set where the rendered value stops changing.
  assert.ok(pulseDecay(1, 1) > PULSE_FLOOR, `1s is NOT yet rest: ${pulseDecay(1, 1)}`);
  assert.ok(pulseDecay(1, 1.7) < PULSE_FLOOR, `1.7s is: ${pulseDecay(1, 1.7)}`);
  // a zero/negative/absent timestep never advances or rewinds it
  assert.equal(pulseDecay(0.7, 0), 0.7);
  assert.equal(pulseDecay(0.7, -1), 0.7);
});

test('pulse math: energy is additive, saturates at 1, and cannot be used to cancel a live flare', () => {
  assert.equal(pulseAdd(0, 1), 1);
  assert.equal(pulseAdd(0.3, 0.4), 0.7);
  assert.equal(pulseAdd(0.8, 0.8), 1, 'saturates rather than overshooting the [0,1] contract');
  assert.equal(pulseAdd(0.5, -1), 0.5, 'negative energy contributes nothing');
  assert.equal(pulseAdd(0.5, NaN), 0.5, 'NaN never reaches the channel');
});

// ── the channel ─────────────────────────────────────────────────────────────────────────────────

test('the sink publishes pulse as --field-pulse, and only while a flare is live', () => {
  const writes: Array<[string, string]> = [];
  const el = { dataset: {}, style: { setProperty: (n: string, v: string) => void writes.push([n, v]) } } as unknown as HTMLElement;
  defaultFeedbackSink(el, { pulse: 0.5 });
  assert.deepEqual(writes, [['--field-pulse', '0.500']]);
  writes.length = 0;
  // an absent channel writes nothing at all — an un-pulsed body never touches the property
  defaultFeedbackSink(el, { density: 0.25 });
  assert.ok(!writes.some(([n]) => n === '--field-pulse'), `no pulse write: ${JSON.stringify(writes)}`);
  writes.length = 0;
  // exact rest is a real write (the flare must land on 0, not on 0.0004)
  defaultFeedbackSink(el, { pulse: 0 });
  assert.deepEqual(writes, [['--field-pulse', '0.000']]);
});

test('pulse(): the flare starts at full energy, decays at the half-life, and settles at exactly 0', () => {
  const { host, step } = drivableHost();
  const field = createField({} as HTMLCanvasElement, { host, render: 'none' });
  try {
    field.scan();
    const seen: number[] = [];
    const body = field.addBody({
      tokens: 'attract', strength: 1, range: 300, rect: rectAt(500, 400),
      onFeedback: (ch) => { if (ch.pulse !== undefined) seen.push(ch.pulse); },
    });
    step(2); // settle; nothing pulsed yet
    assert.equal(seen.length, 0, 'an un-pulsed body never carries the channel');

    field.pulse(body);
    step(1);
    assert.equal(seen[0], 1, 'the flare starts HOT — full energy on the next frame, no ease-in');

    // measure the half-life off the real frames rather than asserting it by construction:
    // step one half-life worth of 16ms frames and read what the engine actually published.
    const framesPerHalfLife = Math.round((PULSE_HALF_LIFE * 1000) / MS); // exactly 9 at 60fps
    step(framesPerHalfLife);
    const after = seen[seen.length - 1]!;
    assert.ok(Math.abs(after - 0.5) < 1e-12, `one half-life of real frames leaves half the flare: ${after}`);

    // run it out. ~11 half-lives to cross the write floor, so a second is NOT enough — the first
    // draft of this test asserted rest after 90 frames and read 0.00066, which is the tail, not a bug.
    step(140);
    assert.equal(seen[seen.length - 1], 0, 'the flare lands on exact rest');
    const settled = seen.length;
    step(20);
    assert.equal(seen.length, settled, 'and the channel goes quiet — no perpetual zero writes');
  } finally {
    field.destroy();
  }
});

test('pulse() is additive across events and saturates, without restarting the decay from stale state', () => {
  const { host, step } = drivableHost();
  const field = createField({} as HTMLCanvasElement, { host, render: 'none' });
  try {
    field.scan();
    let last = 0;
    const body = field.addBody({
      tokens: 'attract', strength: 1, range: 300, rect: rectAt(500, 400),
      onFeedback: (ch) => { if (ch.pulse !== undefined) last = ch.pulse; },
    });
    field.pulse(body, 0.3);
    step(1);
    assert.equal(last, 0.3, 'partial energy flares partially');
    field.pulse(body, 0.3); // a second event while the first is still decaying
    step(1);
    const carried = pulseDecay(0.3, 1 / 60); // what the first flare had left when the second landed
    assert.ok(Math.abs(last - (carried + 0.3)) < 1e-12, `two events sum on the decayed remainder: ${last}`);
    assert.ok(last < 0.6, 'and it is strictly less than 0.3 + 0.3 — the first flare had already decayed');
    field.pulse(body, 5); // absurd energy
    step(1);
    assert.equal(last, 1, 'saturates at 1 — the channel keeps its [0,1] contract');
  } finally {
    field.destroy();
  }
});

// ── the distinctions ────────────────────────────────────────────────────────────────────────────

test('a pulse is not a burst: it leaves matter completely untouched', () => {
  const { host, step } = drivableHost();
  const field = createField({} as HTMLCanvasElement, { host, render: 'none' });
  try {
    field.scan();
    const body = field.addBody({ tokens: 'attract', strength: 1, range: 300, rect: rectAt(500, 400) });
    step(10);

    const snap = (): Float32Array => { const out = new Float32Array(5 * 400); field.readParticles(out); return out; };
    const before = snap();

    field.pulse(body, 1);
    const afterPulse = snap();
    assert.deepEqual([...afterPulse], [...before], 'pulse() moved no matter and changed no velocity');

    // the control: the same field, the same instant, a real burst at the body — this MUST differ,
    // otherwise the comparison above is vacuous (the read could simply be returning nothing).
    field.burst(500, 400);
    const afterBurst = snap();
    assert.notDeepEqual([...afterBurst], [...before], 'burst() does move matter — the comparison is live');
  } finally {
    field.destroy();
  }
});

test('a pulse is not --d: two identical fields, one flared every frame, measure the same density', () => {
  // The comparison needs two fields that are genuinely comparable, and by default they are NOT: the
  // simulation clock is seeded from construction WALL TIME, so two fields built microseconds apart
  // sample different noise even under one seeded rng (measured on this branch: 0.49209583 vs
  // 0.49211508 on the 30th frame — a 5th-decimal difference, enough to make any equality assert
  // flap). Pinning `now` alongside `rng` removes that last source of divergence and the series
  // become bit-identical. (The same wall-clock leak is what PR #1208 fixes for fields that have no
  // injected clock — i.e. every real one.)
  const comparable = () => {
    const { host, step } = drivableHost();
    const field = createField({} as HTMLCanvasElement, { host, render: 'none', rng: seededRng(3), now: () => 0 });
    field.scan();
    const densities: number[] = [];
    const body = field.addBody({
      tokens: 'attract', strength: 2, range: 400, rect: rectAt(500, 400),
      onFeedback: (ch) => { if (ch.density !== undefined) densities.push(ch.density); },
    });
    return { field, step, densities, body };
  };

  const quiet = comparable();
  const flared = comparable();
  try {
    quiet.step(40);
    for (let i = 0; i < 40; i++) { flared.field.pulse(flared.body, 1); flared.step(1); }

    assert.equal(flared.densities.length, quiet.densities.length, 'same number of measured frames');
    assert.ok(quiet.densities.length > 0 && quiet.densities.at(-1)! > 0, 'the density channel is live');
    assert.deepEqual(flared.densities, quiet.densities, 'a flare every frame moves --d by exactly nothing');

    // non-vacuity: the two fields ARE otherwise identical, so a real perturbation must show up here.
    // Burst the flared one and the series must part company — otherwise the equality above proves
    // only that the comparison is blind.
    flared.field.burst(500, 400);
    flared.step(10);
    quiet.step(10);
    assert.notDeepEqual(flared.densities, quiet.densities, 'a burst DOES move --d — the comparison can see a perturbation');
  } finally {
    quiet.field.destroy();
    flared.field.destroy();
  }
});

test('a pulse is not motion: a reduced-motion field is frozen, but its flares still resolve to rest', () => {
  const { host, step } = drivableHost({ reducedMotion: true });
  const field = createField({} as HTMLCanvasElement, { host, render: 'none' });
  try {
    field.scan();
    const seen: number[] = [];
    const body = field.addBody({
      tokens: 'attract', strength: 1, range: 300, rect: rectAt(500, 400),
      onFeedback: (ch) => { if (ch.pulse !== undefined) seen.push(ch.pulse); },
    });
    // the field really is frozen: no matter moves across these frames
    const snap = (): Float32Array => { const out = new Float32Array(5 * 400); field.readParticles(out); return out; };
    const before = snap();
    field.pulse(body);
    step(1);
    assert.equal(seen[0], 1, 'the flare still fires on a still field — an occurrence is not motion');
    step(140);
    assert.deepEqual([...snap()], [...before], 'and nothing moved: dt stayed 0 throughout');
    assert.equal(seen[seen.length - 1], 0, 'the flare resolved to rest rather than latching on forever');
  } finally {
    field.destroy();
  }
});

test('pulse() on something that is not a body of this field is a silent no-op', () => {
  const { host, step } = drivableHost();
  const field = createField({} as HTMLCanvasElement, { host, render: 'none' });
  try {
    field.scan();
    const stranger = { dataset: {}, style: { setProperty: () => {} } } as unknown as HTMLElement;
    assert.doesNotThrow(() => field.pulse(stranger));
    assert.doesNotThrow(() => field.pulse(stranger, 0.5));
    step(2);
  } finally {
    field.destroy();
  }
});
