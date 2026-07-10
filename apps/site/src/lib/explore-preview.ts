// explore-preview.ts — mount ONE live recipe field inside the expand-in-place detail overlay.
//
// Unlike the /patterns hub (which lazily runs up to six tiny card previews), the explore overlay shows
// exactly one recipe at a time, large, in its own render mode — so this is a single explicit mount,
// no IntersectionObserver. It runs the REAL recipe via applyPattern against a contained field, with
// representative scaffold bodies so the field has something to react to. Phase 2b layers the
// visualization workbench (render switcher / overlay toggle / live signal panel) on top of this.
//
// Reduced motion: no field, no loop — show the recipe's static meaning-without-motion line instead.

export interface PreviewHandle {
  destroy(): void;
}

export interface PreviewOptions {
  recipeId: string;
  scaffoldId: string | null;
  primaryRender: string;
  reducedMotionText: string;
  /** the recipe's render layers — the workbench's render switcher is built from these */
  renderLayers: string[];
}

const REDUCED =
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;

// natural-field accent — the canonical palette (mirrors explore.astro / lab.astro).
const FIELD_ACCENT: Record<string, string> = {
  gravity: '#4da3ff', electromagnetic: '#2dd4bf', strong: '#a78bfa', weak: '#ff9d5c',
};

export function mountRecipePreview(container: HTMLElement, opts: PreviewOptions): PreviewHandle {
  let destroyed = false;
  let applied: { destroy(): void } | null = null;
  let field: { destroy(): void } | null = null;
  let detachWorkbench: (() => void) | null = null;
  let detachPointer: (() => void) | null = null;

  if (REDUCED) {
    container.innerHTML = `<p class="exd-static">${opts.reducedMotionText.replace(/[<>&]/g, '')}</p>`;
    return { destroy() { container.innerHTML = ''; } };
  }

  // Async: lazy-import the engine so the catalog never pays for it until a recipe is opened.
  (async () => {
    try {
      const [{ recipeById }, { applyPattern }, { createField }, scaffolds, { attachWorkbench }] = await Promise.all([
        import('@fundamental-engine/core'),
        import('@fundamental-engine/dom'),
        import('@fundamental-engine/vanilla'),
        import('./recipe-scaffolds.ts'),
        import('./explore-workbench.ts'),
      ]);
      if (destroyed) return;
      const recipe = recipeById(opts.recipeId);
      if (!recipe) return;

      scaffolds.injectScaffoldStyles();
      // representative UI bodies for the field to react to (use-case labels, not token names)
      const scaffold = document.createElement('div');
      scaffold.className = 'exd-scaffold rc-preview';
      scaffold.innerHTML = scaffolds.scaffoldFor(opts.recipeId);
      container.appendChild(scaffold);
      const bodyEls = [...scaffold.querySelectorAll<HTMLElement>('[data-body]')];

      const canvas = document.createElement('canvas');
      canvas.className = 'exd-canvas';
      canvas.style.cssText =
        'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;border-radius:inherit;';
      container.appendChild(canvas);

      // a second, stacked surface for the diagnostic OVERLAY readings (force-vectors, grid, …). The
      // engine draws overlays only when given an overlayCanvas (field.ts) — without it setOverlay is
      // a no-op. This is the engine's real underlay+overlay "immersive" architecture, contained.
      const overlayCanvas = document.createElement('canvas');
      overlayCanvas.className = 'exd-canvas exd-canvas-overlay';
      overlayCanvas.style.cssText =
        'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;border-radius:inherit;';
      container.appendChild(overlayCanvas);

      field = createField(canvas, {
        bounds: container,
        render: 'dots',
        density: 0.8,
        waves: false,
        overlayCanvas,
      });
      if (destroyed) { field.destroy(); field = null; return; }

      // run the real recipe — its render plan drives the field (setRender/setOverlay/heatmap).
      // Pass the scaffold elements as the bodies (annotateBodies:false keeps their use-case tokens)
      // so applyPattern does NOT also spawn its own token-labelled demo bodies.
      applied = applyPattern(container, recipe, {
        bodies: bodyEls.length ? bodyEls : undefined,
        annotateBodies: false,
        drive: true,
        field: field as never,
      });

      // the visualization workbench — two-tier substrate/overlay controls + live signal readout. The
      // readout reads the engine's live feedback vars (--d, --coherence, …) off the heaviest body.
      const heaviest = bodyEls
        .filter((el) => el.hasAttribute('data-feedback'))
        .sort((a, b) => parseFloat(b.dataset.strength ?? '0') - parseFloat(a.dataset.strength ?? '0'))[0];
      detachWorkbench = attachWorkbench({
        container,
        field: field as never,
        hasOverlay: true,
        feedbackEl: heaviest ?? bodyEls[0] ?? null,
        bodies: bodyEls,
        renderLayers: opts.renderLayers,
        primaryRender: opts.primaryRender,
        accent: FIELD_ACCENT[recipe.naturalField ?? ''] ?? '#4da3ff',
      });

      // Pointer interaction — moving over the preview steers a flow focus (field.flowTo): matter
      // pulls toward the cursor and the streamline render bends to it. The most direct "the field
      // responds to you" demonstration; clears on leave so it settles back.
      const f = field as { flowTo?: (x: number, y: number) => void; clearFlow?: () => void };
      if (typeof f.flowTo === 'function') {
        container.classList.add('is-steerable');
        const onMove = (e: PointerEvent): void => {
          const r = container.getBoundingClientRect();
          f.flowTo!(e.clientX - r.left, e.clientY - r.top);
        };
        const onLeave = (): void => f.clearFlow?.();
        container.addEventListener('pointermove', onMove);
        container.addEventListener('pointerleave', onLeave);
        detachPointer = () => {
          container.removeEventListener('pointermove', onMove);
          container.removeEventListener('pointerleave', onLeave);
          container.classList.remove('is-steerable');
        };
      }
    } catch {
      /* the info panel stands on its own if the engine can't boot */
    }
  })();

  return {
    destroy() {
      destroyed = true;
      detachPointer?.();
      detachPointer = null;
      detachWorkbench?.();
      detachWorkbench = null;
      applied?.destroy();
      applied = null;
      field?.destroy();
      field = null;
      container.innerHTML = '';
    },
  };
}
