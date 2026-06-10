// Shared plumbing for example pages that upgrade themselves to live data in the browser
// (the pattern market and fleet established): a polite fetch loop that skips hidden tabs
// and retires after repeated failures, plus the status-chip contract — "live · checked
// Ns ago" when the loop is healthy, "snapshot · <date>" otherwise. The committed snapshot
// stays the SSR baseline and the no-JS truth on every page.

export interface LiveChip {
  /** mark a successful refresh (starts/keeps the ticking "Ns ago" label) */
  ok(at?: number): void;
  /** drop back to the snapshot label */
  fail(): void;
  destroy(): void;
}

export function wireLiveChip(el: HTMLElement | null, snapshotLabel: string): LiveChip {
  let liveAt = 0;
  let timer = 0;
  const render = (): void => {
    if (!el) return;
    if (!liveAt) {
      el.textContent = `snapshot · ${snapshotLabel}`;
      el.dataset.live = "off";
      return;
    }
    const s = Math.max(0, Math.round((Date.now() - liveAt) / 1000));
    el.textContent = `live · checked ${s}s ago`;
    el.dataset.live = "on";
  };
  render();
  return {
    ok(at = Date.now()): void {
      liveAt = at;
      render();
      if (!timer) timer = window.setInterval(render, 1000);
    },
    fail(): void {
      liveAt = 0;
      render();
    },
    destroy(): void {
      if (timer) clearInterval(timer);
      timer = 0;
    },
  };
}

export interface PoliteLoopOpts {
  /** one refresh; throw (or reject) to count a failure */
  run: () => Promise<void>;
  /** ms before the first attempt (default 4000 — let the page settle first) */
  firstDelayMs?: number;
  /** repeat cadence; null/undefined = refresh once and stop */
  everyMs?: number | null;
  /** consecutive failures before the loop retires for the visit (default 3) */
  maxFailures?: number;
  /** the page runtime's lifecycle controller — aborting clears every timer */
  signal: AbortSignal;
  onSuccess?: () => void;
  onFailure?: (retired: boolean) => void;
}

/**
 * Run `run` on a polite schedule: never while the tab is hidden (the attempt is skipped,
 * not queued), never after `maxFailures` consecutive failures, never after the page
 * lifecycle aborts. Failures are silent by design — the page keeps its snapshot.
 */
export function politeLoop(opts: PoliteLoopOpts): void {
  const { run, firstDelayMs = 4000, everyMs = null, maxFailures = 3, signal } = opts;
  let failures = 0;
  let interval = 0;
  let retired = false;
  // an attempt that lands while the tab is hidden is skipped, not queued — but remember it,
  // and catch up the moment the tab becomes visible (otherwise a background-opened tab waits
  // a whole interval — or forever, for once-per-visit refreshes — before its first refresh).
  let owed = false;
  const attempt = async (): Promise<void> => {
    if (signal.aborted || retired) return;
    if (document.hidden) {
      owed = true;
      return;
    }
    owed = false;
    try {
      await run();
      failures = 0;
      opts.onSuccess?.();
    } catch {
      failures++;
      retired = failures >= maxFailures;
      if (retired && interval) {
        clearInterval(interval);
        interval = 0;
      }
      opts.onFailure?.(retired);
    }
  };
  const onVisible = (): void => {
    if (!document.hidden && owed) void attempt();
  };
  document.addEventListener("visibilitychange", onVisible);
  const first = window.setTimeout(() => {
    void attempt();
    if (everyMs) interval = window.setInterval(() => void attempt(), everyMs);
  }, firstDelayMs);
  signal.addEventListener("abort", () => {
    clearTimeout(first);
    if (interval) clearInterval(interval);
    interval = 0;
    document.removeEventListener("visibilitychange", onVisible);
  });
}
