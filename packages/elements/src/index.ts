import { PALETTE, FIELD_VERSION, diffFieldSnapshots, replayFieldSnapshots, type AgentHandle, type AgentSpec, type AtomPayload, type FieldHandle, type FieldOptions, type ThreadLink, type FeedbackSink, type FlowOptions, type OverlayInput, type OverlayMode, type IntegratorMode, type ScalarGrid, type FieldEventType, type FieldEventMap, type BodySpec, type BodyHandle, type FieldChannelHandle, type FieldQuery, type FieldQueryResult, type FieldSnapshot, type FieldSnapshotOptions, type FieldDiff, type CausalReplay, type ReplayOptions, type ProjectionRegistry } from '@fundamental-engine/core';
import { createBrowserField, type FieldPlatform } from '@fundamental-engine/dom';
import { HTMLElementBase } from './base.ts';
import { shouldUsePlatformRuntime, startPlatformRuntime, makeFeedbackSink, type PlatformRuntime } from './platform-runtime.ts';
import {
  installPreRegistrationQueue,
  flushPreRegistrationQueue,
  markFieldActive,
  markFieldInactive,
} from './preregistration-queue.ts';

// Experimental platform runtime (Phase D). Re-exported so apps can opt in globally.
export { usePlatformRuntime, isPlatformRuntimeDefault, shouldUsePlatformRuntime, startPlatformRuntime } from './platform-runtime.ts';
export type { PlatformRuntime } from './platform-runtime.ts';

/**
 * `<field-root>` — the reciprocal field as a custom element.
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
 * (canonical) and `<field-field>`.
 * @attr {string} accent - Accent color (hex) the field draws particles and overlay in.
 * @attr {number} density - Particle-density multiplier (default `1`; `0.5` halves the count).
 * @attr {boolean} waves - Draw the background Currents (the resting wave layers + bound shimmer). OPT-IN (#979): absent = off (the bare field); present (and not `"false"`) = on.
 * @attr {string} render - Underlay render mode (Field Surfaces, behind content): `dots` | `trails` | `links` | `metaballs` | `voronoi` | `streamlines` | `none`. The DEFAULT is `none` (#538) — the signals-only engine (#297): the simulation and feedback signals run, but no canvas context is acquired and nothing is ever drawn. Set `render="dots"` for the particle surface.
 * @attr {string} overlay - Overlay readings (Field Surfaces, in front of content): `off` | `streamlines` | `force-vectors` | `field-lines` | `grid` | `temperature` | `energy` | `path` | `data` — or a space-separated stack (readings are additive, drawn in order).
 * @attr {string} palette - Named color palette for the field.
 * @attr {string} theme - Ambient theme preset (#529): `warm` (default) | `cool` | `mono` — the heat ramp + wave baseline.
 * @attr {string} gradient-cool - Hex for the cool end of the heat ramp; overrides the theme (#529).
 * @attr {string} gradient-warm - Hex for the warm end of the heat ramp; overrides the theme (#529).
 * @attr {string} wave-baseline - Space-separated hex stops for the wave baseline; overrides the theme (#529).
 * @attr {number} mass - Global mass scaling applied to bodies.
 * @attr {boolean} attention - Enables the conserved-attention behaviour (one finite budget, redistributed).
 * @attr {boolean} causality - Enables the causality demo behaviour.
 * @attr {string} background - Substrate background: `transparent` clears to transparent so the underlay composites over light content (an image, a 3D scene, a light page); default `opaque` paints the near-black substrate.
 * @attr {number} depth - Optional z-volume (default `0`, the flat field). `> 0` opens a shallow depth the matter drifts through, projected as a size/alpha recession. Construction-time — changing it rebuilds.
 * @attr {string} integrator - Integration scheme (substrate doc 04 §Step 3): `fixed` opts into the frame-rate-independent integrator, `velocity-verlet` into the second-order Verlet scheme (#659); anything else (incl. absent) is the default `legacy`. Construction-time — changing it rebuilds.
 * @attr {number} grid-warp - Distortion multiplier for the `grid` overlay's lattice (default `1`, the calibrated amount). `2`–`3` exaggerates the deformation; `0` flattens it. Only affects the `grid` overlay mode.
 * @attr {number} grid-intensity - Stroke opacity ∈ [0,1] for the `grid` overlay lines (default `0.16`, the faint diagnostic). Raise it (≈`0.5`) to make the warped lattice a visual centerpiece. Only affects the `grid` overlay mode.
 */

/** A no-op scalar grid returned by `grid()` before the element's field has started. */
const NULL_GRID: ScalarGrid = {
  sample: () => 0,
  deposit: () => {},
  gradient: () => ({ x: 0, y: 0 }),
  decay: () => {},
  clear: () => {},
};

/** A no-op projection registry returned by `projections` before the element's field has started. */
const NULL_PROJECTIONS: ProjectionRegistry = {
  register: () => () => {},
  unregister: () => {},
  get: () => undefined,
  list: () => [],
  apply: () => {},
  bind: () => () => {},
  lint: () => [],
};

export class FieldField extends HTMLElementBase {
  /**
   * The engine options `<field-root>` forwards to `createBrowserField`, as ONE declarative table —
   * the single source of truth for the option object built in `start()`, so a new forwarded
   * `FieldOption` can never be silently dropped from forwarding the way `depth` once was. `accent`
   * (raw passthrough so a `palette` with no `accent` adopts the palette stop) and
   * `overlayCanvas`/`feedbackSink` (managed internally) are special-cased in `start()` and absent here.
   *
   * `observedAttributes` stays an explicit literal below — the Custom-Elements-Manifest analyzer reads
   * it statically and can't enumerate a computed array — but the `option-attrs-observed` test pins it
   * to this table (every `attr` here must be observed), so the two lists can't drift apart.
   */
  private static readonly OPTIONS: ReadonlyArray<{
    key: keyof FieldOptions;
    attr: string;
    read: (el: FieldField) => unknown;
  }> = [
    { key: 'density', attr: 'density', read: (el) => el.density },
    { key: 'waves', attr: 'waves', read: (el) => el.waves },
    { key: 'depth', attr: 'depth', read: (el) => el.depth },
    { key: 'background', attr: 'background', read: (el) => el.background },
    { key: 'render', attr: 'render', read: (el) => el.renderMode },
    { key: 'overlay', attr: 'overlay', read: (el) => el.overlay },
    { key: 'palette', attr: 'palette', read: (el) => el.palette },
    { key: 'mass', attr: 'mass', read: (el) => el.mass },
    { key: 'attention', attr: 'attention', read: (el) => el.attention },
    { key: 'causality', attr: 'causality', read: (el) => el.causality },
    { key: 'heatmap', attr: 'heatmap', read: (el) => el.heatmap },
    { key: 'dprCap', attr: 'dpr-cap', read: (el) => el.dprCap },
    { key: 'gridWarp', attr: 'grid-warp', read: (el) => el.gridWarp },
    { key: 'gridIntensity', attr: 'grid-intensity', read: (el) => el.gridIntensity },
    { key: 'theme', attr: 'theme', read: (el) => el.theme },
    { key: 'gradientCool', attr: 'gradient-cool', read: (el) => el.gradientCool },
    { key: 'gradientWarm', attr: 'gradient-warm', read: (el) => el.gradientWarm },
    { key: 'waveBaseline', attr: 'wave-baseline', read: (el) => el.waveBaseline },
    { key: 'waveStyle', attr: 'wave-style', read: (el) => el.waveStyle },
    { key: 'waveCenter', attr: 'wave-center', read: (el) => el.waveCenter },
    { key: 'separation', attr: 'separation', read: (el) => el.separation },
    { key: 'integrator', attr: 'integrator', read: (el) => el.integrator },
  ];

  // Literal (not computed) so the CEM analyzer can enumerate it; the test keeps it in sync with OPTIONS.
  static readonly observedAttributes = [
    'accent',
    'density',
    'waves',
    'depth',
    'render',
    'overlay',
    'palette',
    'mass',
    'attention',
    'causality',
    'heatmap',
    'dpr-cap',
    'grid-warp',
    'grid-intensity',
    'theme',
    'gradient-cool',
    'gradient-warm',
    'wave-baseline',
    'wave-style',
    'wave-center',
    'separation',
    'integrator',
    'background',
    'formation',
  ];

  private readonly canvas: HTMLCanvasElement;
  private field?: FieldHandle;
  /** guard: true while an imperative setter is reflecting its value back to an attribute, so the
   *  resulting attributeChangedCallback skips re-applying it (no double-apply / feedback loop) — #541. */
  private reflecting = false;
  /** Field Surfaces: the optional front overlay surface (light-DOM, above content). */
  private overlayCanvas?: HTMLCanvasElement;
  /** element-level visibility: pages can hide the field (display:none) — skip draw work then. */
  private visibilityObserver?: IntersectionObserver;
  private fieldVisible = true;
  /** SSR pre-registration queue bookkeeping: true while this element counts as a live field, so a
   *  rebuild (start() after a destroy) does not double-count the active-field tally (#683). */
  private fieldActiveMarked = false;
  /** experimental platform runtime (Phase D); present only when the flag is on. */
  platformRuntime?: PlatformRuntime;

  /**
   * The live `@fundamental-engine/dom` instance backing this field (Phase D default), or `undefined` on
   * the legacy path. Read-only introspection for tools like the Inspector — the registries here are
   * the real running state (measurements, state, feedback bindings, relationships, overlays, lint).
   * Read with `measure.last()` etc.; don't call `measure.measure()` off the read phase.
   */
  get platform(): FieldPlatform | undefined {
    return this.platformRuntime?.platform;
  }

  constructor() {
    super();
    // SSR pre-registration queue (shadow-dom.md §31.10): install the capturing document listeners now,
    // in the FIRST field element's constructor, so early `field:register-body` events from bodies that
    // upgrade before this field boots are buffered instead of lost. Idempotent + SSR-guarded (no-op
    // without `document`). The field drains the queue in start() once its own listeners are wired.
    installPreRegistrationQueue();
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

  /** draw the background Currents (§24). OPT-IN (#979, mirrors the core default): the attribute
   *  must be PRESENT (and not `"false"`) to build the waves — same semantics as `attention` /
   *  `causality` / `mass`. Absent = the bare field, no carrier waves. */
  get waves(): boolean {
    return this.hasAttribute('waves') && this.getAttribute('waves') !== 'false';
  }

  /** render mode (§20.6); the DEFAULT is `none` (#538) — the signals-only engine: simulate + feed back,
   *  never draw (#297). Set `render="dots"` (or another drawing mode) to get a visible surface. */
  get renderMode(): 'dots' | 'trails' | 'links' | 'metaballs' | 'voronoi' | 'streamlines' | 'flow' | 'none' {
    const v = this.getAttribute('render');
    return v === 'dots' || v === 'trails' || v === 'links' || v === 'metaballs' || v === 'voronoi' || v === 'streamlines' || v === 'flow'
      ? v
      : 'none';
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
  /** `dpr-cap` — backing-store DPR ceiling (#410); undefined (engine default 2) if absent/invalid. */
  get dprCap(): number | undefined {
    const v = Number(this.getAttribute('dpr-cap'));
    return Number.isFinite(v) && v > 0 ? v : undefined;
  }
  /** `depth` — optional z-volume; undefined (engine default 0, the flat field) if absent/invalid. */
  get depth(): number | undefined {
    const v = Number(this.getAttribute('depth'));
    return Number.isFinite(v) && v > 0 ? v : undefined;
  }
  /** `grid-warp` — `grid` overlay distortion multiplier; undefined (engine default 1) if absent/invalid.
   *  `0` is valid (a flat, undistorted lattice). */
  get gridWarp(): number | undefined {
    const v = Number(this.getAttribute('grid-warp'));
    return Number.isFinite(v) && v >= 0 ? v : undefined;
  }
  /** `grid-intensity` — `grid` overlay stroke opacity ∈ [0,1]; undefined (engine default 0.16, the faint
   *  diagnostic) if absent/invalid. Raise it (≈0.5) to make the warped lattice a visual centerpiece. */
  get gridIntensity(): number | undefined {
    const v = Number(this.getAttribute('grid-intensity'));
    return Number.isFinite(v) && v >= 0 ? v : undefined;
  }
  /** `separation` — particle-to-particle separation force strength ∈ [0,1]; undefined if absent/invalid. */
  get separation(): number | undefined {
    const v = Number(this.getAttribute('separation'));
    return Number.isFinite(v) && v >= 0 ? v : undefined;
  }
  /** `integrator` — the integration scheme (substrate doc 04 §Step 3); `'fixed'` opts into the
   *  frame-rate-independent integrator, `'velocity-verlet'` into the second-order Verlet scheme
   *  (#659); anything else (incl. absent) is the default `'legacy'`. */
  get integrator(): IntegratorMode | undefined {
    const v = this.getAttribute('integrator');
    return v === 'fixed' || v === 'velocity-verlet' ? v : undefined;
  }
  /** `theme` — ambient palette preset (`warm` (default) | `cool` | `mono`); undefined if absent (#529). */
  get theme(): string | undefined {
    return this.getAttribute('theme') ?? undefined;
  }
  /** `gradient-cool` — hex for the cool end of the heat ramp; overrides the theme (#529). */
  get gradientCool(): string | undefined {
    return this.getAttribute('gradient-cool') ?? undefined;
  }
  /** `gradient-warm` — hex for the warm end of the heat ramp; overrides the theme (#529). */
  get gradientWarm(): string | undefined {
    return this.getAttribute('gradient-warm') ?? undefined;
  }
  /** `wave-baseline` — space-separated hex stops for the wave baseline; overrides the theme (#529). */
  get waveBaseline(): readonly string[] | undefined {
    const list = (this.getAttribute('wave-baseline') ?? '').split(/\s+/).filter(Boolean);
    return list.length ? list : undefined;
  }
  /** `wave-style` — wave layout style: `'linear'` | `'circular'` */
  get waveStyle(): 'linear' | 'circular' {
    const v = this.getAttribute('wave-style');
    return v === 'circular' ? 'circular' : 'linear';
  }
  /** `wave-center` — coordinates string space-separated e.g. "200 300" */
  get waveCenter(): { x: number; y: number } | null {
    const v = this.getAttribute('wave-center');
    if (!v) return null;
    const parts = v.trim().split(/\s+/).map(Number);
    if (parts.length === 2 && Number.isFinite(parts[0]) && Number.isFinite(parts[1])) {
      return { x: parts[0]!, y: parts[1]! };
    }
    return null;
  }
  /** `formation` — the global formation (§7), applied live; undefined if absent. Unlike the other
   *  attributes this is post-construction (set via `setFormation`), but it round-trips: the attribute
   *  drives the field and `setFormation` reflects back to it (#541). */
  get formation(): string | undefined {
    return this.getAttribute('formation') ?? undefined;
  }

  // ── the FieldHandle surface, proxied onto the element (§13) ────────────────
  /** the live `FieldHandle` this element drives, or `undefined` before mount / after teardown (#542).
   *  Every method below is forwarded for convenience, but `.handle` is the escape hatch for the full
   *  surface and for passing the field to `bindData` / `applyRecipe` (both from `@fundamental-engine/dom`):
   *  `import { bindData } from '@fundamental-engine/dom'; bindData(el.handle, rows, spec);` */
  get handle(): FieldHandle | undefined {
    return this.field;
  }
  /** reflect an imperative setter's value back to its attribute, so attribute-based debugging shows the
   *  LIVE state (the bug from #541 was a stale `render="none"` after `setRender`). Guarded so the
   *  resulting attributeChangedCallback does not re-apply it. Pass `null` to remove the attribute. */
  private reflect(attr: string, value: string | null): void {
    this.reflecting = true;
    if (value === null) this.removeAttribute(attr);
    else this.setAttribute(attr, value);
    this.reflecting = false;
  }
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
    this.reflect('accent', hex);
  }
  /** swap the accent color template live (§9). */
  setPalette(palette: string | readonly string[]): void {
    this.field?.setPalette(palette);
    // only a named palette has an attribute form; a custom hex-stop array is driven imperatively.
    if (typeof palette === 'string') this.reflect('palette', palette);
  }
  /** switch the global formation (§7). */
  setFormation(name: string): void {
    this.field?.setFormation(name);
    this.reflect('formation', name);
  }
  /** switch the wave current layout style. */
  setWaveStyle(style: 'linear' | 'circular'): void {
    this.field?.setWaveStyle(style);
    this.reflect('wave-style', style);
  }
  /** set the custom wave center coordinate (or function). */
  setWaveCenter(center: { x: number; y: number } | (() => { x: number; y: number }) | null): void {
    this.field?.setWaveCenter(center);
    if (!center) {
      this.reflect('wave-center', null);
    } else if (typeof center === 'object') {
      this.reflect('wave-center', `${center.x} ${center.y}`);
    }
  }
  /** set particle-to-particle separation/repulsion force strength. */
  setSeparation(strength: number): void {
    this.field?.setSeparation(strength);
    this.reflect('separation', String(strength));
  }
  /** toggle conserved attention (§2.4) live. */
  setAttention(on: boolean): void {
    this.field?.setAttention(on);
    this.reflect('attention', on ? 'true' : 'false');
  }
  /** toggle cross-boundary causality (Concept 4) live. */
  setCausality(on: boolean): void {
    this.field?.setCausality(on);
    this.reflect('causality', on ? 'true' : 'false');
  }
  /** switch the substrate background live: `transparent` composites the underlay over light content. */
  setBackground(mode: 'opaque' | 'transparent'): void {
    this.field?.setBackground(mode);
    this.reflect('background', mode);
  }
  /** toggle the density heatmap layer (field-systems H1) live. */
  setHeatmap(on: boolean): void {
    this.field?.setHeatmap(on);
    this.reflect('heatmap', on ? 'true' : 'false');
  }
  /** lower/raise the backing-store DPR ceiling at runtime (the dominant fill-rate lever). */
  setDprCap(cap: number): void {
    this.field?.setDprCap(cap);
  }
  /** apply an adaptive quality tier 0–3 (#413) — the platform runtime forwards the governor's tier. */
  setQualityTier(tier: number): void {
    this.field?.setQualityTier(tier);
  }
  /** switch the underlay render mode (§20.6) live; `none` = signals-only — stop drawing, keep the signals (#297). */
  setRender(mode: 'dots' | 'trails' | 'links' | 'metaballs' | 'voronoi' | 'streamlines' | 'flow' | 'none'): void {
    this.field?.setRender(mode);
    this.reflect('render', mode);
  }
  /** render field readings on the overlay surface (Field Surfaces — in front of content); one mode or an additive stack. */
  setOverlay(mode: OverlayInput): void {
    this.field?.setOverlay(mode);
    syncOverlaySurface(this.overlayCanvas, mode);
    // serialize to the attribute form the `overlay` getter parses: a space-separated stack, or remove
    // it for 'off'/empty (the getter returns 'off' when no known token is present).
    const serial = mode === 'off' ? null : typeof mode === 'string' ? mode : mode.join(' ') || null;
    this.reflect('overlay', serial);
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
  /** add an engine-stepped agent; returns an inert no-op handle if the field hasn't started. */
  addAgent(spec: AgentSpec): AgentHandle {
    return this.field?.addAgent(spec) ?? { particle: {} as never, remove: () => {} };
  }
  /** add a programmatic body (no DOM) from a spec; a no-op handle until the field starts. */
  addBody(spec: BodySpec): BodyHandle {
    return this.field?.addBody(spec) ?? { data: spec.data, channels: {}, set: () => {}, remove: () => {} };
  }
  /** register a named external scalar field channel the engine samples; inert handle until the field starts. */
  addField(name: string, sampler: (x: number, y: number) => number): FieldChannelHandle {
    return this.field?.addField(name, sampler) ?? { name, set: () => {}, remove: () => {} };
  }
  /** sample a registered field channel at (x, y); 0 for an unknown channel or before the field starts. */
  sampleField(name: string, x: number, y: number): number {
    return this.field?.sampleField(name, x, y) ?? 0;
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
  /** copy each live particle's stable id into a Uint32Array, parallel to readParticles. */
  readParticleIds(out: Uint32Array): number {
    return this.field?.readParticleIds(out) ?? 0;
  }
  /** kinetic/thermal/total energy snapshot for the current frame. */
  energy(): { kinetic: number; thermal: number; total: number; count: number } {
    return this.field?.energy() ?? { kinetic: 0, thermal: 0, total: 0, count: 0 };
  }
  /** Ask the live field a structured question (bodies/metrics/relationships/influences) — read-only.
   *  Returns an empty reading before the field starts. See {@link FieldHandle.query}. EXPERIMENTAL. */
  query(q?: FieldQuery): FieldQueryResult {
    return this.field?.query(q) ?? { query: q ?? {}, frame: 0, time: 0, bodies: [], metrics: {}, relationships: [], influences: [], projections: [] };
  }
  /** Capture field state — a portable, versioned {@link FieldSnapshot}. Empty before start. EXPERIMENTAL. */
  snapshot(opts?: FieldSnapshotOptions): FieldSnapshot {
    return (
      this.field?.snapshot(opts) ??
      { id: 'snap-0-0', createdAt: 0, frame: 0, version: FIELD_VERSION, formations: [], bodies: [], relationships: [], metrics: {}, projections: [] }
    );
  }
  /** Compare two snapshots — pure (works before the field starts). See {@link FieldHandle.diff}. EXPERIMENTAL. */
  diff(a: FieldSnapshot, b: FieldSnapshot): FieldDiff {
    return this.field?.diff(a, b) ?? diffFieldSnapshots(a, b);
  }
  /** Explain how the field changed between two snapshots — pure (works before start). See {@link FieldHandle.replay}. EXPERIMENTAL. */
  replay(a: FieldSnapshot, b: FieldSnapshot, opts?: ReplayOptions): CausalReplay {
    return this.field?.replay(a, b, opts) ?? replayFieldSnapshots(a, b, opts);
  }
  /** The field's projection registry — a no-op registry before the field starts. See {@link FieldHandle.projections}. EXPERIMENTAL. */
  get projections(): ProjectionRegistry {
    return this.field?.projections ?? NULL_PROJECTIONS;
  }
  /** sample the live field at `(x, y)` — the net force vector a still test particle would feel
   *  (zero before the field starts). The seam external visualizers consume to build field geometry. */
  sample(x: number, y: number): { x: number; y: number } {
    return this.field?.sample(x, y) ?? { x: 0, y: 0 };
  }
  /** sample the smooth density scalar ∈ [0,1] at `(x, y)` (needs `heatmap`); 0 when off/not started. */
  sampleScalar(x: number, y: number): number {
    return this.field?.sampleScalar(x, y) ?? 0;
  }
  /** sample the density gradient ∇ at `(x, y)` — up-density direction (needs `heatmap`); `{0,0}` when off/not started. */
  sampleGradient(x: number, y: number): { x: number; y: number } {
    return this.field?.sampleGradient(x, y) ?? { x: 0, y: 0 };
  }
  /** open a named host-authorable scalar grid (deposit/sample/gradient/decay); a no-op grid until the field starts. */
  grid(name: string): ScalarGrid {
    return this.field?.grid(name) ?? NULL_GRID;
  }
  /** subscribe to a discrete field event (absorb/release/settle); a no-op unsubscribe until the field starts. */
  on<K extends FieldEventType>(type: K, cb: (e: FieldEventMap[K]) => void): () => void {
    return this.field?.on(type, cb) ?? (() => {});
  }
  /** the running engine version (`FIELD_VERSION`) — available before mount too. */
  get version(): string {
    return this.field?.version ?? FIELD_VERSION;
  }
  /** the page's scroll velocity the engine tracks (drives `--field-scroll-v`); 0 before mount. */
  scrollV(): number {
    return this.field?.scrollV() ?? 0;
  }
  /** pause/resume drawing (the simulation keeps running) — the element also does this automatically
   *  from its IntersectionObserver, so a manual call is for explicit control. */
  setVisible(on: boolean): void {
    this.field?.setVisible(on);
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
    // SSR pre-registration queue (§31.10): this field is no longer live — release its active-field
    // mark so the queue resumes buffering if no field remains (a body that (re)connects during a
    // field-less window is then captured for the next field that boots).
    if (this.fieldActiveMarked) {
      markFieldInactive();
      this.fieldActiveMarked = false;
    }
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
    // skip when an imperative setter is reflecting its own value back here (#541) — the field was
    // already updated by that setter; re-applying would be a redundant double-apply.
    if (!this.field || oldVal === newVal || this.reflecting) return;
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
      case 'dpr-cap':
        this.field.setDprCap(this.dprCap ?? 2);
        break;
      case 'separation':
        this.field.setSeparation(this.separation ?? 0);
        break;
      case 'background':
        this.field.setBackground(this.background);
        break;
      case 'formation':
        if (this.formation) this.field.setFormation(this.formation);
        break;
      default: // density / waves / mass are construction-time → rebuild
        this.field.destroy();
        this.start();
    }
  }

  /**
   * Field Surfaces: lazily create + attach the front overlay surface (light DOM — the shadow host is
   * z-index:0, behind content). A fixed, full-viewport, click-through, mix-blend canvas above content;
   * core sizes its backing store and draws the overlay mode onto it. Created ONCE, on the first overlay
   * that actually goes active (#676) — core invokes this as `overlayCanvasProvider` — and reused across
   * rebuilds. Idempotent: returns the existing canvas on every later call, never a second element.
   */
  private ensureOverlayCanvas(): HTMLCanvasElement | null {
    if (this.overlayCanvas) return this.overlayCanvas;
    if (typeof document === 'undefined') return null;
    const oc = document.createElement('canvas');
    oc.setAttribute('aria-hidden', 'true');
    // marked so a consumer can target the overlay surface (e.g. a scroll-driven opacity fade) without
    // reaching into the shadow internals — it's the only canvas Fundamental adds to the light DOM.
    oc.setAttribute('data-field-overlay', '');
    oc.style.cssText =
      'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:5;mix-blend-mode:screen';
    document.body.appendChild(oc);
    this.overlayCanvas = oc;
    return oc;
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
    // Field Surfaces: the front overlay surface is created LAZILY (#676) — a full-viewport,
    // mix-blend light-DOM canvas costs a whole-screen re-blend every frame while it's in the
    // compositing tree, even empty. So we hand core a PROVIDER instead of a canvas: core calls it the
    // first time an overlay reading actually goes active (a non-off setOverlay / attribute), and not
    // before. The common `overlay: off` boot never adds a canvas. If an overlay attribute IS already
    // set at mount, core resolves it during construction via the same provider (create once, reuse).
    const opts: FieldOptions = {
      // pass the raw attribute so a `palette` with no `accent` adopts the palette's first stop
      accent: this.getAttribute('accent') ?? undefined,
      overlayCanvas: this.overlayCanvas, // may already exist from a prior start()/rebuild — reuse it
      overlayCanvasProvider: () => this.ensureOverlayCanvas(),
      feedbackSink,
    };
    // the rest of the engine options come from the one declarative table (above), so a new
    // FieldOption can never be silently dropped here the way `depth` once was.
    for (const o of FieldField.OPTIONS) (opts as Record<string, unknown>)[o.key] = o.read(this);
    this.field = createBrowserField(this.canvas, opts);
    // formation is post-construction (not a FieldOption), so apply the initial attribute here so
    // `<field-root formation="wells">` works at mount, not only via setFormation (#541).
    if (this.formation) this.field.setFormation(this.formation);
    // attach the handle so the platform write phase can read scrollV → --field-scroll-v
    // and the quality governor can monitor frame duration
    this.platformRuntime?.attachHandle(this.field);
    // a rebuild (density/waves/mass change) starts a fresh engine that defaults to visible —
    // re-apply the last observed element visibility so a hidden field stays draw-skipped.
    if (!this.fieldVisible) this.field.setVisible(false);
    // take the overlay canvas out of the compositing tree unless a reading is actually active.
    syncOverlaySurface(this.overlayCanvas, this.overlay);
    // SSR pre-registration queue (§31.10): the field's body-event listeners are now wired (via the
    // host inside createBrowserField). Mark it live so later registrations skip the queue, then drain
    // any events buffered before boot — they replay onto their source elements and register through
    // the normal idempotent path. Mark ONCE per element (a rebuild re-runs start() but must not
    // re-increment the active-field tally); the drain is safe to run every time (no-op when empty).
    if (!this.fieldActiveMarked) {
      markFieldActive();
      this.fieldActiveMarked = true;
    }
    flushPreRegistrationQueue();
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
 * `<field-root>` — the recommended tag for the singleton field. The registry rejects registering one
 * constructor under two tag names, so this is a thin subclass of {@link FieldField} with identical
 * behaviour, attributes, and body contract.
 */
export class FieldRoot extends FieldField {}

if (typeof customElements !== 'undefined') {
  if (!customElements.get('field-root')) customElements.define('field-root', FieldRoot);
}

declare global {
  interface HTMLElementTagNameMap {
    'field-field': FieldField;
    'field-root': FieldRoot;
  }
}

export * from './field-cell.ts';
export * from './cell-force.ts';
export * from './mount.ts';
// shadow-DOM participation: the helper a custom element uses to join the field without
// repeating registration-event boilerplate (docs/engine-reference/shadow-dom.md §31.1).
export {
  FieldController,
  REGISTER_BODY,
  UNREGISTER_BODY,
  UPDATE_BODY,
} from '@fundamental-engine/core';
export type { RegisterBodyDetail } from '@fundamental-engine/core';
// the running engine version constant — re-exported so a consumer can read it as a named import off
// this door (beside `el.version` on the element). A missing named import aborts the whole ES module,
// so the door must carry it (#584).
export { FIELD_VERSION } from '@fundamental-engine/core';
