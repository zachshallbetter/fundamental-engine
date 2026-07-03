/**
 * Rescan reconciliation (#966): `scan()` rebuilds every Body from scratch, which used to make ANY
 * add/remove/register a visible discontinuity — every `data-feedback` body's eased density (`b.d`,
 * the `--d` channel) hard-dropped to ~0.08 and eased back over ~1s, and matter a sink had captured
 * stayed pinned to the OLD (ghost) Body object forever while the rebuilt sink re-captured a second
 * full capacity. This suite pins the fix: persisting (element, per-element body index) keys carry
 * their runtime feedback state (`d`, `attn`, `accreted`, `count`, `wasOn`) onto the replacement
 * Body, captured particles are remapped old → new, and removed elements still drop their state.
 * Driven through a frame-capturing host with a seeded rng; state observed via `FieldHandle.query()`
 * (`metrics.density` = `b.d`, `metrics.load` = `accreted/capacity`) and `readParticles`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createField } from './field.ts';
import type { FieldHost } from './host.ts';

function virtualBody(id: string, attrs: Record<string, string>, r: { x: number; y: number; w: number; h: number }) {
  return {
    id,
    dataset: {} as Record<string, string>,
    getAttribute: (n: string) => attrs[n] ?? null,
    hasAttribute: (n: string) => n in attrs,
    dispatchEvent: () => true,
    removeAttribute: () => {},
    setAttribute: () => {},
    style: { setProperty: () => {}, removeProperty: () => {} } as unknown as CSSStyleDeclaration,
    getBoundingClientRect: () => ({
      left: r.x - r.w / 2, top: r.y - r.h / 2, right: r.x + r.w / 2, bottom: r.y + r.h / 2,
      width: r.w, height: r.h, x: r.x - r.w / 2, y: r.y - r.h / 2, toJSON: () => ({}),
    }),
  };
}

/** The host serves mutable element lists, so a test simulates DOM adds/removes + rescans. */
function drivableHost(bodyEls: unknown[], presetEls: unknown[] = []): { host: FieldHost; step: (frames: number) => void } {
  const off = (): void => {};
  let cb: ((now: number) => void) | null = null;
  let id = 0;
  let now = 0;
  const host: FieldHost = {
    root: {
      querySelectorAll: (sel: string) =>
        sel.startsWith('[data-body]') ? bodyEls : sel.startsWith('[data-preset]') ? presetEls : [],
      querySelector: () => null,
    } as unknown as ParentNode,
    viewport: () => ({ width: 1000, height: 800, dpr: 1 }),
    scrollY: () => 0,
    scrollHeight: () => 1000,
    reducedMotion: () => false,
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
  const step = (frames: number): void => {
    for (let i = 0; i < frames; i++) { now += 16; cb?.(now); }
  };
  return { host, step };
}

// a small deterministic PRNG so pools + releases are reproducible run to run.
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

type Handle = ReturnType<typeof createField>;
const reading = (field: Handle, id: string) => field.query().bodies.find((b) => b.id === id);

test('rescan preserves b.d on persisting bodies — no --d discontinuity (#966)', () => {
  const hero = virtualBody('hero', { 'data-body': 'attract', 'data-feedback': '', 'data-strength': '2.2', 'data-range': '900' }, { x: 500, y: 400, w: 60, h: 60 });
  const bodyEls: unknown[] = [hero];
  const { host, step } = drivableHost(bodyEls);
  const field = createField({} as HTMLCanvasElement, { host, render: 'none', density: 2, rng: seeded(11) });
  try {
    field.scan();
    // gather a dense cloud so the eased density climbs well clear of the old reset floor (~0.08).
    let before = 0;
    for (let i = 0; i < 3000 && before < 0.3; i++) {
      step(1);
      before = reading(field, 'hero')?.metrics.density ?? 0;
    }
    assert.ok(before >= 0.3, `the body warmed up before the rescan (d=${before.toFixed(3)})`);

    // a new element arrives → rescan (the discontinuity trigger). No frame runs in between, so an
    // exact match proves the eased value was CARRIED, not re-eased from the makeBody zero.
    bodyEls.push(virtualBody('late', { 'data-body': 'wall', 'data-strength': '0.4', 'data-range': '60' }, { x: 80, y: 80, w: 20, h: 20 }));
    field.rescan();
    const after = reading(field, 'hero')?.metrics.density;
    assert.equal(after, before, `rescan carried b.d verbatim (before=${before}, after=${after})`);
    assert.equal(reading(field, 'late')?.metrics.density, 0, 'the genuinely new body starts fresh at d=0');

    // and the frame after the rescan eases from the carried value — no hard drop toward 0.
    step(1);
    const next = reading(field, 'hero')?.metrics.density ?? 0;
    assert.ok(next > before * 0.7, `no post-rescan dip: d stayed near the carried value (${next.toFixed(3)} vs ${before.toFixed(3)})`);
  } finally {
    field.destroy();
  }
});

test('captured matter survives a rescan: load carried, particles remapped, release frees them, capacity not doubled (#966)', () => {
  const CAP = 60;
  const sinkEl = virtualBody('well', { 'data-body': 'sink attract', 'data-strength': '1.8', 'data-range': '900', 'data-absorb': '140', 'data-max': String(CAP) }, { x: 500, y: 400, w: 40, h: 40 });
  const bodyEls: unknown[] = [sinkEl];
  const { host, step } = drivableHost(bodyEls);
  const field = createField({} as HTMLCanvasElement, { host, render: 'none', rng: seeded(23) });
  try {
    let releasedCount = 0;
    let releases = 0;
    field.on('release', (e) => { releases++; releasedCount = e.count; });
    field.scan();

    // capture a partial load (well below capacity), stepping one frame at a time.
    let load = 0;
    for (let i = 0; i < 3000 && load * CAP < 8; i++) {
      step(1);
      load = reading(field, 'well')?.metrics.load ?? 0;
    }
    const held = Math.round(load * CAP);
    assert.ok(held >= 8 && held < CAP, `the sink held a partial load before the rescan (${held}/${CAP})`);

    // rescan mid-hold. The load must carry — a reset to 0 is what let the rebuilt sink capture a
    // SECOND full capacity on top of the stranded matter.
    bodyEls.push(virtualBody('late', { 'data-body': 'wall', 'data-strength': '0.4', 'data-range': '60' }, { x: 80, y: 80, w: 20, h: 20 }));
    field.rescan();
    const carried = reading(field, 'well')?.metrics.load ?? 0;
    assert.equal(carried, load, `rescan carried the accreted load (${(carried * CAP).toFixed(0)}/${CAP}), not reset to 0`);

    // fill to saturation → supernova. The release must free EVERYTHING held — including the matter
    // captured before the rescan. Detect the release frame, then look for ghost-pinned particles:
    // matter still lerping to a stale `cap` sits at the core (≤10px after hundreds of 0.18-lerp
    // frames), while genuinely released matter was ejected to the absorb rim (~146px) and free
    // matter cannot be near the core (anything inside 140px got captured).
    for (let i = 0; i < 6000 && releases === 0; i++) step(1);
    assert.ok(releases >= 1, 'the sink saturated and released');
    assert.ok(releasedCount >= held, `the release includes at least the matter held before the rescan (released ${releasedCount} >= ${held})`);

    const buf = new Float32Array(field.particleCount() * 5);
    const n = field.readParticles(buf);
    let ghosts = 0;
    for (let i = 0; i < n; i++) {
      const dx = buf[i * 5]! - 500;
      const dy = buf[i * 5 + 1]! - 400;
      if (dx * dx + dy * dy < 10 * 10) ghosts++;
    }
    assert.equal(ghosts, 0, `no particle remained pinned to a ghost body at the core after the release (found ${ghosts}, stranding would leave >=${held})`);
  } finally {
    field.destroy();
  }
});

test('a removed element still drops its state — re-adding it starts fresh, no zombie carry (#966)', () => {
  const hero = virtualBody('hero', { 'data-body': 'attract', 'data-feedback': '', 'data-strength': '2.2', 'data-range': '900' }, { x: 500, y: 400, w: 60, h: 60 });
  const bodyEls: unknown[] = [hero];
  const { host, step } = drivableHost(bodyEls);
  const field = createField({} as HTMLCanvasElement, { host, render: 'none', density: 2, rng: seeded(37) });
  try {
    field.scan();
    let warmed = 0;
    for (let i = 0; i < 3000 && warmed < 0.3; i++) {
      step(1);
      warmed = reading(field, 'hero')?.metrics.density ?? 0;
    }
    assert.ok(warmed >= 0.3, `warmed up (d=${warmed.toFixed(3)})`);

    bodyEls.length = 0; // the element leaves the DOM
    field.rescan();
    assert.equal(reading(field, 'hero'), undefined, 'the removed body is gone from the field');

    bodyEls.push(hero); // the same element returns later
    field.rescan();
    assert.equal(reading(field, 'hero')?.metrics.density, 0, 'state was dropped with the removal — the returning element starts fresh at d=0');
  } finally {
    field.destroy();
  }
});

test('preset expansion carries per virtual body, keyed (el, per-element index) — sink load stays on the sink entry (#966)', () => {
  // `blackhole` expands one element into four virtual bodies (attract / swirl / sink / lens). The
  // reconciliation key is (element, per-element body index) in the stable expansion order, so the
  // sink entry's accreted load must land back on the SINK entry, not a sibling.
  const bh = virtualBody('bh', {}, { x: 500, y: 400, w: 40, h: 40 });
  (bh.dataset as Record<string, string>).preset = 'blackhole';
  const bodyEls: unknown[] = [];
  const { host, step } = drivableHost(bodyEls, [bh]);
  const field = createField({} as HTMLCanvasElement, { host, render: 'none', density: 2, rng: seeded(53) });
  try {
    field.scan();
    const sinkLoad = (): number => {
      const readings = field.query().bodies.filter((b) => b.id === 'bh');
      return readings.find((b) => b.tokens.includes('sink'))?.metrics.load ?? 0;
    };
    let load = 0;
    for (let i = 0; i < 4000 && load === 0; i++) {
      step(1);
      load = sinkLoad();
    }
    assert.ok(load > 0, `the preset's sink entry captured matter (load=${load.toFixed(3)})`);

    bodyEls.push(virtualBody('late', { 'data-body': 'wall', 'data-strength': '0.4', 'data-range': '60' }, { x: 80, y: 80, w: 20, h: 20 }));
    field.rescan();
    assert.equal(sinkLoad(), load, 'the sink entry (index 2 of the expansion) carried its load across the rescan');
    const others = field.query().bodies.filter((b) => b.id === 'bh' && !b.tokens.includes('sink'));
    assert.equal(others.length, 3, 'the other three virtual bodies persist');
    for (const o of others) assert.equal(o.metrics.load ?? 0, 0, `sibling entry [${o.tokens.join(' ')}] did not inherit the sink's load — the per-element index keeps them apart`);
  } finally {
    field.destroy();
  }
});

test('anonymous body keeps its synthetic body-N id across a rescan that shifts sibling count (#970)', () => {
  // A body with no DOM id gets a synthetic `body-N` (N = a per-field seq). Before #970 the id lived
  // only on the rebuilt Body object, so ANY rescan minted a FRESH id for the same element — the id
  // churned, breaking every consumer that keys on it (snapshot/diff/replay, captures, edges). The
  // fix carries `identity` in the scan() reconciliation, keyed by (element, per-element index), so
  // the SAME element keeps its id even when its scan index shifts under an add/remove.
  const anon = virtualBody('', { 'data-body': 'attract', 'data-strength': '1.2', 'data-range': '400' }, { x: 500, y: 400, w: 40, h: 40 });
  const bodyEls: unknown[] = [anon];
  const { host } = drivableHost(bodyEls);
  const field = createField({} as HTMLCanvasElement, { host, render: 'none', rng: seeded(71) });
  try {
    field.scan();
    // query() keys the body → mints + caches its synthetic id. Capture it.
    const before = field.query().bodies[0]?.id;
    assert.ok(before && before.startsWith('body-'), `the anonymous body got a synthetic id (${before})`);

    // insert a NEW element BEFORE it → the anonymous body's scan index shifts (0 → 1). Pre-fix, the
    // rebuilt body had no cached identity and drew the next seq value, so its id changed.
    const sibling = virtualBody('', { 'data-body': 'wall', 'data-strength': '0.4', 'data-range': '60' }, { x: 80, y: 80, w: 20, h: 20 });
    bodyEls.unshift(sibling);
    field.rescan();

    // find the SAME element's reading (match by rect centre — it's the only attract body).
    const after = field.query().bodies.find((b) => b.tokens.includes('attract'))?.id;
    assert.equal(after, before, `the same element kept its synthetic id across the rescan (before=${before}, after=${after})`);
    // and the genuinely new element got a DISTINCT synthetic id (no accidental reuse/collision).
    const siblingId = field.query().bodies.find((b) => b.tokens.includes('wall'))?.id;
    assert.notEqual(siblingId, before, `the new element got its own id (${siblingId}), not the persisting one`);
  } finally {
    field.destroy();
  }
});

test('dynamic-authority body keeps its position + velocity across a rescan — no teleport to authored slot (#970)', () => {
  // A `data-authority="dynamic"` body's position/velocity are engine-owned (bx/by/bvx/bvy), not
  // DOM-derived. makeBody leaves them undefined, so pre-#970 a rescan re-adopted the freshly-measured
  // DOM centre and zeroed velocity — a drifting body teleported back to its authored slot when ANY
  // body was added/removed. The fix carries the kinematic state in the scan() reconciliation.
  // A strong off-centre attractor drags the dynamic body away from its authored (500,400) slot.
  const mover = virtualBody('mover', { 'data-body': 'wall', 'data-authority': 'dynamic', 'data-strength': '0.2', 'data-range': '40' }, { x: 500, y: 400, w: 40, h: 40 });
  const puller = virtualBody('puller', { 'data-body': 'attract', 'data-strength': '3', 'data-range': '900' }, { x: 200, y: 200, w: 40, h: 40 });
  const bodyEls: unknown[] = [mover, puller];
  const { host, step } = drivableHost(bodyEls);
  const field = createField({} as HTMLCanvasElement, { host, render: 'none', rng: seeded(83) });
  try {
    field.scan();
    // let the dynamic body drift well away from its authored centre and pick up velocity.
    let pos = { x: 500, y: 400 };
    for (let i = 0; i < 400; i++) {
      step(1);
      const r = reading(field, 'mover')?.rect;
      if (r) pos = { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    }
    const drift = Math.hypot(pos.x - 500, pos.y - 400);
    assert.ok(drift > 20, `the dynamic body drifted away from its authored slot before the rescan (drift=${drift.toFixed(1)}px)`);

    // rescan mid-flight (a sibling arrives). Pre-fix this rebuilt bx/by at the authored rect (500,400)
    // and zeroed velocity — an instant teleport back. The carry keeps it where it was.
    bodyEls.push(virtualBody('late', { 'data-body': 'wall', 'data-strength': '0.4', 'data-range': '60' }, { x: 80, y: 80, w: 20, h: 20 }));
    field.rescan();
    // measureBodies runs inside scan() and transiently writes the DOM rect (500,400) to cx/cy, but
    // the next moveDynamicBodies() re-asserts the carried bx/by as authoritative — so one frame after
    // the rescan the body is back on its trajectory, NOT snapped home. Observe the SETTLED position.
    step(1);
    const r3 = reading(field, 'mover')?.rect;
    const settled = r3 ? { x: r3.x + r3.width / 2, y: r3.y + r3.height / 2 } : pos;
    const backToAuthored = Math.hypot(settled.x - 500, settled.y - 400);
    const jump = Math.hypot(settled.x - pos.x, settled.y - pos.y);
    assert.ok(backToAuthored > drift * 0.5, `the body kept its drifted position (still ${backToAuthored.toFixed(1)}px from the authored slot, was ${drift.toFixed(1)}px) — no teleport home`);
    assert.ok(jump < drift * 0.5, `the rescan did not snap the body back toward its authored slot (post-rescan jump ${jump.toFixed(1)}px << accumulated drift ${drift.toFixed(1)}px)`);
  } finally {
    field.destroy();
  }
});
