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
  static readonly observedAttributes = [
    'accent',
    'density',
    'waves',
    'render',
    'palette',
    'attention',
    'causality',
  ];

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
  get renderMode(): 'dots' | 'trails' | 'links' | 'metaballs' | 'voronoi' | 'streamlines' {
    const v = this.getAttribute('render');
    return v === 'trails' || v === 'links' || v === 'metaballs' || v === 'voronoi' || v === 'streamlines' ? v : 'dots';
  }

  /** colour template name for the travelling accent (§9), or undefined for `ours`. */
  get palette(): string | undefined {
    return this.getAttribute('palette') ?? undefined;
  }

  /** conserved attention (§2.4): present and not `"false"` → one finite strength budget. */
  get attention(): boolean {
    return this.hasAttribute('attention') && this.getAttribute('attention') !== 'false';
  }

  /** cross-boundary causality (Concept 4): present and not `"false"` → density spills. */
  get causality(): boolean {
    return this.hasAttribute('causality') && this.getAttribute('causality') !== 'false';
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
  /** swap the accent colour template live (§9). */
  setPalette(palette: string | readonly string[]): void {
    this.field?.setPalette(palette);
  }
  /** switch the global formation (§7). */
  setFormation(name: string): void {
    this.field?.setFormation(name);
  }
  /** toggle conserved attention (§2.4) live. */
  setAttention(on: boolean): void {
    this.field?.setAttention(on);
  }
  /** toggle cross-boundary causality (Concept 4) live. */
  setCausality(on: boolean): void {
    this.field?.setCausality(on);
  }
  /** switch the render mode (§20.6) live. */
  setRender(mode: 'dots' | 'trails' | 'links' | 'metaballs' | 'voronoi' | 'streamlines'): void {
    this.field?.setRender(mode);
  }
  /** a discrete one-shot: shove + heat matter near (x, y), optionally tinting it (§11). */
  burst(x: number, y: number, hex?: string): void {
    this.field?.burst(x, y, hex);
  }

  connectedCallback(): void {
    // the field is decorative ambiance — hide it from assistive tech (§18 a11y).
    if (!this.hasAttribute('aria-hidden')) this.setAttribute('aria-hidden', 'true');
    this.field = createField(this.canvas, {
      // pass the raw attribute so a `palette` with no `accent` adopts the palette's first stop
      accent: this.getAttribute('accent') ?? undefined,
      density: this.density,
      waves: this.waves,
      render: this.renderMode,
      palette: this.palette,
      attention: this.attention,
      causality: this.causality,
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
