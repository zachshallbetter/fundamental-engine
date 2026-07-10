// Newsroom Field runtime. Fundamental as an INVISIBLE measurement layer over one day of
// Wikipedia's most-read articles, laid out as a newspaper front page (lead / deck / index —
// placement is server-rendered from the ranking; the runtime never moves stories):
//   · Field on/off — off, the ink flattens (CSS via [data-field]) while the placement stays;
//     the scoped field is destroyed. On, the field runs and attention shows in the type.
//   · Color by trend / off — --cat encodes the day-over-day move (warm rising, cool falling,
//     neutral gray for entries with no prior-day count), or steps aside entirely.
//   · LIVE — ONCE per visit (the pageviews API publishes each finished day exactly once;
//     polling would be theater) the page looks for the latest fully-available day: UTC
//     yesterday, falling back one more day on 404. If that day is newer than the snapshot's,
//     it fetches the prior day too (for the trend) and REBUILDS the three zones — same shaping
//     rules as the snapshot script, same markup contract — then re-runs the scoped field over
//     the new bodies and re-applies the active lens. If the snapshot already is the latest
//     edition, the chip flips to live and nothing is rebuilt. Any failure keeps the snapshot.
// The scoped field runs with render: [] — particles compute (metrics flow) but are never drawn.
import { logNormalizeBetween, recipeById, weightToStrength } from "@fundamental-engine/core";
import { applyPattern } from "@fundamental-engine/dom";
import { wireLiveChip, politeLoop } from "../../lib/live-data";
import { pageRuntime } from "../../lib/page-runtime.ts";
import { wireSegments, wireFieldToggle } from "../../lib/controls.ts";
import { fmtInt } from "../../lib/fmt.ts";

type NewsroomLens = "trend" | "off";

// ── live-edition plumbing — mirrors apps/site/scripts/snapshot-examples.mjs ──
interface WikiArticle {
  title: string;
  slug: string;
  views: number;
  rank: number;
  priorViews: number | null;
  url: string;
}
interface WikiTop {
  items?: { articles?: { article: string; views: number; rank: number }[] }[];
}

const API = "https://wikimedia.org/api/rest_v1/metrics/pageviews/top/en.wikipedia/all-access";
const SKIP = /^(Main_Page|Special:|Wikipedia:|Portal:|Help:|File:|Talk:|User:)/;
const FIRST_CHECK_MS = 4_000;

const pad2 = (n: number): string => String(n).padStart(2, "0");
const pathOf = (d: Date): string =>
  `${d.getUTCFullYear()}/${pad2(d.getUTCMonth() + 1)}/${pad2(d.getUTCDate())}`;
const labelOf = (path: string): string =>
  new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${path.replaceAll("/", "-")}T00:00:00Z`));

// formatters — must match the server-side render in newsroom.astro
const pctOf = (a: { views: number; priorViews: number | null }): number | null =>
  a.priorViews ? ((a.views - a.priorViews) / a.priorViews) * 100 : null;
const badgeTxt = (pct: number | null): string =>
  pct === null ? "new" : `${pct >= 0 ? "▲" : "▼"} ${Math.abs(pct).toFixed(1)}%`;
const dirOf = (pct: number | null): string => (pct === null ? "new" : pct >= 0 ? "up" : "down");

// polarity ramp — must match the server-side render in newsroom.astro:
// direction is hue (warm rising, cool falling), magnitude is intensity (vs a ±60% ceiling);
// no prior count = new → neutral gray-blue, no fake direction.
const catFor = (pct: number | null): string => {
  if (pct === null) return "#8a93a6";
  const t = Math.min(1, Math.abs(pct) / 60);
  return pct >= 0
    ? `hsl(${Math.round(32 - t * 10)} ${Math.round(42 + t * 46)}% ${Math.round(56 + t * 8)}%)`
    : `hsl(${Math.round(208 + t * 12)} ${Math.round(34 + t * 46)}% ${Math.round(58 + t * 8)}%)`;
};

const LENS_HINTS: Record<NewsroomLens, string> = {
  trend: "<b>color</b> = the day-over-day move — warm rising, cool falling, gray new",
  off: "<b>color</b> = off — size and placement carry the whole signal",
};

function initNewsroom(page: HTMLElement): () => void {
  const ac = new AbortController();
  const list = page.querySelector<HTMLElement>("[data-nw-list]");
  const rows = (): HTMLElement[] => [...page.querySelectorAll<HTMLElement>(".nw-row")];
  const fieldBtn = page.querySelector<HTMLButtonElement>("[data-nw-field]");
  const lensBtns = [...page.querySelectorAll<HTMLButtonElement>("[data-nw-lens]")];
  const lensHint = page.querySelector<HTMLElement>("[data-nw-lens-hint]");

  let lens: NewsroomLens = "trend";
  let fieldOn = true;
  let activeField: { destroy(): void } | null = null;

  // ── polarity lens — color is the move; size stays pageviews ──────────────
  const applyLens = (): void => {
    for (const r of rows()) {
      if (lens === "off") {
        r.style.setProperty("--cat", "#4da3ff");
        continue;
      }
      const v = Number(r.dataset.views) || 0;
      const prior = Number(r.dataset.prior) || 0;
      const pct = prior ? ((v - prior) / prior) * 100 : null;
      r.style.setProperty("--cat", catFor(pct));
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
        // write --field-attention (eased engagement + center proximity + visibility) per
        // story — the index item nearest the viewport center sharpens. Placement never moves.
        activeField = applyPattern(list, base, {
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

  // ── live edition — ONCE per visit, the page checks for a newer finished day ──
  // The committed snapshot stays the SSR baseline and the no-JS truth; if the API
  // says a newer day is fully available, the three zones are rebuilt from it with
  // the snapshot script's shaping rules and the page's exact markup contract.
  const statusEl = page.querySelector<HTMLElement>("[data-nw-status]");
  const dateline = page.querySelector<HTMLElement>("[data-nw-dateline]");
  const heroDay = page.querySelector<HTMLElement>("[data-nw-day-text]");
  const chip = wireLiveChip(statusEl, (statusEl?.textContent ?? "").replace(/^snapshot · /, ""));

  // one row's inner markup — must match newsroom.astro exactly
  const el = (tag: string, cls: string, text?: string): HTMLElement => {
    const e = document.createElement(tag);
    e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  };
  const titleLink = (a: WikiArticle): HTMLAnchorElement => {
    const link = document.createElement("a");
    link.className = "nw-title";
    link.href = a.url;
    link.target = "_blank";
    link.rel = "noopener";
    link.textContent = a.title;
    return link;
  };
  const metaLine = (a: WikiArticle, lead: boolean): HTMLElement => {
    const wrap = el(lead ? "p" : "span", lead ? "nw-lead-meta" : "nw-meta-line");
    const pct = pctOf(a);
    const chg = el("span", "nw-chg", badgeTxt(pct));
    chg.dataset.dir = dirOf(pct);
    wrap.append(el("span", "nw-count", fmtInt(a.views)), el("span", "nw-count-l", "views"), chg);
    return wrap;
  };
  const bodyAttrs = (e: HTMLElement, a: WikiArticle, w: number): void => {
    e.dataset.body = "attract";
    e.setAttribute("data-feedback", "");
    e.setAttribute("data-hot", "");
    e.dataset.range = "200";
    e.dataset.strength = weightToStrength(w).toFixed(2);
    e.dataset.views = String(a.views);
    e.dataset.prior = a.priorViews == null ? "" : String(a.priorViews);
    e.style.setProperty("--w", w.toFixed(3));
    e.style.setProperty("--cat", catFor(pctOf(a)));
  };

  // rebuild the three zones — lead (rank 1), deck (2–7), index (the rest)
  const rebuild = (articles: WikiArticle[]): void => {
    if (!list) return;
    const views = articles.map((a) => a.views);
    const vMin = Math.min(...views);
    const vMax = Math.max(...views);
    const wOf = (v: number): number => logNormalizeBetween(v, vMin, vMax);

    const top = articles[0]!;
    const leadEl = el("article", "nw-row nw-lead");
    bodyAttrs(leadEl, top, wOf(top.views));
    leadEl.append(el("p", "nw-zone-l", "The lead · rank 01"), titleLink(top), metaLine(top, true));

    const item = (a: WikiArticle, cls: string): HTMLElement => {
      const li = el("li", `nw-row ${cls}`);
      bodyAttrs(li, a, wOf(a.views));
      li.append(el("span", "nw-rank", String(a.rank).padStart(2, "0")), titleLink(a), metaLine(a, false));
      return li;
    };
    const deckOl = el("ol", "nw-deck");
    deckOl.setAttribute("aria-label", "Ranks 2 through 7");
    deckOl.append(...articles.slice(1, 7).map((a) => item(a, "nw-deck-item")));
    const indexOl = el("ol", "nw-index");
    indexOl.setAttribute("aria-label", "Ranks 8 and below");
    indexOl.append(...articles.slice(7).map((a) => item(a, "nw-index-item")));

    list.replaceChildren(leadEl, deckOl, indexOl);
  };

  const fetchDay = async (path: string): Promise<WikiTop | null> => {
    const res = await fetch(`${API}/${path}`, { signal: ac.signal });
    if (res.status === 404) return null; // that day isn't finished yet
    if (!res.ok) throw new Error(String(res.status));
    return (await res.json()) as WikiTop;
  };

  const refresh = async (): Promise<void> => {
    // the latest fully-available day: UTC yesterday, falling back one more on 404
    let dayPath = pathOf(new Date(Date.now() - 86400e3));
    let data = await fetchDay(dayPath);
    if (!data) {
      dayPath = pathOf(new Date(Date.now() - 2 * 86400e3));
      data = await fetchDay(dayPath);
    }
    if (!data) throw new Error("no finished day available");
    const snapDay = list?.dataset.nwDay ?? "";
    if (dayPath <= snapDay) {
      // the snapshot already is the latest edition — verified, nothing to rebuild
      if (statusEl) statusEl.title = "already today's edition";
      return;
    }
    // the prior day, for the trend
    const dayDate = new Date(`${dayPath.replaceAll("/", "-")}T00:00:00Z`);
    const prior = await fetchDay(pathOf(new Date(dayDate.getTime() - 86400e3)));
    if (!prior) throw new Error("prior day unavailable");
    const priorViews = new Map<string, number>(
      (prior.items?.[0]?.articles ?? []).map((a) => [a.article, a.views]),
    );
    // shape — the snapshot script's rules: skip service pages, take 30, slug → title
    const articles: WikiArticle[] = (data.items?.[0]?.articles ?? [])
      .filter((a) => !SKIP.test(a.article))
      .slice(0, 30)
      .map((a) => ({
        title: a.article.replace(/_/g, " "),
        slug: a.article,
        views: a.views,
        rank: a.rank,
        priorViews: priorViews.get(a.article) ?? null,
        url: `https://en.wikipedia.org/wiki/${a.article}`,
      }));
    if (articles.length < 8) throw new Error("unexpected shape");
    rebuild(articles);
    if (list) list.dataset.nwDay = dayPath;
    const label = labelOf(dayPath);
    if (dateline) dateline.textContent = `edition: ${label} (UTC)`;
    if (heroDay) heroDay.textContent = label;
    if (statusEl) statusEl.title = `upgraded to the ${label} edition`;
    applyLens(); // --cat through the ACTIVE lens over the new bodies
    runField(); // destroy + re-apply the scoped field over the new bodies
  };

  politeLoop({
    run: refresh,
    firstDelayMs: FIRST_CHECK_MS,
    everyMs: null, // refresh ONCE per visit — the source updates daily
    signal: ac.signal,
    onSuccess: () => chip.ok(),
    onFailure: () => chip.fail(),
  });

  // ── controls ───────────────────────────────────────────────────────────────
  wireSegments(
    lensBtns,
    "nwLens",
    (v) => {
      lens = (v as NewsroomLens) || "trend";
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

  return () => {
    ac.abort();
    chip.destroy();
    activeField?.destroy();
  };
}

pageRuntime(".ex-newsroom", initNewsroom);
