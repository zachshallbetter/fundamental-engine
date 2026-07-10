// explore-filter-field.ts — the engine-powered (but invisible) filter bar.
//
// The page's own primary control participates in the field, as a demonstration of the invisible-
// fields thesis: the filter pills are bodies, the engine measures their engagement + visibility and
// writes `--field-attention` (0..1, eased per frame) back onto each pill every frame — and CSS turns
// that into a subtle live glow that follows the visitor's cursor across the bar. Nothing is drawn
// (renderless / signals-only), so it never re-introduces the busy-ness of particles over the controls.
//
// This mirrors the shipped nav Wayfinding Field (SiteNav.astro) exactly — same recipe, same renderless
// applyPattern over real chrome, same single CSS custom property as the only output. Progressive
// enhancement: reduced motion, the global field switch off, or a failed import all leave the pills as
// plain chrome (the `--field-attention` fallback resolves to 0).

let field: { destroy(): void } | null = null;
let gen = 0;

const reduceMotion = () =>
  typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export async function startFilterField(): Promise<void> {
  const mine = ++gen;
  field?.destroy();
  field = null;

  if (reduceMotion() || document.documentElement.dataset.field === 'off') return;
  const bar = document.querySelector<HTMLElement>('.ex-pills');
  const pills = bar ? [...bar.querySelectorAll<HTMLElement>('.ex-pill')] : [];
  if (!bar || !pills.length) return;

  try {
    const [{ patternById }, { applyPattern }] = await Promise.all([
      import('@fundamental-engine/core'),
      import('@fundamental-engine/dom'),
    ]);
    if (mine !== gen) return; // superseded by a newer start / a teardown
    const base = patternById('wayfinding-field');
    if (!base) return;
    field = applyPattern(bar, base, {
      renderless: true, // signals only — no canvas, no particles
      bodies: pills, // the pills are the bodies
      annotateBodies: false, // don't write data-body — keep them out of any global field-root scan
    });
  } catch {
    // the plain pills stand on their own
  }
}

export function stopFilterField(): void {
  gen++;
  field?.destroy();
  field = null;
}
