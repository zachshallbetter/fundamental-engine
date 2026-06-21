/**
 * FieldHost — the renderer/environment seam (Phase: frontier). `createField`'s engine is
 * renderer-agnostic: every DOM-global touchpoint (viewport size, scroll, rAF, reduced-motion,
 * visibility, the scan root, and event wiring) goes through this injected host instead of `window` /
 * `document` / `requestAnimationFrame` directly. `browserHost()` (in `@fundamental-engine/dom`)
 * binds it to the browser; an alternative host could drive the same engine from a headless renderer,
 * a different document, or a test harness. This interface is pure types — no globals — so `field.ts`
 * imports zero DOM (enforced by `dom-boundary.test.ts`).
 */

/** The host's current viewport, in CSS px plus device-pixel ratio. */
export interface HostViewport {
  width: number;
  height: number;
  dpr: number;
  /** field-space origin in the host's measurement coords — the top-left the field is drawn from.
   *  `0,0` for a window-scoped host (the default); a CONTAINED host (`containerHost`) returns its
   *  element's `left,top` so the field, its bodies, and its canvas all live in container-local space.
   *  `measureBodies` and the thread/move readouts subtract it. Optional → 0 keeps every window host
   *  and test byte-identical. */
  originX?: number;
  originY?: number;
}

export interface FieldHost {
  /** the subtree scanned for `[data-body]` / `[data-move]` / `[data-on]` / `[data-hot]` / `[data-formation]`. */
  root: ParentNode;
  /** the current viewport size + DPR (read each resize). */
  viewport(): HostViewport;
  /** current vertical scroll offset in px. */
  scrollY(): number;
  /** the scrollable height of the page (cached by the caller — reading it forces reflow). */
  scrollHeight(): number;
  /** whether the user prefers reduced motion (freezes the sim). */
  reducedMotion(): boolean;
  /** whether the surface is hidden (backgrounded tab) — pauses the loop. */
  hidden(): boolean;
  /** schedule the next frame; returns a handle. */
  raf(cb: (t: number) => void): number;
  /** cancel a scheduled frame. */
  cancelRaf(id: number): void;
  /** an offscreen canvas for the heatmap buffer. */
  createCanvas(): HTMLCanvasElement;
  /** subscribe to viewport-resize; returns an unsubscribe. */
  onResize(cb: () => void): () => void;
  /** subscribe to scroll; returns an unsubscribe. */
  onScroll(cb: () => void): () => void;
  /** subscribe to surface visibility changes; returns an unsubscribe. */
  onVisibility(cb: () => void): () => void;
  /** subscribe to user input activity (pointer/wheel/key/touch); returns an unsubscribe. */
  onInput(cb: () => void): () => void;
  /** subscribe to a composed shadow-DOM body event by name; returns an unsubscribe. */
  onBodyEvent(type: string, cb: (e: Event) => void): () => void;
}
