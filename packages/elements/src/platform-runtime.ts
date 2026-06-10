/**
 * Experimental platform-backed runtime for `<field-root>` (Phase D: runtime platform unification).
 *
 * D1 establishes the *path*, not the migration: when the experimental flag is on, the element starts
 * a `@field-ui/platform` runtime alongside the legacy `createField` engine. For now it only measures
 * the scan root each frame on the six-phase scheduler — a foothold the later phases fill in (D2 moves
 * body scanning onto MeasurementRegistry, D3 feedback onto FeedbackRegistry, D4 shadow, D5
 * relationships). Default is OFF, so behavior is unchanged until D6 flips it.
 *
 * The legacy engine still owns everything visible in D1; the platform adds nothing observable, which
 * is exactly the parity guarantee: flag on and flag off render identically.
 */
import { createFieldPlatform, QualityGovernor, type FieldPlatform } from '@field-ui/platform';
import type { FieldHandle } from '@field-ui/core';
import {
  bodyElements,
  REGISTER_BODY,
  FIELD_REGISTER_BODY,
  UNREGISTER_BODY,
  FIELD_UNREGISTER_BODY,
  type FeedbackSink,
  type RegisterBodyDetail,
} from '@field-ui/core';

/** A minimal view of MeasurementRegistry — what body syncing + shadow registration need. */
interface MeasureSink {
  has(el: Element): boolean;
  register(el: Element, opts?: { role?: string; getRect?: () => DOMRect }): void;
  unregister(el: Element): void;
}

/**
 * Sync the scan root's body elements into the MeasurementRegistry (D2). New `[data-body]` /
 * `[data-preset]` / `[data-intent]` / `[data-field-role]` elements are registered for measurement;
 * disconnected ones are pruned by the read phase. Returns how many were newly registered. Pure given
 * the sink + root — the selector is core's `bodyElements`, so the platform never drifts from the
 * legacy scanner. Note (D2): an element that loses its body attribute while staying connected is not
 * yet unregistered — a later refinement; today the legacy engine remains the source of truth for
 * rendering, so this is measurement-only and has no observable effect.
 */
export function syncBodies(sink: MeasureSink, root: ParentNode): number {
  let added = 0;
  for (const el of bodyElements(root)) {
    if (!sink.has(el)) {
      sink.register(el, { role: 'body' });
      added++;
    }
  }
  return added;
}

/**
 * Register a shadow-DOM host for measurement from a `register-body` event detail (D4). The host's
 * custom `getRect` (for closed roots / inner cores) flows straight into MeasurementRegistry's rect
 * override. Pure given the sink + detail. `syncBodies`' `if (!has)` guard means it won't clobber a
 * host registered here, so the two discovery paths coexist (the legacy engine still drives the
 * body's simulation; the platform owns its geometry).
 */
export function registerShadowBody(sink: MeasureSink, detail: RegisterBodyDetail | undefined): void {
  if (detail?.element) sink.register(detail.element, { role: 'shadow-body', getRect: detail.getRect });
}

/** Unregister a shadow-DOM host from measurement on its `unregister-body` event (D4). Pure. */
export function unregisterShadowBody(sink: MeasureSink, detail: RegisterBodyDetail | undefined): void {
  if (detail?.element) sink.unregister(detail.element);
}

/**
 * Relationship discovery is heavier than body syncing (it builds graph edges from every native
 * link), so the runtime re-discovers on a throttle rather than every frame (D5). Pure.
 */
export function shouldDiscoverRelationships(frame: number, every = 30): boolean {
  return frame % every === 0;
}

// ── the flag ──────────────────────────────────────────────────────────────────────
// D6: the platform runtime is now the DEFAULT (parity proven across D1-D5). Every <field-root> runs
// it alongside the legacy engine, which still simulates + renders while the platform owns
// measurement, feedback writes, shadow registration, and the relationship graph. Opt a single
// element back onto the pure-legacy path with experimental-platform="off", or globally with
// usePlatformRuntime(false). D7 trims the now-redundant legacy DOM glue.
let runtimeDefault = true;

/** Enable (or disable) the platform runtime for every `<field-root>` by default (D6: default on). */
export function usePlatformRuntime(on = true): void {
  runtimeDefault = on;
}

/** Whether the platform runtime is the current default. */
export function isPlatformRuntimeDefault(): boolean {
  return runtimeDefault;
}

/**
 * Decide whether an element should use the platform runtime: an explicit `experimental-platform`
 * attribute opts a single element in/out (`="off"` forces the legacy path), otherwise the global
 * default applies (on since D6). Pure — the element's only branch point.
 */
export function shouldUsePlatformRuntime(el: { getAttribute(name: string): string | null; hasAttribute(name: string): boolean }, def = runtimeDefault): boolean {
  if (el.hasAttribute('experimental-platform')) return el.getAttribute('experimental-platform') !== 'off';
  return def;
}

/**
 * Build a feedback sink (D3) that routes the engine's per-body channels through the platform's
 * FeedbackRegistry. The eased density value is the engine's own — only the *write* moves — so the
 * signal is preserved exactly. FeedbackRegistry mirrors `--field-*` → `--forces-*` and `field:*` →
 * `forces:*`, so both alias families stay live. Writes apply on the platform's write phase (its
 * scheduler tick).
 *
 * Since #228 the sink contract is the engine's ONLY write path: with no sink configured,
 * `createField` installs an internal default sink (`core/feedback-sink.ts`) whose direct writes are
 * byte-identical to the engine's historical behavior. This platform sink replaces that default when
 * the runtime is on, moving the same channels onto FeedbackRegistry (write-phase batching,
 * `cssWritesLastFrame()` accounting, governor throttling).
 */
export function makeFeedbackSink(platform: FieldPlatform): FeedbackSink {
  const litArmed = new WeakSet<Element>();
  // match the legacy engine's 3-decimal var formatting exactly, so the platform path is byte-identical.
  const f3 = (n: number): string => n.toFixed(3);
  return (el, ch) => {
    // density → --d (original) + --field-density (auto-mirrors --forces-density)
    if (ch.density !== undefined) platform.feedback.set(el, { '--d': f3(ch.density), '--field-density': f3(ch.density) });
    // heatmap density → --field-heatmap-density (auto-mirrors --forces-heatmap-density)
    if (ch.heatmapDensity !== undefined) platform.feedback.set(el, { '--field-heatmap-density': f3(ch.heatmapDensity) });
    // accretion load → --load + --mass (back-compat alias)
    if (ch.load !== undefined) platform.feedback.set(el, { '--load': f3(ch.load), '--mass': f3(ch.load) });
    // lit → --lit (continuous) + a thresholded field:lit/field:dim (discrete, hysteretic) via state
    if (ch.lit !== undefined) {
      platform.feedback.set(el, { '--lit': f3(ch.lit) });
      if (!litArmed.has(el)) {
        litArmed.add(el);
        platform.feedback.threshold(el, 'field:lit', { metric: 'lit', enter: 0.5, exit: 0.4, exitEvent: 'field:dim' });
      }
      platform.state.set(el, 'lit', ch.lit); // numeric — the threshold compares the raw value
    }
  };
}

// ── the runtime ─────────────────────────────────────────────────────────────────────
export interface PlatformRuntime {
  platform: FieldPlatform;
  /**
   * Attach the FieldHandle after it's created (the platform starts before the field handle
   * exists). Once attached, the write phase writes `--field-scroll-v` to `:root` each frame
   * and the quality governor monitors frame duration.
   */
  attachHandle(handle: FieldHandle): void;
  destroy(): void;
}

/**
 * Start the platform runtime over a scan root. Thin DOM glue (rAF + viewport size); SSR-safe — with
 * no `window` it returns a created-but-idle platform. D2+ register bodies/feedback/relationships
 * here; D1 measures only the root.
 */
export function startPlatformRuntime(root: Element): PlatformRuntime {
  const platform = createFieldPlatform(root);
  platform.measure.register(root, { role: 'field-root' });
  // D2: the discover phase syncs body elements into MeasurementRegistry each frame, so the platform
  // measures the same bodies the legacy scanner finds (geometry only — still no observable change).
  platform.on('discover', (ctx) => {
    syncBodies(platform.measure, root);
    // D5: maintain the relationship graph from the page's native links (throttled — see above).
    if (shouldDiscoverRelationships(ctx.frame)) platform.relationships.discover(root);
  });

  // D4: shadow-DOM hosts join via composed register/unregister events (forces:* + field:* twins).
  // The host's getRect (for closed roots) flows into MeasurementRegistry's rect override. Listening
  // on the document catches the composed events that bubble out of any shadow tree.
  const doc = root.ownerDocument ?? (typeof document !== 'undefined' ? document : null);
  const detailOf = (e: Event): RegisterBodyDetail | undefined => (e as CustomEvent<RegisterBodyDetail>).detail;
  const onRegister = (e: Event): void => registerShadowBody(platform.measure, detailOf(e));
  const onUnregister = (e: Event): void => unregisterShadowBody(platform.measure, detailOf(e));
  const wired: Array<[string, EventListener]> = [];
  if (doc) {
    for (const name of [REGISTER_BODY, FIELD_REGISTER_BODY]) doc.addEventListener(name, onRegister as EventListener);
    for (const name of [UNREGISTER_BODY, FIELD_UNREGISTER_BODY]) doc.addEventListener(name, onUnregister as EventListener);
    wired.push([REGISTER_BODY, onRegister as EventListener], [FIELD_REGISTER_BODY, onRegister as EventListener], [UNREGISTER_BODY, onUnregister as EventListener], [FIELD_UNREGISTER_BODY, onUnregister as EventListener]);
  }
  const unwireShadow = (): void => {
    if (doc) for (const [name, fn] of wired) doc.removeEventListener(name, fn);
  };

  if (typeof window === 'undefined' || typeof requestAnimationFrame === 'undefined') {
    return { platform, attachHandle: () => {}, destroy: unwireShadow };
  }

  let raf = 0;
  let handle: FieldHandle | null = null;
  let lastTs = 0;
  let frame = 0;
  const governor = new QualityGovernor();

  // A frame gap this large is a discontinuity (background tab, system sleep, a debugger pause),
  // not a budget overrun — feeding it would spike the governor for free.
  const DISCONTINUITY_MS = 500;

  // write phase: --field-scroll-v on :root (once handle is attached). Written directly rather
  // than through FeedbackRegistry — it's a page-global, not a per-body channel — so it does NOT
  // count toward feedback.cssWritesLastFrame(). The unchanged-value guard keeps idle frames
  // (scrollV pinned at 0.000) mutation-free.
  let lastScrollV = '';
  platform.on('write', () => {
    if (!handle) return;
    const sv = handle.scrollV().toFixed(3);
    if (sv === lastScrollV) return;
    lastScrollV = sv;
    (root.ownerDocument ?? document).documentElement.style.setProperty('--field-scroll-v', sv);
  });

  // rAF stops while a tab is backgrounded; the first frame back would otherwise read as a huge
  // overrun. Reset the timing baseline and re-detect from full quality.
  const onVisibility = (): void => {
    lastTs = 0;
    governor.reset();
  };
  document.addEventListener('visibilitychange', onVisibility);

  const loop = (t: number): void => {
    const duration = lastTs ? t - lastTs : 0;
    lastTs = t;
    frame++;

    // Tier 2/3 degradation (the governor's built-in consumer): throttle the platform's own tick
    // — measurement, feedback writes, relationship discovery — to every 2nd / 4th frame. The
    // engine keeps simulating at full rate; only the platform's DOM read/write cadence drops.
    // Engine-side responses (render simplification, particle caps) are the embedder's to wire
    // via the field:quality-tier event.
    const stride = governor.tier >= 3 ? 4 : governor.tier === 2 ? 2 : 1;
    if (frame % stride === 0) platform.tick(t, { width: window.innerWidth, height: window.innerHeight });

    if (duration > 0 && duration < DISCONTINUITY_MS && handle) {
      const newTier = governor.feed(duration);
      if (newTier !== undefined) {
        root.dispatchEvent(new CustomEvent('field:quality-tier', {
          bubbles: true, composed: true,
          detail: { tier: newTier, durationMs: Math.round(duration) },
        }));
      }
    }
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
  return {
    platform,
    attachHandle(h: FieldHandle): void {
      handle = h;
      governor.reset();
    },
    destroy(): void {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      handle = null;
      document.removeEventListener('visibilitychange', onVisibility);
      unwireShadow();
    },
  };
}
