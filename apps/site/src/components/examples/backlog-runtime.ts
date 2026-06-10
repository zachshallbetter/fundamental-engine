// Backlog Field runtime. field-ui as an INVISIBLE measurement layer over the repo's own
// work stream:
//   · Field on/off — off, the page collapses to a plain tracker (CSS via [data-field]); the
//     scoped field is destroyed and threads are cleared. On, the field runs and activity
//     shows in the type.
//   · Weight by activity / freshness — re-blend each item's --w from its normalized signals
//     (data-act, data-rec), then re-sort within each lane with a 2D FLIP reflow.
//   · hover an item → SVG threads to the items it references (refs[] present on the page).
//   · the cycle bar is a real sink body: the engine writes --load back, and CSS turns it
//     into the glow. The bar's fill stays data arithmetic (shipped / capacity).
// The scoped field runs with render: [] — particles compute (metrics flow) but are never drawn.
import { recipeById } from "@field-ui/core";
import { applyRecipe } from "@field-ui/platform";

type BacklogWeight = "activity" | "freshness";

const NS = "http://www.w3.org/2000/svg";
const reduceMotion = (): boolean =>
  typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

function centerIn(el: HTMLElement, host: HTMLElement): { x: number; y: number } {
  const r = el.getBoundingClientRect();
  const h = host.getBoundingClientRect();
  return { x: r.left - h.left + r.width / 2, y: r.top - h.top + r.height / 2 };
}

// the lens blends — must match the server-side default in backlog.astro.
const BLENDS: Record<BacklogWeight, { act: number; rec: number }> = {
  activity: { act: 0.65, rec: 0.35 },
  freshness: { act: 0.25, rec: 0.75 },
};

const HINTS: Record<BacklogWeight, string> = {
  activity: "<b>size</b> = activity, comment-leaning — the items people argue about carry the mass",
  freshness: "<b>size</b> = freshness, recency-leaning — the items touched last pull hardest",
};

function initBacklog(): () => void {
  const page = document.querySelector<HTMLElement>(".ex-backlog");
  if (!page) return () => {};
  const ac = new AbortController();
  const zone = page.querySelector<HTMLElement>("[data-wl-zone]");
  const lists = [...page.querySelectorAll<HTMLElement>("[data-wl-list]")];
  const sink = page.querySelector<HTMLElement>("[data-wl-cycle]");
  const fieldBtn = page.querySelector<HTMLButtonElement>("[data-wl-field]");
  const weightBtns = [...page.querySelectorAll<HTMLButtonElement>("[data-wl-weight]")];
  const hint = page.querySelector<HTMLElement>("[data-wl-hint]");
  const rows = (): HTMLElement[] => [...page.querySelectorAll<HTMLElement>(".wl-item")];

  let weight: BacklogWeight = "activity";
  let fieldOn = true;
  let activeField: { destroy(): void } | null = null;

  // ── weighting — re-blend --w + data-strength, then FLIP re-sort per lane ──
  // The FLIP is 2D (top AND left): cards live in a board, so a re-sort can move
  // a card in both axes.
  const reweight = (): void => {
    const blend = BLENDS[weight];
    for (const r of rows()) {
      const w =
        blend.act * (Number(r.dataset.act) || 0) + blend.rec * (Number(r.dataset.rec) || 0);
      r.style.setProperty("--w", w.toFixed(3));
      r.dataset.strength = (0.4 + w * 1.6).toFixed(2);
    }
    for (const list of lists) {
      const items = [...list.querySelectorAll<HTMLElement>(".wl-item")];
      const ordered = [...items].sort(
        (a, b) =>
          Number(b.style.getPropertyValue("--w")) - Number(a.style.getPropertyValue("--w")),
      );
      const first = new Map(
        items.map((r) => {
          const b = r.getBoundingClientRect();
          return [r, { top: b.top, left: b.left }] as const;
        }),
      );
      ordered.forEach((r) => list.appendChild(r));
      ordered.forEach((r) => {
        if (reduceMotion()) return;
        const f = first.get(r);
        if (!f) return;
        const b = r.getBoundingClientRect();
        const dx = f.left - b.left;
        const dy = f.top - b.top;
        if (!dx && !dy) return;
        r.style.transform = `translate(${dx}px, ${dy}px)`;
        r.style.transition = "none";
        requestAnimationFrame(() => {
          r.style.transition = "transform 0.5s cubic-bezier(.2, .7, .2, 1)";
          r.style.transform = "";
          r.addEventListener("transitionend", () => (r.style.transition = ""), { once: true });
        });
      });
    }
  };

  // ── reference threads (hover) — the SVG overlays the whole board so threads cross lanes ──
  // While a hover holds, the hovered card's live density (--d, written by the page's hidden
  // engine every frame) is mirrored onto the SVG as --thread-live, so the threads charge as
  // the field gathers under the cursor.
  let liveRaf = 0;
  const clearThreads = (): void => {
    cancelAnimationFrame(liveRaf);
    liveRaf = 0;
    const svg = zone?.querySelector<SVGSVGElement>("svg.ev-threads");
    svg?.replaceChildren();
    svg?.style.removeProperty("--thread-live");
    rows().forEach((r) => r.classList.remove("lit", "cited"));
  };
  const wireThreads = (): void => {
    if (!zone) return;
    let svg = zone.querySelector<SVGSVGElement>("svg.ev-threads");
    if (!svg) {
      svg = document.createElementNS(NS, "svg") as SVGSVGElement;
      svg.setAttribute("class", "ev-threads");
      svg.setAttribute("aria-hidden", "true");
      zone.prepend(svg);
    }
    const draw = (from: HTMLElement): void => {
      if (!fieldOn) return;
      const box = zone.getBoundingClientRect();
      svg!.setAttribute("viewBox", `0 0 ${box.width} ${box.height}`);
      svg!.style.setProperty("--thread", getComputedStyle(from).getPropertyValue("--cat").trim());
      // follow the hovered card's --d (an inline style the engine writes — cheap to read)
      cancelAnimationFrame(liveRaf);
      const followLive = (): void => {
        svg!.style.setProperty("--thread-live", from.style.getPropertyValue("--d") || "0");
        liveRaf = requestAnimationFrame(followLive);
      };
      followLive();
      const a = centerIn(from, zone);
      from.classList.add("lit");
      let d = "";
      for (const id of (from.dataset.refs || "").split(" ").filter(Boolean)) {
        const t = zone.querySelector<HTMLElement>(`#${CSS.escape(id)}`);
        if (!t) continue;
        t.classList.add("cited");
        const b = centerIn(t, zone);
        const my = (a.y + b.y) / 2;
        d += `<path d="M${a.x} ${a.y} C ${a.x} ${my}, ${b.x} ${my}, ${b.x} ${b.y}"/>`;
      }
      svg!.innerHTML = d;
    };
    rows().forEach((r) => {
      r.addEventListener("pointerenter", () => draw(r), { signal: ac.signal });
      r.addEventListener("pointerleave", clearThreads, { signal: ac.signal });
    });
  };

  // ── the invisible scoped field (render: []) ───────────────────────────────
  const runField = (): void => {
    activeField?.destroy();
    activeField = null;
    if (!fieldOn || !zone) return;
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
        // the cycle bar joins as a sink — the engine writes its fill back as --load.
        const bodies = rows();
        if (sink) bodies.push(sink);
        activeField = applyRecipe(zone, recipe, { bodies, annotateBodies: false });
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
        weight = (b.dataset.wlWeight as BacklogWeight) || "activity";
        page.dataset.weight = weight;
        weightBtns.forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
        if (hint) hint.innerHTML = HINTS[weight];
        reweight();
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
        sink?.style.removeProperty("--load");
        clearThreads();
      }
    },
    { signal: ac.signal },
  );

  wireThreads();
  runField();

  return () => {
    ac.abort();
    cancelAnimationFrame(liveRaf);
    activeField?.destroy();
  };
}

let teardown: (() => void) | undefined;
function init(): void {
  teardown?.();
  teardown = document.querySelector(".ex-backlog") ? initBacklog() : undefined;
}
if (document.readyState !== "loading") init();
else document.addEventListener("DOMContentLoaded", init);
document.addEventListener("astro:page-load", init);
document.addEventListener("astro:before-swap", () => {
  teardown?.();
  teardown = undefined;
});
