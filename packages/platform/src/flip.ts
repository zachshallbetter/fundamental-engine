/**
 * withFlip — the FLIP reflow primitive (First, Last, Invert, Play).
 *
 * Every invisible-fields example re-sorts live DOM (reweight, triage, cross-pane moves) and wants
 * the reflow to read as travel, not teleportation. The recipe is always the same: measure where
 * each element sits, mutate the DOM, measure again, then translate each element from its old box
 * back over its new one and release the offset under a transition. This module is that recipe,
 * extracted (#295) so a runtime states only WHAT changes, not how the motion works.
 *
 * Pure DOM helper: no registries, no engine, no module-top window access (SSR-safe — the
 * reduced-motion probe runs at call time). Under `prefers-reduced-motion: reduce` the mutation
 * still runs; only the animation is skipped.
 */

/** Options for {@link withFlip}. */
export interface FlipOptions {
  /** Transition duration in ms. Default 500. */
  duration?: number;
  /** Transition easing. Default the family's `cubic-bezier(.2, .7, .2, 1)`. */
  easing?: string;
  /**
   * Which axes the released offset travels on. `"both"` (default) animates `translate(dx, dy)`;
   * `"y"` animates `translateY(dy)` only — for single-column lists where any horizontal delta
   * is noise.
   */
  axis?: 'y' | 'both';
  /**
   * Elements the mutation moved but that should NOT be translated — e.g. a tile whose size class
   * changed, where a translate cannot honestly animate the reflow and the caller settles it
   * another way (a fade). Evaluated after `mutate`, once per element.
   */
  exclude?: (el: HTMLElement) => boolean;
}

const DEFAULT_DURATION = 500;
const DEFAULT_EASING = 'cubic-bezier(.2, .7, .2, 1)';

/**
 * Measure `elements()`, run `mutate` (which may reorder, move, or reparent them), then translate
 * each moved element from its old box to its new one and release the offset under a transition.
 * The inline transition is removed on `transitionend`.
 *
 * `elements` is called twice — once before `mutate` (First) and once after (Last) — so a callback
 * that re-queries the DOM naturally covers reparenting. Elements that appear only after `mutate`
 * (no first rect) are left alone. Skips the animation entirely under
 * `prefers-reduced-motion: reduce` (`mutate` still runs).
 */
export function withFlip(elements: () => HTMLElement[], mutate: () => void, opts: FlipOptions = {}): void {
  const reduce =
    typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) {
    mutate();
    return;
  }
  const duration = opts.duration ?? DEFAULT_DURATION;
  const easing = opts.easing ?? DEFAULT_EASING;
  const axis = opts.axis ?? 'both';
  // First: where everything sits now.
  const first = new Map(
    elements().map((el) => {
      const b = el.getBoundingClientRect();
      return [el, { top: b.top, left: b.left }] as const;
    }),
  );
  mutate();
  // Last + Invert + Play, per element.
  for (const el of elements()) {
    if (opts.exclude?.(el)) continue;
    const was = first.get(el);
    if (!was) continue; // appeared during mutate — no origin to travel from
    const now = el.getBoundingClientRect();
    const dx = axis === 'y' ? 0 : was.left - now.left;
    const dy = was.top - now.top;
    if (!dx && !dy) continue;
    el.style.setProperty(
      'transform',
      axis === 'y' ? `translateY(${dy}px)` : `translate(${dx}px, ${dy}px)`,
    );
    el.style.setProperty('transition', 'none');
    void el.getBoundingClientRect(); // commit the inverted offset before releasing it
    requestAnimationFrame(() => {
      el.style.setProperty('transition', `transform ${duration}ms ${easing}`);
      el.style.removeProperty('transform');
      el.addEventListener('transitionend', () => el.style.removeProperty('transition'), {
        once: true,
      });
    });
  }
}
