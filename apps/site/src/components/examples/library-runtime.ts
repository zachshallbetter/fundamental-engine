// Library Field runtime. Fundamental as an INVISIBLE measurement layer over the month's
// most-listened ListenBrainz recordings, laid out as a ranked bar ladder, with the queue
// as a genuine field SINK:
//   · each row's mass --w is its log-normalized listen count (server-computed, static);
//     --bar (also server-computed) is the linear listens/max share that sets the row's
//     background bar length — the runtime never touches it;
//   · the queue panel carries data-body="sink" data-absorb data-max="8" and is registered
//     in the same scoped field as the rows — the ENGINE writes --load back into it as
//     matter accretes (CSS turns that into a glow). Separately, an honestly-labeled UI
//     bar counts queued/8 — that channel is data, not the field;
//   · "+ queue" adds a track chip (the row's button disables); × removes it; at 8/8 the
//     queue RELEASES — clears with a brief settle and reports "released 8 tracks",
//     mirroring the engine's capture→release cycle;
//   · the color lens hashes artists onto the palette (server-assigned) or switches off;
//   · Field on/off — off, the page collapses to a plain list (CSS via [data-field]) and
//     the scoped field is destroyed; the queue keeps counting (it is the UI channel).
//   · LIVE — ONCE per visit (the monthly window moves daily; polling would be theater) the
//     page re-fetches the same ListenBrainz endpoint the snapshot script uses and updates
//     listens IN PLACE — counts, --bar (vs the new max), --w (log mass) — matching rows by
//     recording mbid (track+artist as the fallback). If the ranking changed, the ladder FLIP
//     re-sorts and the rank gutter renumbers. Rows that fell out of the live top 30 stay,
//     dimmed and labeled — no row removal mid-visit; new entrants are NOT added (the
//     snapshot's 30 are the page's bodies). Any failure keeps the snapshot.
// The scoped field runs with render: [] — bodies compute (metrics flow) but nothing is drawn.
import { logNormalizeBetween, recipeById, weightToStrength } from "@fundamental-engine/core";
import { applyRecipe } from "@fundamental-engine/platform";
import { wireLiveChip, politeLoop } from "../../lib/live-data";
import { pageRuntime } from "../../lib/page-runtime.ts";
import { wireSegments, wireFieldToggle } from "../../lib/controls.ts";
import { fmtInt } from "../../lib/fmt.ts";
import { armEntryAtPace } from "../../lib/reading-pace.ts";

type LbLens = "artist" | "off";

const QUEUE_MAX = 8;
const SINGLE_HUE = "#60a5fa";

// the same endpoint apps/site/scripts/snapshot-examples.mjs hits (CORS-enabled, no key)
const LIVE_URL = "https://api.listenbrainz.org/1/stats/sitewide/recordings?range=month&count=30";
const FIRST_CHECK_MS = 4_000;

interface LbRecording {
  track_name?: string;
  artist_name?: string;
  listen_count?: number;
  recording_mbid?: string | null;
}

const HINTS: Record<LbLens, string> = {
  artist: "<b>color</b> = artist — one palette hue per act, hashed from the name",
  off: "<b>color</b> = off — a single hue; mass carries the whole signal",
};

const reduceMotion = () =>
  typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

function initLibrary(page: HTMLElement): () => void {
  const ac = new AbortController();
  const scope = page.querySelector<HTMLElement>("[data-lb-scope]");
  const list = page.querySelector<HTMLElement>("[data-lb-list]");
  const queue = page.querySelector<HTMLElement>("[data-lb-queue]");
  const chips = page.querySelector<HTMLElement>("[data-lb-chips]");
  const count = page.querySelector<HTMLElement>("[data-lb-count]");
  const fill = page.querySelector<HTMLElement>("[data-lb-fill]");
  const empty = page.querySelector<HTMLElement>("[data-lb-empty]");
  const release = page.querySelector<HTMLElement>("[data-lb-release]");
  const fieldBtn = page.querySelector<HTMLButtonElement>("[data-lb-field]");
  const lensBtns = [...page.querySelectorAll<HTMLButtonElement>("[data-lb-lens]")];
  const lensHint = page.querySelector<HTMLElement>("[data-lb-lens-hint]");
  if (!list || !queue || !chips) return () => {};

  let lens: LbLens = (page.dataset.lens as LbLens) || "artist";
  let fieldOn = true;
  let releasing = false;
  let activeField: { destroy(): void } | null = null;
  const queued = new Map<HTMLElement, HTMLElement>(); // row → chip

  const rowsOf = (): HTMLElement[] => [...list.querySelectorAll<HTMLElement>(".lb-row")];

  // ── color lens — orthogonal to mass: size stays listens, color shows the act ──
  const applyLens = (): void => {
    for (const r of rowsOf()) {
      r.style.setProperty(
        "--cat",
        lens === "artist" ? r.dataset.artistColor || SINGLE_HUE : SINGLE_HUE,
      );
    }
  };

  // ── the invisible scoped field (render: []) ──────────────────────────────
  // The sink panel joins the rows as a body, so the engine genuinely writes --load
  // into it as matter accretes — that channel drives the glow, nothing else.
  const runField = (): void => {
    activeField?.destroy();
    activeField = null;
    if (!fieldOn || !scope) return;
    try {
      const base = recipeById("evidence-field");
      if (base) {
        // renderless — invisible; the extra "attention" metric asks the platform pipeline to
        // write --field-attention (eased engagement + center proximity + visibility) per row.
        const bodies = rowsOf();
        bodies.push(queue);
        activeField = applyRecipe(scope, base, {
          bodies,
          annotateBodies: false,
          renderless: true,
          extraMetrics: ["attention"],
        });
      }
    } catch {
      /* the static --w layer stands on its own */
    }
  };

  // ── the UI channel: queued/8 — a plain counter, deliberately not the field ──
  const syncQueue = (): void => {
    const n = queued.size;
    if (count) count.textContent = `${n} / ${QUEUE_MAX}`;
    if (fill) fill.style.width = `${Math.round((n / QUEUE_MAX) * 100)}%`;
    if (empty) empty.hidden = n > 0;
  };

  // ── release — at capacity the queue clears, like the engine's sink letting go ──
  const releaseQueue = (): void => {
    if (releasing) return;
    releasing = true;
    const rows = [...queued.keys()];
    queue.setAttribute("data-releasing", "");
    const settle = (): void => {
      if (ac.signal.aborted) return;
      chips.replaceChildren();
      queued.clear();
      for (const r of rows) {
        const btn = r.querySelector<HTMLButtonElement>("[data-lb-add]");
        if (btn) btn.disabled = false;
      }
      queue.removeAttribute("data-releasing");
      releasing = false;
      syncQueue();
      if (release) {
        release.textContent = `released ${rows.length} tracks`;
        release.hidden = false;
      }
    };
    if (reduceMotion()) settle();
    else setTimeout(settle, 650);
  };

  const removeChip = (row: HTMLElement): void => {
    const chip = queued.get(row);
    if (!chip) return;
    chip.remove();
    queued.delete(row);
    const btn = row.querySelector<HTMLButtonElement>("[data-lb-add]");
    if (btn) btn.disabled = false;
    syncQueue();
  };

  const addTrack = (row: HTMLElement, btn: HTMLButtonElement): void => {
    if (releasing || queued.has(row) || queued.size >= QUEUE_MAX) return;
    const title = row.querySelector(".lb-title")?.textContent?.trim() ?? "track";
    const chip = document.createElement("li");
    chip.className = "lb-chip";
    chip.style.setProperty("--cat", row.style.getPropertyValue("--cat") || SINGLE_HUE);
    const label = document.createElement("span");
    label.className = "lb-chip-t";
    label.textContent = title;
    const x = document.createElement("button");
    x.type = "button";
    x.className = "lb-chip-x";
    x.textContent = "×";
    x.setAttribute("aria-label", `Remove "${title}" from queue`);
    x.addEventListener("click", () => removeChip(row), { signal: ac.signal });
    chip.append(label, x);
    chips.appendChild(chip);
    btn.disabled = true;
    if (release) release.hidden = true;
    queued.set(row, chip);
    syncQueue();
    if (queued.size >= QUEUE_MAX) {
      // hold the 8/8 reading for a beat, then let go.
      releasing = true;
      const start = (): void => {
        releasing = false;
        if (!ac.signal.aborted) releaseQueue();
      };
      if (reduceMotion()) start();
      else setTimeout(start, 450);
    }
  };

  // ── bar entry sweep — gated at reading pace ───────────────────────────────
  // Rows entering the viewport get .lb-in (the bar sweeps out to its length); while the
  // engine's live scroll velocity says the user is scanning (or motion is reduced),
  // .lb-in-instant is added too — no animation. The gate is the shared armEntryAtPace.
  const wireBarSweep = (): void => {
    list.setAttribute("data-lb-anim", "");
    armEntryAtPace(rowsOf(), "lb-in", "lb-in-instant", ac.signal, { threshold: 0.1 });
  };

  // ── live counts — ONCE per visit, the snapshot upgrades itself in place ────
  // The committed snapshot stays the SSR baseline and the no-JS truth; the live
  // pass updates counts/--bar/--w on the SAME rows and FLIP re-sorts only if the
  // ranking actually changed. The queue (rows already queued) is untouched.
  const statusEl = page.querySelector<HTMLElement>("[data-lb-status]");
  const chip = wireLiveChip(statusEl, (statusEl?.textContent ?? "").replace(/^snapshot · /, ""));

  // FLIP re-sort — the page's treatment (translate + settle), rank gutter renumbered
  const flipResort = (ordered: HTMLElement[]): void => {
    const first = new Map(ordered.map((r) => [r, r.getBoundingClientRect()]));
    ordered.forEach((r) => list.appendChild(r));
    ordered.forEach((r, i) => {
      const rank = r.querySelector(".lb-rank");
      if (rank) rank.textContent = String(i + 1).padStart(2, "0");
      if (reduceMotion()) return;
      const was = first.get(r);
      if (!was) return;
      const now = r.getBoundingClientRect();
      const dy = was.top - now.top;
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

  const applyLive = (recs: LbRecording[]): void => {
    const all = rowsOf();
    // match by recording mbid; fall back to the track+artist string
    const nameKey = (t: string, a: string): string =>
      `${t.trim().toLowerCase()} ${a.trim().toLowerCase()}`;
    const byMbid = new Map<string, HTMLElement>();
    const byName = new Map<string, HTMLElement>();
    for (const r of all) {
      if (r.dataset.mbid) byMbid.set(r.dataset.mbid, r);
      byName.set(nameKey(r.dataset.track ?? "", r.dataset.artist ?? ""), r);
    }
    const matched = new Set<HTMLElement>();
    for (const rec of recs) {
      const row =
        (rec.recording_mbid ? byMbid.get(rec.recording_mbid) : undefined) ??
        byName.get(nameKey(rec.track_name ?? "", rec.artist_name ?? ""));
      if (!row || matched.has(row)) continue;
      matched.add(row);
      if (typeof rec.listen_count === "number") {
        row.dataset.listens = String(rec.listen_count);
        const b = row.querySelector<HTMLElement>(".lb-listens b");
        if (b) b.textContent = fmtInt(rec.listen_count);
      }
    }
    // rows that fell out of the live top 30 STAY — dimmed, honestly labeled
    for (const r of all) {
      if (matched.has(r)) {
        r.removeAttribute("data-lb-fell");
        r.removeAttribute("title");
      } else {
        r.setAttribute("data-lb-fell", "");
        r.title = "fell off the chart since the snapshot";
      }
    }
    // recompute --bar (linear vs the new max) and --w (log mass) IN PLACE
    const counts = all.map((r) => Number(r.dataset.listens) || 0);
    const max = Math.max(...counts, 1);
    const cMin = Math.min(...counts);
    const cMax = Math.max(...counts);
    for (const r of all) {
      const n = Number(r.dataset.listens) || 0;
      const w = logNormalizeBetween(n, cMin, cMax);
      r.style.setProperty("--bar", (n / max).toFixed(3));
      r.style.setProperty("--w", w.toFixed(3));
      r.dataset.strength = weightToStrength(w).toFixed(2);
    }
    // re-sort only if the ranking actually changed
    const ordered = [...all].sort(
      (a, b) => (Number(b.dataset.listens) || 0) - (Number(a.dataset.listens) || 0),
    );
    if (ordered.some((r, i) => r !== all[i])) flipResort(ordered);
  };

  const refresh = async (): Promise<void> => {
    const res = await fetch(LIVE_URL, { signal: ac.signal });
    if (!res.ok) throw new Error(String(res.status));
    const data: unknown = await res.json();
    const recs = (data as { payload?: { recordings?: LbRecording[] } }).payload?.recordings;
    if (!Array.isArray(recs)) throw new Error("unexpected shape");
    applyLive(recs);
  };

  politeLoop({
    run: refresh,
    firstDelayMs: FIRST_CHECK_MS,
    everyMs: null, // refresh ONCE per visit — the source updates daily
    signal: ac.signal,
    onSuccess: () => chip.ok(),
    onFailure: () => chip.fail(),
  });

  // ── queueing — delegated from the list ────────────────────────────────────
  list.addEventListener(
    "click",
    (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-lb-add]");
      if (!btn || btn.disabled) return;
      const row = btn.closest<HTMLElement>(".lb-row");
      if (row && list.contains(row)) addTrack(row, btn);
    },
    { signal: ac.signal },
  );

  // ── controls ─────────────────────────────────────────────────────────────
  wireSegments(
    lensBtns,
    "lbLens",
    (v) => {
      lens = (v as LbLens) || "artist";
      page.dataset.lens = lens;
      if (lensHint) lensHint.innerHTML = HINTS[lens];
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
        queue.style.removeProperty("--load");
      }
    },
    ac.signal,
  );

  applyLens();
  syncQueue();
  runField();
  wireBarSweep();

  return () => {
    ac.abort();
    chip.destroy();
    activeField?.destroy();
  };
}

pageRuntime(".ex-library", initLibrary);
