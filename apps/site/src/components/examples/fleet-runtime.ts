// Fleet Field runtime. field-ui as an INVISIBLE measurement layer over GitHub's real
// status page:
//   · Field on/off — off, the page collapses to the checklist (CSS via [data-field]); the
//     scoped field is destroyed and highlights are cleared. On, history shows in the type.
//   · Weight services by involvement / recency — recompute each card's --w from the chosen
//     signal, then re-sort the grid with a 2D FLIP reflow (grid moves are x and y).
//   · hover an incident → the services it hit light in the grid; hover a service → its
//     incidents light in the timeline. Class highlights only — no SVG on this page.
//   · click an incident → it releases the updates it accreted (aria-expanded toggle).
// The scoped field runs with render: [] — particles compute (metrics flow) but are never drawn.
import { recipeById } from "@field-ui/core";
import { applyRecipe } from "@field-ui/platform";

type FleetWeight = "involvement" | "recency";

const reduceMotion = (): boolean =>
  typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

// the reading-pace gate: the engine writes its live scroll velocity (px/frame) to
// --field-scroll-v on <html>; under 2 px/frame the user is reading, not skimming.
// Same gate the evidence reveal uses.
const SCROLL_V_MAX = 2;

const HINTS: Record<FleetWeight, string> = {
  involvement: "<b>size</b> = involvement — how many of the window's incidents named each service",
  recency: "<b>size</b> = recency — the services hit most recently carry the weight",
};

function initFleet(): () => void {
  const page = document.querySelector<HTMLElement>(".ex-fleet");
  if (!page) return () => {};
  const ac = new AbortController();
  const zone = page.querySelector<HTMLElement>("[data-fl-zone]");
  const grid = page.querySelector<HTMLElement>("[data-fl-grid]");
  const comps = (): HTMLElement[] => [...page.querySelectorAll<HTMLElement>(".fl-comp")];
  const incidents = [...page.querySelectorAll<HTMLElement>(".fl-inc")];
  const fieldBtn = page.querySelector<HTMLButtonElement>("[data-fl-field]");
  const weightBtns = [...page.querySelectorAll<HTMLButtonElement>("[data-fl-weight]")];
  const hint = page.querySelector<HTMLElement>("[data-fl-hint]");

  let weight: FleetWeight = "involvement";
  let fieldOn = true;
  let activeField: { destroy(): void } | null = null;

  // ── service weighting — recompute --w + data-strength, then 2D FLIP re-sort ──
  const reweight = (): void => {
    if (!grid) return;
    const all = comps();
    let wFor: (c: HTMLElement) => number;
    let order: (a: HTMLElement, b: HTMLElement) => number;
    if (weight === "involvement") {
      const maxInv = Math.max(...all.map((c) => Number(c.dataset.inv) || 0), 1);
      wFor = (c) => Math.log((Number(c.dataset.inv) || 0) + 1) / Math.log(maxInv + 1);
      order = (a, b) => (Number(b.dataset.inv) || 0) - (Number(a.dataset.inv) || 0);
    } else {
      // recency: most recently hit. Services never named in the window stay at zero.
      const lasts = all.map((c) => Number(c.dataset.last) || 0).filter(Boolean);
      const lmin = lasts.length ? Math.min(...lasts) : 0;
      const lspan = lasts.length ? Math.max(...lasts) - lmin : 0;
      wFor = (c) => {
        const t = Number(c.dataset.last) || 0;
        if (!t) return 0;
        return lspan > 0 ? (t - lmin) / lspan : 1;
      };
      order = (a, b) => (Number(b.dataset.last) || 0) - (Number(a.dataset.last) || 0);
    }
    for (const c of all) {
      const w = wFor(c);
      c.style.setProperty("--w", w.toFixed(3));
      c.dataset.strength = (0.4 + w * 1.6).toFixed(2);
    }
    const ordered = [...all].sort(order);
    const first = new Map(
      all.map((c) => {
        const r = c.getBoundingClientRect();
        return [c, { x: r.left, y: r.top }];
      }),
    );
    ordered.forEach((c) => grid.appendChild(c));
    ordered.forEach((c) => {
      if (reduceMotion()) return;
      const r = c.getBoundingClientRect();
      const f = first.get(c);
      const dx = (f?.x ?? r.left) - r.left;
      const dy = (f?.y ?? r.top) - r.top;
      if (!dx && !dy) return;
      c.style.transform = `translate(${dx}px, ${dy}px)`;
      c.style.transition = "none";
      requestAnimationFrame(() => {
        c.style.transition = "transform 0.5s cubic-bezier(.2, .7, .2, 1)";
        c.style.transform = "";
        c.addEventListener("transitionend", () => (c.style.transition = ""), { once: true });
      });
    });
  };

  // ── cross-highlight (hover) — incidents ↔ the services they named ─────────
  const clearHighlights = (): void => {
    comps().forEach((c) => c.classList.remove("lit", "cited"));
    incidents.forEach((i) => i.classList.remove("lit", "cited"));
  };
  const wireHighlights = (): void => {
    incidents.forEach((inc) => {
      inc.addEventListener(
        "pointerenter",
        () => {
          if (!fieldOn) return;
          inc.classList.add("lit");
          for (const s of (inc.dataset.comps || "").split(" ").filter(Boolean)) {
            page.querySelector<HTMLElement>(`#comp-${CSS.escape(s)}`)?.classList.add("cited");
          }
        },
        { signal: ac.signal },
      );
      inc.addEventListener("pointerleave", clearHighlights, { signal: ac.signal });
    });
    comps().forEach((c) => {
      c.addEventListener(
        "pointerenter",
        () => {
          if (!fieldOn) return;
          c.classList.add("lit");
          const name = c.dataset.name || "";
          incidents
            .filter((i) => (i.dataset.comps || "").split(" ").includes(name))
            .forEach((i) => i.classList.add("cited"));
        },
        { signal: ac.signal },
      );
      c.addEventListener("pointerleave", clearHighlights, { signal: ac.signal });
    });
  };

  // ── release the accreted updates (expand/collapse) ─────────────────────────
  const wireExpand = (): void => {
    page.querySelectorAll<HTMLButtonElement>(".fl-inc-head").forEach((head) => {
      head.addEventListener(
        "click",
        () => {
          const open = head.getAttribute("aria-expanded") !== "true";
          head.setAttribute("aria-expanded", String(open));
          const listId = head.getAttribute("aria-controls");
          const ulist = listId ? document.getElementById(listId) : null;
          if (ulist) ulist.hidden = !open;
        },
        { signal: ac.signal },
      );
    });
  };

  // ── entry sweep — load bars fill 0 → recorded width at reading pace ────────
  // IO marks which incidents are on screen; a rAF loop sweeps them only while the
  // engine's --field-scroll-v reads under SCROLL_V_MAX (an inline style on <html> —
  // cheap to read). Each bar sweeps once; the loop retires itself. Reduced motion
  // never arms the sweep, so the bars render at full width immediately.
  const wireSweep = (): void => {
    if (reduceMotion()) return;
    const list = page.querySelector<HTMLElement>("[data-fl-list]");
    if (!list || !incidents.length) return;
    list.dataset.flSweep = "";
    const pending = new Set<HTMLElement>(incidents);
    const visible = new Set<HTMLElement>();
    let raf = 0;
    const tick = (): void => {
      raf = 0;
      if (ac.signal.aborted || !pending.size) return;
      const sv =
        parseFloat(document.documentElement.style.getPropertyValue("--field-scroll-v")) || 0;
      if (sv < SCROLL_V_MAX) {
        for (const el of visible) {
          el.dataset.swept = "";
          pending.delete(el);
          io.unobserve(el);
        }
        visible.clear();
      }
      if (!pending.size) {
        io.disconnect();
        return;
      }
      if (visible.size) raf = requestAnimationFrame(tick);
    };
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const el = e.target as HTMLElement;
          if (e.isIntersecting) visible.add(el);
          else visible.delete(el);
        }
        if (visible.size && !raf) raf = requestAnimationFrame(tick);
      },
      { threshold: 0.35 },
    );
    incidents.forEach((i) => io.observe(i));
    ac.signal.addEventListener("abort", () => {
      io.disconnect();
      if (raf) cancelAnimationFrame(raf);
    });
  };

  // ── the invisible scoped field (render: []) ────────────────────────────────
  const runField = (): void => {
    activeField?.destroy();
    activeField = null;
    if (!fieldOn || !zone) return;
    try {
      const base = recipeById("evidence-field");
      if (base) {
        // render: [] — invisible; metrics gain the attention lane, so the platform
        // pipeline writes an eased --field-attention (hover/focus + viewport-center
        // proximity + visibility) back to every card.
        const recipe = {
          ...base,
          render: [] as never[],
          metrics: [...new Set([...(base.metrics ?? []), "attention"])],
        } as typeof base;
        activeField = applyRecipe(zone, recipe, {
          bodies: [...comps(), ...incidents],
          annotateBodies: false,
        });
      }
    } catch {
      /* the static --w layer stands on its own */
    }
  };

  // ── controls ────────────────────────────────────────────────────────────────
  weightBtns.forEach((b) =>
    b.addEventListener(
      "click",
      () => {
        weight = (b.dataset.flWeight as FleetWeight) || "involvement";
        page.dataset.weight = weight;
        weightBtns.forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
        if (hint) hint.innerHTML = HINTS[weight];
        reweight();
      },
      { signal: ac.signal },
    ),
  );

  fieldBtn?.addEventListener(
    "click",
    () => {
      fieldOn = !fieldOn;
      page.dataset.field = fieldOn ? "on" : "off";
      fieldBtn.setAttribute("aria-pressed", String(fieldOn));
      const txt = fieldBtn.querySelector(".ev-switch-txt");
      if (txt) txt.textContent = fieldOn ? "on" : "off";
      if (fieldOn) {
        runField();
      } else {
        activeField?.destroy();
        activeField = null;
        clearHighlights();
      }
    },
    { signal: ac.signal },
  );

  wireHighlights();
  wireExpand();
  wireSweep();
  runField();

  return () => {
    ac.abort();
    activeField?.destroy();
  };
}

let teardown: (() => void) | undefined;
function init(): void {
  teardown?.();
  teardown = document.querySelector(".ex-fleet") ? initFleet() : undefined;
}
if (document.readyState !== "loading") init();
else document.addEventListener("DOMContentLoaded", init);
document.addEventListener("astro:page-load", init);
document.addEventListener("astro:before-swap", () => {
  teardown?.();
  teardown = undefined;
});
