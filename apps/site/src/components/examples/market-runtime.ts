// Market Field runtime. field-ui as an INVISIBLE measurement layer over a CoinGecko snapshot,
// laid out as a cap-weighted mosaic — mass is AREA:
//   · Field on/off — off, the mosaic collapses to an even grid (CSS via [data-field]); the scoped
//     field is destroyed. On, the field runs and cap shows in tile area and type.
//   · Weight by cap / volume — recompute each tile's --w from the chosen signal, RE-TIER (swap
//     the mk-t1..mk-t4 span class), then re-sort. Tiles whose footprint is unchanged FLIP in 2D
//     (translate(dx, dy)); re-tiered tiles settle with a fade — translate cannot honestly animate
//     a size change, and scaling tiles of live text looks worse than a settle.
//   · Move window 24h / 7d — repolarize: --cat encodes direction (hue) and magnitude (intensity).
//   · LIVE — the page upgrades itself from the committed snapshot to live CoinGecko data: it
//     re-polls the same endpoint the snapshot script uses once a minute and updates the tiles
//     IN PLACE (price + tick flash, badges, --cat through the active lens, --w/data-strength,
//     sparkline path). A poll never re-sorts or re-tiers — hostile under the cursor. Any fetch
//     error reverts silently to snapshot mode; 3 consecutive failures stop the polling.
// The scoped field runs with render: [] — particles compute (metrics flow) but are never drawn.
import { logNormalizeBetween, recipeById, weightToStrength } from "@fundamental-engine/core";
import { applyRecipe, withFlip } from "@fundamental-engine/platform";
import { pageRuntime } from "../../lib/page-runtime.ts";
import { wireSegments, wireFieldToggle } from "../../lib/controls.ts";
import { armEntryAtPace } from "../../lib/reading-pace.ts";

type MarketWeight = "cap" | "volume";
type MarketLens = "24h" | "7d";

// the CoinGecko /coins/markets row shape (the fields this page reads)
interface GeckoRow {
  id?: string;
  current_price?: number | null;
  market_cap?: number | null;
  total_volume?: number | null;
  price_change_percentage_24h_in_currency?: number | null;
  price_change_percentage_7d_in_currency?: number | null;
  sparkline_in_7d?: { price?: number[] } | null;
}

// same endpoint apps/site/scripts/snapshot-examples.mjs hits (CORS-enabled, free tier)
const LIVE_URL =
  "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=24&sparkline=true&price_change_percentage=24h,7d";
const POLL_MS = 60_000;
const FIRST_POLL_MS = 3_000;
const MAX_FAILURES = 3; // rate-limit courtesy: 3 consecutive misses → stop asking

const reduceMotion = (): boolean =>
  typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

// polarity ramp — must match the server-side render in market.astro:
// direction is hue (teal-green up, red-pink down), magnitude is intensity (vs a ±10% ceiling).
const catFor = (chg: number): string => {
  const t = Math.min(1, Math.abs(chg) / 10);
  return chg >= 0
    ? `hsl(${Math.round(168 - t * 18)} ${Math.round(34 + t * 46)}% ${Math.round(52 + t * 14)}%)`
    : `hsl(${Math.round(354 - t * 14)} ${Math.round(38 + t * 47)}% ${Math.round(56 + t * 12)}%)`;
};

// formatters + sparkline generator — must match the server-side render in market.astro
const fmtPrice = (p: number): string =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: p >= 1 ? 2 : 6,
  }).format(p);
const fmtCompact = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});
const badgeTxt = (chg: number): string => `${chg >= 0 ? "▲" : "▼"} ${Math.abs(chg).toFixed(2)}%`;
const downsample = (arr: number[] | undefined | null, n: number): number[] => {
  if (!arr || arr.length <= n) return arr ?? [];
  const out: number[] = [];
  for (let i = 0; i < n; i++) out.push(arr[Math.round((i * (arr.length - 1)) / (n - 1))]);
  return out;
};
const sparkPath = (s: number[]): string => {
  if (!s.length) return "";
  const min = Math.min(...s);
  const span = Math.max(...s) - min || 1;
  return s
    .map((v, i) => {
      const x = (i / Math.max(s.length - 1, 1)) * 120;
      const y = 25 - ((v - min) / span) * 22;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
};

const HINTS: Record<MarketWeight, string> = {
  cap: "<b>area</b> = market cap — the heavier the asset, the more page it takes",
  volume: "<b>area</b> = 24h volume — where the trading actually happened",
};

// tier: the tile's grid footprint — must match tierOf() in market.astro.
const TIERS = ["mk-t1", "mk-t2", "mk-t3", "mk-t4"] as const;
const tierOf = (w: number): string => (w > 0.8 ? "mk-t1" : w > 0.55 ? "mk-t2" : w > 0.35 ? "mk-t3" : "mk-t4");
const LENS_HINTS: Record<MarketLens, string> = {
  "24h": "<b>color</b> = the 24-hour move — direction is hue, magnitude is intensity",
  "7d": "<b>color</b> = the 7-day move — the week's drift, not the day's noise",
};

function initMarket(page: HTMLElement): () => void {
  const ac = new AbortController();
  const list = page.querySelector<HTMLElement>("[data-mk-list]");
  const rows = (): HTMLElement[] => [...page.querySelectorAll<HTMLElement>(".mk-tile")];
  const fieldBtn = page.querySelector<HTMLButtonElement>("[data-mk-field]");
  const weightBtns = [...page.querySelectorAll<HTMLButtonElement>("[data-mk-weight]")];
  const lensBtns = [...page.querySelectorAll<HTMLButtonElement>("[data-mk-lens]")];
  const hint = page.querySelector<HTMLElement>("[data-mk-hint]");
  const lensHint = page.querySelector<HTMLElement>("[data-mk-lens-hint]");

  let weight: MarketWeight = "cap";
  let lens: MarketLens = "24h";
  let fieldOn = true;
  let activeField: { destroy(): void } | null = null;

  // ── polarity lens — color is the move; size stays the weighting signal ────
  const applyLens = (): void => {
    for (const r of rows()) {
      const chg = Number(lens === "24h" ? r.dataset.c24 : r.dataset.c7) || 0;
      r.style.setProperty("--cat", catFor(chg));
    }
  };

  // the active weighting signal, read off a tile
  const valOf = (r: HTMLElement): number =>
    Number(weight === "cap" ? r.dataset.cap : r.dataset.volume) || 0;

  // recompute --w + data-strength from the active signal on every tile (the
  // scoped field re-measures naturally) WITHOUT touching tiers or order —
  // the live poll calls this alone; reweight() layers re-tier + re-sort on top.
  const recomputeWeights = (): Map<HTMLElement, number> => {
    const all = rows();
    const vals = all.map(valOf);
    const vMin = Math.min(...vals);
    const vMax = Math.max(...vals);
    const ws = new Map<HTMLElement, number>();
    for (const r of all) {
      const w = logNormalizeBetween(valOf(r), vMin, vMax);
      ws.set(r, w);
      r.style.setProperty("--w", w.toFixed(3));
      r.dataset.strength = weightToStrength(w).toFixed(2);
    }
    return ws;
  };

  // ── weighting — recompute --w + data-strength, RE-TIER, then FLIP re-sort ──
  // Tiles that keep their footprint FLIP in 2D (the mosaic moves them on both
  // axes); tiles whose tier changed settle with a fade — a translate cannot
  // honestly animate a size change.
  const reweight = (): void => {
    if (!list) return;
    const all = rows();
    // re-tiered tiles are excluded from the translate (their footprint changed)
    // and settle with a fade below.
    const retiered = new Set<HTMLElement>();
    // withFlip measures every tile BEFORE the mutation — top AND left, the mosaic is 2D.
    withFlip(
      () => all,
      () => {
        // 1) set the new weight on every tile (drives the type + the scoped field's
        //    pull) and swap the tier class — mass is area, so reweighting resizes
        const ws = recomputeWeights();
        for (const r of all) {
          const next = tierOf(ws.get(r) ?? 0);
          if (!r.classList.contains(next)) {
            r.classList.remove(...TIERS);
            r.classList.add(next);
            retiered.add(r);
          }
        }
        // 2) re-sort by the signal
        const ordered = [...all].sort((a, b) => valOf(b) - valOf(a));
        ordered.forEach((r) => list.appendChild(r));
        ordered.forEach((r, i) => {
          const rank = r.querySelector(".mk-rank");
          if (rank) rank.textContent = String(i + 1).padStart(2, "0");
          r.removeAttribute("data-mk-retiered");
        });
      },
      { exclude: (r) => retiered.has(r) },
    );
    // re-tiered tiles: restart the fade-settle (the attribute hooks the CSS animation)
    if (!reduceMotion()) {
      for (const r of retiered) {
        void r.offsetWidth;
        r.setAttribute("data-mk-retiered", "");
        r.addEventListener("animationend", () => r.removeAttribute("data-mk-retiered"), {
          once: true,
        });
      }
    }
  };

  // ── the invisible scoped field (render: []) ───────────────────────────────
  const runField = (): void => {
    activeField?.destroy();
    activeField = null;
    if (!fieldOn || !list) return;
    try {
      const base = recipeById("evidence-field");
      if (base) {
        // renderless — invisible; the extra "attention" metric asks the platform pipeline to
        // write --field-attention (eased engagement + center proximity + visibility) per tile.
        activeField = applyRecipe(list, base, {
          bodies: rows(),
          annotateBodies: false,
          renderless: true,
          extraMetrics: ["attention"],
        });
      }
    } catch {
      /* the static --w layer stands on its own */
    }
  };

  // ── sparkline entry draw-in — gated at reading pace ───────────────────────
  // Tiles entering the viewport get .mk-in; while the engine's live scroll velocity says
  // the user is scanning (or motion is reduced), .mk-in-instant is added too, so the path
  // is simply there instead of drawing. The gate is the shared armEntryAtPace primitive.
  const wireSparkDraw = (): void => {
    if (!list) return;
    list.setAttribute("data-mk-anim", "");
    armEntryAtPace(rows(), "mk-in", "mk-in-instant", ac.signal, { threshold: 0.15 });
  };

  // ── live data — the snapshot upgrades itself to a feed ─────────────────────
  // Once a minute (first poll ~3s in, skipped while the tab is hidden) re-fetch
  // the same CoinGecko endpoint the snapshot script uses and update tiles IN
  // PLACE. Assets match by id; ids the snapshot doesn't know are ignored — the
  // committed 24 are the page's bodies. Never throws: any fetch error reverts
  // silently to snapshot mode, and 3 consecutive failures stop the polling.
  const statusEl = page.querySelector<HTMLElement>("[data-mk-status]");
  const statusTxt = page.querySelector<HTMLElement>("[data-mk-status-txt]");
  const snapLabel = statusTxt?.textContent ?? "";
  let lastLiveAt = 0; // 0 = snapshot mode
  let failures = 0;
  let firstTimer: ReturnType<typeof setTimeout> | undefined;
  let pollTimer: ReturnType<typeof setInterval> | undefined;
  let tickTimer: ReturnType<typeof setInterval> | undefined;

  const setStatus = (): void => {
    if (!statusEl || !statusTxt) return;
    let next = snapLabel;
    if (lastLiveAt) {
      const s = Math.max(0, Math.round((Date.now() - lastLiveAt) / 1000));
      next = `live · updated ${s}s ago`;
      statusEl.dataset.live = "on";
    } else {
      delete statusEl.dataset.live;
    }
    if (statusTxt.textContent !== next) statusTxt.textContent = next;
  };

  // one-shot price flash — teal up, red down; the class leaves on animationend
  const flashPrice = (el: HTMLElement, up: boolean): void => {
    if (reduceMotion()) return;
    el.classList.remove("mk-tick-up", "mk-tick-down");
    void el.offsetWidth; // restart the animation if a tick is still running
    const cls = up ? "mk-tick-up" : "mk-tick-down";
    el.classList.add(cls);
    el.addEventListener("animationend", () => el.classList.remove(cls), { once: true });
  };

  const applyLive = (data: GeckoRow[]): void => {
    const byId = new Map(rows().map((r) => [r.id.replace(/^mk-/, ""), r]));
    for (const c of data) {
      const tile = c.id ? byId.get(c.id) : undefined;
      if (!tile) continue; // unknown/new id — not a body on this page
      // raw signals — the lens and the weighting read these
      if (c.market_cap != null) tile.dataset.cap = String(c.market_cap);
      if (c.total_volume != null) tile.dataset.volume = String(c.total_volume);
      if (c.price_change_percentage_24h_in_currency != null)
        tile.dataset.c24 = String(c.price_change_percentage_24h_in_currency);
      if (c.price_change_percentage_7d_in_currency != null)
        tile.dataset.c7 = String(c.price_change_percentage_7d_in_currency);
      // price text + one-shot tick flash on change
      const priceEl = tile.querySelector<HTMLElement>(".mk-price");
      if (priceEl && c.current_price != null) {
        const prev = Number(tile.dataset.price);
        tile.dataset.price = String(c.current_price);
        priceEl.textContent = fmtPrice(c.current_price);
        if (Number.isFinite(prev) && c.current_price !== prev)
          flashPrice(priceEl, c.current_price > prev);
      }
      const capEl = tile.querySelector<HTMLElement>(".mk-cap");
      if (capEl && c.market_cap != null) capEl.textContent = `${fmtCompact.format(c.market_cap)} cap`;
      // change badges — value + direction glyph, both windows
      for (const [win, chg] of [
        ["24h", Number(tile.dataset.c24) || 0],
        ["7d", Number(tile.dataset.c7) || 0],
      ] as const) {
        const el = tile.querySelector<HTMLElement>(`.mk-chg[data-win="${win}"]`);
        if (!el) continue;
        el.textContent = badgeTxt(chg);
        el.dataset.dir = chg >= 0 ? "up" : "down";
      }
      // sparkline — swap d with the same generator; no entry animation on an
      // update, and the path keeps pathLength="100"
      const sp = downsample(c.sparkline_in_7d?.price, 32);
      if (sp.length) tile.querySelector(".mk-spark path")?.setAttribute("d", sparkPath(sp));
    }
    applyLens(); // --cat through the ACTIVE lens (24h or 7d)
    recomputeWeights(); // --w + data-strength — the scoped field re-measures
    // deliberately NO re-tier / re-sort here — hostile under the cursor;
    // tiers re-settle on the next lens change.
  };

  const stopPolling = (): void => {
    if (firstTimer !== undefined) clearTimeout(firstTimer);
    if (pollTimer !== undefined) clearInterval(pollTimer);
    firstTimer = pollTimer = undefined;
  };

  const poll = async (): Promise<void> => {
    if (ac.signal.aborted || document.hidden) return;
    try {
      const res = await fetch(LIVE_URL, { signal: ac.signal });
      if (!res.ok) throw new Error(String(res.status));
      const data: unknown = await res.json();
      if (!Array.isArray(data)) throw new Error("unexpected shape");
      applyLive(data as GeckoRow[]);
      failures = 0;
      lastLiveAt = Date.now();
    } catch {
      if (ac.signal.aborted) return;
      failures += 1;
      lastLiveAt = 0; // revert silently to snapshot mode
      if (failures >= MAX_FAILURES) stopPolling();
    }
    setStatus();
  };

  const wireLive = (): void => {
    firstTimer = setTimeout(() => void poll(), FIRST_POLL_MS);
    pollTimer = setInterval(() => void poll(), POLL_MS);
    tickTimer = setInterval(setStatus, 1000); // the "Ns ago" tick
  };

  // ── controls ───────────────────────────────────────────────────────────────
  wireSegments(
    weightBtns,
    "mkWeight",
    (v) => {
      weight = (v as MarketWeight) || "cap";
      page.dataset.weight = weight;
      if (hint) hint.innerHTML = HINTS[weight];
      reweight();
    },
    ac.signal,
  );

  wireSegments(
    lensBtns,
    "mkLens",
    (v) => {
      lens = (v as MarketLens) || "24h";
      page.dataset.lens = lens;
      if (lensHint) lensHint.innerHTML = LENS_HINTS[lens];
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
      }
    },
    ac.signal,
  );

  applyLens();
  runField();
  wireSparkDraw();
  wireLive();

  return () => {
    ac.abort();
    stopPolling();
    if (tickTimer !== undefined) clearInterval(tickTimer);
    tickTimer = undefined;
    activeField?.destroy();
  };
}

pageRuntime(".ex-market", initMarket);
