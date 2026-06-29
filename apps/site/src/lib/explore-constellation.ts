// explore-constellation.ts — the force-directed map view of the catalog.
//
// A second way to read the 64 recipes: instead of a grid, every recipe is a node that settles around
// its primary domain, so the catalog's shape becomes visible — which domains are dense, which recipes
// sit between two. A small custom force relaxation (anchor pull + all-pairs repulsion) runs once and
// settles; nodes then animate into place via CSS. Clicking a node opens the same detail overlay as a
// card (via an `explore:open` event); search / domain filters dim non-matching nodes.
//
// Reduced motion: positions are applied with no transition (no fly-in).

import { DOMAINS } from './recipe-taxonomy.ts';

interface RecipeBlob {
  name: string;
  accent: string;
  domains: { id: string; label: string }[];
  isPlatform: boolean;
}
interface CNode {
  id: string;
  name: string;
  domain: string; // primary domain id, or 'platform'
  domainsAll: string[];
  search: string;
  el: HTMLButtonElement;
  x: number; y: number; vx: number; vy: number;
}

const REDUCED =
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;

export interface ConstellationHandle {
  show(): void;
  hide(): void;
  destroy(): void;
}

export function initConstellation(): ConstellationHandle {
  const container = document.querySelector<HTMLElement>('[data-constellation]');
  const dataEl = document.getElementById('ex-recipe-data');
  if (!container || !dataEl) return { show() {}, hide() {}, destroy() {} };

  const data: Record<string, RecipeBlob> = JSON.parse(dataEl.textContent || '{}');
  const domainIds = DOMAINS.map((d) => d.id);

  let built = false;
  let nodes: CNode[] = [];
  let filterState: { domain: string; q: string } = { domain: 'all', q: '' };

  const build = (): void => {
    container.innerHTML = '';
    nodes = [];

    // domain cluster labels (faint, behind the nodes)
    for (const d of DOMAINS) {
      const lbl = document.createElement('span');
      lbl.className = 'ex-cluster-label';
      lbl.dataset.domain = d.id;
      lbl.textContent = d.label;
      container.appendChild(lbl);
    }

    for (const [id, d] of Object.entries(data)) {
      const primary = d.isPlatform ? 'platform' : d.domains[0]?.id ?? 'platform';
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ex-cnode';
      btn.dataset.recipeId = id;
      btn.style.setProperty('--cnode-accent', d.isPlatform ? 'var(--text-3)' : `var(--dom-${primary})`);
      btn.innerHTML = `<span class="ex-cnode-dot"></span><span class="ex-cnode-name">${d.name.replace(/[<>&]/g, '')}</span>`;
      container.appendChild(btn);
      nodes.push({
        id,
        name: d.name,
        domain: primary,
        domainsAll: d.isPlatform ? ['platform'] : d.domains.map((x) => x.id),
        search: `${d.name} ${d.domains.map((x) => x.label).join(' ')}`.toLowerCase(),
        el: btn,
        x: 0, y: 0, vx: 0, vy: 0,
      });
    }
    built = true;
  };

  const layout = (): void => {
    const W = container.clientWidth;
    const H = container.clientHeight;
    if (W < 50 || H < 50) return;
    const cx = W / 2;
    const cy = H / 2;
    const R = Math.min(W, H) * 0.37;

    // domain anchors on a ring (first at top), platform at centre
    const anchors: Record<string, { x: number; y: number }> = {};
    domainIds.forEach((id, i) => {
      const a = (i / domainIds.length) * Math.PI * 2 - Math.PI / 2;
      anchors[id] = { x: cx + R * Math.cos(a), y: cy + R * Math.sin(a) };
    });
    anchors.platform = { x: cx, y: cy };

    // place cluster labels at anchors
    container.querySelectorAll<HTMLElement>('.ex-cluster-label').forEach((lbl) => {
      const a = anchors[lbl.dataset.domain ?? ''];
      if (a) lbl.style.transform = `translate(${a.x}px, ${a.y}px) translate(-50%, -50%)`;
    });

    // deterministic-ish jitter from index so the layout is stable across runs
    nodes.forEach((n, i) => {
      const an = anchors[n.domain] ?? anchors.platform!;
      const j = (i % 7) - 3;
      n.x = an.x + j * 6;
      n.y = an.y + ((i % 5) - 2) * 6;
      n.vx = 0; n.vy = 0;
    });

    // dots are small, so cluster tight: short repel radius + firm anchor pull keeps the 9 groups
    // distinct without the name-pill overlap of a label-everywhere layout.
    const REPEL_R2 = 30 * 30;
    for (let it = 0; it < 300; it++) {
      for (const n of nodes) {
        const an = anchors[n.domain] ?? anchors.platform!;
        let fx = (an.x - n.x) * 0.06;
        let fy = (an.y - n.y) * 0.06;
        for (const m of nodes) {
          if (m === n) continue;
          let dx = n.x - m.x;
          let dy = n.y - m.y;
          let d2 = dx * dx + dy * dy;
          if (d2 < 1) { d2 = 1; dx = (i01(n.x) - 0.5); dy = (i01(n.y) - 0.5); }
          if (d2 < REPEL_R2) {
            const d = Math.sqrt(d2);
            const f = 130 / d2;
            fx += (dx / d) * f;
            fy += (dy / d) * f;
          }
        }
        n.vx = (n.vx + fx) * 0.8;
        n.vy = (n.vy + fy) * 0.8;
        n.x = Math.max(24, Math.min(W - 24, n.x + n.vx));
        n.y = Math.max(34, Math.min(H - 18, n.y + n.vy));
      }
    }

    for (const n of nodes) {
      n.el.style.transform = `translate(${n.x.toFixed(1)}px, ${n.y.toFixed(1)}px) translate(-50%, -50%)`;
    }
    applyFilter();
  };

  // tiny deterministic [0,1) from a coordinate — avoids Math.random for stable separation nudges
  const i01 = (v: number): number => {
    const s = Math.sin(v * 12.9898) * 43758.5453;
    return s - Math.floor(s);
  };

  const matches = (n: CNode): boolean => {
    if (filterState.domain !== 'all') {
      if (filterState.domain === 'platform') {
        if (n.domain !== 'platform') return false;
      } else if (!n.domainsAll.includes(filterState.domain)) return false;
    }
    if (filterState.q && !n.search.includes(filterState.q)) return false;
    return true;
  };
  const applyFilter = (): void => {
    if (!built) return;
    const filtering = filterState.domain !== 'all' || filterState.q !== '';
    for (const n of nodes) n.el.classList.toggle('is-dim', filtering && !matches(n));
  };

  // ── events ──────────────────────────────────────────────────────────────────────────────────
  const onClick = (e: MouseEvent): void => {
    const node = (e.target as Element).closest<HTMLElement>('.ex-cnode');
    const id = node?.dataset.recipeId;
    if (id) document.dispatchEvent(new CustomEvent('explore:open', { detail: { id } }));
  };
  container.addEventListener('click', onClick);

  const onFilter = (e: Event): void => {
    const d = (e as CustomEvent).detail as { domain: string; q: string };
    if (d) { filterState = d; applyFilter(); }
  };
  document.addEventListener('explore:filter', onFilter);

  let resizeT = 0;
  const onResize = (): void => {
    window.clearTimeout(resizeT);
    resizeT = window.setTimeout(() => { if (!container.hidden) layout(); }, 200);
  };
  window.addEventListener('resize', onResize);

  return {
    show() {
      container.hidden = false;
      container.setAttribute('aria-hidden', 'false');
      if (REDUCED) container.classList.add('no-anim');
      if (!built) build();
      // measure after it's visible (size is 0 while hidden)
      requestAnimationFrame(() => requestAnimationFrame(layout));
    },
    hide() {
      container.hidden = true;
      container.setAttribute('aria-hidden', 'true');
    },
    destroy() {
      container.removeEventListener('click', onClick);
      document.removeEventListener('explore:filter', onFilter);
      window.removeEventListener('resize', onResize);
      window.clearTimeout(resizeT);
      container.innerHTML = '';
      built = false;
    },
  };
}
