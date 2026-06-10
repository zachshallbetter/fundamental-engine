// Shared helpers for the navigation sweep — the invisible-fields treatment applied to nav chrome.
// Every binding is signals-only (render: []) and reduced-motion-guarded; the engine writes
// --field-* custom properties back onto the links, which CSS turns into ink/weight/marks. With the
// engine off the vars are simply unset and the links render as plain, reachable chrome.
import { recipeById } from "@field-ui/core";
import { applyRecipe } from "@field-ui/platform";

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

const METRIC_VARS = [
  "--field-attention",
  "--field-memory",
  "--field-priority",
  "--field-density",
  "--field-recency",
];

export interface NavFieldHandle {
  destroy(): void;
}

/**
 * Apply a recipe signals-only over the `<a>` links inside `root`. Optionally pin one link as the
 * "well"/current (data-field-attention=1) and mark previously-visited links (data-field-memory=1 +
 * a `nav-visited` class) from the visit log. Returns a teardown, or null when there's nothing to do
 * (reduced motion, no links, unknown recipe, or the engine failed to load).
 */
export function applyNavField(
  root: HTMLElement,
  recipeId: string,
  opts: { pin?: HTMLElement | null; markVisited?: boolean; extraMetrics?: string[] } = {},
): NavFieldHandle | null {
  if (reduceMotion()) return null;
  const links = [...root.querySelectorAll<HTMLAnchorElement>("a[href]")];
  if (!links.length) return null;
  const pinned = opts.pin ?? null;
  pinned?.setAttribute("data-field-attention", "1");
  const marked: HTMLElement[] = [];
  if (opts.markVisited) {
    const visited = loadVisited();
    for (const a of links) {
      if (visited.has(normRoute(a.getAttribute("href") || ""))) {
        a.setAttribute("data-field-memory", "1");
        a.classList.add("nav-visited");
        marked.push(a);
      }
    }
  }
  try {
    const base = recipeById(recipeId);
    if (!base) return null;
    const applied = applyRecipe(root, base, {
      bodies: links,
      annotateBodies: false,
      renderless: true,
      extraMetrics: opts.extraMetrics ?? ["attention", "memory"],
    });
    return {
      destroy() {
        applied.destroy();
        pinned?.removeAttribute("data-field-attention");
        for (const a of marked) {
          a.removeAttribute("data-field-memory");
          a.classList.remove("nav-visited");
        }
        for (const a of links) for (const v of METRIC_VARS) a.style.removeProperty(v);
      },
    };
  } catch {
    return null;
  }
}
