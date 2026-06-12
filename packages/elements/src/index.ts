import { PALETTE, type AtomPayload, type FieldHandle, type ThreadLink, type FeedbackSink, type FlowOptions, type OverlayInput, type OverlayMode } from '@field-ui/core';
import { createBrowserField, type FieldPlatform } from '@field-ui/platform';
import { HTMLElementBase } from './base.ts';
import { shouldUsePlatformRuntime, startPlatformRuntime, makeFeedbackSink, type PlatformRuntime } from './platform-runtime.ts';

// Experimental platform runtime (Phase D). Re-exported so apps can opt in globally.
export { usePlatformRuntime, isPlatformRuntimeDefault, shouldUsePlatformRuntime, startPlatformRuntime } from './platform-runtime.ts';
export type { PlatformRuntime } from './platform-runtime.ts';

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
 *
 * @summary The page-singleton reciprocal field — a full-viewport canvas that turns
 * `[data-body]` / `[data-preset]` elements into bodies. Registered as `<field-root>`
 * (canonical), `<field-field>`, and `<forces-field>` (deprecated alias).
 * @attr {string} accent - Accent color (hex) the field draws particles and overlay in.
 * @attr {number} density - Particle-density multiplier (default `1`; `0.5` halves the count).
 * @attr {number} waves - Intensity of the resting wave currents (the ambient drift).
 * @attr {string} render - Underlay render mode (Field Surfaces, behind content): `dots` | `trails` | `links` | `metaballs` | `voronoi` | `streamlines` | `none`. `none` is the signals-only engine (#297): the simulation and feedback signals run, but no canvas context is acquired and nothing is ever drawn.
 * @attr {string} overlay - Overlay readings (Field Surfaces, in front of content): `off` | `streamlines` | `force-vectors` | `field-lines` | `grid` | `temperature` | `energy` | `path` | `data` — or a space-separated stack (readings are additive, drawn in order).
 * @attr {string} palette - Named color palette for the field.
 * @attr {number} mass - Global mass scaling applied to bodies.
 * @attr {boolean} attention - Enables the conserved-attention behaviour (one finite budget, redistributed).
 * @attr {boolean} causality - Enables the causality demo behaviour.
 * @attr {string} background - Substrate background: `transparent` clears to transparent so the underlay composites over light content (an image, a 3D scene, a light page); default `opaque` paints the near-black substrate.
 */
export class FieldField extends HTMLElementBase {
  static readonly observedAttributes = [
    'accent',
    'density',
    'waves',
    'render',
    'overlay',
    'palette',
    'mass',
    'attention',
    'causality',
    'heatmap',
    'background',
  ];

  private readonly canvas: HTMLCanvasElement;
  private field?: FieldHandle;
  /** Field Surfaces: the optional front overlay surface (light-DOM, above content). */
  private overlayCanvas?: HTMLCanvasElement;
  /** element-level visibility: pages can hide the field (display:none) — skip draw work then. */
  private visibilityObserver?: IntersectionObserver;
  private fieldVisible = true;
  /** experimental platform runtime (Phase D); present only when the flag is on. */
  platformRuntime?: PlatformRuntime;

  /**
   * The live `@field-ui/platform` instance backing this field (Phase D default), or `undefined` on
   * the legacy path. Read-only introspection for tools like the Inspector — the registries here are
   * the real running state (measurements, state, feedback bindings, relationships, overlays, lint).
   * Read with `measure.last()` etc.; don't call `measure.measure()` off the read phase.
   */
  get platform(): FieldPlatform | undefined {
    return this.platformRuntime?.platform;
  }

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

  /** the travelling accent (§9); defaults to the first palette color. */
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

  /** render mode (§20.6); `none` = the signals-only engine — simulate + feed back, never draw (#297). */
  get renderMode(): 'dots' | 'trails' | 'links' | 'metaballs' | 'voronoi' | 'streamlines' | 'flow' | 'none' {
    const v = this.getAttribute('render');
    return v === 'trails' || v === 'links' || v === 'metaballs' || v === 'voronoi' || v === 'streamlines' || v === 'flow' || v === 'none'
      ? v
      : 'dots';
  }

  /** substrate background: `transparent` (present and not `"false"`) clears to transparent so the
   *  underlay composites over light content; default `opaque` paints the near-black substrate. */
  get background(): 'opaque' | 'transparent' {
    const v = this.getAttribute('background');
    return v === 'transparent' || (v === '' && this.hasAttribute('background')) ? 'transparent' : 'opaque';
  }

  /** Field Surfaces: the overlay reading(s) — one mode or a space-separated additive stack. Default `off`. */
  get overlay(): OverlayInput {
    const KNOWN: readonly OverlayMode[] = [
      'streamlines',
      'force-vectors',
      'field-lines',
      'grid',
      'temperature',
      'energy',
      'path',
      'data',
    ];
    const list = (this.getAttribute('overlay') ?? '')
      .split(/\s+/)
      .filter((t): t is OverlayMode => (KNOWN as readonly string[]).includes(t));
    if (!list.length) return 'off';
    return list.length === 1 ? list[0]! : list;
  }

  /** color template name for the travelling accent (§9), or undefined for `ours`. */
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

  /** first-class mass (§21.3): present and not `"false"` → particle mass ∝ size. */
  get mass(): boolean {
    return this.hasAttribute('mass') && this.getAttribute('mass') !== 'false';
  }

  /** density heatmap (field-systems H1): present and not `"false"` → the pooling glow underlay. */
  get heatmap(): boolean {
    return this.hasAttribute('heatmap') && this.getAttribute('heatmap') !== 'false';
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
  /** recolor the travelling accent (§9). */
  setAccent(hex: string): void {
    this.field?.setAccent(hex);
  }
  /** swap the accent color template live (§9). */
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
  /** switch the substrate background live: `transparent` composites the underlay over light content. */
  setBackground(mode: 'opaque' | 'transparent'): void {
    this.field?.setBackground(mode);
  }
  /** toggle the density heatmap layer (field-systems H1) live. */
  setHeatmap(on: boolean): void {
    this.field?.setHeatmap(on);
  }
  /** switch the underlay render mode (§20.6) live; `none` = signals-only — stop drawing, keep the signals (#297). */
  setRender(mode: 'dots' | 'trails' | 'links' | 'metaballs' | 'voronoi' | 'streamlines' | 'flow' | 'none'): void {
    this.field?.setRender(mode);
  }
  /** render field readings on the overlay surface (Field Surfaces — in front of content); one mode or an additive stack. */
  setOverlay(mode: OverlayInput): void {
    this.field?.setOverlay(mode);
    syncOverlaySurface(this.overlayCanvas, mode);
  }
  /** wire glowing connector lines between a set, or clear with null (§10). */
  threads(list: ThreadLink[] | null): void {
    this.field?.threads(list);
  }
  /** a discrete one-shot: shove + heat matter near (x, y), optionally tinting it (§11). */
  burst(x: number, y: number, hex?: string): void {
    this.field?.burst(x, y, hex);
  }
  /** place/move a dynamic flow focus the field bends toward — pulls matter, curves the streamlines. */
  flowTo(x: number, y: number, opts?: FlowOptions): void {
    this.field?.flowTo(x, y, opts);
  }
  /** remove the flow focus. */
  clearFlow(): void {
    this.field?.clearFlow();
  }
  /** bind a data record to each base particle (its `weight` scales mass + size); pick back with `atomAt`. */
  seed(atoms: readonly AtomPayload[]): void {
    this.field?.seed(atoms);
  }
  /** the seeded record on the nearest particle to (x, y), or null — for hover-to-inspect. */
  atomAt(x: number, y: number): AtomPayload | null {
    return this.field?.atomAt(x, y) ?? null;
  }
  /** focus the nearest seeded particle (hold + light it), returning its record — the dwell affordance. */
  focusAt(x: number, y: number): AtomPayload | null {
    return this.field?.focusAt(x, y) ?? null;
  }
  /** release the focused particle. */
  clearFocus(): void {
    this.field?.clearFocus();
  }
  /** live particle-pool size — `store.size` forwarded through the public handle. */
  particleCount(): number {
    return this.field?.particleCount() ?? 0;
  }
  /** copy live particle state into `out` (stride 5: x, y, z, heat, size); returns the count written
   *  (0 before the field starts) — the render-agnostic swarm read-out an alternative surface draws. */
  readParticles(out: Float32Array): number {
    return this.field?.readParticles(out) ?? 0;
  }
  /** kinetic/thermal/total energy snapshot for the current frame. */
  energy(): { kinetic: number; thermal: number; total: number; count: number } {
    return this.field?.energy() ?? { kinetic: 0, thermal: 0, total: 0, count: 0 };
  }

  connectedCallback(): void {
    // the field is decorative ambiance — hide it from assistive tech (§18 a11y).
    if (!this.hasAttribute('aria-hidden')) this.setAttribute('aria-hidden', 'true');
    this.start();
    // Pages can hide the singleton field with CSS (display:none) — e.g. surfaces that want the
    // engine's signals but no particle swarm. The host is position:fixed inset:0, so IO reports
    // not-intersecting exactly when it's hidden or zero-sized; the engine then skips all draw
    // work while the simulation (scrollV, feedback vars, events) keeps running.
    if (typeof IntersectionObserver !== 'undefined' && !this.visibilityObserver) {
      this.visibilityObserver = new IntersectionObserver((entries) => {
        this.fieldVisible = entries.some((e) => e.isIntersecting);
        this.field?.setVisible(this.fieldVisible);
      });
      this.visibilityObserver.observe(this);
    }
  }

  disconnectedCallback(): void {
    this.visibilityObserver?.disconnect();
    this.visibilityObserver = undefined;
    this.field?.destroy();
    this.field = undefined;
    // Field Surfaces: remove the light-DOM overlay surface this element owns.
    this.overlayCanvas?.remove();
    this.overlayCanvas = undefined;
    this.platformRuntime?.destroy();
    this.platformRuntime = undefined;
  }

  /**
   * React to live attribute changes after mount (§13). The color / render / toggle attributes
   * apply through the field's setters; the construction-time ones (`density`, `waves`, `mass`)
   * rebuild the field. Fires before `connectedCallback` for the initial attributes too, which the
   * `this.field` guard skips — the first mount reads every attribute itself.
   */
  attributeChangedCallback(name: string, oldVal: string | null, newVal: string | null): void {
    if (!this.field || oldVal === newVal) return;
    switch (name) {
      case 'accent':
        this.field.setAccent(this.accent);
        break;
      case 'palette':
        this.field.setPalette(this.palette ?? 'ours');
        break;
      case 'render':
        this.field.setRender(this.renderMode);
        break;
      case 'overlay':
        this.field.setOverlay(this.overlay);
        syncOverlaySurface(this.overlayCanvas, this.overlay);
        break;
      case 'attention':
        this.field.setAttention(this.attention);
        break;
      case 'causality':
        this.field.setCausality(this.causality);
        break;
      case 'heatmap':
        this.field.setHeatmap(this.heatmap);
        break;
      case 'background':
        this.field.setBackground(this.background);
        break;
      default: // density / waves / mass are construction-time → rebuild
        this.field.destroy();
        this.start();
    }
  }

  /** (re)create the engine on the canvas, reading the current attributes. */
  private start(): void {
    // tear down any prior platform runtime before a rebuild (idempotent)
    this.platformRuntime?.destroy();
    this.platformRuntime = undefined;
    // Phase D: when the experimental flag is on, start the platform runtime FIRST (so the engine can
    // hand it feedback via a sink), then create the engine with that sink. D2 measures bodies; D3
    // routes feedback through FeedbackRegistry. Default off → no runtime, no sink (unchanged).
    let feedbackSink: FeedbackSink | undefined;
    if (shouldUsePlatformRuntime(this)) {
      const scanRoot = this.ownerDocument?.documentElement ?? this;
      this.platformRuntime = startPlatformRuntime(scanRoot);
      feedbackSink = makeFeedbackSink(this.platformRuntime.platform);
    }
    // Field Surfaces: ensure the front overlay surface exists (light DOM — the shadow host is
    // z-index:0, behind content). A fixed, full-viewport, click-through canvas above content; core
    // sizes its backing store and draws the overlay mode onto it. Created once, reused across rebuilds.
    if (!this.overlayCanvas && typeof document !== 'undefined') {
      const oc = document.createElement('canvas');
      oc.setAttribute('aria-hidden', 'true');
      oc.style.cssText =
        'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:5;mix-blend-mode:screen';
      document.body.appendChild(oc);
      this.overlayCanvas = oc;
    }
    this.field = createBrowserField(this.canvas, {
      // pass the raw attribute so a `palette` with no `accent` adopts the palette's first stop
      accent: this.getAttribute('accent') ?? undefined,
      density: this.density,
      waves: this.waves,
      background: this.background,
      render: this.renderMode,
      overlayCanvas: this.overlayCanvas,
      overlay: this.overlay,
      palette: this.palette,
      mass: this.mass,
      attention: this.attention,
      causality: this.causality,
      heatmap: this.heatmap,
      feedbackSink,
    });
    // attach the handle so the platform write phase can read scrollV → --field-scroll-v
    // and the quality governor can monitor frame duration
    this.platformRuntime?.attachHandle(this.field);
    // a rebuild (density/waves/mass change) starts a fresh engine that defaults to visible —
    // re-apply the last observed element visibility so a hidden field stays draw-skipped.
    if (!this.fieldVisible) this.field.setVisible(false);
    // take the overlay canvas out of the compositing tree unless a reading is actually active.
    syncOverlaySurface(this.overlayCanvas, this.overlay);
  }
}

/**
 * Field Surfaces perf: the overlay canvas is a full-viewport `mix-blend-mode: screen` layer, so while
 * it's in the compositing tree the browser re-blends the whole screen against the animating underlay
 * every frame — even with nothing drawn on it. Take it OUT of the tree (`display:none`) whenever no
 * reading is active, and put it back only when one is. Keeps the common `overlay: off` case as cheap
 * as a single-canvas field. Module-level (not a class member) so it stays out of the public manifest.
 */
function syncOverlaySurface(canvas: HTMLCanvasElement | undefined, input: OverlayInput): void {
  if (!canvas) return;
  const active = Array.isArray(input) ? input.some((m) => m !== 'off') : input !== 'off';
  canvas.style.display = active ? '' : 'none';
}

if (typeof customElements !== 'undefined' && !customElements.get('field-field')) {
  customElements.define('field-field', FieldField);
}

/**
 * Tag aliases of the canonical {@link FieldField} element. The registry rejects registering one
 * constructor under two tag names, so each alias is a thin subclass with identical behaviour,
 * attributes, and body contract. `<field-root>` is the recommended tag for the singleton field;
 * `<forces-field>` is the deprecated field-ui-migration alias kept until the removal version
 * (docs/planning-archive/field-ui-migration-plan.md §3).
 */
export class FieldRoot extends FieldField {}
/** @deprecated use `<field-root>` / `FieldField`. */
export class ForcesField extends FieldField {}

if (typeof customElements !== 'undefined') {
  if (!customElements.get('field-root')) customElements.define('field-root', FieldRoot);
  if (!customElements.get('forces-field')) customElements.define('forces-field', ForcesField);
}

declare global {
  interface HTMLElementTagNameMap {
    'field-field': FieldField;
    'field-root': FieldRoot;
    'forces-field': ForcesField;
  }
}

export * from './forces-cell.ts';
export * from './cell-force.ts';
export * from './mount.ts';
// shadow-DOM participation: the helper a custom element uses to join the field without
// repeating registration-event boilerplate (docs/engine-reference/shadow-dom.md §31.1).
export {
  FieldController,
  ForcesController, // @deprecated alias of FieldController
  REGISTER_BODY,
  UNREGISTER_BODY,
  UPDATE_BODY,
  // field:* event aliases (field-ui migration) — dispatched and listened alongside forces:*.
  FIELD_REGISTER_BODY,
  FIELD_UNREGISTER_BODY,
  FIELD_UPDATE_BODY,
} from '@field-ui/core';
export type { RegisterBodyDetail } from '@field-ui/core';
