// explore-preview.ts — mount ONE live recipe field inside the expand-in-place detail overlay.
//
// Unlike the /recipes hub (which lazily runs up to six tiny card previews), the explore overlay shows
// exactly one recipe at a time, large, in its own render mode — so this is a single explicit mount,
// no IntersectionObserver. It runs the REAL recipe via applyRecipe against a contained field, with
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

export function mountRecipePreview(container: HTMLElement, opts: PreviewOptions): PreviewHandle {
  let destroyed = false;
  let applied: { destroy(): void } | null = null;
  let field: { destroy(): void } | null = null;
  let detachWorkbench: (() => void) | null = null;

  if (REDUCED) {
    container.innerHTML = `<p class="exd-static">${opts.reducedMotionText.replace(/[<>&]/g, '')}</p>`;
    return { destroy() { container.innerHTML = ''; } };
  }

  // Async: lazy-import the engine so the catalog never pays for it until a recipe is opened.
  (async () => {
    try {
      const [{ recipeById }, { applyRecipe }, { createField }, scaffolds, { attachWorkbench }] = await Promise.all([
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

      field = createField(canvas, {
        bounds: container,
        render: 'dots',
        density: 0.8,
        waves: false,
      });
      if (destroyed) { field.destroy(); field = null; return; }

      // run the real recipe — its render plan drives the field (setRender/setOverlay/heatmap).
      // Pass the scaffold elements as the bodies (annotateBodies:false keeps their use-case tokens)
      // so applyRecipe does NOT also spawn its own token-labelled demo bodies.
      applied = applyRecipe(container, recipe, {
        bodies: bodyEls.length ? bodyEls : undefined,
        annotateBodies: false,
        drive: true,
        field: field as never,
      });

      // the visualization workbench — render switcher + heatmap + live signal readout
      detachWorkbench = attachWorkbench({
        container,
        field: field as never,
        applied: applied as never,
        renderLayers: opts.renderLayers,
        primaryRender: opts.primaryRender,
      });
    } catch {
      /* the info panel stands on its own if the engine can't boot */
    }
  })();

  return {
    destroy() {
      destroyed = true;
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
