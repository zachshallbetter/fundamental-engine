// explore-page.ts — the browse state machine for /explore.
//
// Plain DOM, no engine: search + problem-domain filtering over the server-rendered catalog. The
// engine-powered flourish (the signals-only filter bar) lives in explore-filter-field.ts and is
// layered on top; this module owns the actual filtering UX so it works even if the engine never
// loads (progressive enhancement — the catalog is fully usable without it).
//
// Filter behaviour: non-matching cards are HIDDEN and the grid reflows to show only matches, with a
// FLIP animation so surviving cards glide to their new positions instead of jumping. A live result
// count and an empty state keep the visitor oriented. Reduced motion skips the FLIP.

interface ExploreState {
  /** 'all' | 'platform' | a ProblemDomain id */
  domain: string;
  /** lowercased search query */
  q: string;
}

const REDUCED =
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;

export function initExplorePage(): () => void {
  const grid = document.querySelector<HTMLElement>('.ex-grid');
  if (!grid) return () => {};

  const cards = Array.from(grid.querySelectorAll<HTMLElement>('.ex-card'));
  const pills = Array.from(document.querySelectorAll<HTMLButtonElement>('.ex-pill'));
  const search = document.querySelector<HTMLInputElement>('.ex-search-input');
  const countEl = document.querySelector<HTMLElement>('[data-result-count]');
  const emptyEl = document.querySelector<HTMLElement>('[data-empty]');
  const clearBtn = document.querySelector<HTMLButtonElement>('[data-clear-filters]');

  const state: ExploreState = { domain: 'all', q: '' };

  const matches = (card: HTMLElement): boolean => {
    // domain gate
    if (state.domain !== 'all') {
      if (state.domain === 'platform') {
        if (card.dataset.platform !== '1') return false;
      } else if (!(card.dataset.domains ?? '').split(' ').includes(state.domain)) {
        return false;
      }
    }
    // search gate — name + intent + solves were lowercased server-side into data attributes
    if (state.q) {
      const hay = `${card.dataset.name ?? ''} ${card.dataset.intent ?? ''} ${card.dataset.solves ?? ''}`;
      if (!hay.includes(state.q)) return false;
    }
    return true;
  };

  const apply = (): void => {
    // FLIP — first: positions of currently-visible cards before the mutation.
    const first = new Map<HTMLElement, DOMRect>();
    if (!REDUCED) {
      for (const c of cards) if (!c.hidden) first.set(c, c.getBoundingClientRect());
    }

    let shown = 0;
    for (const card of cards) {
      const ok = matches(card);
      card.hidden = !ok;
      if (ok) shown++;
    }

    // count + empty state
    if (countEl) countEl.textContent = `${shown} recipe${shown === 1 ? '' : 's'}`;
    if (emptyEl) emptyEl.hidden = shown !== 0;

    // FLIP — last + invert + play, for cards that stayed visible.
    if (!REDUCED) {
      for (const card of cards) {
        if (card.hidden) continue;
        const prev = first.get(card);
        const next = card.getBoundingClientRect();
        if (prev) {
          const dx = prev.left - next.left;
          const dy = prev.top - next.top;
          if (dx || dy) {
            card.animate(
              [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'translate(0, 0)' }],
              { duration: 280, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' },
            );
          }
        } else {
          // newly revealed — fade + rise in
          card.animate(
            [
              { opacity: 0, transform: 'translateY(6px) scale(0.985)' },
              { opacity: 1, transform: 'translateY(0) scale(1)' },
            ],
            { duration: 240, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' },
          );
        }
      }
    }

    // notify the filter-field (signals layer) that the active domain changed, so it can re-mass pills.
    document.dispatchEvent(new CustomEvent('explore:filter', { detail: { ...state } }));
  };

  const setDomain = (domain: string): void => {
    // clicking the active non-'all' pill toggles back to 'all'
    state.domain = state.domain === domain && domain !== 'all' ? 'all' : domain;
    for (const p of pills) {
      const on = p.dataset.domain === state.domain;
      p.classList.toggle('is-on', on);
      p.setAttribute('aria-pressed', String(on));
    }
    apply();
  };

  // pills
  for (const pill of pills) {
    pill.addEventListener('click', () => setDomain(pill.dataset.domain ?? 'all'));
  }

  // search (debounced)
  let t = 0;
  const onSearch = (): void => {
    window.clearTimeout(t);
    t = window.setTimeout(() => {
      state.q = (search?.value ?? '').trim().toLowerCase();
      apply();
    }, 110);
  };
  search?.addEventListener('input', onSearch);

  // clear
  clearBtn?.addEventListener('click', () => {
    if (search) search.value = '';
    setDomain('all');
  });

  return () => {
    window.clearTimeout(t);
    for (const pill of pills) pill.replaceWith(pill.cloneNode(true)); // drop listeners
  };
}
