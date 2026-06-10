// Threads Field runtime. field-ui as an INVISIBLE measurement layer over one real Hacker
// News discussion, with the reply tree as a BINDING structure:
//   · every comment's mass is server-computed (log-normalized subtree size, carried as --w
//     and data-strength); the runtime never reweights — a thread's shape is fixed history;
//   · hover or focus a comment → its full ANCESTOR CHAIN (a parent-id walk up to the story)
//     plus its direct replies light: .lit on self, .cited on the chain;
//   · heat lens (tempo / off) recolors --cat from data-tempo — how fast each comment landed
//     after its parent;
//   · click a comment to expand its clamped text (aria-expanded on the row);
//   · Field on/off — off, the page collapses to a plain tree (CSS via [data-field]) and the
//     scoped field is destroyed.
// The scoped field runs with render: [] — bodies compute (metrics flow) but nothing is drawn.
import { recipeById } from "@field-ui/core";
import { applyRecipe } from "@field-ui/platform";

type ThLens = "tempo" | "off";

const HINTS: Record<ThLens, string> = {
  tempo:
    "<b>color</b> = tempo — warm replies landed within minutes of their parent, cool ones took hours",
  off: "<b>color</b> = off — a single accent; size carries the whole signal",
};

function initThreads(): () => void {
  const page = document.querySelector<HTMLElement>(".ex-threads");
  if (!page) return () => {};
  const ac = new AbortController();
  const list = page.querySelector<HTMLElement>("[data-th-list]");
  const fieldBtn = page.querySelector<HTMLButtonElement>("[data-th-field]");
  const lensBtns = [...page.querySelectorAll<HTMLButtonElement>("[data-th-lens]")];
  const hint = page.querySelector<HTMLElement>("[data-th-hint]");
  if (!list) return () => {};

  let lens: ThLens = (page.dataset.lens as ThLens) || "tempo";
  let fieldOn = true;
  let activeField: { destroy(): void } | null = null;

  const rows = [...list.querySelectorAll<HTMLElement>(".th-c")];
  const byId = new Map(rows.map((r) => [r.dataset.id ?? "", r]));
  const kids = new Map<string, HTMLElement[]>();
  for (const r of rows) {
    const p = r.dataset.parent ?? "";
    if (!kids.has(p)) kids.set(p, []);
    kids.get(p)!.push(r);
  }

  // ── the binding chain: self → .lit; ancestors (up to the story) + direct replies → .cited ──
  const clearChain = (): void => rows.forEach((r) => r.classList.remove("lit", "cited"));
  const lightChain = (row: HTMLElement): void => {
    if (!fieldOn) return;
    clearChain();
    row.classList.add("lit");
    let p = byId.get(row.dataset.parent ?? "");
    while (p) {
      p.classList.add("cited");
      p = byId.get(p.dataset.parent ?? "");
    }
    for (const kid of kids.get(row.dataset.id ?? "") ?? []) kid.classList.add("cited");
  };
  rows.forEach((r) => {
    r.addEventListener("pointerenter", () => lightChain(r), { signal: ac.signal });
    r.addEventListener("pointerleave", clearChain, { signal: ac.signal });
    r.addEventListener("focusin", () => lightChain(r), { signal: ac.signal });
    r.addEventListener("focusout", clearChain, { signal: ac.signal });
  });

  // ── expand/collapse the clamped text (works with the field off — it's content) ───────────
  const toggle = (row: HTMLElement): void =>
    row.setAttribute("aria-expanded", String(row.getAttribute("aria-expanded") !== "true"));
  list.addEventListener(
    "click",
    (e) => {
      const t = e.target as HTMLElement;
      if (t.closest("a")) return;
      const row = t.closest<HTMLElement>(".th-c");
      if (row && list.contains(row)) toggle(row);
    },
    { signal: ac.signal },
  );
  list.addEventListener(
    "keydown",
    (e) => {
      if (e.key !== "Enter") return;
      const row = e.target as HTMLElement;
      if (row.classList?.contains("th-c")) toggle(row);
    },
    { signal: ac.signal },
  );

  // ── heat lens — recolor only; the tree's order and mass are fixed history ────────────────
  const applyLens = (): void => {
    if (lens === "tempo") {
      rows.forEach((r) => {
        const t = Number(r.dataset.tempo) || 0;
        r.style.setProperty("--cat", `hsl(${Math.round(205 - t * 180)} 74% 64%)`);
      });
    } else {
      rows.forEach((r) => r.style.setProperty("--cat", "#60a5fa"));
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
        const recipe = { ...base, render: [] as never[] };
        activeField = applyRecipe(list, recipe, { bodies: rows, annotateBodies: false });
      }
    } catch {
      /* the static --w layer stands on its own */
    }
  };

  // ── controls ─────────────────────────────────────────────────────────────
  lensBtns.forEach((b) =>
    b.addEventListener(
      "click",
      () => {
        lens = (b.dataset.thLens as ThLens) || "tempo";
        page.dataset.lens = lens;
        lensBtns.forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
        if (hint) hint.innerHTML = HINTS[lens];
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
        clearChain();
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
  teardown = document.querySelector(".ex-threads") ? initThreads() : undefined;
}
if (document.readyState !== "loading") init();
else document.addEventListener("DOMContentLoaded", init);
document.addEventListener("astro:page-load", init);
document.addEventListener("astro:before-swap", () => {
  teardown?.();
  teardown = undefined;
});
