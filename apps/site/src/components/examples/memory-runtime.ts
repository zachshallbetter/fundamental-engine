// Memory Field runtime. field-ui as an INVISIBLE measurement layer over Google ngrams word frequencies:
//   · elapsed days slider decays retention w = a · exp(-days_eff / tau), updating styles in real time;
//   · click a card to REVIEW it (w springs back to anchor a, and decays relative to review time);
//   · Field on/off — off, the page collapses to a plain grid and the scoped field is destroyed.
// The scoped field runs with render: [] — bodies compute (metrics flow) but nothing is drawn.
import { recipeById } from "@field-ui/core";
import { applyRecipe } from "@field-ui/platform";

function initMemory(): () => void {
  const page = document.querySelector<HTMLElement>(".ex-memory");
  if (!page) return () => {};
  const ac = new AbortController();
  const grid = page.querySelector<HTMLElement>("[data-mx-grid]");
  const fieldBtn = page.querySelector<HTMLButtonElement>("[data-mx-field]");
  const slider = page.querySelector<HTMLInputElement>("[data-mx-days-input]");
  const daysOut = page.querySelector<HTMLElement>("[data-mx-days-out]");
  const resetBtn = page.querySelector<HTMLButtonElement>("[data-mx-reset]");
  if (!grid || !slider) return () => {};

  const cards = [...grid.querySelectorAll<HTMLElement>(".mx-card")];
  let fieldOn = page.dataset.field !== "off";
  let sliderValue = Number(slider.value) || 7;
  const reviews = new Map<string, number>();
  let activeField: { destroy(): void } | null = null;

  const updateRetention = (): void => {
    for (const card of cards) {
      const word = card.querySelector(".mx-word")?.textContent || "";
      const a = Number(card.dataset.anchor) || 0.5;
      const tau = 4 + a * 56;
      const reviewedAt = reviews.get(word) ?? -1;
      const daysEff = reviewedAt >= 0 ? Math.max(0, sliderValue - reviewedAt) : sliderValue;
      const w = a * Math.exp(-daysEff / tau);

      card.style.setProperty("--w", w.toFixed(3));
      card.dataset.strength = (0.4 + w * 1.6).toFixed(2);
      if (reviewedAt >= 0) {
        card.setAttribute("data-reviewed", "");
      } else {
        card.removeAttribute("data-reviewed");
      }
    }
  };

  const runField = (): void => {
    activeField?.destroy();
    activeField = null;
    if (!fieldOn || !grid) return;
    try {
      const base = recipeById("evidence-field");
      if (base) {
        const recipe = { ...base, render: [] as never[] };
        activeField = applyRecipe(grid, recipe, { bodies: cards, annotateBodies: false });
      }
    } catch {
      /* static --w layer fallback */
    }
  };

  // ── review: click card to spring back ──────────────────────────────────────
  grid.addEventListener(
    "click",
    (e) => {
      if (!fieldOn) return;
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>(".mx-card");
      if (!btn || !grid.contains(btn)) return;
      const word = btn.querySelector(".mx-word")?.textContent || "";
      reviews.set(word, sliderValue);
      updateRetention();
    },
    { signal: ac.signal },
  );

  // ── controls ───────────────────────────────────────────────────────────────
  slider.addEventListener(
    "input",
    () => {
      sliderValue = Number(slider.value);
      if (daysOut) daysOut.textContent = `${sliderValue}d`;
      updateRetention();
    },
    { signal: ac.signal },
  );

  resetBtn?.addEventListener(
    "click",
    () => {
      reviews.clear();
      updateRetention();
    },
    { signal: ac.signal },
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

  updateRetention();
  runField();

  return () => {
    ac.abort();
    activeField?.destroy();
  };
}

let teardown: (() => void) | undefined;
function init(): void {
  teardown?.();
  teardown = document.querySelector(".ex-memory") ? initMemory() : undefined;
}
if (document.readyState !== "loading") init();
else document.addEventListener("DOMContentLoaded", init);
document.addEventListener("astro:page-load", init);
document.addEventListener("astro:before-swap", () => {
  teardown?.();
  teardown = undefined;
});
