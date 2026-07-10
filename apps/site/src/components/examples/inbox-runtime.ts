// Inbox Field runtime. Fundamental as an INVISIBLE measurement layer over real unanswered
// Stack Overflow questions, with attention as a CONSERVED budget — and a PLACE:
//   · every ask's urgency u = a lens-weighted blend of its recency / votes / views
//     (server-computed, carried as data-rec / data-vot / data-vie; recency is the core
//     freshness kernel over askedAt — also declared as data-field-at, which grounds the
//     platform pipeline's --field-recency lane in world time);
//   · weights are renormalized so Σw is pinned to a fixed budget (N × 0.42), capped at 1 with
//     water-filling — the attention meter always reads 100% allocated, by construction. The
//     sum runs over EVERY ask, stream and focus pane alike;
//   · click an ask to PIN it: its card travels into the focus pane (a 2D FLIP move) and holds
//     w = 1; the remaining budget redistributes over the unpinned stream. Unpin it and the
//     card returns to its place in the stream's current sort order;
//   · lens segments (fresh / voted / seen) re-blend the urgency and FLIP re-sort the stream;
//   · LIVE ARRIVALS — every 5 minutes (politely: hidden tabs skip, 3 consecutive misses retire
//     the loop, and the API's backoff field is honored) the page re-polls the same unanswered-
//     [javascript] feed the snapshot script uses. New asks (deduped by question id against
//     everything on the page) enter at the stream top as full bodies — the exact card contract,
//     marked data-live-item so the age reads "new" instead of a snapshot-relative figure — then
//     the budget renormalizes over the larger field (N grew; Σw = N × 0.42 stays exact) and the
//     scoped field re-binds. Past 60 unpinned items, the oldest asks decay off the bottom (a
//     brief fade, removal, renormalize again);
//   · Field on/off — off, the page collapses to a plain list (CSS via [data-field]) and the
//     scoped field is destroyed.
// The scoped field runs render-less (applyPattern renderless) — bodies compute (metrics flow) but nothing is drawn.
import {
  allocateAttention,
  freshness,
  logNormalizeBetween,
  patternById,
  weightToStrength,
} from "@fundamental-engine/core";
import { applyPattern, withFlip } from "@fundamental-engine/dom";
import { wireFieldToggle, wireSegments } from "../../lib/controls";
import { politeLoop, wireLiveChip } from "../../lib/live-data";
import { pageRuntime } from "../../lib/page-runtime";

type IxLens = "fresh" | "voted" | "seen";

const BUDGET_PER_ITEM = 0.42;
const STREAM_CAP = 60; // unpinned items the stream holds before the oldest decay off
// recency's half-life — must match the server-side render in inbox.astro (the platform
// default: 7 days). Live arrivals are scored with the same kernel, so they land on the
// same absolute scale as the snapshot — no normalization constants needed for recency.
const REC_HALF_LIFE_MS = 7 * 86_400_000;

// the same feed apps/site/scripts/snapshot-examples.mjs snapshots (CORS-enabled, no key;
// the anonymous quota is ~300/day, so the cadence stays a courteous 5 minutes)
const LIVE_URL =
  "https://api.stackexchange.com/2.3/questions/no-answers?site=stackoverflow&tagged=javascript&filter=default&order=desc&sort=creation&pagesize=20";
const FIRST_POLL_MS = 4_000;
const POLL_MS = 5 * 60_000;
const MAX_FAILURES = 3;

// the Stack Exchange /questions row shape (the fields this page reads)
interface SeQuestion {
  question_id?: number;
  title?: string;
  tags?: unknown;
  score?: number;
  view_count?: number;
  creation_date?: number;
  link?: string;
  owner?: { display_name?: string } | null;
}

// the normalization constants the server rendered with — live arrivals are scored on the
// same scale (vot/vie clamped: a hot new ask can sit past the snapshot's edge; rec is the
// freshness kernel — absolute, so it needs no constants at all). Views carry their RAW
// min/max so the runtime re-runs core's logNormalizeBetween identically to the snapshot.
interface IxNorm {
  sMin: number;
  sSpan: number;
  vMin: number;
  vMax: number;
}

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));
const fmtViews = (v: number): string => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v));
// API titles arrive HTML-entity-encoded; a detached textarea decodes them as plain text
const decodeEntities = (s: string): string => {
  const t = document.createElement("textarea");
  t.innerHTML = s;
  return t.value;
};

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

function initInbox(page: HTMLElement): () => void {
  const ac = new AbortController();
  const split = page.querySelector<HTMLElement>("[data-ix-split]");
  const list = page.querySelector<HTMLElement>("[data-ix-list]");
  const focusPane = page.querySelector<HTMLElement>("[data-ix-focus]");
  const focusList = page.querySelector<HTMLElement>("[data-ix-focus-list]");
  const focusN = page.querySelector<HTMLElement>("[data-ix-focus-n]");
  const fieldBtn = page.querySelector<HTMLButtonElement>("[data-ix-field]");
  const lensBtns = [...page.querySelectorAll<HTMLButtonElement>("[data-ix-lens]")];
  const meter = page.querySelector<HTMLElement>("[data-ix-meter]");
  const hint = page.querySelector<HTMLElement>("[data-ix-hint]");
  if (!split || !list || !focusList) return () => {};

  let lens: IxLens = (page.dataset.lens as IxLens) || "fresh";
  let fieldOn = true;
  let activeField: { destroy(): void } | null = null;
  const pinned = new Set<HTMLElement>();

  // EVERY ask, both panes — the conserved sum runs over all of them.
  const itemsOf = () => [...split.querySelectorAll<HTMLElement>(".ix-item")];
  const streamItems = () => [...list.querySelectorAll<HTMLElement>(".ix-item")];

  const urgencyOf = (it: HTMLElement): number => {
    const b = BLENDS[lens];
    return (
      b.rec * (Number(it.dataset.rec) || 0) +
      b.vot * (Number(it.dataset.vot) || 0) +
      b.vie * (Number(it.dataset.vie) || 0)
    );
  };

  // ── 2D FLIP — measure every card (both panes), mutate the DOM, then play the
  // inverted transforms so moves between stream and focus visibly travel. ──────
  const flip = (mutate: () => void): void => withFlip(itemsOf, mutate);

  // ── the conserved budget: pins hold w=1 in the focus pane; the rest water-fill
  // what remains (core's allocateAttention — §2.4's one finite budget). Σ--w across
  // BOTH panes stays at the budget, always. ────────────────────────────────────
  const reallocate = (): void => {
    const items = itemsOf();
    const budget = items.length * BUDGET_PER_ITEM;
    const ws = allocateAttention(
      items.map((it) => ({ urgency: urgencyOf(it), pinned: pinned.has(it) })),
      budget,
    );
    for (const [i, it] of items.entries()) {
      const w = ws[i] ?? 0;
      it.style.setProperty("--w", w.toFixed(3));
      it.dataset.strength = weightToStrength(w).toFixed(2);
      const bar = it.querySelector<HTMLElement>(".ix-share i");
      if (bar) bar.style.width = `${Math.round(w * 100)}%`;
    }
    if (meter)
      meter.textContent = `100% allocated · pinned ${pinned.size} · free ${Math.max(
        0,
        budget - pinned.size,
      ).toFixed(1)}`;
  };

  // the focus pane's header count + empty-state hint
  const syncFocus = (): void => {
    focusPane?.toggleAttribute("data-has-pins", pinned.size > 0);
    if (focusN) focusN.textContent = `${pinned.size} pinned`;
  };

  // ── lens change: re-blend, then FLIP re-sort the stream so it visibly re-settles ──
  const resort = (): void => {
    const ordered = [...streamItems()].sort(
      (a, b) => Number(b.style.getPropertyValue("--w")) - Number(a.style.getPropertyValue("--w")),
    );
    flip(() => ordered.forEach((it) => list.appendChild(it)));
  };

  // ── the invisible scoped field (renderless) — scoped to the split so both panes count ──
  const runField = (): void => {
    activeField?.destroy();
    activeField = null;
    if (!fieldOn) return;
    try {
      const base = patternById("evidence-field");
      if (base) {
        // renderless keeps the field invisible; the extra metric lanes ask the platform
        // pipeline to write --field-attention per ask (an eased 0..1 blend of engagement,
        // viewport-center proximity, and visibility) and --field-recency — GROUNDED in each
        // ask's declared data-field-at (askedAt), so it decays on the world clock.
        activeField = applyPattern(split, base, {
          bodies: itemsOf(),
          annotateBodies: false,
          renderless: true,
          extraMetrics: ["attention", "recency"],
        });
      }
    } catch {
      /* the static --w layer stands on its own */
    }
  };

  // ── live arrivals — the snapshot upgrades itself to a feed ──────────────────
  // The chip in the controls row narrates the state: "snapshot · <date>" until the
  // first successful poll, "live · checked Ns ago" (ticking) after it.
  const chipEl = page.querySelector<HTMLElement>("[data-ix-live]");
  const chip = wireLiveChip(chipEl, chipEl?.dataset.snapshot ?? "");

  // build a stream card with the EXACT contract the server renders — every attribute the
  // field, the lenses, and the budget read. Live items carry data-live-item and an honest
  // "new" tick where snapshot cards carry a snapshot-relative age.
  const buildCard = (q: SeQuestion, n: IxNorm, now: number): HTMLElement => {
    const title = decodeEntities(q.title ?? "");
    const askedMs = (q.creation_date ?? now) * 1000;
    // the core temporal kernel — same shape, same half-life as the server's data-rec
    const rec = freshness(askedMs, now * 1000, REC_HALF_LIFE_MS);
    const vot = clamp01(((q.score ?? 0) - n.sMin) / n.sSpan);
    // identical helper, identical raw extremes as the snapshot — { equal: 0 } matches the
    // server's degenerate convention (an all-equal set reads 0, like the linear vot lane)
    const vie = logNormalizeBetween(q.view_count ?? 0, n.vMin, n.vMax, { equal: 0 });

    const li = document.createElement("li");
    li.className = "ix-item";
    li.id = `q-${q.question_id}`;
    li.dataset.body = "attract";
    li.setAttribute("data-feedback", "");
    li.setAttribute("data-hot", "");
    li.dataset.range = "200";
    li.dataset.strength = "0.40"; // reallocate() assigns the real mass immediately
    li.dataset.rec = rec.toFixed(4);
    li.dataset.vot = vot.toFixed(4);
    li.dataset.vie = vie.toFixed(4);
    li.dataset.asked = String(q.creation_date ?? Math.round(now));
    // the declared world timestamp — grounds the platform's recency lane (--field-recency)
    li.setAttribute("data-field-at", String(Math.round(askedMs)));
    li.setAttribute("data-live-item", "");
    li.style.setProperty("--w", "0.000");
    li.style.setProperty("--cat", `hsl(${Math.round(205 + rec * 125)} 74% 64%)`);

    const body = document.createElement("div");
    body.className = "ix-body";
    const a = document.createElement("a");
    a.className = "ix-title";
    a.href = q.link ?? "#";
    a.target = "_blank";
    a.rel = "noopener";
    a.textContent = title;
    const meta = document.createElement("span");
    meta.className = "ix-meta";
    const tagsEl = document.createElement("span");
    tagsEl.className = "ix-tags";
    const tags = Array.isArray(q.tags)
      ? q.tags.filter((t): t is string => typeof t === "string")
      : [];
    for (const t of tags) {
      const tag = document.createElement("span");
      tag.className = "ix-tag";
      tag.textContent = t;
      tagsEl.appendChild(tag);
    }
    const rest = document.createElement("span");
    rest.className = "ix-meta-rest";
    const tick = document.createElement("span");
    tick.className = "ix-new";
    tick.textContent = "new";
    rest.append(tick, ` · ${decodeEntities(q.owner?.display_name ?? "unknown")}`);
    meta.append(tagsEl, rest);
    body.append(a, meta);

    const stats = document.createElement("div");
    stats.className = "ix-stats";
    const stat = (val: string, label: string): HTMLElement => {
      const s = document.createElement("span");
      s.className = "ix-stat";
      const b = document.createElement("b");
      b.textContent = val;
      const l = document.createElement("span");
      l.className = "ix-stat-l";
      l.textContent = label;
      s.append(b, l);
      return s;
    };
    const share = document.createElement("span");
    share.className = "ix-share";
    share.setAttribute("aria-hidden", "true");
    share.appendChild(document.createElement("i"));
    stats.append(
      stat(String(q.score ?? 0), "votes"),
      stat(fmtViews(q.view_count ?? 0), "views"),
      share,
    );

    const pin = document.createElement("button");
    pin.className = "ix-pin";
    pin.type = "button";
    pin.setAttribute("aria-pressed", "false");
    pin.setAttribute("aria-label", `Pin "${title}"`);
    pin.textContent = "pin";

    li.append(body, stats, pin);
    return li;
  };

  // decay off the bottom: past STREAM_CAP unpinned items, the OLDEST asks leave —
  // a brief fade, removal, then the budget renormalizes over the smaller field.
  const trimStream = (): void => {
    const unpinned = streamItems().filter((it) => !pinned.has(it));
    const excess = unpinned.length - STREAM_CAP;
    if (excess <= 0) return;
    const leaving = [...unpinned]
      .sort((a, b) => (Number(a.dataset.asked) || 0) - (Number(b.dataset.asked) || 0))
      .slice(0, excess);
    const finish = (): void => {
      if (ac.signal.aborted) return;
      leaving.forEach((it) => it.remove());
      reallocate(); // N shrank — Σw re-pins to the smaller budget, exactly
      runField(); // the scoped field re-binds without the departed bodies
    };
    if (reduceMotion()) {
      finish();
      return;
    }
    leaving.forEach((it) => it.setAttribute("data-ix-leaving", ""));
    window.setTimeout(finish, 450); // matches the CSS fade
  };

  // new asks enter the field: dedupe by question id against EVERYTHING on the page
  // (stream and focus pane), prepend with the existing FLIP settle plus a brief
  // opacity+rise entry, renormalize over the larger N, re-bind the scoped field.
  const applyArrivals = (rows: SeQuestion[], n: IxNorm): void => {
    const known = new Set(itemsOf().map((it) => it.id));
    const now = Date.now() / 1000;
    const fresh = rows
      .filter((q) => Number.isFinite(q.question_id) && !known.has(`q-${q.question_id}`))
      .map((q) => buildCard(q, n, now));
    if (!fresh.length) return;
    const anchor = list.firstChild;
    flip(() => fresh.forEach((c) => list.insertBefore(c, anchor)));
    if (!reduceMotion())
      fresh.forEach((c) => {
        c.setAttribute("data-ix-entering", "");
        c.addEventListener("animationend", () => c.removeAttribute("data-ix-entering"), {
          once: true,
        });
      });
    reallocate(); // N grew — the budget grows with it; Σw = N × 0.42, still exact
    runField(); // destroy + re-apply so the new bodies join the scoped field
    trimStream();
  };

  const wireArrivals = (): void => {
    if (typeof fetch !== "function") return;
    let norm: IxNorm | null = null;
    try {
      norm = JSON.parse(list.dataset.ixNorm ?? "") as IxNorm;
    } catch {
      /* no normalization constants — the page stays a snapshot */
    }
    if (!norm) return;
    const n = norm;
    let notBefore = 0; // the API's backoff contract: don't ask again before this
    politeLoop({
      run: async () => {
        if (Date.now() < notBefore) return; // honoring backoff — a skip, not a failure
        const res = await fetch(LIVE_URL, { signal: ac.signal });
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as { items?: unknown; backoff?: number };
        if (typeof data?.backoff === "number")
          notBefore = Date.now() + data.backoff * 1000;
        if (!Array.isArray(data?.items)) throw new Error("unexpected shape");
        applyArrivals(data.items as SeQuestion[], n);
        chip.ok();
      },
      firstDelayMs: FIRST_POLL_MS,
      everyMs: POLL_MS,
      maxFailures: MAX_FAILURES,
      signal: ac.signal,
      onFailure: () => chip.fail(),
    });
  };

  // ── pinning — click anywhere on an ask, in either pane (links keep navigating).
  // Pin: the card travels to the focus pane. Unpin: it returns to its place in the
  // stream's current sort order. ───────────────────────────────────────────────
  split.addEventListener(
    "click",
    (e) => {
      if (!fieldOn) return;
      const t = e.target as HTMLElement;
      if (t.closest("a")) return;
      const item = t.closest<HTMLElement>(".ix-item");
      if (!item || !split.contains(item)) return;
      if (pinned.has(item)) {
        pinned.delete(item);
        item.removeAttribute("data-pinned");
        // recompute first so the returning card carries its competitive weight…
        reallocate();
        // …then slot it back by the stream's current descending --w order.
        flip(() => {
          const w = Number(item.style.getPropertyValue("--w")) || 0;
          const next = streamItems().find(
            (s) => (Number(s.style.getPropertyValue("--w")) || 0) < w,
          );
          list.insertBefore(item, next ?? null);
        });
      } else {
        pinned.add(item);
        item.setAttribute("data-pinned", "");
        flip(() => focusList.appendChild(item));
        reallocate();
      }
      const btn = item.querySelector<HTMLButtonElement>(".ix-pin");
      btn?.setAttribute("aria-pressed", String(pinned.has(item)));
      syncFocus();
    },
    { signal: ac.signal },
  );

  // ── controls ─────────────────────────────────────────────────────────────
  wireSegments(
    lensBtns,
    "ixLens",
    (value) => {
      lens = (value as IxLens) || "fresh";
      page.dataset.lens = lens;
      if (hint) hint.innerHTML = HINTS[lens];
      reallocate();
      resort();
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

  reallocate();
  syncFocus();
  runField();
  wireArrivals();

  return () => {
    ac.abort();
    chip.destroy();
    activeField?.destroy();
  };
}

pageRuntime(".ex-inbox", initInbox);
