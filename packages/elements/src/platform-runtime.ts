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
import { createFieldPlatform, type FieldPlatform } from '@field-ui/platform';

// ── the flag ──────────────────────────────────────────────────────────────────────
let runtimeDefault = false;

/** Enable (or disable) the platform runtime for every `<field-root>` by default. Off until D6. */
export function usePlatformRuntime(on = true): void {
  runtimeDefault = on;
}

/** Whether the platform runtime is the current default. */
export function isPlatformRuntimeDefault(): boolean {
  return runtimeDefault;
}

/**
 * Decide whether an element should use the platform runtime: an explicit `experimental-platform`
 * attribute opts a single element in (or `experimental-platform="off"` opts out of the default),
 * otherwise the global default applies. Pure — the element's only branch point.
 */
export function shouldUsePlatformRuntime(el: { getAttribute(name: string): string | null; hasAttribute(name: string): boolean }, def = runtimeDefault): boolean {
  if (el.hasAttribute('experimental-platform')) return el.getAttribute('experimental-platform') !== 'off';
  return def;
}

// ── the runtime ─────────────────────────────────────────────────────────────────────
export interface PlatformRuntime {
  platform: FieldPlatform;
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

  if (typeof window === 'undefined' || typeof requestAnimationFrame === 'undefined') {
    return { platform, destroy() {} };
  }

  let raf = 0;
  const loop = (t: number): void => {
    platform.tick(t, { width: window.innerWidth, height: window.innerHeight });
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
  return {
    platform,
    destroy(): void {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    },
  };
}
