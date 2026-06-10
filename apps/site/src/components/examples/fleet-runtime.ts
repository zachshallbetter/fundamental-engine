// Fleet Field runtime. field-ui as an INVISIBLE measurement layer over GitHub's real
// status page:
//   · Field on/off — off, the page collapses to the checklist (CSS via [data-field]); the
//     scoped field is destroyed and highlights are cleared. On, history shows in the type.
//   · Weight services by involvement / recency — recompute each card's --w from the chosen
//     signal, then re-sort the grid with a 2D FLIP reflow (grid moves are x and y).
//   · hover an incident → the services it hit light in the grid; hover a service → its
//     incidents light in the timeline. Class highlights only — no SVG on this page.
//   · click an incident → it releases the updates it accreted (aria-expanded toggle).
//   · LIVE status — the grid re-polls githubstatus.com's components feed every 60s (CORS-
//     enabled; skipped while the tab is hidden) and diffs each card's status pill in place.
//     A changed card pulses once and holds data-active ~3s, so the attention metric reads
//     the change as engagement — the field notices. Three consecutive failures and the loop
//     retires itself; the chip falls back to the snapshot date. Never throws.
// The scoped field runs render-less (applyRecipe renderless) — particles compute (metrics flow) but are never drawn.
import { logNormalize, recipeById, weightToStrength } from "@field-ui/core";
import { applyRecipe, withFlip } from "@field-ui/platform";
import { wireFieldToggle, wireSegments } from "../../lib/controls";
import { pageRuntime } from "../../lib/page-runtime";
import { atReadingPace } from "../../lib/reading-pace";

type FleetWeight = "involvement" | "recency";

const reduceMotion = (): boolean =>
  typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

const HINTS: Record<FleetWeight, string> = {
  involvement: "<b>size</b> = involvement — how many of the window's incidents named each service",
  recency: "<b>size</b> = recency — the services hit most recently carry the weight",
};

// ── the live components feed (mirrors the page's server-side palette) ────────
const POLL_URL = "https://www.githubstatus.com/api/v2/components.json";
const POLL_MS = 60_000;
const POLL_FIRST_MS = 3_000;
const POLL_MAX_FAILS = 3;
const ACTIVE_MS = 3_000;
const STATUS_COLOR: Record<string, string> = {
  operational: "#2dd4bf",
  degraded_performance: "#fbbf24",
  partial_outage: "#ff9d5c",
  major_outage: "#f87171",
  under_maintenance: "#60a5fa",
};

function initFleet(page: HTMLElement): () => void {
  const ac = new AbortController();
  const zone = page.querySelector<HTMLElement>("[data-fl-zone]");
  const grid = page.querySelector<HTMLElement>("[data-fl-grid]");
  const comps = (): HTMLElement[] => [...page.querySelectorAll<HTMLElement>(".fl-comp")];
  const incidents = [...page.querySelectorAll<HTMLElement>(".fl-inc")];
  const fieldBtn = page.querySelector<HTMLButtonElement>("[data-fl-field]");
  const weightBtns = [...page.querySelectorAll<HTMLButtonElement>("[data-fl-weight]")];
  const hint = page.querySelector<HTMLElement>("[data-fl-hint]");

  let weight: FleetWeight = "involvement";
  let fieldOn = true;
  let activeField: { destroy(): void } | null = null;

  // ── service weighting — recompute --w + data-strength, then 2D FLIP re-sort ──
  const reweight = (): void => {
    if (!grid) return;
    const all = comps();
    let wFor: (c: HTMLElement) => number;
    let order: (a: HTMLElement, b: HTMLElement) => number;
    if (weight === "involvement") {
      // the family's consensus shape — ln(x+1)/ln(max+1), the core weight primitive
      const maxInv = Math.max(...all.map((c) => Number(c.dataset.inv) || 0));
      wFor = (c) => logNormalize(Number(c.dataset.inv) || 0, maxInv);
      order = (a, b) => (Number(b.dataset.inv) || 0) - (Number(a.dataset.inv) || 0);
    } else {
      // recency: most recently hit. Services never named in the window stay at zero.
      const lasts = all.map((c) => Number(c.dataset.last) || 0).filter(Boolean);
      const lmin = lasts.length ? Math.min(...lasts) : 0;
      const lspan = lasts.length ? Math.max(...lasts) - lmin : 0;
      wFor = (c) => {
        const t = Number(c.dataset.last) || 0;
        if (!t) return 0;
        return lspan > 0 ? (t - lmin) / lspan : 1;
      };
      order = (a, b) => (Number(b.dataset.last) || 0) - (Number(a.dataset.last) || 0);
    }
    for (const c of all) {
      const w = wFor(c);
      c.style.setProperty("--w", w.toFixed(3));
      c.dataset.strength = weightToStrength(w).toFixed(2);
    }
    const ordered = [...all].sort(order);
    withFlip(
      () => all,
      () => ordered.forEach((c) => grid.appendChild(c)),
    );
  };

  // ── cross-highlight (hover) — incidents ↔ the services they named ─────────
  const clearHighlights = (): void => {
    comps().forEach((c) => c.classList.remove("lit", "cited"));
    incidents.forEach((i) => i.classList.remove("lit", "cited"));
  };
  const wireHighlights = (): void => {
    incidents.forEach((inc) => {
      inc.addEventListener(
        "pointerenter",
        () => {
          if (!fieldOn) return;
          inc.classList.add("lit");
          for (const s of (inc.dataset.comps || "").split(" ").filter(Boolean)) {
            page.querySelector<HTMLElement>(`#comp-${CSS.escape(s)}`)?.classList.add("cited");
          }
        },
        { signal: ac.signal },
      );
      inc.addEventListener("pointerleave", clearHighlights, { signal: ac.signal });
    });
    comps().forEach((c) => {
      c.addEventListener(
        "pointerenter",
        () => {
          if (!fieldOn) return;
          c.classList.add("lit");
          const name = c.dataset.name || "";
          incidents
            .filter((i) => (i.dataset.comps || "").split(" ").includes(name))
            .forEach((i) => i.classList.add("cited"));
        },
        { signal: ac.signal },
      );
      c.addEventListener("pointerleave", clearHighlights, { signal: ac.signal });
    });
  };

  // ── release the accreted updates (expand/collapse) ─────────────────────────
  const wireExpand = (): void => {
    page.querySelectorAll<HTMLButtonElement>(".fl-inc-head").forEach((head) => {
      head.addEventListener(
        "click",
        () => {
          const open = head.getAttribute("aria-expanded") !== "true";
          head.setAttribute("aria-expanded", String(open));
          const listId = head.getAttribute("aria-controls");
          const ulist = listId ? document.getElementById(listId) : null;
          if (ulist) ulist.hidden = !open;
        },
        { signal: ac.signal },
      );
    });
  };

  // ── entry sweep — load bars fill 0 → recorded width at reading pace ────────
  // IO marks which incidents are on screen; a rAF loop sweeps them only while the
  // reader is at reading pace (lib/reading-pace.ts — the engine's --field-scroll-v
  // under 2 px/frame). Unlike armEntryAtPace, the sweep WAITS for calm rather than
  // falling back to an instant reveal, so the gate is read directly. Each bar sweeps
  // once; the loop retires itself. Reduced motion never arms the sweep, so the bars
  // render at full width immediately.
  const wireSweep = (): void => {
    if (reduceMotion()) return;
    const list = page.querySelector<HTMLElement>("[data-fl-list]");
    if (!list || !incidents.length) return;
    list.dataset.flSweep = "";
    const pending = new Set<HTMLElement>(incidents);
    const visible = new Set<HTMLElement>();
    let raf = 0;
    const tick = (): void => {
      raf = 0;
      if (ac.signal.aborted || !pending.size) return;
      if (atReadingPace()) {
        for (const el of visible) {
          el.dataset.swept = "";
          pending.delete(el);
          io.unobserve(el);
        }
        visible.clear();
      }
      if (!pending.size) {
        io.disconnect();
        return;
      }
      if (visible.size) raf = requestAnimationFrame(tick);
    };
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const el = e.target as HTMLElement;
          if (e.isIntersecting) visible.add(el);
          else visible.delete(el);
        }
        if (visible.size && !raf) raf = requestAnimationFrame(tick);
      },
      { threshold: 0.35 },
    );
    incidents.forEach((i) => io.observe(i));
    ac.signal.addEventListener("abort", () => {
      io.disconnect();
      if (raf) cancelAnimationFrame(raf);
    });
  };

  // ── live status — poll-and-diff over the components feed ───────────────────
  // Every POLL_MS (first poll ~3s in, skipped while the tab is hidden) fetch the live
  // components.json and update each card's status pill IN PLACE, matched by component id
  // (name as a fallback). Only a CHANGED status touches the DOM: the pill re-labels, the
  // card's --cat recolors, a one-shot pulse fires (class cleared on animationend), and the
  // card holds data-active for ~ACTIVE_MS — the scoped recipe's attention metric counts
  // data-active as engagement, so the field registers the change. --w is never touched:
  // status is live; the involvement weight is the snapshot's incident history.
  // Never throws; POLL_MAX_FAILS consecutive failures retire the loop and the chip falls
  // back to the committed snapshot date.
  const wireLive = (): void => {
    const chip = page.querySelector<HTMLElement>("[data-fl-live]");
    if (!chip || typeof fetch !== "function") return;
    const all = comps();
    const byId = new Map(all.map((c) => [c.dataset.compId ?? "", c]));
    const byName = new Map(
      all.map((c) => [(c.querySelector(".fl-comp-name")?.textContent ?? "").trim(), c]),
    );
    const snapshotLabel = `snapshot · ${chip.dataset.snapshot ?? ""}`;
    const activeTimers = new Map<HTMLElement, ReturnType<typeof setTimeout>>();
    let lastOk = 0;
    let fails = 0;
    let stopped = false;
    let loop: ReturnType<typeof setInterval> | undefined;
    let tick: ReturnType<typeof setInterval> | undefined;

    const syncChip = (): void => {
      if (stopped || !lastOk) {
        chip.dataset.live = "snapshot";
        chip.textContent = snapshotLabel;
        return;
      }
      chip.dataset.live = "on";
      chip.textContent = `live · checked ${Math.max(0, Math.round((Date.now() - lastOk) / 1000))}s ago`;
    };

    const markChanged = (card: HTMLElement): void => {
      if (!reduceMotion()) {
        // one-shot pulse: re-arm cleanly even if a previous pulse is mid-flight.
        card.classList.remove("fl-changed");
        void card.offsetWidth;
        card.classList.add("fl-changed");
        card.addEventListener("animationend", () => card.classList.remove("fl-changed"), {
          once: true,
        });
      }
      // ~3s of data-active: the metric pipeline reads it as engagement (the field notices).
      card.setAttribute("data-active", "");
      clearTimeout(activeTimers.get(card));
      activeTimers.set(
        card,
        setTimeout(() => card.removeAttribute("data-active"), ACTIVE_MS),
      );
    };

    const apply = (data: unknown): void => {
      const list = (data as { components?: unknown })?.components;
      if (!Array.isArray(list)) return;
      for (const raw of list) {
        const c = raw as { id?: string; name?: string; status?: string };
        if (!c || typeof c.status !== "string") continue;
        const card =
          (c.id ? byId.get(c.id) : undefined) ??
          (c.name ? byName.get(c.name.trim()) : undefined);
        const pill = card?.querySelector<HTMLElement>(".fl-pill");
        if (!card || !pill || pill.dataset.status === c.status) continue;
        pill.dataset.status = c.status;
        pill.textContent = c.status.replace(/_/g, " ");
        card.style.setProperty("--cat", STATUS_COLOR[c.status] ?? "#2dd4bf");
        markChanged(card);
      }
    };

    const poll = async (): Promise<void> => {
      if (stopped || ac.signal.aborted || document.hidden) return;
      try {
        const res = await fetch(POLL_URL, { signal: ac.signal });
        if (!res.ok) throw new Error(String(res.status));
        apply(await res.json());
        fails = 0;
        lastOk = Date.now();
        syncChip();
      } catch {
        if (ac.signal.aborted) return;
        fails += 1;
        if (fails >= POLL_MAX_FAILS) {
          // retire the loop entirely; the chip falls back to the committed snapshot.
          stopped = true;
          lastOk = 0;
          clearInterval(loop);
          clearInterval(tick);
          syncChip();
        }
      }
    };

    const first = setTimeout(() => void poll(), POLL_FIRST_MS);
    loop = setInterval(() => void poll(), POLL_MS);
    tick = setInterval(() => {
      if (lastOk && !stopped) syncChip();
    }, 1000);
    ac.signal.addEventListener("abort", () => {
      clearTimeout(first);
      clearInterval(loop);
      clearInterval(tick);
      activeTimers.forEach((t) => clearTimeout(t));
      activeTimers.clear();
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
        // proximity + visibility) back to every card.
        activeField = applyRecipe(zone, base, {
          bodies: [...comps(), ...incidents],
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
    "flWeight",
    (value) => {
      weight = (value as FleetWeight) || "involvement";
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
        clearHighlights();
      }
    },
    ac.signal,
  );

  wireHighlights();
  wireExpand();
  wireSweep();
  wireLive();
  runField();

  return () => {
    ac.abort();
    activeField?.destroy();
  };
}

pageRuntime(".ex-fleet", initFleet);
