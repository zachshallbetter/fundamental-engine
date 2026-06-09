/**
 * `FieldField` — the reciprocal DOM-physics field as a typed class, for plain TypeScript
 * apps that want object-oriented ergonomics without a framework or a custom element.
 *
 * `new FieldField()` builds a managed, full-viewport canvas and starts the engine on it;
 * pass `{ canvas }` to drive a `<canvas>` you own instead. The class implements the full
 * `FieldHandle` surface, so an instance is type-compatible anywhere a handle is expected,
 * and it exposes the `canvas` it renders to. (`ForcesField` remains as a deprecated alias.)
 *
 * ```ts
 * import { FieldField } from '@field-ui/vanilla';
 *
 * const field = new FieldField({ accent: '#4da3ff', render: 'dots' });
 * field.setFormation('wells');
 * field.burst(window.innerWidth / 2, 200);
 * // field.scan(); field.destroy();
 * ```
 */

import { type FieldHandle, type FieldOptions, type ThreadLink, type FlowOptions } from '@field-ui/core';
import { createBrowserField } from '@field-ui/platform';
import { makeFieldCanvas, assertBrowser } from './mount.ts';

export interface FieldFieldInit extends FieldOptions {
  /** drive a `<canvas>` you own; when omitted, a managed full-viewport canvas is created
   *  (and removed again by `destroy()`). */
  canvas?: HTMLCanvasElement;
  /** where to append the managed canvas; ignored when you pass your own `canvas`. */
  target?: HTMLElement;
}

export class FieldField implements FieldHandle {
  /** the `<canvas>` the field renders to — the one created for you, or the one you passed. */
  readonly canvas: HTMLCanvasElement;
  private readonly field: FieldHandle;
  /** did this instance create the canvas (and so should remove it on `destroy()`)? */
  private readonly managed: boolean;

  constructor(init: FieldFieldInit = {}) {
    assertBrowser(); // browser-only: fail loudly during SSR instead of a cryptic crash
    const { canvas, target, ...opts } = init;
    this.managed = !canvas;
    this.canvas = canvas ?? makeFieldCanvas(target);
    this.field = createBrowserField(this.canvas, opts);
  }

  /** (re)scan the document for `[data-body]` bodies after a layout change. */
  scan(): void {
    this.field.scan();
  }
  /** alias of `scan`. */
  rescan(): void {
    this.field.rescan();
  }
  /** recolour the travelling accent (§9). */
  setAccent(hex: string): void {
    this.field.setAccent(hex);
  }
  /** swap the accent's colour template live: a built-in name or custom hex stops (§9). */
  setPalette(palette: string | readonly string[]): void {
    this.field.setPalette(palette);
  }
  /** switch the global formation (§7). */
  setFormation(name: string): void {
    this.field.setFormation(name);
  }
  /** toggle conserved attention (§2.4) live — one finite strength budget. */
  setAttention(on: boolean): void {
    this.field.setAttention(on);
  }
  /** toggle cross-boundary causality (Concept 4) live — density spills to neighbours. */
  setCausality(on: boolean): void {
    this.field.setCausality(on);
  }
  /** toggle the density heatmap layer (field-systems H1) live. */
  setHeatmap(on: boolean): void {
    this.field.setHeatmap(on);
  }
  /** switch the underlay render mode (§20.6) live. */
  setRender(mode: Parameters<FieldHandle['setRender']>[0]): void {
    this.field.setRender(mode);
  }
  /** render a field-structure visualization on the overlay surface (in front of content). */
  setOverlay(mode: Parameters<FieldHandle['setOverlay']>[0]): void {
    this.field.setOverlay(mode);
  }
  /** wire glowing connector lines between a set, or clear with null (§10). */
  threads(list: ThreadLink[] | null): void {
    this.field.threads(list);
  }
  /** a discrete one-shot: shove + heat matter near (x, y), optionally tinting it (§11). */
  burst(x: number, y: number, hex?: string): void {
    this.field.burst(x, y, hex);
  }
  /** place/move a dynamic flow focus the field bends toward — pulls matter, curves the streamlines. */
  flowTo(x: number, y: number, opts?: FlowOptions): void {
    this.field.flowTo(x, y, opts);
  }
  /** remove the flow focus. */
  clearFlow(): void {
    this.field.clearFlow();
  }
  /** stop the loop, release listeners, and remove the canvas if this instance made it. */
  destroy(): void {
    this.field.destroy();
    if (this.managed) this.canvas.remove();
  }
}

/** @deprecated field-ui-migration alias of {@link FieldField}; use `FieldField`. */
export { FieldField as ForcesField };
/** @deprecated field-ui-migration alias of {@link FieldFieldInit}; use `FieldFieldInit`. */
export type { FieldFieldInit as ForcesFieldInit };
