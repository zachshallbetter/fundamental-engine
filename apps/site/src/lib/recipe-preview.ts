// recipe-preview.ts — run a recipe LIVE inside a container, lazily and safely.
//
// Each `[data-recipe-preview="<id>"]` element gets the real recipe executed via `applyRecipe()`.
// Critically, each preview also gets its OWN contained FieldHandle (a canvas + createField with
// containerHost), so the recipe's particle simulation + render plan (dots, streamlines, heatmap)
// actually run — not just the signals/metrics layer. Without a field, applyRecipe would only write
// --field-* CSS variables but draw nothing.
//
// To keep a 64-card hub from running 64 rAF loops at once, previews mount only when scrolled into
// view, destroy() when they leave, and a global cap bounds how many run concurrently. Reduced motion
// renders the recipe's static `meaningWithoutMotion` output and starts no loop.
import { recipeById } from "@fundamental-engine/core";
import { applyRecipe, type AppliedRecipe } from "@fundamental-engine/dom";
import { createField } from "@fundamental-engine/vanilla";
import type { FieldHandle } from "@fundamental-engine/core";
import { scaffoldFor, injectScaffoldStyles } from "./recipe-scaffolds.ts";

interface PreviewOptions {
  selector?: string;
  /** max live (driven) previews at once — the rest queue until one leaves view. */
  max?: number;
  /** optional per-frame readout: called with the live inspection for an element. */
  onInspect?: (el: HTMLElement, applied: AppliedRecipe) => void;
}

type Slot = HTMLElement & { _applied?: AppliedRecipe; _field?: FieldHandle; _canvas?: HTMLCanvasElement };

export function initRecipePreviews(opts: PreviewOptions = {}): () => void {
  const sel = opts.selector ?? "[data-recipe-preview]";
  const max = opts.max ?? 6;
  const reduced =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;

  injectScaffoldStyles();

  const els = Array.from(document.querySelectorAll<Slot>(sel));
  const live = new Set<Slot>();
  const visible = new Set<Slot>();
  let pollRaf = 0;

  const mount = (el: Slot, drive: boolean): void => {
    if (el._applied) return;
    const id = el.dataset.recipePreview ?? "";
    const recipe = recipeById(id);
    if (!recipe) return;
    el.innerHTML = "";
    el.dataset.recipeMounted = "1";

    // Inject representative UI bodies so visitors see the field reacting to
    // actual elements, not an empty particle box. The toggle lets visitors
    // switch between the labelled use-case view and the pure particle field.
    // The canvas is appended after so it sits behind the scaffold elements
    // (scaffold uses position:relative+z-index:1 to stay on top).
    el.insertAdjacentHTML("beforeend", scaffoldFor(id));
    el.insertAdjacentHTML("beforeend",
      `<button class="sc-toggle" aria-pressed="false" title="Show field visualization" type="button">` +
      `<span class="sc-toggle-opt">Use case</span>` +
      `<span class="sc-toggle-opt">Field</span>` +
      `</button>`
    );

    // Create a contained particle field for this preview card — without a real FieldHandle,
    // applyRecipe only runs the feedback/metrics layer and the recipe draws nothing.
    let field: FieldHandle | undefined;
    if (drive && !reduced) {
      const canvas = document.createElement("canvas");
      canvas.style.cssText =
        "position:absolute;inset:0;width:100%;height:100%;pointer-events:none;border-radius:inherit;";
      el.style.position = "relative";
      el.appendChild(canvas);
      el._canvas = canvas;
      try {
        field = createField(canvas, {
          bounds: el,
          render: "dots",
          density: 0.6,
          // The preview should show THIS recipe's behavior, not the generic ambient
          // background Currents (which default on and look identical across every card).
          waves: false,
        });
        el._field = field;
      } catch {
        // if the field fails to start (e.g. no WebGL), fall back to signals-only
        canvas.remove();
        el._canvas = undefined;
      }
    }

    el._applied = applyRecipe(el, recipe, { reducedMotion: reduced, drive, field });
    if (drive) live.add(el);
  };

  const unmount = (el: Slot): void => {
    el._applied?.destroy();
    el._applied = undefined;
    el._field?.destroy();
    el._field = undefined;
    el._canvas?.remove();
    el._canvas = undefined;
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
