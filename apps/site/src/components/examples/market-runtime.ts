// Market Field runtime. field-ui as an INVISIBLE measurement layer over a CoinGecko snapshot:
//   · Field on/off — off, the page collapses to a plain table (CSS via [data-field]); the scoped
//     field is destroyed. On, the field runs and cap shows in the type.
//   · Weight by cap / volume — recompute each row's --w from the chosen signal, then re-sort
//     with a FLIP reflow so you watch the field re-settle.
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
  cap: "<b>size</b> = market cap — the heavier the asset, the harder it anchors",
  volume: "<b>size</b> = 24h volume — where the trading actually happened",
};
const LENS_HINTS: Record<MarketLens, string> = {
  "24h": "<b>color</b> = the 24-hour move — direction is hue, magnitude is intensity",
  "7d": "<b>color</b> = the 7-day move — the week's drift, not the day's noise",
};

function initMarket(): () => void {
  const page = document.querySelector<HTMLElement>(".ex-market");
  if (!page) return () => {};
  const ac = new AbortController();
  const list = page.querySelector<HTMLElement>("[data-mk-list]");
  const rows = (): HTMLElement[] => [...page.querySelectorAll<HTMLElement>(".mk-row")];
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

  // ── weighting — recompute --w + data-strength, then FLIP re-sort ──────────
  const reweight = (): void => {
    if (!list) return;
    const all = rows();
    const valOf = (r: HTMLElement): number =>
      Number(weight === "cap" ? r.dataset.cap : r.dataset.volume) || 0;
    const lmin = Math.log(Math.min(...all.map(valOf)) + 1);
    const lmax = Math.log(Math.max(...all.map(valOf)) + 1);
    // 1) set the new weight on every row (drives the type + the scoped field's pull)
    for (const r of all) {
      const w = lmax > lmin ? (Math.log(valOf(r) + 1) - lmin) / (lmax - lmin) : 1;
      r.style.setProperty("--w", w.toFixed(3));
      r.dataset.strength = (0.4 + w * 1.6).toFixed(2);
    }
    // 2) re-sort by the signal, FLIP-animating the reflow
    const ordered = [...all].sort((a, b) => valOf(b) - valOf(a));
    const firstTop = new Map(all.map((r) => [r, r.getBoundingClientRect().top]));
    ordered.forEach((r) => list.appendChild(r));
    ordered.forEach((r, i) => {
      const rank = r.querySelector(".mk-rank");
      if (rank) rank.textContent = String(i + 1).padStart(2, "0");
      if (reduceMotion()) return;
      const dy = (firstTop.get(r) ?? 0) - r.getBoundingClientRect().top;
      if (!dy) return;
      r.style.transform = `translateY(${dy}px)`;
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
        const recipe = { ...base, render: [] as never[] };
        activeField = applyRecipe(list, recipe, { bodies: rows(), annotateBodies: false });
      }
    } catch {
      /* the static --w layer stands on its own */
    }
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
