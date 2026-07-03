/**
 * Dom-package dev diagnostics — a tiny, deduped, production-stripped `console.warn`, mirroring
 * core's `devWarnNoOp` (packages/core/src/contracts/guards.ts) but local to this package (core's
 * guard is internal and not on the public entry). A no-op unless checks are enabled, which default
 * ON outside `NODE_ENV === 'production'`, so a bundler that defines `NODE_ENV` dead-code-eliminates
 * the body. Never throws — advisory only.
 */
function defaultDev(): boolean {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
  return env?.NODE_ENV !== 'production';
}
let CHECKS = defaultDev();

/** Turn dom dev warnings on or off explicitly (tests, or to silence in a specific env). */
export function setDomDevWarnings(on: boolean): void {
  CHECKS = on;
}

const warnedOnce = new Set<string>();

/** Dev-only, deduped `console.warn`. Deduped by `id`, so a call made every frame warns at most once. */
export function devWarn(id: string, message: string): void {
  if (!CHECKS) return;
  if (warnedOnce.has(id)) return;
  warnedOnce.add(id);
  console.warn(`[Fundamental:${id}] ${message}`);
}

/** Clear the dedup set — for tests that assert a warn fires. */
export function resetDomDevWarnings(): void {
  warnedOnce.clear();
}

/**
 * Track how often a named layout-traversing operation is invoked and warn ONCE if it is being called
 * at frame frequency (more than `maxPerWindow` calls inside `windowMs`) — the "layout-traversal
 * trap": `RelationshipRegistry.discover()` and `VisualBindingRegistry.scan()` walk the DOM with
 * `querySelectorAll`, so running them every frame is a silent perf sink (they are meant to run on a
 * throttle, e.g. `shouldDiscoverRelationships`'s every-30-frames cadence). Dev-only + deduped, so it
 * fires at most once per `id` for the lifetime of the process. Returns nothing; never throws.
 */
export function warnIfFrameFrequent(id: string, hint: string, maxPerWindow = 20, windowMs = 1000): void {
  if (!CHECKS) return;
  const now = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
  const rec = frequency.get(id);
  if (!rec || now - rec.windowStart > windowMs) {
    frequency.set(id, { windowStart: now, count: 1 });
    return;
  }
  rec.count++;
  if (rec.count > maxPerWindow) devWarn(`FREQUENT_${id}`, hint);
}

const frequency = new Map<string, { windowStart: number; count: number }>();
