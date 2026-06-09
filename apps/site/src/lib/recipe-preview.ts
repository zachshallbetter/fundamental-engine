// recipe-preview.ts — run a recipe LIVE inside a container, lazily and safely.
//
// Each `[data-recipe-preview="<id>"]` element gets the real recipe executed via `applyRecipe()` (a
// scoped FieldPlatform — it creates the recipe's demo bodies, binds metrics → `--field-*`, and ticks
// them). To keep a 64-card hub from running 64 rAF loops at once, previews mount only when scrolled
// into view, `destroy()` when they leave, and a global cap bounds how many run concurrently. Reduced
// motion renders the recipe's static `meaningWithoutMotion` output and starts no loop.
//
// Reused: `recipeById` (field-ui) + `applyRecipe` (@field-ui/platform). Returns a teardown for the
// Astro `before-swap` lifecycle.
import { recipeById } from "@field-ui/core";
import { applyRecipe, type AppliedRecipe } from "@field-ui/platform";

interface PreviewOptions {
  selector?: string;
  /** max live (driven) previews at once — the rest queue until one leaves view. */
  max?: number;
  /** optional per-frame readout: called with the live inspection for an element. */
  onInspect?: (el: HTMLElement, applied: AppliedRecipe) => void;
}

type Slot = HTMLElement & { _applied?: AppliedRecipe };

export function initRecipePreviews(opts: PreviewOptions = {}): () => void {
  const sel = opts.selector ?? "[data-recipe-preview]";
  const max = opts.max ?? 6;
  const reduced =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;

  const els = Array.from(document.querySelectorAll<Slot>(sel));
  const live = new Set<Slot>();
  const visible = new Set<Slot>();
  let pollRaf = 0;

  const mount = (el: Slot, drive: boolean): void => {
    if (el._applied) return;
    const recipe = recipeById(el.dataset.recipePreview ?? "");
    if (!recipe) return;
    el.innerHTML = "";
    el.dataset.recipeMounted = "1";
    el._applied = applyRecipe(el, recipe, { reducedMotion: reduced, drive });
    if (drive) live.add(el);
  };
  const unmount = (el: Slot): void => {
    el._applied?.destroy();
    el._applied = undefined;
    el.innerHTML = "";
    delete el.dataset.recipeMounted;
    live.delete(el);
  };
  // fill freed slots from the queue of in-view-but-not-yet-running previews.
  const pump = (): void => {
    for (const el of visible) {
      if (live.size >= max) break;
      if (!el._applied) mount(el, true);
    }
  };

  // Reduced motion: mount every preview once as a static (undriven) block, no observer, no loop.
  if (reduced) {
    for (const el of els) mount(el, false);
    return () => {
      for (const el of els) unmount(el);
    };
  }

  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        const el = e.target as Slot;
        if (e.isIntersecting) visible.add(el);
        else {
          visible.delete(el);
          unmount(el);
        }
      }
      pump();
    },
    { rootMargin: "150px" },
  );
  for (const el of els) io.observe(el);

  if (opts.onInspect) {
    const poll = (): void => {
      for (const el of live) if (el._applied) opts.onInspect!(el, el._applied);
      pollRaf = requestAnimationFrame(poll);
    };
    pollRaf = requestAnimationFrame(poll);
  }

  return () => {
    io.disconnect();
    if (pollRaf) cancelAnimationFrame(pollRaf);
    for (const el of [...live, ...visible]) unmount(el);
  };
}
