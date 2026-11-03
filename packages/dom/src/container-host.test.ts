import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FIELD_BOUNDARY_ATTR } from '@fundamental-engine/core';
import { containerHost } from './container-host.ts';

/** Stub the browser globals containerHost reads (it is browser code; this exercises the contract). */
function withWindow<T>(dpr: number, fn: () => T): T {
  const g = globalThis as { window?: unknown; ResizeObserver?: unknown };
  const prevWin = g.window;
  const prevRO = g.ResizeObserver;
  g.window = { devicePixelRatio: dpr, addEventListener() {}, removeEventListener() {} };
  g.ResizeObserver = class { observe() {} disconnect() {} };
  try {
    return fn();
  } finally {
    g.window = prevWin;
    g.ResizeObserver = prevRO;
  }
}

test('containerHost.viewport returns the container size + its left/top as the field-space origin (#540)', () => {
  withWindow(2, () => {
    const attrs = new Map<string, string>();
    const el = {
      getBoundingClientRect: () => ({ left: 200, top: 100, width: 360, height: 240 }),
      scrollTop: 12,
      scrollHeight: 800,
      addEventListener() {},
      removeEventListener() {},
      setAttribute: (n: string, v: string) => attrs.set(n, v),
      removeAttribute: (n: string) => attrs.delete(n),
      hasAttribute: (n: string) => attrs.has(n),
    } as unknown as HTMLElement;
    const host = containerHost(el);
    const vp = host.viewport();
    assert.equal(vp.width, 360);
    assert.equal(vp.height, 240);
    assert.equal(vp.dpr, 2);
    assert.equal(vp.originX, 200, 'origin tracks the container left → bodies measured container-local');
    assert.equal(vp.originY, 100, 'origin tracks the container top');
    assert.equal(host.root, el, 'scans within the container, not the document');
    assert.equal(host.scrollY(), 12, 'scroll is the container scroll, not window');
    assert.equal(host.scrollHeight(), 800);
  });
});

test('containerHost marks its bounds as a field boundary at attach; detach removes it (#980)', () => {
  withWindow(1, () => {
    const attrs = new Map<string, string>();
    const el = {
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 }),
      addEventListener() {},
      removeEventListener() {},
      setAttribute: (n: string, v: string) => attrs.set(n, v),
      removeAttribute: (n: string) => attrs.delete(n),
      hasAttribute: (n: string) => attrs.has(n),
    } as unknown as HTMLElement;
    const host = containerHost(el);
    assert.ok(attrs.has(FIELD_BOUNDARY_ATTR), 'attach marks the bounds — outer scans skip its bodies');
    host.detach!();
    assert.ok(!attrs.has(FIELD_BOUNDARY_ATTR), 'destroy unmarks — the page field re-adopts on rescan');
    host.detach!(); // idempotent
    assert.ok(!attrs.has(FIELD_BOUNDARY_ATTR));
    containerHost(el); // re-attach after destroy re-marks
    assert.ok(attrs.has(FIELD_BOUNDARY_ATTR));
  });
});

// ── viewport gating for a contained field (#672 lane S2, program §6.1 C-4) ──────────────────────
//
// A contained field used to run its frame loop forever: `hidden()` reported only `document.hidden`,
// so N cards on a page were N always-running rAF loops, each doing a full simulation, measurement
// and feedback pass every frame for a card nobody could see.
//
// These pin the gate at the host contract the engine actually consults — `hidden()` and the
// `onVisibility` subscription — because that is the seam, and it is where a regression would land.

interface IOStub {
  cb: (entries: Array<{ isIntersecting: boolean }>) => void;
  opts?: { rootMargin?: string };
  observed: unknown[];
  disconnected: number;
}

/** Stub `document` + `IntersectionObserver` on top of `withWindow`'s `window` + `ResizeObserver`. */
function withDoc<T>(present: boolean, fn: (io: IOStub) => T): T {
  const g = globalThis as Record<string, unknown>;
  const savedIO = g.IntersectionObserver;
  const savedDoc = g.document;
  g.document = { hidden: false, addEventListener() {}, removeEventListener() {} };
  const rec: IOStub = { cb: () => {}, observed: [], disconnected: 0 };
  g.IntersectionObserver = present
    ? (class {
        constructor(cb: IOStub['cb'], opts?: { rootMargin?: string }) {
          rec.cb = cb;
          rec.opts = opts;
        }
        observe(t: unknown) { rec.observed.push(t); }
        disconnect() { rec.disconnected++; }
      } as unknown)
    : undefined;
  try {
    return fn(rec);
  } finally {
    if (savedIO === undefined) delete g.IntersectionObserver; else g.IntersectionObserver = savedIO;
    if (savedDoc === undefined) delete g.document; else g.document = savedDoc;
  }
}

function boundsEl(): HTMLElement {
  const attrs = new Map<string, string>();
  return {
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 300, height: 200 }),
    scrollTop: 0,
    scrollHeight: 200,
    addEventListener() {},
    removeEventListener() {},
    setAttribute: (n: string, v: string) => void attrs.set(n, v),
    removeAttribute: (n: string) => void attrs.delete(n),
    hasAttribute: (n: string) => attrs.has(n),
  } as unknown as HTMLElement;
}

test('C-4: an off-screen contained field reports hidden, so the engine cancels its rAF', () => {
  withWindow(1, () => {
    withDoc(true, (io) => {
      const el = boundsEl();
      const host = containerHost(el);
      assert.equal(host.hidden?.(), false, 'starts on-screen — an observer that never fires must not latch it shut');

      let woke = 0;
      const off = host.onVisibility!(() => void woke++);
      assert.deepEqual(io.observed, [el], 'the bounds element is what is observed');

      io.cb([{ isIntersecting: false }]);
      assert.equal(host.hidden?.(), true, 'scrolled out of view ⇒ hidden ⇒ the engine stops the loop');
      assert.equal(woke, 1, 'and the engine is told, once');

      io.cb([{ isIntersecting: false }]);
      assert.equal(woke, 1, 'no edge, no notification — IO fires on every threshold crossing');

      io.cb([{ isIntersecting: true }]);
      assert.equal(host.hidden?.(), false, 'back in view ⇒ visible again');
      assert.equal(woke, 2, 'and the engine is told to resume');

      off();
      assert.equal(io.disconnected, 1, 'unsubscribing disconnects the observer');
    });
  });
});

test('C-4: the page being hidden still hides a contained field, on-screen or not', () => {
  withWindow(1, () => {
    withDoc(true, () => {
      const host = containerHost(boundsEl());
      const doc = (globalThis as { document?: { hidden?: boolean } }).document!;
      doc.hidden = true;
      assert.equal(host.hidden?.(), true, 'the two conditions are ORed, not replaced');
      doc.hidden = false;
      assert.equal(host.hidden?.(), false);
    });
  });
});

test('C-4: unsubscribing leaves the gate OPEN — a dead observer must not report hidden forever', () => {
  withWindow(1, () => {
    withDoc(true, (io) => {
      const host = containerHost(boundsEl());
      const off = host.onVisibility!(() => {});
      io.cb([{ isIntersecting: false }]);
      assert.equal(host.hidden?.(), true);
      off();
      assert.equal(host.hidden?.(), false, 'a torn-down observer can never report again — so open, not latched');
    });
  });
});

test('C-4: the observer margin resumes a card before it scrolls in, not after', () => {
  withWindow(1, () => {
    withDoc(true, (io) => {
      const host = containerHost(boundsEl());
      host.onVisibility!(() => {});
      const margin = Number.parseFloat(io.opts?.rootMargin ?? '0');
      assert.ok(margin > 0, `a positive margin so the first visible frame is a running field, got ${io.opts?.rootMargin}`);
    });
  });
});

test('C-4: pauseOffscreen: false opts out — the host reports only the page visibility, as before', () => {
  withWindow(1, () => {
    withDoc(true, (io) => {
      const host = containerHost(boundsEl(), { pauseOffscreen: false });
      host.onVisibility!(() => {});
      assert.deepEqual(io.observed, [], 'nothing is observed at all');
      assert.equal(host.hidden?.(), false, 'and the field keeps running wherever the box is');
    });
  });
});

test('C-4: no IntersectionObserver in the environment ⇒ the old behaviour, not a broken one', () => {
  withWindow(1, () => {
    withDoc(false, () => {
      const host = containerHost(boundsEl());
      assert.doesNotThrow(() => host.onVisibility!(() => {}));
      assert.equal(host.hidden?.(), false, 'unobservable ⇒ assumed visible, exactly as before this gate existed');
    });
  });
});

test('C-4: each contained field gates on its OWN box — two cards do not share a verdict', () => {
  // The bug this forecloses: one shared module-level flag, or observing the wrong element. With N
  // cards on a page the whole point is that the off-screen ones stop while the visible one runs.
  withWindow(1, () => {
    withDoc(true, (io) => {
      const a = boundsEl();
      const b = boundsEl();
      const hostA = containerHost(a);
      const hostB = containerHost(b);
      hostA.onVisibility!(() => {});
      const ioA = io.cb; // the stub records the LAST constructed observer's callback
      hostB.onVisibility!(() => {});
      const ioB = io.cb;
      assert.notEqual(ioA, ioB, 'two fields, two observers');

      ioA([{ isIntersecting: false }]); // only A scrolled away
      assert.equal(hostA.hidden?.(), true, 'A is off-screen and pauses');
      assert.equal(hostB.hidden?.(), false, 'B is untouched and keeps running');
    });
  });
});
