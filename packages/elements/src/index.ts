import { createField, PALETTE, type FieldHandle } from 'forces-ui';

/**
 * `<forces-field>` — the reciprocal field as a custom element.
 *
 * Drop it once on a page; it renders a full-viewport canvas behind the content
 * and scans the document for `[data-body]` / `[data-preset]` elements, turning
 * each into a body in the field (§2.1).
 *
 * The point of shipping a **custom element**: it works in React, Svelte, Astro,
 * Vue, or plain HTML unchanged — "every element is a body" as a native, portable
 * primitive, with no framework lock-in for consumers.
 *
 * Plain `HTMLElement` (the field is just a canvas — no templating). Lit earns its
 * place when there's UI to template, e.g. the Lab controls (§14).
 */
export class ForcesField extends HTMLElement {
  static readonly observedAttributes = ['accent', 'density', 'waves', 'render'];

  private readonly canvas: HTMLCanvasElement;
  private field?: FieldHandle;

  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent =
      ':host{position:fixed;inset:0;z-index:0;display:block;pointer-events:none}' +
      'canvas{width:100%;height:100%;display:block}';
    this.canvas = document.createElement('canvas');
    root.append(style, this.canvas);
  }

  /** the travelling accent (§9); defaults to the first palette colour. */
  get accent(): string {
    return this.getAttribute('accent') ?? PALETTE[0] ?? '#4da3ff';
  }

  /** particle-count multiplier (§2.5). */
  get density(): number {
    const v = Number(this.getAttribute('density'));
    return Number.isFinite(v) && v > 0 ? v : 1;
  }

  /** draw the background Currents (§24). */
  get waves(): boolean {
    return this.getAttribute('waves') !== 'false';
  }

  /** render mode (§20.6). */
  get renderMode(): 'dots' | 'trails' | 'links' {
    const v = this.getAttribute('render');
    return v === 'trails' || v === 'links' ? v : 'dots';
  }

  // ── the FieldHandle surface, proxied onto the element (§13) ────────────────
  /** re-scan the document for `[data-body]` bodies after a DOM change. */
  scan(): void {
    this.field?.scan();
  }
  /** alias of `scan`. */
  rescan(): void {
    this.field?.scan();
  }
  /** recolour the travelling accent (§9). */
  setAccent(hex: string): void {
    this.field?.setAccent(hex);
  }
  /** switch the global formation (§7). */
  setFormation(name: string): void {
    this.field?.setFormation(name);
  }
  /** a discrete one-shot: shove + heat matter near (x, y), optionally tinting it (§11). */
  burst(x: number, y: number, hex?: string): void {
    this.field?.burst(x, y, hex);
  }

  connectedCallback(): void {
    // the field is decorative ambiance — hide it from assistive tech (§18 a11y).
    if (!this.hasAttribute('aria-hidden')) this.setAttribute('aria-hidden', 'true');
    this.field = createField(this.canvas, {
      accent: this.accent,
      density: this.density,
      waves: this.waves,
      render: this.renderMode,
    });
  }

  disconnectedCallback(): void {
    this.field?.destroy();
    this.field = undefined;
  }
}

if (typeof customElements !== 'undefined' && !customElements.get('forces-field')) {
  customElements.define('forces-field', ForcesField);
}

declare global {
  interface HTMLElementTagNameMap {
    'forces-field': ForcesField;
  }
}

export * from './forces-cell.ts';
export * from './cell-force.ts';
export * from './mount.ts';
