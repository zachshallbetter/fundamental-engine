/**
 * The whole Fundamental integration for this example, in one file.
 *
 * `@fundamental-engine/vanilla` is the framework-free door. It has NO side effects: importing it
 * registers no custom element. You give createField() a <canvas> you own and it starts the engine:
 * resolves a host (browserHost by default), runs the sim, and — with render: 'dots' — draws particles
 * onto your canvas. It also scans the page for [data-body] elements, so the attract/repel bodies in
 * index.html bend the field with no per-element wiring.
 */
import { createField } from '@fundamental-engine/vanilla';
import type { FieldHandle } from '@fundamental-engine/vanilla';

const canvas = document.getElementById('field') as HTMLCanvasElement | null;
if (!canvas) throw new Error('#field canvas not found');

// The engine default render mode is 'none' (signals-only, #538) — opt in to a visible field with 'dots'.
const field: FieldHandle = createField(canvas, { render: 'dots', density: 2 });

// Expose the handle so a smoke test / the console can read live field state.
(globalThis as unknown as { field: FieldHandle }).field = field;

// Live readout: particleCount() is the one strong invariant — if it's > 0, the field has booted.
const readout = document.getElementById('readout');
function loop(): void {
  if (readout) {
    readout.textContent = `field v${field.version} · ${field.particleCount()} particles · render: dots`;
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
