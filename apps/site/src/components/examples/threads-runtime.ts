// Threads Field runtime. field-ui as an INVISIBLE measurement layer over one real Hacker
// News discussion, with the reply tree as a BINDING structure:
//   · every comment's mass is server-computed (log-normalized subtree size, carried as --w
//     and data-strength); the runtime never reweights — a thread's shape is fixed history;
//   · hover or focus a comment → its full ANCESTOR CHAIN (a parent-id walk up to the story)
//     plus its direct replies light: .lit on self, .cited on the chain. While a comment is
//     lit, its live --d (the engine's local density, gathered by data-hot) is mirrored onto
//     the list as --chain — the connectors' ink reads it, so the chain literally charges;
//   · heat lens (tempo / off) recolors --cat from data-tempo — how fast each comment landed
//     after its parent;
//   · click a comment to expand its clamped text (aria-expanded on the row);
//   · subtree COLLAPSE — every comment with replies carries a caret (a real button:
//     Enter/Space toggle, aria-expanded tracks state). Collapsing hides the comment's whole
//     subtree (a comment hides iff ANY ancestor is collapsed — the same parent-id walk as
//     the chain, run downward) and shows a "+N replies hidden" chip (N = the subtree size,
//     server-computed as data-subtree). After every toggle the scoped field is destroyed and
//     re-applied over the VISIBLE bodies only — collapsed comments leave the field, not just
//     the page. "Collapse all / expand all" do the same in bulk over top-level comments;
//   · Field on/off — off, the page collapses to a plain tree (CSS via [data-field]) and the
//     scoped field is destroyed.
// The scoped field runs with render: [] — bodies compute (metrics flow) but nothing is drawn.
import { recipeById } from "@fundamental-engine/core";
import { applyRecipe } from "@fundamental-engine/platform";
import { pageRuntime } from "../../lib/page-runtime.ts";
import { wireSegments, wireFieldToggle } from "../../lib/controls.ts";

type ThLens = "tempo" | "off";

const HINTS: Record<ThLens, string> = {
  tempo:
    "<b>color</b> = tempo — warm replies landed within minutes of their parent, cool ones took hours",
  off: "<b>color</b> = off — a single accent; size carries the whole signal",
};

function initThreads(page: HTMLElement): () => void {
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
  // the field (and the lenses) only ever see what's on the page
  const visibleRows = (): HTMLElement[] => rows.filter((r) => !r.hidden);

  // ── the chain charge: while a comment is lit, mirror its live --d (engine-written
  // inline, so reading row.style costs no style recalc) onto the list as --chain. The
  // connector CSS reads it — the hovered comment's gathered density lights the chain. ──
  let chainRaf = 0;
  const dischargeChain = (): void => {
    cancelAnimationFrame(chainRaf);
    chainRaf = 0;
    list.style.removeProperty("--chain");
  };
  const chargeChain = (row: HTMLElement): void => {
    cancelAnimationFrame(chainRaf);
    const step = (): void => {
      list.style.setProperty("--chain", row.style.getPropertyValue("--d") || "0");
      chainRaf = requestAnimationFrame(step);
    };
    chainRaf = requestAnimationFrame(step);
  };

  // ── the binding chain: self → .lit; ancestors (up to the story) + direct replies → .cited ──
  const clearChain = (): void => {
    rows.forEach((r) => r.classList.remove("lit", "cited"));
    dischargeChain();
  };
  const lightChain = (row: HTMLElement): void => {
    if (!fieldOn) return;
    clearChain();
    row.classList.add("lit");
    chargeChain(row);
    let p = byId.get(row.dataset.parent ?? "");
    while (p) {
      p.classList.add("cited");
      p = byId.get(p.dataset.parent ?? "");
    }
    // collapsed-away replies are skipped — the chain lights only what's on the page
    for (const kid of kids.get(row.dataset.id ?? "") ?? []) {
      if (!kid.hidden) kid.classList.add("cited");
    }
  };
  rows.forEach((r) => {
    r.addEventListener("pointerenter", () => lightChain(r), { signal: ac.signal });
    r.addEventListener("pointerleave", clearChain, { signal: ac.signal });
    r.addEventListener("focusin", () => lightChain(r), { signal: ac.signal });
    r.addEventListener("focusout", clearChain, { signal: ac.signal });
  });

  // ── subtree collapse — hide the descendants, then re-run the field over the rest ─────────
  // State lives on the row as [data-collapsed]; visibility is derived from it in one pass:
  // a comment hides iff ANY ancestor on its parent chain is collapsed (so nested collapses
  // survive an outer expand). The engine prunes hidden elements on its own, but we are
  // explicit: every toggle destroys and re-applies the scoped field over visibleRows() —
  // the same rebuild the field on/off switch uses. Works with the field off; it's content.
  const setCollapsed = (row: HTMLElement, collapsed: boolean): void => {
    if (collapsed) row.dataset.collapsed = "";
    else delete row.dataset.collapsed;
    const n = Number(row.dataset.subtree) || 0;
    const caret = row.querySelector<HTMLButtonElement>(".th-caret");
    if (caret) {
      caret.setAttribute("aria-expanded", String(!collapsed));
      caret.setAttribute(
        "aria-label",
        `${collapsed ? "Expand" : "Collapse"} ${n} ${n === 1 ? "reply" : "replies"}`,
      );
    }
    const chip = row.querySelector<HTMLElement>(".th-hidden-n");
    if (chip) chip.hidden = !collapsed;
  };
  const syncVisibility = (): void => {
    for (const r of rows) {
      let hide = false;
      let p = byId.get(r.dataset.parent ?? "");
      while (p && !(hide = p.dataset.collapsed != null)) p = byId.get(p.dataset.parent ?? "");
      r.hidden = hide;
    }
  };
  const afterCollapse = (): void => {
    syncVisibility();
    clearChain(); // a hidden comment must not keep .lit/.cited or hold the charge loop
    applyLens(); // rows revealed mid-lens pick up the current --cat
    runField(); // re-bind: the field runs over the visible bodies only
  };
  const wireCollapse = (): void => {
    page.querySelectorAll<HTMLButtonElement>(".th-caret").forEach((caret) => {
      caret.addEventListener(
        "click",
        (e) => {
          e.stopPropagation(); // the row's click handler expands clamped text — not this
          const row = caret.closest<HTMLElement>(".th-c");
          if (!row) return;
          setCollapsed(row, row.dataset.collapsed == null);
          afterCollapse();
        },
        { signal: ac.signal },
      );
    });
    page.querySelectorAll<HTMLButtonElement>("[data-th-all]").forEach((btn) => {
      btn.addEventListener(
        "click",
        () => {
          if (btn.dataset.thAll === "collapse") {
            // top-level comments are the reading workflow; nested state is wiped with them
            for (const r of rows) {
              if (r.dataset.collapsed != null) setCollapsed(r, false);
            }
            for (const r of rows) {
              if (r.dataset.top != null && (Number(r.dataset.subtree) || 0) > 0)
                setCollapsed(r, true);
            }
          } else {
            for (const r of rows) {
              if (r.dataset.collapsed != null) setCollapsed(r, false);
            }
          }
          afterCollapse();
        },
        { signal: ac.signal },
      );
    });
  };

  // ── expand/collapse the clamped text (works with the field off — it's content) ───────────
  const toggle = (row: HTMLElement): void =>
    row.setAttribute("aria-expanded", String(row.getAttribute("aria-expanded") !== "true"));
  list.addEventListener(
    "click",
    (e) => {
      const t = e.target as HTMLElement;
      if (t.closest("a") || t.closest(".th-caret")) return;
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

  // ── heat lens — recolor only; the tree's order and mass are fixed history. Hidden
  // (collapsed-away) comments are skipped; afterCollapse re-applies the lens on reveal. ─────
  const applyLens = (): void => {
    if (lens === "tempo") {
      visibleRows().forEach((r) => {
        const t = Number(r.dataset.tempo) || 0;
        r.style.setProperty("--cat", `hsl(${Math.round(205 - t * 180)} 74% 64%)`);
      });
    } else {
      visibleRows().forEach((r) => r.style.setProperty("--cat", "#60a5fa"));
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
        // renderless keeps the field invisible; the extra "attention" metric asks the
        // platform pipeline to write --field-attention per comment (an eased 0..1 blend
        // of engagement, viewport-center proximity, and visibility) — read by the ink CSS.
        // Visible bodies only — collapsed subtrees leave the field, not just the page.
        activeField = applyRecipe(list, base, {
          bodies: visibleRows(),
          annotateBodies: false,
          renderless: true,
          extraMetrics: ["attention"],
        });
      }
    } catch {
      /* the static --w layer stands on its own */
    }
  };

  // ── controls ─────────────────────────────────────────────────────────────
  wireSegments(
    lensBtns,
    "thLens",
    (v) => {
      lens = (v as ThLens) || "tempo";
      page.dataset.lens = lens;
      if (hint) hint.innerHTML = HINTS[lens];
      applyLens();
    },
    ac.signal,
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
        clearChain();
      }
    },
    ac.signal,
  );

  wireCollapse();
  applyLens();
  runField();

  return () => {
    ac.abort();
    dischargeChain();
    activeField?.destroy();
  };
}

pageRuntime(".ex-threads", initThreads);
