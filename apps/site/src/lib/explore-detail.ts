// explore-detail.ts — expand-in-place detail overlay for /explore.
//
// Clicking a card opens a focused detail view that grows from the card's position (FLIP) while the
// grid recedes behind a backdrop. The recipe's field wakes in the preview area; its info (problem,
// use cases, tokens, metrics, render stack) slides in alongside; the URL gains `?r=<id>` so the view
// is shareable and the back button closes it. Esc / backdrop / close button all dismiss.
//
// Progressive enhancement: the cards are real <a href="/recipes/<id>"> links, so with no JS — or on
// cmd/middle-click — they navigate to the full recipe page. JS intercepts a plain click to open the
// overlay instead. Phase 2b enhances the preview region into the full visualization workbench.

import { mountRecipePreview, type PreviewHandle } from './explore-preview.ts';

interface DomainRef { id: string; label: string }
interface RecipeDetail {
  name: string;
  intent: string;
  tier: string;
  fieldLabel: string;
  accent: string;
  domains: DomainRef[];
  solves: string[];
  tokens: string[];
  metrics: string[];
  render: string[];
  isPlatform: boolean;
  scaffoldId: string | null;
  primaryRender: string;
  reducedMotion: string;
}

const REDUCED =
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const chip = (text: string, accentVar?: string) =>
  `<span class="exd-chip"${accentVar ? ` style="--chip-accent: ${accentVar}"` : ''}>${esc(text)}</span>`;

const lane = (label: string, items: string[], cls = '') =>
  items.length
    ? `<div class="exd-lane"><span class="exd-lane-label">${label}</span><div class="exd-lane-items ${cls}">${items
        .map((i) => `<code class="exd-token">${esc(i)}</code>`)
        .join('')}</div></div>`
    : '';

export function initExploreDetail(): () => void {
  const root = document.querySelector<HTMLElement>('[data-detail]');
  const panel = root?.querySelector<HTMLElement>('[data-detail-panel]');
  const previewEl = root?.querySelector<HTMLElement>('[data-detail-preview]');
  const infoEl = root?.querySelector<HTMLElement>('[data-detail-info]');
  const grid = document.querySelector<HTMLElement>('.ex-grid');
  const dataEl = document.getElementById('ex-recipe-data');
  if (!root || !panel || !previewEl || !infoEl || !grid || !dataEl) return () => {};

  const data: Record<string, RecipeDetail> = JSON.parse(dataEl.textContent || '{}');

  let openId: string | null = null;
  let preview: PreviewHandle | null = null;
  let lastFocused: HTMLElement | null = null;
  let mountTimer = 0;

  const buildInfo = (id: string, d: RecipeDetail): string => {
    const tierField = `<div class="exd-head"><span class="exd-field" style="--accent:${esc(d.accent)}">${esc(d.fieldLabel)}</span><span class="exd-tier">${esc(d.tier)}</span></div>`;
    const title = `<h2 class="exd-name" id="ex-detail-name">${esc(d.name)}</h2>`;
    const intent = `<p class="exd-intent">${esc(d.intent)}</p>`;
    const domains = d.isPlatform
      ? chip('Platform & Teaching', 'var(--text-3)')
      : d.domains.map((dm) => chip(dm.label, `var(--dom-${dm.id})`)).join('');
    const domainRow = `<div class="exd-domains">${domains}</div>`;
    const solves = d.solves.length
      ? `<div class="exd-lane"><span class="exd-lane-label">Solves</span><div class="exd-lane-items">${d.solves
          .map((s) => `<span class="exd-solve">${esc(s)}</span>`)
          .join('')}</div></div>`
      : '';
    const tokens = lane('Tokens', d.tokens);
    const metrics = lane('Metrics', d.metrics);
    const render = lane('Render', d.render);
    const link = `<a class="exd-open" href="/recipes/${encodeURIComponent(id)}">Open full recipe <span aria-hidden="true">→</span></a>`;
    return tierField + title + intent + domainRow + solves + tokens + metrics + render + link;
  };

  // ── focus trap ──────────────────────────────────────────────────────────────────────────────
  const onKeydown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key !== 'Tab') return;
    const focusables = panel.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])',
    );
    if (!focusables.length) return;
    const firstF = focusables[0]!;
    const lastF = focusables[focusables.length - 1]!;
    if (e.shiftKey && document.activeElement === firstF) { e.preventDefault(); lastF.focus(); }
    else if (!e.shiftKey && document.activeElement === lastF) { e.preventDefault(); firstF.focus(); }
  };

  const open = (id: string, fromCard: HTMLElement | null, push: boolean): void => {
    const d = data[id];
    if (!d) return;
    if (openId === id) return;
    const switching = openId !== null;
    openId = id;

    lastFocused = (document.activeElement as HTMLElement) ?? null;
    infoEl.innerHTML = buildInfo(id, d);
    panel.style.setProperty('--detail-accent', d.accent);

    // tear down any previous preview now; the new one mounts AFTER the entrance (below)
    window.clearTimeout(mountTimer);
    preview?.destroy();
    preview = null;
    previewEl.innerHTML = '';

    void fromCard; // (FLIP-from-card entrance is a future polish; the CSS scale-in is robust today)
    root.hidden = false;
    document.body.classList.add('ex-detail-open');
    // Force a synchronous reflow to commit the pre-open state (opacity 0 / scaled), THEN add the
    // class so the transition runs deterministically (rAF triggers are unreliable under load).
    void panel.offsetWidth;
    root.classList.add('is-open');

    // Defer the heavy field boot until the entrance transition has played — the lazy engine import
    // saturates the main thread and would otherwise starve the panel's fade/scale-in. This also
    // reads better: the panel arrives, THEN the field wakes inside it.
    mountTimer = window.setTimeout(() => {
      if (openId !== id) return;
      preview = mountRecipePreview(previewEl, {
        recipeId: id,
        scaffoldId: d.scaffoldId,
        primaryRender: d.primaryRender,
        reducedMotionText: d.reducedMotion,
      });
    }, REDUCED ? 0 : 340);

    const closeBtn = panel.querySelector<HTMLElement>('[data-detail-close]');
    closeBtn?.focus();
    document.addEventListener('keydown', onKeydown);

    // URL
    const url = `${location.pathname}?r=${encodeURIComponent(id)}`;
    if (push) {
      if (switching) history.replaceState({ r: id }, '', url);
      else history.pushState({ r: id }, '', url);
    }
  };

  function close(push = true): void {
    if (openId === null) return;
    openId = null;
    window.clearTimeout(mountTimer);
    document.removeEventListener('keydown', onKeydown);
    root.classList.remove('is-open');
    document.body.classList.remove('ex-detail-open');
    const finish = () => {
      root.hidden = true;
      preview?.destroy();
      preview = null;
      previewEl.innerHTML = '';
      infoEl.innerHTML = '';
    };
    if (REDUCED) finish();
    else window.setTimeout(finish, 260); // matches the panel transition
    lastFocused?.focus?.();
    lastFocused = null;
    if (push) {
      // drop the ?r= param
      if (history.state?.r) history.back();
      else history.replaceState({}, '', location.pathname);
    }
  }

  // ── wiring ──────────────────────────────────────────────────────────────────────────────────
  const onCardClick = (e: MouseEvent): void => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const link = (e.target as Element).closest<HTMLElement>('.ex-card-link');
    if (!link) return;
    const li = link.closest<HTMLElement>('.ex-card');
    const id = li?.dataset.recipeId;
    if (!id || !data[id]) return;
    e.preventDefault();
    open(id, li ?? null, true);
  };
  grid.addEventListener('click', onCardClick);

  root.querySelector('[data-detail-close]')?.addEventListener('click', () => close());
  root.querySelector('[data-detail-backdrop]')?.addEventListener('click', () => close());

  const onPopState = (): void => {
    const r = new URLSearchParams(location.search).get('r');
    if (r && data[r]) open(r, document.querySelector(`.ex-card[data-recipe-id="${r}"]`), false);
    else close(false);
  };
  window.addEventListener('popstate', onPopState);

  // deep-link: open the recipe named in ?r= on load
  const initial = new URLSearchParams(location.search).get('r');
  if (initial && data[initial]) {
    open(initial, document.querySelector(`.ex-card[data-recipe-id="${initial}"]`), false);
  }

  return () => {
    grid.removeEventListener('click', onCardClick);
    window.removeEventListener('popstate', onPopState);
    document.removeEventListener('keydown', onKeydown);
    // Synchronous teardown — no close animation (whose async finish() could clobber a fresh open
    // on a re-init) and no history mutation.
    openId = null;
    window.clearTimeout(mountTimer);
    preview?.destroy();
    preview = null;
    root.classList.remove('is-open');
    root.hidden = true;
    document.body.classList.remove('ex-detail-open');
    infoEl.innerHTML = '';
    previewEl.innerHTML = '';
  };
}
