/**
 * Shared concept-study runtime. Each study declares element groups (a root + a recipe id + the items
 * to annotate) and this drives them through the REAL recipe runtime — applyRecipe() per group — plus a
 * Field on/off toggle, a reduced-motion toggle, and a live inspect readout. No hand-wired behavior with
 * recipe labels attached: the recipes execute.
 *
 * Page contract: buttons carry `data-study="field"` / `data-study="reduced"`; a status element carries
 * `data-study-status`.
 */
import { recipeById } from 'field-ui';
import { applyRecipe, type AppliedRecipe } from '@field-ui/platform';

export interface StudyGroup {
  root: HTMLElement;
  recipeId: string;
  items: HTMLElement[];
}

export function mountStudy(groups: StudyGroup[]): { stop: () => void } {
  const status = document.querySelector<HTMLElement>('[data-study-status]');
  let applieds: AppliedRecipe[] = [];
  let raf = 0;
  let on = false;
  let reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  const teardown = (): void => {
    for (const a of applieds) a.destroy();
    applieds = [];
  };
  const apply = (): void => {
    teardown();
    applieds = groups.flatMap((g) => {
      const r = recipeById(g.recipeId);
      return r && g.items.length ? [applyRecipe(g.root, r, { bodies: g.items, reducedMotion: reduced })] : [];
    });
    on = true;
    if (!raf) raf = requestAnimationFrame(loop);
  };
  const stop = (): void => {
    teardown();
    on = false;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    if (status) status.textContent = 'field off — plain semantic page';
  };
  function loop(): void {
    if (status && applieds.length) {
      const reports = applieds.map((a) => a.inspect());
      const frame = reports[0]?.frame ?? 0;
      const bodies = reports.reduce((n, r) => n + r.measurements, 0);
      const rels = reports.reduce((n, r) => n + r.relationships, 0);
      const lint = reports.reduce((n, r) => n + r.lint, 0);
      status.textContent = `field on${reduced ? ' · reduced motion' : ''} · ${frame} frames · ${bodies} bodies · ${rels} relationships · lint ${lint || '✓'}`;
    }
    raf = requestAnimationFrame(loop);
  }

  for (const btn of document.querySelectorAll<HTMLButtonElement>('[data-study]')) {
    btn.addEventListener('click', () => {
      const k = btn.dataset.study;
      if (k === 'field') {
        if (on) stop();
        else apply();
        btn.classList.toggle('on', on);
        btn.setAttribute('aria-pressed', String(on));
        btn.textContent = on ? 'Field: on' : 'Field: off';
      } else if (k === 'reduced') {
        reduced = !reduced;
        btn.classList.toggle('on', reduced);
        btn.setAttribute('aria-pressed', String(reduced));
        if (on) apply();
      }
    });
  }

  apply(); // studies start with the field on
  document.addEventListener('astro:before-swap', stop, { once: true });
  return { stop };
}
