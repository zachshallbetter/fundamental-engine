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

export function mountXRay(field: FieldHandle, container: ParentNode & EventTarget, opts: XRayOptions = {}): () => void {
  const hotkey = opts.hotkey ?? '?';
  const pos = opts.position ?? 'bottom-right';

  let panel: HTMLElement | null = null;
  let rafId: number | null = null;
  let cursorX = 0;
  let cursorY = 0;

  function positionStyle(): string {
    const [v, h] = pos.split('-') as ['top' | 'bottom', 'left' | 'right'];
    return `position:fixed;${v}:16px;${h}:16px;z-index:99999;`;
  }

  function tick() {
    if (!panel) return;
    const n = field.particleCount();
    const sample = (field as any).sample?.(cursorX, cursorY) as { x: number; y: number } | undefined;
    const energy = (field as any).energy?.() as { kinetic: number; thermal: number; total: number } | undefined;
    panel.innerHTML = `
      <div style="font:11px/1.4 monospace;color:#e2e8f0;padding:12px 14px;min-width:220px">
        <div style="color:#a0c4ff;font-weight:700;margin-bottom:8px;letter-spacing:.04em">⊕ FIELD X-RAY</div>
        <div>particles <b style="color:#ffd166">${n}</b></div>
        ${energy ? `<div>kinetic <b style="color:#ffd166">${energy.kinetic.toFixed(3)}</b>  thermal <b style="color:#ffd166">${energy.thermal.toFixed(3)}</b></div>` : ''}
        ${sample ? `<div>force @ cursor  fx <b style="color:#06d6a0">${sample.x.toFixed(3)}</b>  fy <b style="color:#06d6a0">${sample.y.toFixed(3)}</b></div>` : ''}
        <div style="margin-top:6px;color:#718096;font-size:10px">press ${hotkey} to close · move cursor for force probe</div>
      </div>
    `;
    rafId = requestAnimationFrame(tick);
  }

  function open() {
    if (panel) return;
    panel = document.createElement('div');
    panel.setAttribute('data-field-xray', '');
    panel.style.cssText = positionStyle() + 'background:rgba(10,15,28,.88);border:1px solid rgba(160,196,255,.18);border-radius:10px;backdrop-filter:blur(12px);box-shadow:0 8px 32px rgba(0,0,0,.5);';
    document.body.appendChild(panel);
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
