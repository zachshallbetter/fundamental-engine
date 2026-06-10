// Memory Field runtime. field-ui as an INVISIBLE measurement layer over Google ngrams word frequencies:
//   · elapsed days slider decays retention w = a · exp(-days_eff / tau), updating styles in real time;
//   · click a card to REVIEW it (w springs back to anchor a, and decays relative to review time);
//   · reviews PERSIST on this device: the word → reviewedAtDay map mirrors to localStorage
//     ("fui:memory-reviews") on every review and restores on init (only for words present on
//     the page); the slider's day persists too ("fui:memory-day") and the initial decay renders
//     from it. "reset reviews" clears the map and both keys. Storage failures (private windows,
//     hardened browsers) are swallowed — the page simply doesn't remember;
//   · entry: the cards stagger in (.mem-in, 20ms apart, capped at 400ms) once the grid is in view
//     AND --field-scroll-v reads reading pace (< 2 px/frame) — skipped under reduced motion;
//   · Field on/off — off, the page collapses to a plain grid and the scoped field is destroyed.
// The scoped field runs with render: [] plus the "attention" metric, so the platform pipeline
// writes --field-attention per card — the ink CSS reads it alongside the engine's live --d.
import { recipeById } from "@field-ui/core";
import { applyRecipe } from "@field-ui/platform";

const SCROLL_V_MAX = 2; // px/frame — same reading-pace gate EvidenceRuntime's reveal uses
const STAGGER_MS = 20;
const STAGGER_CAP_MS = 400;

const reduceMotion = (): boolean =>
  typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

// ── persistence — localStorage, guarded: a private window or hardened browser may
// throw on any access, and the page must keep working (it just won't remember). ──
const REVIEWS_KEY = "fui:memory-reviews"; // JSON object: word → reviewedAtDay
const DAY_KEY = "fui:memory-day"; // the slider's day

const storeRead = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const storeWrite = (key: string, value: string): void => {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* full / denied — the session still works, it just won't persist */
  }
};
const storeDrop = (key: string): void => {
  try {
    localStorage.removeItem(key);
  } catch {
    /* nothing to clear */
  }
};

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

  // restore persisted reviews — only for words actually present on the page — and the
  // persisted slider day (clamped to the slider's range, reflected in label + render).
  const wordsOnPage = new Set(
    cards.map((card) => card.querySelector(".mx-word")?.textContent || ""),
  );
  const storedReviews = storeRead(REVIEWS_KEY);
  if (storedReviews) {
    try {
      const parsed = JSON.parse(storedReviews) as Record<string, unknown>;
      for (const [word, day] of Object.entries(parsed)) {
        if (wordsOnPage.has(word) && typeof day === "number" && Number.isFinite(day))
          reviews.set(word, day);
      }
    } catch {
      /* corrupt entry — start fresh */
    }
  }
  const storedDay = storeRead(DAY_KEY);
  if (storedDay != null) {
    const day = Math.round(Number(storedDay));
    if (Number.isFinite(day)) {
      sliderValue = Math.min(Number(slider.max) || 60, Math.max(Number(slider.min) || 0, day));
      slider.value = String(sliderValue);
      if (daysOut) daysOut.textContent = `${sliderValue}d`;
    }
  }

  const persistReviews = (): void =>
    storeWrite(REVIEWS_KEY, JSON.stringify(Object.fromEntries(reviews)));

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
        // render: [] keeps the field invisible; the extra "attention" metric asks the
        // platform pipeline to write --field-attention per card (an eased 0..1 blend of
        // engagement, viewport-center proximity, and visibility) — read by the ink CSS.
        const recipe = {
          ...base,
          render: [] as never[],
          metrics: [...new Set([...(base.metrics ?? []), "attention"])],
        } as typeof base;
        activeField = applyRecipe(grid, recipe, { bodies: cards, annotateBodies: false });
      }
    } catch {
      /* static --w layer fallback */
    }
  };

  // ── entry: stagger the cards in once the grid is in view AND the scroll has settled
  // to reading pace. --field-scroll-v is the engine's live scroll velocity, written to
  // the <html> inline style — reading el.style avoids a per-frame style recalc. The
  // pre-state only exists while the grid carries data-mx-entry, so a runtime failure
  // can never strand the cards invisible. Reduced motion: no stagger at all. ─────────
  const wireEntry = (): void => {
    if (reduceMotion()) return;
    grid.setAttribute("data-mx-entry", "");
    const timers: number[] = [];
    let raf = 0;
    const start = (): void => {
      cards.forEach((card, i) => {
        timers.push(
          window.setTimeout(
            () => card.classList.add("mem-in"),
            Math.min(i * STAGGER_MS, STAGGER_CAP_MS),
          ),
        );
      });
      // once the last card has settled, hand authority back to the base rules.
      timers.push(
        window.setTimeout(
          () => {
            grid.removeAttribute("data-mx-entry");
            cards.forEach((card) => card.classList.remove("mem-in"));
          },
          Math.min(cards.length * STAGGER_MS, STAGGER_CAP_MS) + 450,
        ),
      );
    };
    const tick = (): void => {
      if (ac.signal.aborted) return;
      const sv =
        parseFloat(document.documentElement.style.getPropertyValue("--field-scroll-v")) || 0;
      if (sv < SCROLL_V_MAX) {
        start();
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    let seen = false;
    const io = new IntersectionObserver(
      (entries) => {
        if (seen || !entries.some((e) => e.isIntersecting)) return;
        seen = true;
        io.disconnect();
        raf = requestAnimationFrame(tick);
      },
      { threshold: 0.08 },
    );
    io.observe(grid);
    ac.signal.addEventListener("abort", () => {
      io.disconnect();
      cancelAnimationFrame(raf);
      timers.forEach((t) => clearTimeout(t));
      grid.removeAttribute("data-mx-entry");
    });
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
      persistReviews(); // every review mirrors to this device's storage
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
      storeWrite(DAY_KEY, String(sliderValue)); // the day persists alongside the reviews
      updateRetention();
    },
    { signal: ac.signal },
  );

  resetBtn?.addEventListener(
    "click",
    () => {
      reviews.clear();
      storeDrop(REVIEWS_KEY); // reset clears the device's memory too — both keys
      storeDrop(DAY_KEY);
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
  wireEntry();

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
