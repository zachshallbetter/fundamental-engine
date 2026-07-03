/**
 * X-Ray: press the hotkey (default '?') on any page to reveal a live field readout —
 * active bodies, particle count, energy snapshot, and force vector under the cursor.
 * mountXRay(field, host, opts?) returns a teardown function.
 */
import type { FieldHandle } from '@fundamental-engine/core';

export interface XRayOptions {
  /** Key that toggles the overlay. Default '?' */
  hotkey?: string;
  /** Corner to anchor the panel. Default 'bottom-right' */
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
}

/** The optional readout capabilities. `sample`/`energy` are on the current FieldHandle, but a host
 *  may pass a reduced facade (a scoped agent view, a port shim), so we probe them without an `any`
 *  cast — a typed structural guard that keeps the panel honest about what the field can report. */
type ForceProbe = (x: number, y: number) => { x: number; y: number };
type EnergyProbe = () => { kinetic: number; thermal: number; total: number };

function forceProbe(field: FieldHandle): ForceProbe | null {
  const fn = (field as Partial<FieldHandle>).sample;
  return typeof fn === 'function' ? (x, y) => fn.call(field, x, y) : null;
}
function energyProbe(field: FieldHandle): EnergyProbe | null {
  const fn = (field as Partial<FieldHandle>).energy;
  return typeof fn === 'function' ? () => fn.call(field) : null;
}

export function mountXRay(field: FieldHandle, container: ParentNode & EventTarget, opts: XRayOptions = {}): () => void {
  const hotkey = opts.hotkey ?? '?';
  const pos = opts.position ?? 'bottom-right';

  // Mount against the container's OWN document, not the global `document` — the field may live in
  // an iframe, a popup window, or a test DOM. `ownerDocument` is null only for a Document node itself,
  // in which case the container IS the document.
  const doc: Document =
    (container as Node).ownerDocument ?? (container as unknown as Document);
  const mountParent: HTMLElement = doc.body ?? (doc.documentElement as unknown as HTMLElement);

  const sample = forceProbe(field);
  const energy = energyProbe(field);

  let panel: HTMLElement | null = null;
  let rafId: number | null = null;
  let cursorX = 0;
  let cursorY = 0;

  function positionStyle(): string {
    const [v, h] = pos.split('-') as ['top' | 'bottom', 'left' | 'right'];
    return `position:fixed;${v}:16px;${h}:16px;z-index:99999;`;
  }

  /** A styled key/value line. Values are set via textContent, never innerHTML — a hotkey (or any
   *  numeric readout) can never be interpreted as markup. */
  function row(label: string, value?: string, valueColor?: string): HTMLElement {
    const div = doc.createElement('div');
    div.append(doc.createTextNode(label));
    if (value !== undefined) {
      const b = doc.createElement('b');
      if (valueColor) b.style.color = valueColor;
      b.textContent = value;
      div.append(doc.createTextNode(' '), b);
    }
    return div;
  }

  function tick() {
    if (!panel) return;
    const n = field.particleCount();
    const e = energy?.();
    const f = sample?.(cursorX, cursorY);

    // Rebuild the body from scratch each frame via typed nodes — no innerHTML anywhere.
    const inner = doc.createElement('div');
    inner.style.cssText = 'font:11px/1.4 monospace;color:#e2e8f0;padding:12px 14px;min-width:220px';

    const title = doc.createElement('div');
    title.style.cssText = 'color:#a0c4ff;font-weight:700;margin-bottom:8px;letter-spacing:.04em';
    title.textContent = '⊕ FIELD X-RAY';
    inner.append(title);

    inner.append(row('particles', String(n), '#ffd166'));
    if (e) {
      const line = doc.createElement('div');
      line.append(doc.createTextNode('kinetic '));
      const k = doc.createElement('b'); k.style.color = '#ffd166'; k.textContent = e.kinetic.toFixed(3);
      line.append(k, doc.createTextNode('  thermal '));
      const t = doc.createElement('b'); t.style.color = '#ffd166'; t.textContent = e.thermal.toFixed(3);
      line.append(t);
      inner.append(line);
    }
    if (f) {
      const line = doc.createElement('div');
      line.append(doc.createTextNode('force @ cursor  fx '));
      const fx = doc.createElement('b'); fx.style.color = '#06d6a0'; fx.textContent = f.x.toFixed(3);
      line.append(fx, doc.createTextNode('  fy '));
      const fy = doc.createElement('b'); fy.style.color = '#06d6a0'; fy.textContent = f.y.toFixed(3);
      line.append(fy);
      inner.append(line);
    }

    const hint = doc.createElement('div');
    hint.style.cssText = 'margin-top:6px;color:#718096;font-size:10px';
    // hotkey is interpolated as TEXT — an `<img onerror=…>` hotkey renders as literal characters.
    hint.textContent = `press ${hotkey} to close · move cursor for force probe`;
    inner.append(hint);

    panel.replaceChildren(inner);
    rafId = requestAnimationFrame(tick);
  }

  function open() {
    if (panel) return;
    panel = doc.createElement('div');
    panel.setAttribute('data-field-xray', '');
    panel.style.cssText = positionStyle() + 'background:rgba(10,15,28,.88);border:1px solid rgba(160,196,255,.18);border-radius:10px;backdrop-filter:blur(12px);box-shadow:0 8px 32px rgba(0,0,0,.5);';
    mountParent.appendChild(panel);
    tick();
  }

  function close() {
    if (rafId != null) { cancelAnimationFrame(rafId); rafId = null; }
    panel?.remove();
    panel = null;
  }

  function onKey(e: Event) {
    const key = (e as KeyboardEvent).key;
    if (key === hotkey) { panel ? close() : open(); }
    if (key === 'Escape') close();
  }

  function onMove(e: Event) {
    cursorX = (e as MouseEvent).clientX;
    cursorY = (e as MouseEvent).clientY;
  }

  container.addEventListener('keydown', onKey as EventListener);
  container.addEventListener('mousemove', onMove as EventListener);

  return () => {
    close();
    container.removeEventListener('keydown', onKey as EventListener);
    container.removeEventListener('mousemove', onMove as EventListener);
  };
}
