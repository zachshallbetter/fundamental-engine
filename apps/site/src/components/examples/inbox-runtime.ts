// Inbox Field runtime. field-ui as an INVISIBLE measurement layer over real unanswered
// Stack Overflow questions, with attention as a CONSERVED budget:
//   · every ask's urgency u = a lens-weighted blend of its normalized recency / votes / views
//     (server-computed, carried as data-rec / data-vot / data-vie);
//   · weights are renormalized so Σw is pinned to a fixed budget (N × 0.42), capped at 1 with
//     water-filling — the attention meter always reads 100% allocated, by construction;
//   · click an ask to PIN it (w = 1); the remaining budget redistributes over the unpinned;
//   · lens segments (fresh / voted / seen) re-blend the urgency and FLIP re-sort the list;
//   · Field on/off — off, the page collapses to a plain list (CSS via [data-field]) and the
//     scoped field is destroyed.
// The scoped field runs with render: [] — bodies compute (metrics flow) but nothing is drawn.
import { recipeById } from "@field-ui/core";
import { applyRecipe } from "@field-ui/platform";

type IxLens = "fresh" | "voted" | "seen";

const BUDGET_PER_ITEM = 0.42;

const BLENDS: Record<IxLens, { rec: number; vot: number; vie: number }> = {
  fresh: { rec: 0.6, vot: 0.25, vie: 0.15 },
  voted: { rec: 0.25, vot: 0.6, vie: 0.15 },
  seen: { rec: 0.25, vot: 0.15, vie: 0.6 },
};

const HINTS: Record<IxLens, string> = {
  fresh: "<b>size</b> = urgency, recency-leaning — fresh asks pull hardest before they go cold",
  voted: "<b>size</b> = urgency, vote-leaning — the asks other people already endorsed",
  seen: "<b>size</b> = urgency, view-leaning — the asks many tried and none could answer",
};

const reduceMotion = () =>
  typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

// conserved allocation: scale urgencies so Σw = budget, cap each at 1, re-flow capped
// excess over the rest (water-filling). Mirrors the server-side initial allocation.
function allocate(us: number[], budget: number): number[] {
  const w = us.map(() => 0);
  let free = us.map((_, i) => i);
  let rem = budget;
  for (let pass = 0; pass < 10 && free.length && rem > 0; pass++) {
    const sum = free.reduce((s, i) => s + (us[i] ?? 0), 0) || 1;
    const k = rem / sum;
    const still: number[] = [];
    let capped = 0;
    for (const i of free) {
      if ((us[i] ?? 0) * k >= 1) {
        w[i] = 1;
        capped++;
      } else still.push(i);
    }
    if (!capped) {
      for (const i of still) w[i] = (us[i] ?? 0) * k;
      break;
    }
    rem -= capped;
    free = still;
  }
  return w;
}

function initInbox(): () => void {
  const page = document.querySelector<HTMLElement>(".ex-inbox");
  if (!page) return () => {};
  const ac = new AbortController();
  const list = page.querySelector<HTMLElement>("[data-ix-list]");
  const fieldBtn = page.querySelector<HTMLButtonElement>("[data-ix-field]");
  const lensBtns = [...page.querySelectorAll<HTMLButtonElement>("[data-ix-lens]")];
  const meter = page.querySelector<HTMLElement>("[data-ix-meter]");
  const hint = page.querySelector<HTMLElement>("[data-ix-hint]");
  if (!list) return () => {};

  let lens: IxLens = (page.dataset.lens as IxLens) || "fresh";
  let fieldOn = true;
  let activeField: { destroy(): void } | null = null;
  const pinned = new Set<HTMLElement>();

  const itemsOf = () => [...list.querySelectorAll<HTMLElement>(".ix-item")];

  const urgencyOf = (it: HTMLElement): number => {
    const b = BLENDS[lens];
    return (
      b.rec * (Number(it.dataset.rec) || 0) +
      b.vot * (Number(it.dataset.vot) || 0) +
      b.vie * (Number(it.dataset.vie) || 0)
    );
  };

  // ── the conserved budget: pins take w=1; the rest split what remains ──────
  const reallocate = (): void => {
    const items = itemsOf();
    const budget = items.length * BUDGET_PER_ITEM;
    const unpinned = items.filter((it) => !pinned.has(it));
    const ws = allocate(
      unpinned.map(urgencyOf),
      Math.max(0, budget - pinned.size),
    );
    const wOf = new Map<HTMLElement, number>(unpinned.map((it, i) => [it, ws[i] ?? 0]));
    for (const it of items) {
      const w = pinned.has(it) ? 1 : (wOf.get(it) ?? 0);
      it.style.setProperty("--w", w.toFixed(3));
      it.dataset.strength = (0.4 + w * 1.6).toFixed(2);
      const bar = it.querySelector<HTMLElement>(".ix-share i");
      if (bar) bar.style.width = `${Math.round(w * 100)}%`;
    }
    if (meter)
      meter.textContent = `100% allocated · pinned ${pinned.size} · free ${Math.max(
        0,
        budget - pinned.size,
      ).toFixed(1)}`;
  };

  // ── lens change: re-blend, then FLIP re-sort so the field visibly re-settles ──
  const resort = (): void => {
    const items = itemsOf();
    const ordered = [...items].sort(
      (a, b) => Number(b.style.getPropertyValue("--w")) - Number(a.style.getPropertyValue("--w")),
    );
    const firstTop = new Map(items.map((it) => [it, it.getBoundingClientRect().top]));
    ordered.forEach((it) => list.appendChild(it));
    if (reduceMotion()) return;
    ordered.forEach((it) => {
      const dy = (firstTop.get(it) ?? 0) - it.getBoundingClientRect().top;
      if (!dy) return;
      it.style.transform = `translateY(${dy}px)`;
      it.style.transition = "none";
      requestAnimationFrame(() => {
        it.style.transition = "transform 0.5s cubic-bezier(.2, .7, .2, 1)";
        it.style.transform = "";
        it.addEventListener("transitionend", () => (it.style.transition = ""), { once: true });
      });
    });
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
        activeField = applyRecipe(list, recipe, { bodies: itemsOf(), annotateBodies: false });
      }
    } catch {
      /* the static --w layer stands on its own */
    }
  };

  // ── pinning — click anywhere on an ask (links keep navigating) ───────────
  list.addEventListener(
    "click",
    (e) => {
      if (!fieldOn) return;
      const t = e.target as HTMLElement;
      if (t.closest("a")) return;
      const item = t.closest<HTMLElement>(".ix-item");
      if (!item || !list.contains(item)) return;
      if (pinned.has(item)) {
        pinned.delete(item);
        item.removeAttribute("data-pinned");
      } else {
        pinned.add(item);
        item.setAttribute("data-pinned", "");
      }
      const btn = item.querySelector<HTMLButtonElement>(".ix-pin");
      btn?.setAttribute("aria-pressed", String(pinned.has(item)));
      reallocate();
    },
    { signal: ac.signal },
  );

  // ── controls ─────────────────────────────────────────────────────────────
  lensBtns.forEach((b) =>
    b.addEventListener(
      "click",
      () => {
        lens = (b.dataset.ixLens as IxLens) || "fresh";
        page.dataset.lens = lens;
        lensBtns.forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
        if (hint) hint.innerHTML = HINTS[lens];
        reallocate();
        resort();
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

  reallocate();
  runField();

  return () => {
    ac.abort();
    activeField?.destroy();
  };
}

let teardown: (() => void) | undefined;
function init(): void {
  teardown?.();
  teardown = document.querySelector(".ex-inbox") ? initInbox() : undefined;
}
if (document.readyState !== "loading") init();
else document.addEventListener("DOMContentLoaded", init);
document.addEventListener("astro:page-load", init);
document.addEventListener("astro:before-swap", () => {
  teardown?.();
  teardown = undefined;
});
