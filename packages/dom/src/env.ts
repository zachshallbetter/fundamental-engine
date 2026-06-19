/**
 * env — shared, SSR-safe environment probes for the platform layer.
 *
 * Two helpers that multiple platform modules need independently:
 *   - `prefersReducedMotion()` — true when the OS/browser signals reduced motion preference.
 *   - `pageHidden()` — true when the document visibility state is "hidden".
 *
 * Both are safe to call in a non-DOM environment (SSR, Node test runners, custom hosts): they
 * default to `false` when `window` / `document` are absent, rather than throwing.
 *
 * **Overriding for tests:** call `setEnvOverrides({ reducedMotion, hidden })` before the code
 * under test runs, then `clearEnvOverrides()` (or a second call with `{}`) afterward. The
 * override object is shallow-merged — passing only `reducedMotion` leaves `hidden` live, and
 * vice versa. This is the intended seam; tests no longer need to stub `globalThis.matchMedia` or
 * `document.hidden` directly.
 */

interface EnvOverrides {
  reducedMotion?: boolean;
  hidden?: boolean;
}

let _overrides: EnvOverrides = {};

/**
 * Override one or both env probes — for test use only. Shallow-merges with any existing
 * overrides so callers can set just the field they need.
 */
export function setEnvOverrides(o: EnvOverrides): void {
  _overrides = { ..._overrides, ...o };
}

/** Remove all env overrides, restoring the live DOM probe behaviour. */
export function clearEnvOverrides(): void {
  _overrides = {};
}

/**
 * Returns `true` when `prefers-reduced-motion: reduce` is active.
 * SSR-safe: returns `false` when `matchMedia` is not available.
 */
export function prefersReducedMotion(): boolean {
  if (_overrides.reducedMotion !== undefined) return _overrides.reducedMotion;
  return typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Returns `true` when the document is currently hidden (background tab / minimised window).
 * SSR-safe: returns `false` when `document` is not available.
 */
export function pageHidden(): boolean {
  if (_overrides.hidden !== undefined) return _overrides.hidden;
  return typeof document !== 'undefined' && document.hidden;
}
