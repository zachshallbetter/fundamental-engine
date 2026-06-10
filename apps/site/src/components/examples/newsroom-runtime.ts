// Newsroom Field runtime. field-ui as an INVISIBLE measurement layer over one day of
// Wikipedia's most-read articles, laid out as a newspaper front page (lead / deck / index —
// placement is server-rendered from the ranking; the runtime never moves stories):
//   · Field on/off — off, the ink flattens (CSS via [data-field]) while the placement stays;
//     the scoped field is destroyed. On, the field runs and attention shows in the type.
//   · Color by trend / off — --cat encodes the day-over-day move (warm rising, cool falling,
//     neutral gray for entries with no prior-day count), or steps aside entirely.
// The scoped field runs with render: [] — particles compute (metrics flow) but are never drawn.
import { recipeById } from "@field-ui/core";
import { applyRecipe } from "@field-ui/platform";

type NewsroomLens = "trend" | "off";

// polarity ramp — must match the server-side render in newsroom.astro:
// direction is hue (warm rising, cool falling), magnitude is intensity (vs a ±60% ceiling);
// no prior count = new → neutral gray-blue, no fake direction.
const catFor = (pct: number | null): string => {
  if (pct === null) return "#8a93a6";
  const t = Math.min(1, Math.abs(pct) / 60);
  return pct >= 0
    ? `hsl(${Math.round(32 - t * 10)} ${Math.round(42 + t * 46)}% ${Math.round(56 + t * 8)}%)`
    : `hsl(${Math.round(208 + t * 12)} ${Math.round(34 + t * 46)}% ${Math.round(58 + t * 8)}%)`;
};

const LENS_HINTS: Record<NewsroomLens, string> = {
  trend: "<b>color</b> = the day-over-day move — warm rising, cool falling, gray new",
  off: "<b>color</b> = off — size and placement carry the whole signal",
};

function initNewsroom(): () => void {
  const page = document.querySelector<HTMLElement>(".ex-newsroom");
  if (!page) return () => {};
  const ac = new AbortController();
  const list = page.querySelector<HTMLElement>("[data-nw-list]");
  const rows = (): HTMLElement[] => [...page.querySelectorAll<HTMLElement>(".nw-row")];
  const fieldBtn = page.querySelector<HTMLButtonElement>("[data-nw-field]");
  const lensBtns = [...page.querySelectorAll<HTMLButtonElement>("[data-nw-lens]")];
  const lensHint = page.querySelector<HTMLElement>("[data-nw-lens-hint]");

  let lens: NewsroomLens = "trend";
  let fieldOn = true;
  let activeField: { destroy(): void } | null = null;

  // ── polarity lens — color is the move; size stays pageviews ──────────────
  const applyLens = (): void => {
    for (const r of rows()) {
      if (lens === "off") {
        r.style.setProperty("--cat", "#4da3ff");
        continue;
      }
      const v = Number(r.dataset.views) || 0;
      const prior = Number(r.dataset.prior) || 0;
      const pct = prior ? ((v - prior) / prior) * 100 : null;
      r.style.setProperty("--cat", catFor(pct));
    }
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
  lensBtns.forEach((b) =>
    b.addEventListener(
      "click",
      () => {
        lens = (b.dataset.nwLens as NewsroomLens) || "trend";
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
  teardown = document.querySelector(".ex-newsroom") ? initNewsroom() : undefined;
}
if (document.readyState !== "loading") init();
else document.addEventListener("DOMContentLoaded", init);
document.addEventListener("astro:page-load", init);
document.addEventListener("astro:before-swap", () => {
  teardown?.();
  teardown = undefined;
});
