/**
 * createFieldPlatform — the coordinator that binds the platform registries to one shared
 * FrameScheduler. The native participation surface field-ui wishes the browser exposed.
 *
 * The scheduler owns loop discipline: every frame walks discover → read → compute → state → write →
 * render in order (see schedule.ts). By default the platform wires the two phases the registries own
 * outright — `read` (MeasurementRegistry) and `write` (FeedbackRegistry) — and installs the read
 * guard so an off-phase measurement is caught. Callers add `discover`/`compute`/`state`/`render`
 * handlers with `platform.on(phase, fn)`; relationships, visual bindings, and overlays plug into
 * those. The shape is additive — adding handlers never reorders the core read→write spine.
 */
import { MeasurementRegistry } from './measurement.ts';
import { StateRegistry } from './state.ts';
import { FeedbackRegistry } from './feedback.ts';
import { RelationshipRegistry } from './relationships.ts';
import { VisualBindingRegistry } from './visual-bindings.ts';
import { OverlayRegistry } from './overlays.ts';
import { FrameScheduler } from './schedule.ts';
import type { Phase, PhaseHandler, FrameReport, SchedulerOptions } from './schedule.ts';
import type { Viewport } from './types.ts';

export interface FieldPlatform {
  /** the platform root (a `<field-root>`, an article, or the document element). */
  root: Element;
  measure: MeasurementRegistry;
  state: StateRegistry;
  feedback: FeedbackRegistry;
  relationships: RelationshipRegistry;
  visuals: VisualBindingRegistry;
  overlays: OverlayRegistry;
  /** the shared frame scheduler driving the six-phase loop. */
  scheduler: FrameScheduler;
  /** register a phase handler (discover/compute/state/render are open for callers). Returns unsubscribe. */
  on(phase: Phase, handler: PhaseHandler): () => void;
  /** run one full six-phase frame; returns the per-frame report (phases run + any violations). */
  tick(now?: number, viewport?: Viewport): FrameReport;
}

export interface PlatformOptions extends SchedulerOptions {}

export function createFieldPlatform(root: Element, opts: PlatformOptions = {}): FieldPlatform {
  const measure = new MeasurementRegistry();
  const state = new StateRegistry();
  const feedback = new FeedbackRegistry();
  const relationships = new RelationshipRegistry();
  const visuals = new VisualBindingRegistry();
  const overlays = new OverlayRegistry();
  const scheduler = new FrameScheduler({ strict: opts.strict ?? false });

  // read-phase discipline: measurement consults the scheduler before reading layout.
  measure.setPhaseGuard(scheduler.readGuard());

  // Body Matter Interaction, Bound Visual tier: source→visual state mirroring is the platform
  // default — a scanned representation/measurement visual receives its source's feedback channels
  // (--d / --load / the metrics) without the author wiring anything. Change-gated; see
  // visual-bindings.ts MIRRORED_CHANNELS.
  visuals.setMirroring(true);

  // the two phases the registries own outright. Everything else is opt-in via platform.on(...).
  scheduler.on('read', (ctx) => measure.measure(ctx.now, ctx.viewport));
  scheduler.on('write', (ctx) => feedback.flush(state, ctx.now));

  // staleness sweep: the StateRegistry and OverlayRegistry both hold strong Element refs with no
  // natural prune moment — the feedback sink writes --lit/--d/--load onto every body every frame,
  // and overlays pin their source elements — yet nothing deletes an entry when its element leaves
  // the DOM. Run their prune on a low cadence (every 120th frame ≈ 2s) to release detached
  // elements for GC. Iterating an empty registry is free, so the sweep is cheap when idle.
  scheduler.on('write', (ctx) => {
    if (ctx.frame % 120 === 0) {
      state.prune();
      overlays.prune();
    }
  });

  return {
    root,
    measure,
    state,
    feedback,
    relationships,
    visuals,
    overlays,
    scheduler,
    on: (phase, handler) => scheduler.on(phase, handler),
    tick: (now = 0, viewport?: Viewport) => scheduler.runFrame(now, viewport),
  };
}
