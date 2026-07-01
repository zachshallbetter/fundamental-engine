/**
 * `FieldField` — the reciprocal DOM-physics field as a typed class, for plain TypeScript
 * apps that want object-oriented ergonomics without a framework or a custom element.
 *
 * `new FieldField()` builds a managed, full-viewport canvas and starts the engine on it;
 * pass `{ canvas }` to drive a `<canvas>` you own instead. The class implements the full
 * `FieldHandle` surface, so an instance is type-compatible anywhere a handle is expected,
 * and it exposes the `canvas` it renders to.
 *
 * ```ts
 * import { FieldField } from '@fundamental-engine/vanilla';
 *
 * const field = new FieldField({ accent: '#4da3ff', render: 'dots' });
 * field.setFormation('wells');
 * field.burst(window.innerWidth / 2, 200);
 * // field.scan(); field.destroy();
 * ```
 */

import { type AgentHandle, type AgentSpec, type AtomPayload, type FieldHandle, type FieldOptions, type ThreadLink, type FlowOptions, type ScalarGrid, type FieldEventType, type FieldEventMap, type BodySpec, type BodyHandle, type EdgeHandle, type EdgeView, type FieldChannelHandle, type FieldQuery, type FieldQueryResult, type FieldSnapshot, type FieldSnapshotOptions, type FieldDiff, type CausalReplay, type ReplayOptions, type ProjectionRegistry } from '@fundamental-engine/core';
import { createField } from './create-field.ts';
import { makeFieldCanvas, makeContainedCanvas, assertBrowser } from './mount.ts';

export interface FieldFieldInit extends FieldOptions {
  /** drive a `<canvas>` you own; when omitted, a managed full-viewport canvas is created
   *  (and removed again by `destroy()`). */
  canvas?: HTMLCanvasElement;
  /** where to append the managed canvas; ignored when you pass your own `canvas`. */
  target?: HTMLElement;
  /** render a CONTAINED field scoped to this element instead of the window (#540): the field, its
   *  bodies (scanned within `bounds`), and its canvas all live in the element's local coordinate
   *  space. The managed canvas is absolutely positioned inside it. The card-sized / component path. */
  bounds?: HTMLElement;
}

export class FieldField implements FieldHandle {
  /** the `<canvas>` the field renders to — the one created for you, or the one you passed. */
  readonly canvas: HTMLCanvasElement;
  private readonly field: FieldHandle;
  /** did this instance create the canvas (and so should remove it on `destroy()`)? */
  private readonly managed: boolean;

  constructor(init: FieldFieldInit = {}) {
    assertBrowser(); // browser-only: fail loudly during SSR instead of a cryptic crash
    const { canvas, target, bounds, ...opts } = init;
    this.managed = !canvas;
    // The managed canvas differs by mode (absolutely-positioned inside `bounds`, else full-viewport);
    // host resolution (container vs browser) is delegated to the one `createField` entry.
    this.canvas = canvas ?? (bounds ? makeContainedCanvas(bounds) : makeFieldCanvas(target));
    this.field = createField(this.canvas, bounds ? { ...opts, bounds } : opts);
  }

  /** (re)scan the document for `[data-body]` bodies after a layout change. */
  scan(): void {
    this.field.scan();
  }
  /** alias of `scan`. */
  rescan(): void {
    this.field.rescan();
  }
  /** recolor the travelling accent (§9). */
  setAccent(hex: string): void {
    this.field.setAccent(hex);
  }
  /** swap the accent's color template live: a built-in name or custom hex stops (§9). */
  setPalette(palette: string | readonly string[]): void {
    this.field.setPalette(palette);
  }
  /** switch the global formation (§7). */
  setFormation(name: string): void {
    this.field.setFormation(name);
  }
  setWaveStyle(style: 'linear' | 'circular'): void {
    this.field.setWaveStyle(style);
  }
  setWaveCenter(center: { x: number; y: number } | (() => { x: number; y: number }) | null): void {
    this.field.setWaveCenter(center);
  }
  setSeparation(strength: number): void {
    this.field.setSeparation(strength);
  }
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
  /** lower/raise the backing-store DPR ceiling at runtime (the dominant fill-rate lever). */
  setDprCap(cap: number): void {
    this.field.setDprCap(cap);
  }
  /** apply an adaptive quality tier 0–3 (#413) — caps DPR, drops the heatmap at 2+; 0 restores. */
  setQualityTier(tier: number): void {
    this.field.setQualityTier(tier);
  }
  /** the field's current runtime policy (frozen copy). */
  get policy(): FieldHandle['policy'] {
    return this.field.policy;
  }
  /** replace the runtime field policy live — what this host/session/user/app permits. */
  setPolicy(policy: Parameters<FieldHandle['setPolicy']>[0]): void {
    this.field.setPolicy(policy);
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
  seed(atoms: readonly AtomPayload[]): void {
    this.field.seed(atoms);
  }
  /** add an engine-stepped agent (a mesh-bound participant the integrator moves). */
  addAgent(spec: AgentSpec): AgentHandle {
    return this.field.addAgent(spec);
  }
  /** add a programmatic body (no DOM) from a spec — carries data + per-body feedback; survives rescan. */
  addBody(spec: BodySpec): BodyHandle {
    return this.field.addBody(spec);
  }
  /** relate two programmatic bodies — the non-DOM relationship counterpart of addBody. */
  addEdge(a: BodyHandle, b: BodyHandle, opts?: { type?: string; strength?: number; direction?: 'from-to' | 'to-from' | 'bidirectional' }): EdgeHandle {
    return this.field.addEdge(a, b, opts);
  }
  /** the live programmatic-edge read-out — each edge's endpoint data, type, strength, memory, active. */
  readEdges(): ReadonlyArray<EdgeView> {
    return this.field.readEdges();
  }
  /** Ask the live field a structured question (bodies/metrics/relationships/influences) — delegated
   *  to the engine. Read-only; works headless. See {@link FieldHandle.query}. */
  query(q?: FieldQuery): FieldQueryResult {
    return this.field.query(q);
  }
  /** Capture field state (bodies/metrics/relationships/active formations) — delegated. See {@link FieldHandle.snapshot}. */
  snapshot(opts?: FieldSnapshotOptions): FieldSnapshot {
    return this.field.snapshot(opts);
  }
  /** Compare two snapshots — delegated. See {@link FieldHandle.diff}. */
  diff(a: FieldSnapshot, b: FieldSnapshot): FieldDiff {
    return this.field.diff(a, b);
  }
  /** Explain how the field changed between two snapshots — delegated. See {@link FieldHandle.replay}. */
  replay(a: FieldSnapshot, b: FieldSnapshot, opts?: ReplayOptions): CausalReplay {
    return this.field.replay(a, b, opts);
  }
  /** The field's projection registry — delegated. See {@link FieldHandle.projections}. */
  get projections(): ProjectionRegistry {
    return this.field.projections;
  }
  /** register a named external scalar field channel the engine samples on its read path. */
  addField(name: string, sampler: (x: number, y: number) => number): FieldChannelHandle {
    return this.field.addField(name, sampler);
  }
  /** sample a registered field channel at (x, y); 0 for an unknown channel. */
  sampleField(name: string, x: number, y: number): number {
    return this.field.sampleField(name, x, y);
  }
  atomAt(x: number, y: number): AtomPayload | null {
    return this.field.atomAt(x, y);
  }
  focusAt(x: number, y: number): AtomPayload | null {
    return this.field.focusAt(x, y);
  }
  clearFocus(): void {
    this.field.clearFocus();
  }
  particleCount(): number {
    return this.field.particleCount();
  }
  /** copy live particle state into `out` (stride 5: x, y, z, heat, size); returns the count written. */
  readParticles(out: Float32Array): number {
    return this.field.readParticles(out);
  }
  /** copy each live particle's stable id into a Uint32Array, parallel to readParticles. */
  readParticleIds(out: Uint32Array): number {
    return this.field.readParticleIds(out);
  }
  /** read multiple named channels from live particles into caller-owned buffers (column-wise). */
  readParticleChannels(channels: readonly string[], out: readonly Float32Array[]): number {
    return this.field.readParticleChannels(channels, out);
  }
  /** register a named custom overlay function; returns an unregister fn. */
  registerOverlay(name: string, drawFn: Parameters<typeof this.field.registerOverlay>[1]): () => void {
    return this.field.registerOverlay(name, drawFn);
  }
  energy(): { kinetic: number; thermal: number; total: number; count: number } {
    return this.field.energy();
  }
  /** sample the live field at `(x, y)` — the net force vector a still test particle would feel. */
  sample(x: number, y: number): { x: number; y: number } {
    return this.field.sample(x, y);
  }
  /** sample the smooth density scalar ∈ [0,1] at `(x, y)` (needs `heatmap: true`); 0 when off. */
  sampleScalar(x: number, y: number): number {
    return this.field.sampleScalar(x, y);
  }
  /** sample the density gradient ∇ at `(x, y)` — up-density direction (needs `heatmap: true`); `{0,0}` when off. */
  sampleGradient(x: number, y: number): { x: number; y: number } {
    return this.field.sampleGradient(x, y);
  }
  /** open a named host-authorable scalar grid (deposit/sample/gradient/decay) — a scent/wear/goal field. */
  grid(name: string): ScalarGrid {
    return this.field.grid(name);
  }
  /** subscribe to a discrete field event (absorb/release/settle); returns an unsubscribe fn. */
  on<K extends FieldEventType>(type: K, cb: (e: FieldEventMap[K]) => void): () => void {
    return this.field.on(type, cb);
  }
  /** the running engine version (`FIELD_VERSION`). */
  get version(): string {
    return this.field.version;
  }
  scrollV(): number {
    return this.field.scrollV();
  }
  setVisible(on: boolean): void {
    this.field.setVisible(on);
  }
  setBackground(mode: Parameters<FieldHandle['setBackground']>[0]): void {
    this.field.setBackground(mode);
  }
  /** stop the loop, release listeners, and remove the canvas if this instance made it. */
  destroy(): void {
    this.field.destroy();
    if (this.managed) this.canvas.remove();
  }
}
