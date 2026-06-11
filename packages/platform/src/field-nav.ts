/**
 * `bindFieldNav` — the navigation-chrome idiom the field-ui site hand-spread across a dozen surfaces
 * (top nav, chapter rail, docs sidebar/outline/search, breadcrumbs, pagers, footer, filter rosters),
 * lifted into the platform. It runs a recipe SIGNALS-ONLY (`render: []`) over the `<a>` links inside a
 * root: every link becomes a body, the current link can be pinned as the "well" (`data-field-attention
 * = 1`), and previously-visited links can be marked (`data-field-memory = 1` + a `nav-visited` class)
 * from a caller-supplied predicate. The platform writes the recipe's `--field-*` lanes back onto each
 * link; CSS turns them into ink, weight, glows, and marks. Nothing is drawn.
 *
 * Progressive enhancement is the contract: under `prefers-reduced-motion` (or when the recipe can't be
 * resolved / there are no links) it returns `null` and writes nothing — the links stay plain and
 * reachable. The caller owns the visit log and the recipe lookup; this helper owns the binding and its
 * teardown. Unfrozen (experimental) — option names may refine before 1.0.
 */
import { recipeById, type FieldRecipe } from '@field-ui/core';
import { applyRecipe } from './apply-recipe.ts';
import { prefersReducedMotion } from './env.ts';

export interface FieldNavOptions {
  /** the link to pin as the current/"well" — its attention lane is held at 1. */
  pin?: Element | null;
  /** predicate over a link's `href`: true → mark it visited (`data-field-memory=1` + `nav-visited`). */
  visited?: (href: string) => boolean;
  /** extra metric lanes to bind beyond the recipe's (default `['attention','memory']`). */
  extraMetrics?: string[];
  /** force the reduced-motion path (defaults to the OS `prefers-reduced-motion` setting). */
  reducedMotion?: boolean;
}

export interface FieldNavHandle {
  destroy(): void;
}

/** The `--field-*` lanes a nav binding may write — cleared on teardown so a re-bind starts clean. */
const NAV_METRIC_VARS = [
  '--field-attention',
  '--field-memory',
  '--field-priority',
  '--field-density',
  '--field-recency',
];

/**
 * Bind a recipe signals-only over the `<a href>` links inside `root`. `recipe` may be a `FieldRecipe`
 * or a catalog id. Returns a teardown, or `null` when there's nothing to bind (reduced motion, no
 * links, or an unknown recipe id).
 */
export function bindFieldNav(
  root: Element,
  recipe: FieldRecipe | string,
  opts: FieldNavOptions = {},
): FieldNavHandle | null {
  if (opts.reducedMotion ?? prefersReducedMotion()) return null;
  const resolved = typeof recipe === 'string' ? recipeById(recipe) : recipe;
  if (!resolved) return null;
  const links = [...root.querySelectorAll<HTMLAnchorElement>('a[href]')];
  if (!links.length) return null;

  const pinned = (opts.pin as HTMLElement | null) ?? null;
  pinned?.setAttribute('data-field-attention', '1');
  const marked: HTMLElement[] = [];
  if (opts.visited) {
    for (const a of links) {
      if (opts.visited(a.getAttribute('href') ?? '')) {
        a.setAttribute('data-field-memory', '1');
        a.classList.add('nav-visited');
        marked.push(a);
      }
    }
  }

  const undoAnnotations = (): void => {
    pinned?.removeAttribute('data-field-attention');
    for (const a of marked) {
      a.removeAttribute('data-field-memory');
      a.classList.remove('nav-visited');
    }
  };

  let applied: { destroy(): void };
  try {
    applied = applyRecipe(root, resolved, {
      bodies: links,
      annotateBodies: false,
      renderless: true,
      extraMetrics: opts.extraMetrics ?? ['attention', 'memory'],
    });
  } catch {
    undoAnnotations();
    return null; // the plain links stand on their own
  }

  return {
    destroy() {
      applied.destroy();
      undoAnnotations();
      for (const a of links) for (const v of NAV_METRIC_VARS) a.style.removeProperty(v);
    },
  };
}
