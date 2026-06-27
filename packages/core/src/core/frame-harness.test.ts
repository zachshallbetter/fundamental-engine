/**
 * Frame-harness tests — exercise the element-consumer paths in `field.ts` (§22.3 element capture /
 * relocate / emit, §22.5 capture/release events) by driving the REAL frame loop frame-by-frame on a
 * deterministic `dt` + seeded `rng`. This is the coverage the issue (#704) calls out: PR #260's
 * per-frame wiring — movers, `[data-dock]` collapse, warp teleport, element emit, and the
 * `field:captured` / `field:released` / `field:relocated` dispatch — never ran under the only
 * `createField` stub (a `raf` that never fires + an empty `querySelectorAll`). Here it does.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { frameHarness, frameHarnessField, seededRng, HarnessElement } from './frame-harness.ts';

// ── the harness itself ───────────────────────────────────────────────────────

test('frameHarness: the loop is manual — the engine schedules, step() fires (deterministic dt)', () => {
  const h = frameHarness({ width: 640, height: 480 });
  const ticks: number[] = [];
  h.host.raf((t) => ticks.push(t));
  assert.equal(ticks.length, 0, 'nothing runs until step()');
  h.host.tick(16);
  assert.equal(ticks.length, 1, 'one frame per tick');
  h.host.raf((t) => ticks.push(t)); // the engine re-schedules inside the frame; mimic that
  h.host.tick(16);
  assert.equal(ticks.length, 2);
  assert.equal(ticks[1], 32, 'the clock advances by the supplied dt');
});

test('frameHarness: the scan root reflects only connected elements matching the selector', () => {
  const h = frameHarness();
  const a = h.add({ attrs: { 'data-move': '' } });
  const b = h.add({ attrs: { 'data-body': 'attract' } });
  const root = h.host.root as unknown as { querySelectorAll(s: string): HarnessElement[] };
  assert.deepEqual([...root.querySelectorAll('[data-move]')], [a]);
  assert.deepEqual([...root.querySelectorAll('[data-body]')], [b]);
  h.remove(a);
  assert.deepEqual([...root.querySelectorAll('[data-move]')], [], 'removed elements drop out of the scan');
});

test('HarnessElement: dataset mirrors data-* and style is readable after the engine writes it', () => {
  const el = new HarnessElement({ attrs: { 'data-move': 'layout', 'data-max': '8' } });
  assert.equal(el.dataset.move, 'layout');
  assert.equal(el.dataset.max, '8');
  el.style.transform = 'translate(3px, 4px)';
  assert.equal(el.style.transform, 'translate(3px, 4px)', 'a transform write reads back');
});

// ── movers: a [data-move] element drifts under the field (the loop ran) ───────

test('a [data-move] element gets a transform once the frame loop runs', () => {
  const { harness, field } = frameHarnessField({ rng: seededRng(1) });
  // a strong attract well so the mover is visibly displaced within a handful of frames.
  harness.add({ attrs: { 'data-body': 'attract', 'data-strength': '1', 'data-range': '600' }, rect: { left: 100, top: 100, width: 60, height: 60 } });
  const mover = harness.add({ attrs: { 'data-move': '' }, rect: { left: 400, top: 300, width: 30, height: 30 } });
  field.scan();
  assert.equal(mover.style.transform, '', 'no transform before the loop runs');
  harness.step(8);
  assert.match(mover.style.transform, /^translate\(/, 'the mover carries a translate after frames step');
  field.destroy();
});

// ── element capture (§22.3): a [data-dock] element docks into a sink ──────────

test('a [data-dock] element inside a sink radius captures — field:captured + the forces:* alias', () => {
  const { harness, field } = frameHarnessField({ rng: seededRng(5) });
  harness.add({
    attrs: { 'data-body': 'sink', 'data-absorb': '120', 'data-max': '5000', 'data-when': 'active', 'data-active': '1' },
    rect: { left: 380, top: 280, width: 40, height: 40 },
  });
  const dock = harness.add({ attrs: { 'data-move': '', 'data-dock': '' }, rect: { left: 390, top: 290, width: 20, height: 20 } });
  field.scan();
  harness.step();
  assert.ok(dock.events.includes('field:captured'), 'field:captured fired');
  assert.ok(dock.events.includes('forces:captured'), 'the forces:* alias fired too (migration window)');
  // the captured detail carries the sink element (§22.3 dock capture payload).
  const cap = dock.dispatched.find((e) => e.type === 'field:captured');
  assert.ok(cap && typeof cap.detail === 'object' && cap.detail !== null && 'sink' in cap.detail, 'detail.sink is present');
  field.destroy();
});

test('a docked element collapses (scale → opacity) and holds — captured fires exactly once while held', () => {
  const { harness, field } = frameHarnessField({ rng: seededRng(5) });
  harness.add({
    attrs: { 'data-body': 'sink', 'data-absorb': '120', 'data-max': '5000', 'data-when': 'active', 'data-active': '1' },
    rect: { left: 380, top: 280, width: 40, height: 40 },
  });
  const dock = harness.add({ attrs: { 'data-move': '', 'data-dock': '' }, rect: { left: 390, top: 290, width: 20, height: 20 } });
  field.scan();
  harness.step(); // capture
  harness.step(6); // hold
  const captures = dock.events.filter((e) => e === 'field:captured').length;
  assert.equal(captures, 1, 'no re-fire while the element stays docked');
  // the collapse transform is written (scale + matching opacity, 0..1 as it docks).
  assert.match(dock.style.transform, /scale\(/, 'a dock collapse transform is written');
  const opacity = Number(dock.style.opacity);
  assert.ok(opacity >= 0 && opacity < 1, 'opacity is the collapse fade');
  field.destroy();
});

// ── capture → hold → release (the sequence the issue asks for) ────────────────

test('capture → hold → release: a gated sink discharges on disengagement, firing field:released', () => {
  const { harness, field } = frameHarnessField({ rng: seededRng(7) });
  const sink = harness.add({
    // engagement-gated (§22.5): charges while data-active='1', discharges on the falling edge.
    attrs: { 'data-body': 'sink', 'data-absorb': '120', 'data-max': '5000', 'data-when': 'active', 'data-active': '1' },
    rect: { left: 380, top: 280, width: 40, height: 40 },
  });
  const dock = harness.add({ attrs: { 'data-move': '', 'data-dock': '' }, rect: { left: 390, top: 290, width: 20, height: 20 } });
  field.scan();
  harness.step(); // capture
  harness.step(6); // hold (no release yet)
  assert.ok(!dock.events.includes('field:released'), 'no release while engaged + held');
  // move the element clear of the sink core so it cannot immediately re-dock, then disengage.
  dock.rect = { left: 5000, top: 5000, width: 20, height: 20 };
  sink.setAttribute('data-active', '0');
  harness.step(7);
  assert.deepEqual(
    dock.events,
    ['field:captured', 'forces:captured', 'field:released', 'forces:released'],
    'the full ordered sequence: captured (×alias) then released (×alias)',
  );
  field.destroy();
});

test('release restores the captured element — a11y + opacity cleared (no content left collapsed)', () => {
  const { harness, field } = frameHarnessField({ rng: seededRng(7) });
  const sink = harness.add({
    attrs: { 'data-body': 'sink', 'data-absorb': '120', 'data-max': '5000', 'data-when': 'active', 'data-active': '1' },
    rect: { left: 380, top: 280, width: 40, height: 40 },
  });
  const dock = harness.add({ attrs: { 'data-move': '', 'data-dock': '' }, rect: { left: 390, top: 290, width: 20, height: 20 } });
  field.scan();
  harness.step(50); // capture + fully collapse — the dock progress eases in (aria-hidden + inert at dock ≥ 1)
  assert.equal(dock.getAttribute('aria-hidden'), 'true', 'a fully docked element is hidden from a11y');
  assert.ok(dock.hasAttribute('inert'), 'and inert');
  dock.rect = { left: 5000, top: 5000, width: 20, height: 20 };
  sink.setAttribute('data-active', '0');
  harness.step(7); // discharge → undock → restore
  assert.ok(dock.events.includes('field:released'), 'field:released fired on undock');
  assert.equal(dock.getAttribute('aria-hidden'), null, 'aria-hidden restored');
  assert.ok(!dock.hasAttribute('inert'), 'inert removed');
  assert.equal(dock.style.opacity, '', 'opacity reset to the layout default');
  field.destroy();
});

test('a saturating sink (data-max=1) cycles capture↔release every frame (conserved supernova)', () => {
  // capacity 1 → the sink supernovas the moment it holds one particle, undocking + re-docking the
  // element in a fill→explode→refill loop. Proves the release path fires off particle saturation too.
  const { harness, field } = frameHarnessField({ rng: seededRng(9) });
  harness.add({
    attrs: { 'data-body': 'sink attract', 'data-absorb': '900', 'data-max': '1' },
    rect: { left: 380, top: 280, width: 40, height: 40 },
  });
  const dock = harness.add({ attrs: { 'data-move': '', 'data-dock': '' }, rect: { left: 390, top: 290, width: 20, height: 20 } });
  field.scan();
  harness.step(4);
  assert.ok(dock.events.includes('field:captured'), 'captured during a fill phase');
  assert.ok(dock.events.includes('field:released'), 'released during a supernova phase');
  field.destroy();
});

// ── element relocate (§22.3): a [data-warp] element teleports at a throat ─────

test('a [data-warp] element entering a warp throat fires field:relocated', () => {
  const { harness, field } = frameHarnessField({ rng: seededRng(3) });
  // a warp throat paired (data-pair) to a target body whose live centre is the teleport destination.
  harness.add({
    attrs: { 'data-body': 'warp', 'data-absorb': '120', 'data-pair': '[data-body="anchor"]' },
    rect: { left: 160, top: 160, width: 80, height: 80 },
  });
  harness.add({ attrs: { 'data-body': 'anchor' }, rect: { left: 560, top: 360, width: 80, height: 80 } });
  const warpEl = harness.add({ attrs: { 'data-move': '', 'data-warp': '' }, rect: { left: 190, top: 190, width: 20, height: 20 } });
  field.scan();
  harness.step(6);
  assert.ok(warpEl.events.includes('field:relocated'), 'field:relocated fired at the throat');
  assert.ok(warpEl.events.includes('forces:relocated'), 'the forces:* alias fired too');
  field.destroy();
});

// ── element emit (§22.3): a [data-emit] body clones a template, capped, a11y-safe ──

test('a [data-emit] body clones its template up to data-max, decorative + inert, and prunes on destroy', () => {
  const { harness, field } = frameHarnessField({ rng: seededRng(3) });
  harness.add({ attrs: { id: 'spark' }, rect: { left: 0, top: 0, width: 4, height: 4 } }); // the template
  const emitter = harness.add({
    attrs: { 'data-body': 'attract', 'data-emit': '#spark', 'data-max': '3' },
    rect: { left: 100, top: 100, width: 40, height: 40 },
  });
  field.scan();
  // emit runs every 30th frame; drive well past the cap so it would overflow without the budget.
  harness.step(200);
  assert.equal(emitter.children.length, 3, 'clones are capped at data-max');
  for (const clone of emitter.children) {
    assert.equal(clone.getAttribute('aria-hidden'), 'true', 'clones are decorative (aria-hidden)');
    assert.ok(clone.hasAttribute('inert'), 'and inert (out of tab order)');
    assert.equal(clone.id, '', 'and id-stripped (no duplicate ids)');
    assert.equal(clone.dataset.fieldEmitted, '', 'tagged data-field-emitted');
  }
  field.destroy();
  assert.ok(emitter.children.every((c) => !c.isConnected), 'destroy() removes every emitted clone');
});

// ── determinism: same seed ⇒ same frame-by-frame outcome ──────────────────────

test('same seed + same steps ⇒ identical mover transform (reproducible runs)', () => {
  const run = (): string => {
    const { harness, field } = frameHarnessField({ rng: seededRng(123) });
    harness.add({ attrs: { 'data-body': 'attract', 'data-strength': '1', 'data-range': '600' }, rect: { left: 100, top: 100, width: 60, height: 60 } });
    const mover = harness.add({ attrs: { 'data-move': '' }, rect: { left: 400, top: 300, width: 30, height: 30 } });
    field.scan();
    harness.step(12);
    const t = mover.style.transform;
    field.destroy();
    return t;
  };
  assert.equal(run(), run(), 'two identically-seeded runs produce the same transform');
});
