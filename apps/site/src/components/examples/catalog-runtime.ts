// Catalog Field runtime. field-ui as an INVISIBLE measurement layer over a real Open Library shelf:
//   · Weight by consensus / anticipation / longevity — recompute each book's mass from the chosen
//     count (the same log-normalized formula as /evidence), then FLIP re-sort the grid.
//   · Color by subject / off — the first-subject palette lens, or a single accent.
//   · shared-shelf affinity — hover or focus a book and every shelf-mate sharing ANY subject
//     lights up (.cited); the strongest shared subject floats beside the card as a chip.
//   · Field on/off — off, the page collapses to a plain grid and the scoped field is destroyed.
// The scoped field runs with render: [] — bodies compute (metrics flow) but nothing is drawn.
import { recipeById } from "@field-ui/core";
import { applyRecipe } from "@field-ui/platform";

type Signal = "consensus" | "anticipation" | "longevity";
type Lens = "subject" | "off";

const reduceMotion = () =>
  typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

const HINTS: Record<Signal, string> = {
  consensus: "<b>size</b> = ratings — the evidence trust math, retargeted at the shelf",
  anticipation: "<b>size</b> = want-to-read — forward demand on the shelf",
  longevity: "<b>size</b> = editions — how many times the world reprinted it",
};
const LENS_HINTS: Record<Lens, string> = {
  subject: "<b>color</b> = first subject — the shelf each book sits on",
  off: "<b>color</b> = off — size carries the whole signal",
};

function initCatalog(): () => void {
  const page = document.querySelector<HTMLElement>(".ex-catalog");
  if (!page) return () => {};
  const ac = new AbortController();
  const grid = page.querySelector<HTMLElement>("[data-cat-grid]");
  const fieldBtn = page.querySelector<HTMLButtonElement>("[data-cat-field]");
  const weightBtns = [...page.querySelectorAll<HTMLButtonElement>("[data-cat-weight]")];
  const lensBtns = [...page.querySelectorAll<HTMLButtonElement>("[data-cat-lens]")];
  const hint = page.querySelector<HTMLElement>("[data-cat-hint]");
  const lensHint = page.querySelector<HTMLElement>("[data-cat-lens-hint]");
  if (!grid) return () => {};

  const cells = [...grid.querySelectorAll<HTMLElement>(".cat-cell")];
  const cards = [...grid.querySelectorAll<HTMLElement>(".cat-card")];
  let signal: Signal = (page.dataset.weight as Signal) || "consensus";
  let lens: Lens = (page.dataset.lens as Lens) || "subject";
  let fieldOn = page.dataset.field !== "off";
  let activeField: { destroy(): void } | null = null;

  // subjects parsed once per card — original casing for the chip, normalized for matching.
  const norm = (s: string): string => s.trim().toLowerCase();
  const subjectsOf = new Map(
    cards.map((c) => [c, (c.dataset.subjects || "").split("|").filter(Boolean)]),
  );
  const normSetOf = new Map(
    cards.map((c) => [c, new Set((subjectsOf.get(c) || []).map(norm))]),
  );

  // ── weighting — the evidence formula, retargeted ─────────────────────────
  const weightOf = (
    card: HTMLElement,
    s: Signal,
    st: { rmax: number; wmax: number; emax: number },
  ): number => {
    const ratings = Number(card.dataset.ratings) || 0;
    const want = Number(card.dataset.want) || 0;
    const editions = Number(card.dataset.editions) || 0;
    if (s === "consensus") return Math.log(ratings + 1) / st.rmax; // IDENTICAL to /evidence
    if (s === "anticipation") return Math.log(want + 1) / st.wmax;
    return Math.log(editions + 1) / st.emax;
  };

  const reweight = (): void => {
    const st = {
      rmax: Math.log(Math.max(...cards.map((c) => Number(c.dataset.ratings) || 0), 1) + 1),
      wmax: Math.log(Math.max(...cards.map((c) => Number(c.dataset.want) || 0), 1) + 1),
      emax: Math.log(Math.max(...cards.map((c) => Number(c.dataset.editions) || 0), 1) + 1),
    };
    // 1) set the new weight on every book (drives --w + the scoped field's pull)
    for (const card of cards) {
      const w = weightOf(card, signal, st);
      card.style.setProperty("--w", w.toFixed(3));
      card.dataset.strength = (0.4 + w * 1.6).toFixed(2);
    }
    // 2) re-sort the grid cells by weight, FLIP-animating the reflow (both axes)
    const wOf = (cell: HTMLElement): number =>
      Number(cell.querySelector<HTMLElement>(".cat-card")?.style.getPropertyValue("--w")) || 0;
    const ordered = [...cells].sort((a, b) => wOf(b) - wOf(a));
    const first = new Map(cells.map((c) => [c, c.getBoundingClientRect()]));
    ordered.forEach((c) => grid.appendChild(c));
    ordered.forEach((c, i) => {
      const rank = c.querySelector(".cat-rank");
      if (rank) rank.textContent = String(i + 1).padStart(2, "0");
      if (reduceMotion()) return;
      const was = first.get(c);
      if (!was) return;
      const now = c.getBoundingClientRect();
      const dx = was.left - now.left;
      const dy = was.top - now.top;
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

  // ── color lens — subject palette, or a single accent (size carries it all) ──
  const applyLens = (): void => {
    if (lens === "subject") {
      cards.forEach((c) => c.style.setProperty("--cat", c.dataset.subjectColor || "#4da3ff"));
    } else {
      cards.forEach((c) => c.style.setProperty("--cat", "#4da3ff"));
    }
  };

  // ── the invisible scoped field (render: []) ──────────────────────────────
  const runField = (): void => {
    activeField?.destroy();
    activeField = null;
    if (!fieldOn) return;
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
        activeField = applyRecipe(grid, recipe, { bodies: cards, annotateBodies: false });
      }
    } catch {
      /* the static --w layer stands on its own */
    }
  };

  // ── shared-shelf affinity (hover + focus) ────────────────────────────────
  let chip: HTMLElement | null = null;
  let chipRaf = 0;

  const clearAffinity = (): void => {
    cancelAnimationFrame(chipRaf);
    chipRaf = 0;
    cards.forEach((c) => c.classList.remove("lit", "cited"));
    chip?.remove();
    chip = null;
  };

  const showAffinity = (card: HTMLElement): void => {
    if (!fieldOn) return;
    clearAffinity();
    card.classList.add("lit");
    const mine = subjectsOf.get(card) || [];
    const mineNorm = normSetOf.get(card) || new Set<string>();
    // count, per shared subject, how many OTHER books carry it; light each shelf-mate.
    const counts = new Map<string, number>();
    for (const other of cards) {
      if (other === card) continue;
      let shares = false;
      for (const n of normSetOf.get(other) || []) {
        if (!mineNorm.has(n)) continue;
        shares = true;
        counts.set(n, (counts.get(n) || 0) + 1);
      }
      if (shares) other.classList.add("cited");
    }
    // the chip names the strongest shared subject — the one this book shares most widely.
    let best: string | null = null;
    let bestN = 0;
    for (const [n, c] of counts) {
      if (c > bestN) {
        best = n;
        bestN = c;
      }
    }
    if (!best || !bestN) return;
    const label = (mine.find((s) => norm(s) === best) || best).toLowerCase();
    chip = document.createElement("span");
    chip.className = "cat-chip";
    chip.textContent = `also: ${label} ×${bestN}`;
    grid.appendChild(chip);
    const cell = card.closest<HTMLElement>(".cat-cell") || card;
    chip.style.left = `${cell.offsetLeft + 8}px`;
    chip.style.top = `${cell.offsetTop - 6}px`;
    // the chip floats outside the card, so it can't inherit the card's live density:
    // mirror the hovered card's --d (an inline style the engine writes every frame)
    // onto the chip as --live while the hover holds — the border charges with it.
    const followLive = (): void => {
      chip?.style.setProperty("--live", card.style.getPropertyValue("--d") || "0");
      chipRaf = requestAnimationFrame(followLive);
    };
    followLive();
  };

  cards.forEach((c) => {
    c.addEventListener("pointerenter", () => showAffinity(c), { signal: ac.signal });
    c.addEventListener("pointerleave", clearAffinity, { signal: ac.signal });
    // focus does not bubble, so this fires only when the card itself is tabbed to.
    c.addEventListener("focus", () => showAffinity(c), { signal: ac.signal });
    c.addEventListener("blur", clearAffinity, { signal: ac.signal });
  });

  // ── controls ─────────────────────────────────────────────────────────────
  weightBtns.forEach((b) =>
    b.addEventListener(
      "click",
      () => {
        signal = (b.dataset.catWeight as Signal) || "consensus";
        page.dataset.weight = signal;
        weightBtns.forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
        if (hint) hint.innerHTML = HINTS[signal];
        clearAffinity();
        reweight();
      },
      { signal: ac.signal },
    ),
  );

  lensBtns.forEach((b) =>
    b.addEventListener(
      "click",
      () => {
        lens = (b.dataset.catLens as Lens) || "subject";
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
        clearAffinity();
      }
    },
    { signal: ac.signal },
  );

  reweight();
  applyLens();
  runField();

  return () => {
    ac.abort();
    clearAffinity();
    activeField?.destroy();
  };
}

let teardown: (() => void) | undefined;
function init(): void {
  teardown?.();
  teardown = document.querySelector(".ex-catalog") ? initCatalog() : undefined;
}
if (document.readyState !== "loading") init();
else document.addEventListener("DOMContentLoaded", init);
document.addEventListener("astro:page-load", init);
document.addEventListener("astro:before-swap", () => {
  teardown?.();
  teardown = undefined;
});
