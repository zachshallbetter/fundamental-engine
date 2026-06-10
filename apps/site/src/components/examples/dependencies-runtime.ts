// Dependencies Field runtime. field-ui as an INVISIBLE measurement layer over the monorepo's
// real dependency surface:
//   · Field on/off — off, the page collapses to a flat manifest (CSS via [data-field]); the
//     scoped field is destroyed and the spill is cleared. On, downloads show in the type.
//   · Weight by downloads / freshness — recompute each row's --w from the chosen signal, then
//     re-sort with a FLIP reflow. Packages without a reported publish date hold a neutral
//     weight under the freshness lens rather than faking one.
//   · CAUSALITY SPILL — hover an external dep: SVG threads run from the row to each workspace
//     package that inherits it (red when the dep carries advisories, its --cat otherwise).
//     Hover a workspace node: its full upstream chain lights (class highlights, no SVG).
//   · LIVE — once per visit (~4s in) the page refreshes each external dep's last-week download
//     count from api.npmjs.org and re-settles through the EXISTING reweight path. Once, not a
//     poll: the figure is a weekly aggregate, so re-polling it would be theater. Failed rows
//     keep their snapshot values; advisories and publish dates stay snapshot by design.
// The scoped field runs with render: [] — particles compute (metrics flow) but are never drawn.
import { recipeById } from "@field-ui/core";
import { applyRecipe } from "@field-ui/platform";
import { wireLiveChip, politeLoop } from "../../lib/live-data.ts";

type DepWeight = "downloads" | "freshness";

const NS = "http://www.w3.org/2000/svg";
const reduceMotion = (): boolean =>
  typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

function centerIn(el: HTMLElement, host: HTMLElement): { x: number; y: number } {
  const r = el.getBoundingClientRect();
  const h = host.getBoundingClientRect();
  return { x: r.left - h.left + r.width / 2, y: r.top - h.top + r.height / 2 };
}

const HINTS: Record<DepWeight, string> = {
  downloads:
    "<b>size</b> = weekly downloads — the mass the ecosystem already moves through each package",
  freshness:
    "<b>size</b> = publish recency — recently shipped packages pull; unreported dates hold a neutral weight",
};

function initDependencies(): () => void {
  const page = document.querySelector<HTMLElement>(".ex-dependencies");
  if (!page) return () => {};
  const ac = new AbortController();
  const zone = page.querySelector<HTMLElement>("[data-dp-zone]");
  const list = page.querySelector<HTMLElement>("[data-dp-list]");
  const nodes = [...page.querySelectorAll<HTMLElement>(".dp-node")];
  const rows = (): HTMLElement[] => [...page.querySelectorAll<HTMLElement>(".dp-row")];
  const fieldBtn = page.querySelector<HTMLButtonElement>("[data-dp-field]");
  const weightBtns = [...page.querySelectorAll<HTMLButtonElement>("[data-dp-weight]")];
  const hint = page.querySelector<HTMLElement>("[data-dp-hint]");

  let weight: DepWeight = "downloads";
  let fieldOn = true;
  let activeField: { destroy(): void } | null = null;

  // ── weighting — recompute --w + data-strength, then FLIP re-sort ──────────
  const reweight = (): void => {
    if (!list) return;
    const all = rows();
    let wFor: (r: HTMLElement) => number;
    if (weight === "downloads") {
      const dls = all.map((r) => Number(r.dataset.dl) || 0);
      const lmin = Math.log(Math.min(...dls) + 1);
      const lmax = Math.log(Math.max(...dls) + 1);
      wFor = (r) =>
        lmax > lmin ? (Math.log((Number(r.dataset.dl) || 0) + 1) - lmin) / (lmax - lmin) : 1;
    } else {
      // freshness: linear over the reported publish dates; missing dates sit neutral at 0.5.
      const pubs = all.map((r) => (r.dataset.pub ? Number(r.dataset.pub) : null));
      const known = pubs.filter((p): p is number => p !== null);
      const pmin = known.length ? Math.min(...known) : 0;
      const pspan = known.length ? Math.max(...known) - pmin : 0;
      wFor = (r) => {
        const p = r.dataset.pub ? Number(r.dataset.pub) : null;
        if (p === null) return 0.5;
        return pspan > 0 ? (p - pmin) / pspan : 0.5;
      };
    }
    for (const r of all) {
      const w = wFor(r);
      r.style.setProperty("--w", w.toFixed(3));
      r.dataset.strength = (0.4 + w * 1.6).toFixed(2);
      const bar = r.querySelector<HTMLElement>(".ev-bar i");
      if (bar) bar.style.width = `${Math.round(w * 100)}%`;
    }
    const ordered = [...all].sort(
      (a, b) => Number(b.style.getPropertyValue("--w")) - Number(a.style.getPropertyValue("--w")),
    );
    const firstTop = new Map(all.map((r) => [r, r.getBoundingClientRect().top]));
    ordered.forEach((r) => list.appendChild(r));
    ordered.forEach((r) => {
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

  // ── causality spill (hover) — one SVG overlay spans both zones ─────────────
  const clearSpill = (): void => {
    zone?.querySelector("svg.ev-threads")?.replaceChildren();
    zone?.style.removeProperty("--thread");
    rows().forEach((r) => r.classList.remove("lit"));
    nodes.forEach((n) => n.classList.remove("lit", "cited"));
  };
  const wireSpill = (): void => {
    if (!zone) return;
    let svg = zone.querySelector<SVGSVGElement>("svg.ev-threads");
    if (!svg) {
      svg = document.createElementNS(NS, "svg") as SVGSVGElement;
      svg.setAttribute("class", "ev-threads");
      svg.setAttribute("aria-hidden", "true");
      zone.prepend(svg);
    }
    // hover a dep row → light it and thread to every workspace package it lands in.
    const spillDown = (from: HTMLElement): void => {
      if (!fieldOn) return;
      const box = zone.getBoundingClientRect();
      svg!.setAttribute("viewBox", `0 0 ${box.width} ${box.height}`);
      // advisory-carrying deps thread red; clean ones in their --cat (same property —
      // the page sets --cat red exactly when advisories exist).
      zone.style.setProperty(
        "--thread",
        getComputedStyle(from).getPropertyValue("--cat").trim() || "var(--accent)",
      );
      const a = centerIn(from, zone);
      from.classList.add("lit");
      let d = "";
      for (const id of (from.dataset.uses || "").split(" ").filter(Boolean)) {
        const t = zone.querySelector<HTMLElement>(`#${CSS.escape(id)}`);
        if (!t) continue;
        t.classList.add("cited");
        const b = centerIn(t, zone);
        const my = (a.y + b.y) / 2;
        d += `<path d="M${a.x} ${a.y} C ${a.x} ${my}, ${b.x} ${my}, ${b.x} ${b.y}"/>`;
      }
      svg!.innerHTML = d;
    };
    // hover a workspace node → light its full upstream chain (class highlights only).
    const spillUp = (from: HTMLElement): void => {
      if (!fieldOn) return;
      zone.style.setProperty("--thread", "var(--accent)");
      from.classList.add("lit");
      for (const id of (from.dataset.chain || "").split(" ").filter(Boolean)) {
        zone.querySelector<HTMLElement>(`#${CSS.escape(id)}`)?.classList.add("cited");
      }
    };
    rows().forEach((r) => {
      r.addEventListener("pointerenter", () => spillDown(r), { signal: ac.signal });
      r.addEventListener("pointerleave", clearSpill, { signal: ac.signal });
    });
    nodes.forEach((n) => {
      n.addEventListener("pointerenter", () => spillUp(n), { signal: ac.signal });
      n.addEventListener("pointerleave", clearSpill, { signal: ac.signal });
    });
  };

  // ── the invisible scoped field (render: []) ────────────────────────────────
  const runField = (): void => {
    activeField?.destroy();
    activeField = null;
    if (!fieldOn || !zone) return;
    try {
      const base = recipeById("evidence-field");
      if (base) {
        // render: [] — invisible; metrics gain the attention lane, so the platform
        // pipeline writes an eased --field-attention (hover/focus + viewport-center
        // proximity + visibility) back to every row and node.
        const recipe = {
          ...base,
          render: [] as never[],
          metrics: [...new Set([...(base.metrics ?? []), "attention"])],
        } as typeof base;
        activeField = applyRecipe(zone, recipe, {
          bodies: [...rows(), ...nodes],
          annotateBodies: false,
        });
      }
    } catch {
      /* the static --w layer stands on its own */
    }
  };

  // ── controls ────────────────────────────────────────────────────────────────
  weightBtns.forEach((b) =>
    b.addEventListener(
      "click",
      () => {
        weight = (b.dataset.dpWeight as DepWeight) || "downloads";
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
        clearSpill();
      }
    },
    { signal: ac.signal },
  );

  // ── live downloads — the snapshot upgrades itself ONCE per visit ───────────
  // ~4s in (politeLoop skips hidden tabs), fetch each external dep's last-week
  // figure from api.npmjs.org. The whole batch is one run: partial success is
  // fine — rows whose fetch failed keep their snapshot values — and the run only
  // counts as a failure when EVERY fetch failed. Fresh counts flow through the
  // EXISTING reweight path: --w re-normalizes against the fresh max, data-strength
  // follows, and the list FLIP re-sorts through the ACTIVE lens. No repeat
  // (everyMs: null): downloads are weekly aggregates — polling would be theater.
  const chipEl = page.querySelector<HTMLElement>("[data-dp-live]");
  const chip = wireLiveChip(chipEl, chipEl?.dataset.snapshot ?? "");
  const fmtDl = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
  const refreshDownloads = async (): Promise<void> => {
    const results = await Promise.allSettled(
      rows().map(async (r) => {
        const name = r.querySelector(".dp-name")?.textContent?.trim();
        if (!name) throw new Error("unnamed row");
        const res = await fetch(
          `https://api.npmjs.org/downloads/point/last-week/${encodeURIComponent(name)}`,
          { signal: ac.signal },
        );
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as { downloads?: number };
        if (typeof data.downloads !== "number") throw new Error("unexpected shape");
        r.dataset.dl = String(data.downloads);
        // the figure stays inside the row's declared measurement span (.dp-dl)
        const fig = r.querySelector<HTMLElement>(".dp-dl b");
        if (fig) fig.textContent = fmtDl.format(data.downloads);
      }),
    );
    if (!results.some((x) => x.status === "fulfilled")) throw new Error("npm api unreachable");
    reweight(); // the existing path: --w + data-strength + bars + FLIP re-sort, active lens
  };
  politeLoop({
    run: refreshDownloads,
    firstDelayMs: 4000,
    everyMs: null, // once per visit — see above
    signal: ac.signal,
    onSuccess: () => chip.ok(),
    onFailure: () => chip.fail(),
  });

  wireSpill();
  runField();

  return () => {
    ac.abort();
    chip.destroy();
    activeField?.destroy();
  };
}

let teardown: (() => void) | undefined;
function init(): void {
  teardown?.();
  teardown = document.querySelector(".ex-dependencies") ? initDependencies() : undefined;
}
if (document.readyState !== "loading") init();
else document.addEventListener("DOMContentLoaded", init);
document.addEventListener("astro:page-load", init);
document.addEventListener("astro:before-swap", () => {
  teardown?.();
  teardown = undefined;
});
