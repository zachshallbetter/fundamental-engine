// The cookbook's LIVE examples — the ones that cannot run at build time.
//
// The headless examples in this folder execute during `astro build` and print what they returned.
// A contained field, a data binding, the workbench and nav chrome all need a real document, so they
// run here, in the browser, on the page that documents them. Each writes a status line into
// `[data-cb-status]` — which is both the reader's proof that it is live and the hook e2e asserts on
// (apps/site/e2e/cookbook.spec.ts), so a demo that silently stops working fails CI.
//
// Every demo is torn down through `pageRuntime`: these pages are reached by client-side navigation,
// and a contained field owns a rAF loop, a ResizeObserver and listeners on its bounds element.
import { createField } from '@fundamental-engine/vanilla';
import { bindData, bindFieldNav } from '@fundamental-engine/dom';
import type { FieldHandle } from '@fundamental-engine/core';
import { pageRuntime } from '../page-runtime.ts';

type Teardown = () => void;

const say = (root: HTMLElement, text: string): void => {
  const el = root.querySelector<HTMLElement>('[data-cb-status]');
  if (el) el.textContent = text;
};

/** A contained field on a stage element: its own canvas, its own coordinate space, its own bounds. */
function containedField(
  stage: HTMLElement,
  opts: { density?: number; render?: string } = {},
): { field: FieldHandle; destroy: Teardown } {
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;border-radius:inherit';
  stage.appendChild(canvas);

  // `bounds` resolves to containerHost(stage) — the field is scoped to this element, and the
  // element is marked as a field boundary so the PAGE field skips the bodies inside it.
  const field = createField(canvas, {
    bounds: stage,
    render: (opts.render ?? 'dots') as 'dots',
    density: opts.density ?? 3,
    waves: false,
  });
  field.scan();

  return {
    field,
    destroy: () => {
      field.destroy();
      canvas.remove();
    },
  };
}

/** A rAF loop that reports a body's live `--d` until torn down. */
function reportDensity(root: HTMLElement, body: HTMLElement, label: string): Teardown {
  let raf = 0;
  const loop = (): void => {
    const d = parseFloat(getComputedStyle(body).getPropertyValue('--d')) || 0;
    say(root, `${label} · --d ${d.toFixed(3)}`);
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
  return () => cancelAnimationFrame(raf);
}

// ── contained field ───────────────────────────────────────────────────────────────────────────
function mountContained(root: HTMLElement): Teardown {
  const stage = root.querySelector<HTMLElement>('[data-cb-stage]');
  const body = root.querySelector<HTMLElement>('[data-body]');
  if (!stage || !body) return () => {};

  // `current` holds the live field: the density toggle REBUILDS it (density is a
  // construction-time option), and the teardown must always drop whichever one is current —
  // destroying the first field while leaving its canvas behind is exactly the leak this
  // indirection prevents.
  let current = containedField(stage, { density: 4 });
  const stopReport = reportDensity(root, body, 'contained field running');

  // the density lesson, made switchable: the pool is 130 x density FIELD-WIDE, so a small
  // contained field needs a HIGHER density to read the same --d as a page-sized one.
  const toggle = root.querySelector<HTMLButtonElement>('[data-cb-density]');
  let high = true;
  const onClick = (): void => {
    high = !high;
    current.destroy(); // drops the field AND its canvas
    current = containedField(stage, { density: high ? 4 : 0.5 });
    if (toggle) toggle.textContent = high ? 'density 4 (try 0.5)' : 'density 0.5 (try 4)';
  };
  toggle?.addEventListener('click', onClick);

  return () => {
    toggle?.removeEventListener('click', onClick);
    stopReport();
    current.destroy();
  };
}

// ── conditional gates (data-when) ─────────────────────────────────────────────────────────────
function mountConditions(root: HTMLElement): Teardown {
  const stage = root.querySelector<HTMLElement>('[data-cb-stage]');
  if (!stage) return () => {};
  const { field, destroy } = containedField(stage, { density: 4 });

  // The gated body only acts while it is ENGAGED (data-when="active" + data-hot).
  const gated = root.querySelector<HTMLElement>('[data-cb-gated]');
  let raf = 0;
  const loop = (): void => {
    const d = gated ? parseFloat(getComputedStyle(gated).getPropertyValue('--d')) || 0 : 0;
    const engaged = gated?.matches(':hover, :focus-within') ?? false;
    say(root, `gate ${engaged ? 'open (engaged)' : 'closed (idle)'} · --d ${d.toFixed(3)}`);
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);

  void field;
  return () => {
    cancelAnimationFrame(raf);
    destroy();
  };
}

// ── the visualization workbench ───────────────────────────────────────────────────────────────
function mountWorkbench(root: HTMLElement): Teardown {
  const stage = root.querySelector<HTMLElement>('[data-cb-stage]');
  if (!stage) return () => {};
  const { field, destroy } = containedField(stage, { density: 4, render: 'dots' });

  // SUBSTRATE is pick-one (one base layer); OVERLAY readings are additive (the engine takes an
  // array), which is why one is a radio set and the other a set of toggles.
  const overlays = new Set<string>();
  const listeners: [HTMLElement, string, EventListener][] = [];

  for (const btn of root.querySelectorAll<HTMLButtonElement>('[data-cb-render]')) {
    const fn = (): void => {
      const mode = btn.dataset.cbRender!;
      field.setRender(mode as 'dots');
      for (const other of root.querySelectorAll('[data-cb-render]'))
        other.setAttribute('aria-pressed', String(other === btn));
      say(root, `substrate ${mode} · overlays ${[...overlays].join(' ') || 'none'}`);
    };
    btn.addEventListener('click', fn);
    listeners.push([btn, 'click', fn]);
  }

  for (const btn of root.querySelectorAll<HTMLButtonElement>('[data-cb-overlay]')) {
    const fn = (): void => {
      const mode = btn.dataset.cbOverlay!;
      if (overlays.has(mode)) overlays.delete(mode);
      else overlays.add(mode);
      btn.setAttribute('aria-pressed', String(overlays.has(mode)));
      // an overlay reading needs a front surface; without one setOverlay is a silent no-op
      field.setOverlay([...overlays]);
      say(root, `substrate live · overlays ${[...overlays].join(' ') || 'none'}`);
    };
    btn.addEventListener('click', fn);
    listeners.push([btn, 'click', fn]);
  }

  say(root, 'workbench ready · substrate dots · overlays none');

  return () => {
    for (const [el, type, fn] of listeners) el.removeEventListener(type, fn);
    destroy();
  };
}

// ── data-driven binding ───────────────────────────────────────────────────────────────────────
interface Ticket {
  id: string;
  title: string;
  priority: number;
  blocks?: string;
}

const TICKETS: Ticket[] = [
  { id: 't-1', title: 'Payment retries fail silently', priority: 0.95, blocks: 't-3' },
  { id: 't-2', title: 'Slow search on large tenants', priority: 0.6 },
  { id: 't-3', title: 'Refund webhook ordering', priority: 0.45 },
  { id: 't-4', title: 'Tidy the settings copy', priority: 0.12 },
];

function mountBinding(root: HTMLElement): Teardown {
  const container = root.querySelector<HTMLElement>('[data-cb-records]');
  if (!container) return () => {};

  // Records become bodies; the mapper owns tokens, metrics and edges; the Pattern frames which
  // metrics are tracked and written back as --field-*.
  const binding = bindData<Ticket>(
    container,
    TICKETS,
    (t) => ({
      id: t.id,
      label: `${t.title}`,
      body: { tokens: ['attract'], strength: 0.3 + t.priority, range: 180, feedback: true },
      metrics: { priority: t.priority },
      relationships: t.blocks ? [{ to: t.blocks, type: 'blocks', strength: t.priority }] : [],
    }),
    { pattern: 'priority-well', className: 'cb-record', tag: 'li' },
  );

  const report = (): void => {
    const i = binding.inspect();
    say(
      root,
      i
        ? `bound ${i.records} records · ${i.bodies} bodies · ${i.relationships} relationships`
        : 'binding idle',
    );
  };
  report();

  // the update path: a diff by id, so survivors keep their identity and removals decay out
  const btn = root.querySelector<HTMLButtonElement>('[data-cb-update]');
  let escalated = false;
  const onClick = (): void => {
    escalated = !escalated;
    binding.update(
      escalated
        ? [
            { id: 't-2', title: 'Slow search on large tenants', priority: 0.99 },
            { id: 't-3', title: 'Refund webhook ordering', priority: 0.5 },
            { id: 't-5', title: 'New: auth token expiry', priority: 0.8 },
          ]
        : TICKETS,
    );
    report();
    btn!.textContent = escalated ? 'restore the original set' : 'apply an update';
  };
  btn?.addEventListener('click', onClick);

  return () => {
    btn?.removeEventListener('click', onClick);
    binding.destroy();
  };
}

// ── navigation chrome ─────────────────────────────────────────────────────────────────────────
function mountNav(root: HTMLElement): Teardown {
  const nav = root.querySelector<HTMLElement>('[data-cb-nav]');
  if (!nav) return () => {};

  // Signals-only over real links: every <a> becomes a body, the current one is pinned, and
  // "visited" is a predicate YOU own. Nothing is drawn; the links stay plain and reachable.
  const visited = new Set(['/docs/cookbook/signals-first']);
  const handle = bindFieldNav(nav, 'navigation-current', {
    pin: nav.querySelector('[aria-current="page"]'),
    visited: (href) => visited.has(href),
  });

  say(
    root,
    handle
      ? `nav bound · ${nav.querySelectorAll('a').length} links are bodies, nothing drawn`
      : 'nav not bound — reduced motion is respected, links stay plain',
  );

  return () => handle?.destroy();
}

const MOUNTS: Record<string, (root: HTMLElement) => Teardown> = {
  contained: mountContained,
  conditions: mountConditions,
  workbench: mountWorkbench,
  binding: mountBinding,
  nav: mountNav,
};

/** Boot every cookbook demo present on the page, and tear them all down on navigation. */
export function initCookbookDemos(): void {
  pageRuntime('[data-cb-demo]', () => {
    const teardowns: Teardown[] = [];
    for (const root of document.querySelectorAll<HTMLElement>('[data-cb-demo]')) {
      const mount = MOUNTS[root.dataset.cbDemo ?? ''];
      if (mount) teardowns.push(mount(root));
    }
    return () => {
      for (const t of teardowns) t();
    };
  });
}
