// Market Field runtime. field-ui as an INVISIBLE measurement layer over a CoinGecko snapshot,
// laid out as a cap-weighted mosaic — mass is AREA:
//   · Field on/off — off, the mosaic collapses to an even grid (CSS via [data-field]); the scoped
//     field is destroyed. On, the field runs and cap shows in tile area and type.
//   · Weight by cap / volume — recompute each tile's --w from the chosen signal, RE-TIER (swap
//     the mk-t1..mk-t4 span class), then re-sort. Tiles whose footprint is unchanged FLIP in 2D
//     (translate(dx, dy)); re-tiered tiles settle with a fade — translate cannot honestly animate
//     a size change, and scaling tiles of live text looks worse than a settle.
//   · Move window 24h / 7d — repolarize: --cat encodes direction (hue) and magnitude (intensity).
// The scoped field runs with render: [] — particles compute (metrics flow) but are never drawn.
import { recipeById } from "@field-ui/core";
import { applyRecipe } from "@field-ui/platform";

type MarketWeight = "cap" | "volume";
type MarketLens = "24h" | "7d";

const reduceMotion = (): boolean =>
  typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

// polarity ramp — must match the server-side render in market.astro:
// direction is hue (teal-green up, red-pink down), magnitude is intensity (vs a ±10% ceiling).
const catFor = (chg: number): string => {
  const t = Math.min(1, Math.abs(chg) / 10);
  return chg >= 0
    ? `hsl(${Math.round(168 - t * 18)} ${Math.round(34 + t * 46)}% ${Math.round(52 + t * 14)}%)`
    : `hsl(${Math.round(354 - t * 14)} ${Math.round(38 + t * 47)}% ${Math.round(56 + t * 12)}%)`;
};

const HINTS: Record<MarketWeight, string> = {
  cap: "<b>area</b> = market cap — the heavier the asset, the more page it takes",
  volume: "<b>area</b> = 24h volume — where the trading actually happened",
};

// tier: the tile's grid footprint — must match tierOf() in market.astro.
const TIERS = ["mk-t1", "mk-t2", "mk-t3", "mk-t4"] as const;
const tierOf = (w: number): string => (w > 0.8 ? "mk-t1" : w > 0.55 ? "mk-t2" : w > 0.35 ? "mk-t3" : "mk-t4");
const LENS_HINTS: Record<MarketLens, string> = {
  "24h": "<b>color</b> = the 24-hour move — direction is hue, magnitude is intensity",
  "7d": "<b>color</b> = the 7-day move — the week's drift, not the day's noise",
};

function initMarket(): () => void {
  const page = document.querySelector<HTMLElement>(".ex-market");
  if (!page) return () => {};
  const ac = new AbortController();
  const list = page.querySelector<HTMLElement>("[data-mk-list]");
  const rows = (): HTMLElement[] => [...page.querySelectorAll<HTMLElement>(".mk-tile")];
  const fieldBtn = page.querySelector<HTMLButtonElement>("[data-mk-field]");
  const weightBtns = [...page.querySelectorAll<HTMLButtonElement>("[data-mk-weight]")];
  const lensBtns = [...page.querySelectorAll<HTMLButtonElement>("[data-mk-lens]")];
  const hint = page.querySelector<HTMLElement>("[data-mk-hint]");
  const lensHint = page.querySelector<HTMLElement>("[data-mk-lens-hint]");

  let weight: MarketWeight = "cap";
  let lens: MarketLens = "24h";
  let fieldOn = true;
  let activeField: { destroy(): void } | null = null;

  // ── polarity lens — color is the move; size stays the weighting signal ────
  const applyLens = (): void => {
    for (const r of rows()) {
      const chg = Number(lens === "24h" ? r.dataset.c24 : r.dataset.c7) || 0;
      r.style.setProperty("--cat", catFor(chg));
    }
  };

  // ── weighting — recompute --w + data-strength, RE-TIER, then FLIP re-sort ──
  // Tiles that keep their footprint FLIP in 2D (the mosaic moves them on both
  // axes); tiles whose tier changed settle with a fade — a translate cannot
  // honestly animate a size change.
  const reweight = (): void => {
    if (!list) return;
    const all = rows();
    const valOf = (r: HTMLElement): number =>
      Number(weight === "cap" ? r.dataset.cap : r.dataset.volume) || 0;
    const lmin = Math.log(Math.min(...all.map(valOf)) + 1);
    const lmax = Math.log(Math.max(...all.map(valOf)) + 1);
    // 0) first: where every tile sits now (top AND left — the mosaic is 2D)
    const first = new Map(all.map((r) => [r, r.getBoundingClientRect()]));
    // 1) set the new weight on every tile (drives the type + the scoped field's
    //    pull) and swap the tier class — mass is area, so reweighting resizes
    const retiered = new Set<HTMLElement>();
    for (const r of all) {
      const w = lmax > lmin ? (Math.log(valOf(r) + 1) - lmin) / (lmax - lmin) : 1;
      r.style.setProperty("--w", w.toFixed(3));
      r.dataset.strength = (0.4 + w * 1.6).toFixed(2);
      const next = tierOf(w);
      if (!r.classList.contains(next)) {
        r.classList.remove(...TIERS);
        r.classList.add(next);
        retiered.add(r);
      }
    }
    // 2) re-sort by the signal, then animate the reflow
    const ordered = [...all].sort((a, b) => valOf(b) - valOf(a));
    ordered.forEach((r) => list.appendChild(r));
    ordered.forEach((r, i) => {
      const rank = r.querySelector(".mk-rank");
      if (rank) rank.textContent = String(i + 1).padStart(2, "0");
      r.removeAttribute("data-mk-retiered");
      if (reduceMotion()) return;
      if (retiered.has(r)) {
        // restart the fade-settle (the attribute hooks the CSS animation)
        void r.offsetWidth;
        r.setAttribute("data-mk-retiered", "");
        r.addEventListener("animationend", () => r.removeAttribute("data-mk-retiered"), {
          once: true,
        });
        return;
      }
      const was = first.get(r);
      if (!was) return;
      const now = r.getBoundingClientRect();
      const dx = was.left - now.left;
      const dy = was.top - now.top;
      if (!dx && !dy) return;
      r.style.transform = `translate(${dx}px, ${dy}px)`;
      r.style.transition = "none";
      requestAnimationFrame(() => {
        r.style.transition = "transform 0.5s cubic-bezier(.2, .7, .2, 1)";
        r.style.transform = "";
        r.addEventListener("transitionend", () => (r.style.transition = ""), { once: true });
      });
    });
  };

  // ── the invisible scoped field (render: []) ───────────────────────────────
  const runField = (): void => {
    activeField?.destroy();
    activeField = null;
    if (!fieldOn || !list) return;
    try {
      const base = recipeById("evidence-field");
      if (base) {
        // render: [] — invisible; metrics gain "attention" so the platform pipeline writes
        // --field-attention (eased engagement + center proximity + visibility) per tile.
        const recipe = {
          ...base,
          render: [] as never[],
          metrics: [...new Set([...(base.metrics ?? []), "attention"])],
        };
        activeField = applyRecipe(list, recipe, { bodies: rows(), annotateBodies: false });
      }
    } catch {
      /* the static --w layer stands on its own */
    }
  };

  // ── sparkline entry draw-in — gated at reading pace ───────────────────────
  // Tiles entering the viewport get .mk-in; while the engine's live scroll
  // velocity (--field-scroll-v, px/frame) says the user is scanning (>= 2),
  // .mk-in-instant is added too, so the path is simply there instead of drawing.
  const SCROLL_V_MAX = 2.0;
  const wireSparkDraw = (): void => {
    if (!list) return;
    list.setAttribute("data-mk-anim", "");
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const tile = e.target as HTMLElement;
          // --field-scroll-v is an inline style on <html> (written by the engine), so
          // reading el.style avoids a forced style recalc.
          const sv =
            parseFloat(document.documentElement.style.getPropertyValue("--field-scroll-v")) || 0;
          if (sv >= SCROLL_V_MAX || reduceMotion()) tile.classList.add("mk-in", "mk-in-instant");
          else tile.classList.add("mk-in");
          io.unobserve(tile);
        }
      },
      { threshold: 0.15 },
    );
    rows().forEach((t) => io.observe(t));
    ac.signal.addEventListener("abort", () => io.disconnect());
  };

  // ── controls ───────────────────────────────────────────────────────────────
  weightBtns.forEach((b) =>
    b.addEventListener(
      "click",
      () => {
        weight = (b.dataset.mkWeight as MarketWeight) || "cap";
        page.dataset.weight = weight;
        weightBtns.forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
        if (hint) hint.innerHTML = HINTS[weight];
        reweight();
      },
      { signal: ac.signal },
    ),
  );

  lensBtns.forEach((b) =>
    b.addEventListener(
      "click",
      () => {
        lens = (b.dataset.mkLens as MarketLens) || "24h";
        page.dataset.lens = lens;
        lensBtns.forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
        if (lensHint) lensHint.innerHTML = LENS_HINTS[lens];
        applyLens();
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
      }
    },
    { signal: ac.signal },
  );

  applyLens();
  runField();
  wireSparkDraw();

  return () => {
    ac.abort();
    activeField?.destroy();
  };
}

let teardown: (() => void) | undefined;
function init(): void {
  teardown?.();
  teardown = document.querySelector(".ex-market") ? initMarket() : undefined;
}
if (document.readyState !== "loading") init();
else document.addEventListener("DOMContentLoaded", init);
document.addEventListener("astro:page-load", init);
document.addEventListener("astro:before-swap", () => {
  teardown?.();
  teardown = undefined;
});
