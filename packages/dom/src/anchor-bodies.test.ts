/**
 * anchorBodies unit tests (#680) — feature detection, SSR safety, stable naming, the opt-in dynamic-body
 * follow channel (change-gated), and the default-path pin: with the helper off / unsupported, nothing is
 * written to any element.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  anchorBodies,
  anchorBodyName,
  supportsAnchorPositioning,
  ANCHOR_FOLLOW_VARS,
  ANCHOR_NAME_PREFIX,
} from './anchor-bodies.ts';
import type { FieldBodyReading, FieldQueryResult } from '@fundamental-engine/core';

const g = globalThis as Record<string, unknown>;

/** A minimal element double: inline-style writes are recorded, attributes/rect are supplied. */
interface FakeEl {
  id: string;
  attrs: Record<string, string>;
  props: Record<string, string>;
  writes: number;
  rect: { left: number; top: number; width: number; height: number };
  style: { setProperty(n: string, v: string): void; removeProperty(n: string): void };
  getAttribute(n: string): string | null;
  getBoundingClientRect(): { left: number; top: number; width: number; height: number };
}

function el(id: string, attrs: Record<string, string> = {}, rect = { left: 100, top: 50, width: 40, height: 20 }): FakeEl {
  const e: FakeEl = {
    id,
    attrs,
    props: {},
    writes: 0,
    rect,
    style: {
      setProperty(n, v) {
        e.props[n] = v;
        e.writes++;
      },
      removeProperty(n) {
        delete e.props[n];
      },
    },
    getAttribute: (n) => (n in attrs ? attrs[n]! : null),
    getBoundingClientRect: () => e.rect,
  };
  return e;
}

/** A root double whose `querySelectorAll` returns the supplied elements regardless of selector. */
function root(list: FakeEl[]): ParentNode & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    querySelectorAll: (sel: string) => {
      calls.push(sel);
      return list as unknown as NodeListOf<Element>;
    },
  } as unknown as ParentNode & { calls: string[] };
}

/** Install a mock `CSS.supports`, run `fn`, restore the original CSS global. */
function withCSS(supports: ((q: string) => boolean) | undefined, fn: () => void): void {
  const had = 'CSS' in g;
  const prev = g.CSS;
  if (supports) g.CSS = { supports };
  else delete g.CSS;
  try {
    fn();
  } finally {
    if (had) g.CSS = prev;
    else delete g.CSS;
  }
}

const yes = (): boolean => true;

test('supportsAnchorPositioning: false without CSS / CSS.supports, true when both queries pass', () => {
  withCSS(undefined, () => assert.equal(supportsAnchorPositioning(), false));
  withCSS(yes, () => assert.equal(supportsAnchorPositioning(), true));
  withCSS((q) => q.startsWith('anchor-name'), () => assert.equal(supportsAnchorPositioning(), false));
  withCSS(() => {
    throw new Error('boom');
  }, () => assert.equal(supportsAnchorPositioning(), false));
  const css = { registerProperty() {} };
  const had = 'CSS' in g;
  const prev = g.CSS;
  g.CSS = css;
  try {
    assert.equal(supportsAnchorPositioning(), false, 'CSS without supports() is not support');
  } finally {
    if (had) g.CSS = prev;
    else delete g.CSS;
  }
});

test('anchorBodyName: stable from the id, dashed-ident safe, index fallback for anonymous elements', () => {
  assert.equal(anchorBodyName(el('chip') as unknown as Element), `${ANCHOR_NAME_PREFIX}-chip`);
  assert.equal(anchorBodyName(el('a.b:c d') as unknown as Element), `${ANCHOR_NAME_PREFIX}-a-b-c-d`);
  assert.equal(anchorBodyName(el('') as unknown as Element, '--x', 3), '--x-3');
});

test('SSR: no document and no root ⇒ an inert result that never throws', () => {
  assert.equal(typeof document, 'undefined', 'this suite runs without a DOM');
  withCSS(yes, () => {
    const r = anchorBodies();
    assert.equal(r.supported, false);
    assert.equal(r.names.size, 0);
    r.rescan();
    r.tick();
    r.dispose();
    assert.equal(r.nameFor({} as Element), undefined);
  });
});

test('default-path pin: unsupported browser ⇒ zero style writes on every element, supported:false', () => {
  const a = el('a', { 'data-body': 'attract' });
  const b = el('', { 'data-move': '' });
  withCSS(undefined, () => {
    const r = anchorBodies({ root: root([a, b]) });
    assert.equal(r.supported, false);
    assert.equal(r.names.size, 0);
    r.tick();
    r.dispose();
  });
  withCSS(() => false, () => {
    const r = anchorBodies({ root: root([a, b]) });
    assert.equal(r.supported, false);
    r.tick();
  });
  assert.equal(a.writes + b.writes, 0, 'nothing is written when anchor positioning is unsupported');
  assert.deepEqual(a.props, {});
  assert.deepEqual(b.props, {});
});

test('supported: writes anchor-name from the id (else a stable index), rescan keeps names, dispose removes them', () => {
  const chip = el('chip', { 'data-move': 'layout' });
  const anon1 = el('', { 'data-move': '' });
  const anon2 = el('', { 'data-body': 'repel' });
  const late = el('late', { 'data-body': 'attract' });
  const list = [chip, anon1, anon2];
  withCSS(yes, () => {
    const r = anchorBodies({ root: root(list) });
    assert.equal(r.supported, true);
    assert.equal(r.nameFor(chip as unknown as Element), '--field-body-chip');
    assert.equal(chip.props['anchor-name'], '--field-body-chip');
    assert.equal(anon1.props['anchor-name'], '--field-body-0');
    assert.equal(anon2.props['anchor-name'], '--field-body-1');
    assert.equal(r.names.size, 3);
    // rescan after the DOM changed: existing names are stable, the new element gets the next index-free name
    list.push(late);
    r.rescan();
    assert.equal(anon1.props['anchor-name'], '--field-body-0', 'existing names survive a rescan');
    assert.equal(late.props['anchor-name'], '--field-body-late');
    assert.equal(chip.writes, 1, 'a rescan does not rewrite an existing name');
    // the follow vars are never written without opting in
    r.tick();
    assert.equal(r.writesLastTick, 0);
    assert.equal(ANCHOR_FOLLOW_VARS.x in chip.props, false);
    r.dispose();
    assert.equal('anchor-name' in chip.props, false, 'dispose removes the name');
    assert.equal('anchor-name' in late.props, false);
    assert.equal(r.names.size, 0);
  });
});

test('custom prefix + selector are honoured', () => {
  const chip = el('chip', { 'data-move': '' });
  withCSS(yes, () => {
    const rt = root([chip]);
    const r = anchorBodies({ root: rt, prefix: '--tip', selector: '.chip' });
    assert.deepEqual(rt.calls, ['.chip']);
    assert.equal(r.nameFor(chip as unknown as Element), '--tip-chip');
  });
});

/** A `field.query` double returning the given body readings (engine-owned centres, field px). */
function fieldWith(bodies: () => Array<Pick<FieldBodyReading, 'id' | 'rect'>>): { query: () => FieldQueryResult; calls: number } {
  const f = {
    calls: 0,
    query: (): FieldQueryResult => {
      f.calls++;
      return { bodies: bodies() as FieldBodyReading[], metrics: {} } as unknown as FieldQueryResult;
    },
  };
  return f;
}

test('follow: a dynamic body with an id gets --move-x/--move-y = engine centre − layout centre, change-gated', () => {
  // layout box centre (110, 60); the engine owns the body at (135.5, 60) → dx = 25.5, dy = 0
  const dyn = el('orb', { 'data-body': 'attract', 'data-authority': 'dynamic' }, { left: 100, top: 50, width: 20, height: 20 });
  const kin = el('chip', { 'data-move': 'layout' });
  const anchoredBody = el('card', { 'data-body': 'attract' });
  let cx = 135.5;
  const field = fieldWith(() => [
    { id: 'orb', rect: { x: cx - 10, y: 50, width: 20, height: 20 } },
    { id: 'card', rect: { x: 300, y: 300, width: 40, height: 40 } },
  ]);
  const ticks: Array<() => void> = [];
  withCSS(yes, () => {
    const r = anchorBodies({
      root: root([dyn, kin, anchoredBody]),
      follow: {
        field,
        schedule: (t) => {
          ticks.push(t);
          return () => ticks.length = 0;
        },
      },
    });
    assert.equal(ticks.length, 1, 'the custom scheduler received the tick');
    r.tick();
    assert.equal(field.calls, 1);
    assert.equal(dyn.props['--move-x'], '25.50px');
    assert.equal(dyn.props['--move-y'], '0.00px');
    assert.equal(r.writesLastTick, 2);
    // resting: the same reading ⇒ no rewrite (change gate)
    r.tick();
    assert.equal(r.writesLastTick, 0);
    assert.equal(dyn.writes, 1 + 2, 'anchor-name + one x/y pair; the resting tick wrote nothing');
    // the body moves ⇒ one new pair
    cx = 140;
    r.tick();
    assert.equal(dyn.props['--move-x'], '30.00px');
    assert.equal(r.writesLastTick, 2);
    // kinematic movers and anchored bodies are never given the vars (anchor positioning already follows
    // a mover's transform; an anchored body does not move)
    assert.equal('--move-x' in kin.props, false);
    assert.equal('--move-x' in anchoredBody.props, false);
    r.dispose();
    assert.equal(ticks.length, 0, 'dispose stopped the scheduler');
    assert.equal('--move-x' in dyn.props, false, 'dispose removes the vars');
    assert.equal('anchor-name' in dyn.props, false);
  });
});

test('follow: origin + measureEvery — the layout centre is re-measured on the cadence and origin-shifted', () => {
  const dyn = el('orb', { 'data-body': 'attract', 'data-authority': 'dynamic' }, { left: 300, top: 250, width: 20, height: 20 });
  // a contained field whose container sits at (200, 200): layout centre in field px = (110, 60)
  const field = fieldWith(() => [{ id: 'orb', rect: { x: 100, y: 50, width: 20, height: 20 } }]);
  withCSS(yes, () => {
    const r = anchorBodies({
      root: root([dyn]),
      follow: { field, origin: { x: 200, y: 200 }, measureEvery: 3, schedule: () => () => {} },
    });
    r.tick();
    assert.equal(dyn.props['--move-x'], '0.00px');
    assert.equal(dyn.props['--move-y'], '0.00px');
    // the element's layout box moves (e.g. a scroll) — ticks 2 and 3 keep the cached measure, tick 4 re-measures
    dyn.rect = { left: 300, top: 350, width: 20, height: 20 };
    r.tick();
    r.tick();
    assert.equal(dyn.props['--move-y'], '0.00px', 'cached measure until the cadence boundary');
    r.tick();
    assert.equal(dyn.props['--move-y'], '-100.00px', 're-measured on the 6-tick/3-tick cadence');
    r.dispose();
  });
});

test('follow: an anonymous dynamic body (no id) and an unknown id are skipped without writes', () => {
  const anon = el('', { 'data-body': 'attract', 'data-authority': 'dynamic' });
  const ghost = el('ghost', { 'data-body': 'attract', 'data-authority': 'dynamic' });
  const field = fieldWith(() => [{ id: 'body-3', rect: { x: 0, y: 0, width: 10, height: 10 } }]);
  withCSS(yes, () => {
    const r = anchorBodies({ root: root([anon, ghost]), follow: { field, schedule: () => () => {} } });
    r.tick();
    assert.equal(r.writesLastTick, 0);
    assert.equal('--move-x' in anon.props, false);
    assert.equal('--move-x' in ghost.props, false);
    r.dispose();
  });
});

test('follow: with no dynamic bodies the field is never queried (zero per-frame cost)', () => {
  const kin = el('chip', { 'data-move': 'layout' });
  const field = fieldWith(() => []);
  withCSS(yes, () => {
    const r = anchorBodies({ root: root([kin]), follow: { field, schedule: () => () => {} } });
    r.tick();
    r.tick();
    assert.equal(field.calls, 0);
    r.dispose();
  });
});

test('follow: custom var names', () => {
  const dyn = el('orb', { 'data-body': 'attract', 'data-authority': 'dynamic' }, { left: 0, top: 0, width: 0, height: 0 });
  const field = fieldWith(() => [{ id: 'orb', rect: { x: 5, y: 7, width: 0, height: 0 } }]);
  withCSS(() => false, () => {
    // unsupported anchor positioning: no anchor-name, but the follow vars (plain custom properties) still run
    const r = anchorBodies({ root: root([dyn]), follow: { field, vars: { x: '--dx', y: '--dy' }, schedule: () => () => {} } });
    assert.equal(r.supported, false);
    r.tick();
    assert.deepEqual(dyn.props, { '--dx': '5.00px', '--dy': '7.00px' });
    r.dispose();
  });
});
