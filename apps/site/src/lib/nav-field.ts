// Site-side glue for the navigation sweep. The signals-only binding itself now lives in the platform
// (`bindFieldNav`); this module keeps the SITE policy on top of it: the cross-surface visit log (the
// "seen / where have I been" memory) and route normalization. `applyNavField` is a thin adapter that
// feeds the visit log to `bindFieldNav` as a `visited` predicate, so every site runtime keeps its
// existing call shape.
import { bindFieldNav, type FieldNavHandle } from "@field-ui/platform";

export type NavFieldHandle = FieldNavHandle;

export const reduceMotion = (): boolean =>
  typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/** normalize an href to a comparable route key (no hash/query, no trailing slash). */
export const normRoute = (href: string): string =>
  (href.split("#")[0]!.split("?")[0] || "/").replace(/\/$/, "") || "/";

// ── visited routes — the cross-surface "seen / where have I been" memory ─────
const VISITED_KEY = "fui:docs-visited";
export function loadVisited(): Set<string> {
  try {
    const raw = localStorage.getItem(VISITED_KEY);
    const arr = raw ? (JSON.parse(raw) as unknown) : [];
    return new Set(Array.isArray(arr) ? (arr as string[]) : []);
  } catch {
    return new Set();
  }
}
export function recordVisit(route: string): void {
  try {
    const v = loadVisited();
    v.add(route);
    localStorage.setItem(VISITED_KEY, JSON.stringify([...v].slice(-200)));
  } catch {
    /* storage unavailable — surfaces just won't show 'seen' marks */
  }
}

/**
 * Apply a recipe signals-only over the `<a>` links inside `root` (via the platform's `bindFieldNav`).
 * Optionally pin one link as the current/"well" and mark previously-visited links from the site visit
 * log. Returns a teardown, or null when there's nothing to bind (reduced motion, no links, unknown
 * recipe).
 */
export function applyNavField(
  root: HTMLElement,
  recipeId: string,
  opts: { pin?: HTMLElement | null; markVisited?: boolean; extraMetrics?: string[] } = {},
): NavFieldHandle | null {
  const visited = opts.markVisited ? loadVisited() : null;
  return bindFieldNav(root, recipeId, {
    pin: opts.pin ?? null,
    visited: visited ? (href) => visited.has(normRoute(href)) : undefined,
    extraMetrics: opts.extraMetrics,
  });
}
