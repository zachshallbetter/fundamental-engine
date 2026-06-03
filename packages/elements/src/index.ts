import { PALETTE } from 'forces-ui';

/**
 * `<forces-field>` — the reciprocal field as a custom element.
 *
 * Drop it once on a page; it renders a full-viewport canvas behind the content
 * and (once the engine lands — ROADMAP Phase 1) scans the document for
 * `[data-body]` / `[data-preset]` elements, turning each into a body in the field.
 *
 * The point of shipping a **custom element**: it works in React, Svelte, Astro,
 * Vue, or plain HTML unchanged — "every element is a body" as a native, portable
 * primitive, with no framework lock-in for consumers.
 *
 * Plain `HTMLElement` for now (the field is just a canvas — no templating). Lit
 * earns its place when there's UI to template, e.g. the Lab controls (§14).
 *
 * STATUS: API placeholder. The integrator (FieldStore + loop) wires in at Phase 1.
 */
export class ForcesField extends HTMLElement {
  static readonly observedAttributes = ['accent', 'density', 'waves'];

  private readonly canvas: HTMLCanvasElement;

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

  connectedCallback(): void {
    // TODO(Phase 1): mount the engine against this.canvas —
    //   this.field = createField(this.canvas, {
    //     accent: this.accent, density: this.density, waves: this.waves,
    //   });
    //   this.field.scan(document); // [data-body] / [data-preset] → bodies
    void this.canvas;
  }

  disconnectedCallback(): void {
    // TODO(Phase 1): this.field?.destroy();
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
