// Memory Field runtime. Fundamental as an INVISIBLE measurement layer over Google ngrams word frequencies:
//   · elapsed days slider decays retention w = retention(a, days_eff) — the core temporal
//     kernel: a · exp(−since/τ(a)), τ = 4 + a·56 days — updating styles in real time;
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
import { DAY_MS, recipeById, retention, weightToStrength } from "@fundamental-engine/core";
import { applyRecipe } from "@fundamental-engine/dom";
import { pageRuntime } from "../../lib/page-runtime.ts";
import { persisted } from "../../lib/persisted.ts";
import { wireFieldToggle } from "../../lib/controls.ts";
import { atReadingPace } from "../../lib/reading-pace.ts";

const STAGGER_MS = 20;
const STAGGER_CAP_MS = 400;

const reduceMotion = (): boolean =>
  typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

// ── persistence — the shared persisted() slots (fui:memory-reviews / fui:memory-day, the
// same keys and JSON values the page has always written): a private window or hardened
// browser degrades to in-memory behavior, and the page keeps working — it just won't
// remember. ──
const reviewsStore = persisted<Record<string, number>>("memory-reviews", {}); // word → reviewedAtDay
const dayStore = persisted<number | null>("memory-day", null); // the slider's day

function initMemory(page: HTMLElement): () => void {
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
  const storedReviews = reviewsStore.get() as Record<string, unknown> | null;
  if (storedReviews && typeof storedReviews === "object") {
    for (const [word, day] of Object.entries(storedReviews)) {
      if (wordsOnPage.has(word) && typeof day === "number" && Number.isFinite(day))
        reviews.set(word, day);
    }
  }
  const storedDay = dayStore.get();
  if (storedDay != null) {
    const day = Math.round(Number(storedDay));
    if (Number.isFinite(day)) {
      sliderValue = Math.min(Number(slider.max) || 60, Math.max(Number(slider.min) || 0, day));
      slider.value = String(sliderValue);
      if (daysOut) daysOut.textContent = `${sliderValue}d`;
    }
  }

  const persistReviews = (): void => reviewsStore.set(Object.fromEntries(reviews));

  const updateRetention = (): void => {
    for (const card of cards) {
      const word = card.querySelector(".mx-word")?.textContent || "";
      const a = Number(card.dataset.anchor) || 0.5;
      const reviewedAt = reviews.get(word) ?? -1;
      const daysEff = reviewedAt >= 0 ? Math.max(0, sliderValue - reviewedAt) : sliderValue;
      // the core temporal kernel: w = a·exp(−since/τ(a)), τ = 4 + a·56 days — Ebbinghaus
      // with a stability term, so deep anchors decay slower. Must match memory.astro.
      const w = retention(a, daysEff * DAY_MS);

      card.style.setProperty("--w", w.toFixed(3));
      card.dataset.strength = weightToStrength(w).toFixed(2);
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
        // renderless keeps the field invisible; the extra "attention" metric asks the
        // platform pipeline to write --field-attention per card (an eased 0..1 blend of
        // engagement, viewport-center proximity, and visibility) — read by the ink CSS.
        activeField = applyRecipe(grid, base, {
          bodies: cards,
          annotateBodies: false,
          renderless: true,
          extraMetrics: ["attention"],
        });
      }
    } catch {
      /* static --w layer fallback */
    }
  };

  // ── entry: stagger the cards in once the grid is in view AND the scroll has settled
  // to reading pace (the shared atReadingPace() gate — an inline-style read, no per-frame
  // style recalc). The stagger itself stays bespoke: 20ms apart, capped at 400ms — a shape
  // armEntryAtPace doesn't carry. The pre-state only exists while the grid carries
  // data-mx-entry, so a runtime failure can never strand the cards invisible. Reduced
  // motion: no stagger at all. ─────────
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
      if (atReadingPace()) {
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
      dayStore.set(sliderValue); // the day persists alongside the reviews
      updateRetention();
    },
    { signal: ac.signal },
  );

  resetBtn?.addEventListener(
    "click",
    () => {
      reviews.clear();
      reviewsStore.clear(); // reset clears the device's memory too — both keys
      dayStore.clear();
      updateRetention();
    },
    { signal: ac.signal },
  );

  wireFieldToggle(
    fieldBtn,
    page,
    (on) => {
      fieldOn = on;
      if (fieldOn) {
        runField();
      } else {
        activeField?.destroy();
        activeField = null;
      }
    },
    ac.signal,
  );

  updateRetention();
  runField();
  wireEntry();

  return () => {
    ac.abort();
    activeField?.destroy();
  };
}

pageRuntime(".ex-memory", initMemory);
