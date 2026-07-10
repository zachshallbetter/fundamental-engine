// Dependencies Field runtime. Fundamental as an INVISIBLE measurement layer over the monorepo's
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
// The scoped field runs render-less (applyPattern renderless) — particles compute (metrics flow) but are never drawn.
import { logNormalizeBetween, recipeById, weightToStrength } from "@fundamental-engine/core";
import { applyPattern, threadOverlay, withFlip } from "@fundamental-engine/dom";
import { wireFieldToggle, wireSegments } from "../../lib/controls.ts";
import { wireLiveChip, politeLoop } from "../../lib/live-data.ts";
import { pageRuntime } from "../../lib/page-runtime.ts";

type DepWeight = "downloads" | "freshness";

const HINTS: Record<DepWeight, string> = {
  downloads:
    "<b>size</b> = weekly downloads — the mass the ecosystem already moves through each package",
  freshness:
    "<b>size</b> = publish recency — recently shipped packages pull; unreported dates hold a neutral weight",
};

function initDependencies(page: HTMLElement): () => void {
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
      const dlMin = Math.min(...dls);
      const dlMax = Math.max(...dls);
      wFor = (r) => logNormalizeBetween(Number(r.dataset.dl) || 0, dlMin, dlMax);
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
      r.dataset.strength = weightToStrength(w).toFixed(2);
      const bar = r.querySelector<HTMLElement>(".ev-bar i");
      if (bar) bar.style.width = `${Math.round(w * 100)}%`;
    }
    const ordered = [...all].sort(
      (a, b) => Number(b.style.getPropertyValue("--w")) - Number(a.style.getPropertyValue("--w")),
    );
    withFlip(
      () => all,
      () => ordered.forEach((r) => list.appendChild(r)),
      { axis: "y" },
    );
  };

  // ── causality spill (hover) — one SVG overlay spans both zones ─────────────
  // The SVG lifecycle, the bezier geometry, and the lit/cited marks are the platform's
  // threadOverlay. The spill SEMANTICS stay here: --thread is set on the ZONE (the
  // .dp-node lit/cited styles read it by inheritance, not just the paths), and the
  // upstream-chain hover lights classes without drawing at all.
  const threads = zone ? threadOverlay(zone, { className: "ev-threads" }) : null;
  const clearSpill = (): void => {
    threads?.clear();
    zone?.style.removeProperty("--thread");
    rows().forEach((r) => r.classList.remove("lit"));
    nodes.forEach((n) => n.classList.remove("lit", "cited"));
  };
  const wireSpill = (): void => {
    if (!zone || !threads) return;
    // hover a dep row → light it and thread to every workspace package it lands in.
    const spillDown = (from: HTMLElement): void => {
      if (!fieldOn) return;
      // advisory-carrying deps thread red; clean ones in their --cat (same property —
      // the page sets --cat red exactly when advisories exist). The variable lives on
      // the zone so the cited NODES inherit it too; the overlay's paths fall through
      // to it (no per-draw color is passed).
      zone.style.setProperty(
        "--thread",
        getComputedStyle(from).getPropertyValue("--cat").trim() || "var(--accent)",
      );
      const targets = (from.dataset.uses || "")
        .split(" ")
        .filter(Boolean)
        .map((id) => zone.querySelector<HTMLElement>(`#${CSS.escape(id)}`))
        .filter((t): t is HTMLElement => t !== null);
      threads.draw(from, targets);
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

  // ── the invisible scoped field (renderless) ────────────────────────────────
  const runField = (): void => {
    activeField?.destroy();
    activeField = null;
    if (!fieldOn || !zone) return;
    try {
      const base = recipeById("evidence-field");
      if (base) {
        // renderless — invisible; metrics gain the attention lane, so the platform
        // pipeline writes an eased --field-attention (hover/focus + viewport-center
        // proximity + visibility) back to every row and node.
        activeField = applyPattern(zone, base, {
          bodies: [...rows(), ...nodes],
          annotateBodies: false,
          renderless: true,
          extraMetrics: ["attention"],
        });
      }
    } catch {
      /* the static --w layer stands on its own */
    }
  };

  // ── controls ────────────────────────────────────────────────────────────────
  wireSegments(
    weightBtns,
    "dpWeight",
    (value) => {
      weight = (value as DepWeight) || "downloads";
      page.dataset.weight = weight;
      if (hint) hint.innerHTML = HINTS[weight];
      reweight();
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
        clearSpill();
      }
    },
    ac.signal,
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

pageRuntime(".ex-dependencies", initDependencies);
