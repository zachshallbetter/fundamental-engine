import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ForcesField, mountField, createField } from './index.ts';

/**
 * A throwaway, zero-dependency DOM stub — just enough surface for `createField` to construct
 * and tear down. No animation frame ever runs (we hand back a fake `requestAnimationFrame`
 * that never invokes its callback), so only the synchronous mount path is exercised. The
 * repo forbids a test framework or jsdom, so we hand-roll the few globals it touches.
 */
function installDOM(): { body: { children: unknown[] }; makeCanvas: () => HTMLCanvasElement } {
  const noop = (): void => {};
  const makeCanvas = (): HTMLCanvasElement => {
    const node = {
      width: 0,
      height: 0,
      style: {} as Record<string, string>,
      _parent: null as { _remove(n: unknown): void } | null,
      setAttribute: noop,
      getContext: () => ({ setTransform: noop }),
      remove(): void {
        node._parent?._remove(node);
      },
    };
    return node as unknown as HTMLCanvasElement;
  };
  const children: unknown[] = [];
  const body = {
    children,
    appendChild(node: { _parent: unknown }): void {
      children.push(node);
      node._parent = body;
    },
    _remove(node: unknown): void {
      const i = children.indexOf(node);
      if (i >= 0) children.splice(i, 1);
    },
  };
  (globalThis as Record<string, unknown>).window = {
    innerWidth: 1280,
    innerHeight: 800,
    devicePixelRatio: 1,
    scrollY: 0,
    addEventListener: noop,
    removeEventListener: noop,
  };
  (globalThis as Record<string, unknown>).document = {
    body,
    documentElement: { scrollHeight: 2000 },
    createElement: () => makeCanvas(),
    querySelectorAll: () => [],
    addEventListener: noop,
    removeEventListener: noop,
    hidden: false,
  };
  (globalThis as Record<string, unknown>).requestAnimationFrame = () => 1; // never invoke the frame
  (globalThis as Record<string, unknown>).cancelAnimationFrame = noop;
  return { body, makeCanvas };
}

test('re-exports the imperative surface', () => {
  assert.equal(typeof createField, 'function');
  assert.equal(typeof mountField, 'function');
  assert.equal(typeof ForcesField, 'function');
});

test('mountField appends a managed canvas and destroy() removes it', () => {
  const { body } = installDOM();
  assert.equal(body.children.length, 0);
  const field = mountField({ render: 'dots' });
  assert.equal(body.children.length, 1);
  field.destroy();
  assert.equal(body.children.length, 0);
});

test('new ForcesField() manages its canvas and forwards the full handle', () => {
  const { body } = installDOM();
  const field = new ForcesField({ accent: '#4da3ff' });
  assert.equal(body.children.length, 1);
  assert.equal(field.canvas, body.children[0]);
  const methods = [
    'scan',
    'rescan',
    'setAccent',
    'setPalette',
    'setFormation',
    'setAttention',
    'setCausality',
    'setRender',
    'setVisible',
    'threads',
    'burst',
    'destroy',
  ] as const;
  for (const m of methods) {
    assert.equal(typeof (field as unknown as Record<string, unknown>)[m], 'function', m);
  }
  field.destroy();
  assert.equal(body.children.length, 0);
});

test('ForcesField drives a canvas you own without creating or removing one', () => {
  const { body, makeCanvas } = installDOM();
  const own = makeCanvas();
  const field = new ForcesField({ canvas: own });
  assert.equal(body.children.length, 0); // we did not append it
  assert.equal(field.canvas, own);
  field.destroy();
  assert.equal(body.children.length, 0); // and we removed nothing
});

// ── FieldHandle method contracts ─────────────────────────────────────────────

test('setAccent() accepts a hex string without throwing', () => {
  installDOM();
  const field = new ForcesField();
  assert.doesNotThrow(() => field.setAccent('#ff6e9c'));
  assert.doesNotThrow(() => field.setAccent('#4da3ff'));
  field.destroy();
});

test('setVisible() toggles without throwing (draw-skip is engine-internal)', () => {
  installDOM();
  const field = new ForcesField();
  assert.doesNotThrow(() => field.setVisible(false));
  assert.doesNotThrow(() => field.setVisible(true));
  field.destroy();
});

test('setPalette() accepts a built-in name or a custom hex array', () => {
  installDOM();
  const field = new ForcesField();
  assert.doesNotThrow(() => field.setPalette('ours'));
  assert.doesNotThrow(() => field.setPalette(['#111111', '#222222', '#333333']));
  field.destroy();
});

test('setFormation() accepts every valid formation id', () => {
  installDOM();
  const field = new ForcesField();
  const formations = ['ambient', 'wells', 'lanes', 'scatter', 'accretion'] as const;
  for (const f of formations) {
    assert.doesNotThrow(() => field.setFormation(f), `setFormation('${f}')`);
  }
  field.destroy();
});

test('setFormation() with an unknown name does not throw', () => {
  installDOM();
  const field = new ForcesField();
  assert.doesNotThrow(() => field.setFormation('nonexistent-formation'));
  field.destroy();
});

test('setAttention() toggles the attention budget without throwing', () => {
  installDOM();
  const field = new ForcesField();
  assert.doesNotThrow(() => field.setAttention(true));
  assert.doesNotThrow(() => field.setAttention(false));
  assert.doesNotThrow(() => field.setAttention(true));
  field.destroy();
});

test('setCausality() toggles cross-boundary density without throwing', () => {
  installDOM();
  const field = new ForcesField();
  assert.doesNotThrow(() => field.setCausality(true));
  assert.doesNotThrow(() => field.setCausality(false));
  field.destroy();
});

test('setHeatmap() toggles the density heatmap layer without throwing', () => {
  installDOM();
  const field = new ForcesField();
  assert.doesNotThrow(() => field.setHeatmap(true));
  assert.doesNotThrow(() => field.setHeatmap(false));
  field.destroy();
});

test('setRender() accepts all six render modes', () => {
  installDOM();
  const field = new ForcesField();
  const modes = ['dots', 'trails', 'links', 'metaballs', 'voronoi', 'streamlines'] as const;
  for (const mode of modes) {
    assert.doesNotThrow(() => field.setRender(mode), `setRender('${mode}')`);
  }
  field.destroy();
});

test('setOverlay() accepts all overlay modes without throwing (Field Surfaces)', () => {
  installDOM();
  const field = new ForcesField();
  const modes = ['streamlines', 'force-vectors', 'field-lines', 'off'] as const;
  for (const mode of modes) {
    assert.doesNotThrow(() => field.setOverlay(mode), `setOverlay('${mode}')`);
  }
  field.destroy();
});

test('threads() accepts a ThreadLink array and null', () => {
  installDOM();
  const field = new ForcesField();
  const fakeEl = {} as HTMLElement;
  assert.doesNotThrow(() => field.threads([{ a: fakeEl, b: fakeEl, color: '#ffffff' }]));
  assert.doesNotThrow(() => field.threads(null));
  field.destroy();
});

test('burst() fires without crashing at arbitrary coordinates', () => {
  installDOM();
  const field = new ForcesField();
  assert.doesNotThrow(() => field.burst(400, 300));
  assert.doesNotThrow(() => field.burst(0, 0, '#4da3ff'));
  assert.doesNotThrow(() => field.burst(9999, 9999));
  field.destroy();
});

test('scan() and rescan() run without crashing', () => {
  installDOM();
  const field = new ForcesField();
  assert.doesNotThrow(() => field.scan());
  assert.doesNotThrow(() => field.rescan());
  field.destroy();
});

test('destroy() is idempotent — calling it twice does not throw', () => {
  installDOM();
  const field = new ForcesField();
  field.destroy();
  assert.doesNotThrow(() => field.destroy());
});

test('createField options: render, density, waves, palette, mass, attention, causality', () => {
  const { makeCanvas } = installDOM();
  const canvas = makeCanvas();
  assert.doesNotThrow(() => {
    const h = createField(canvas, {
      render: 'trails',
      density: 2,
      waves: false,
      palette: 'ours',
      mass: true,
      attention: true,
      causality: true,
    });
    h.destroy();
  });
});
