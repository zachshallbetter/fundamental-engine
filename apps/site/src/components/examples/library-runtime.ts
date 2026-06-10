// Library Field runtime. field-ui as an INVISIBLE measurement layer over the month's
// most-listened ListenBrainz recordings, with the queue as a genuine field SINK:
//   · each row's mass --w is its log-normalized listen count (server-computed, static);
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
// The scoped field runs with render: [] — bodies compute (metrics flow) but nothing is drawn.
import { recipeById } from "@field-ui/core";
import { applyRecipe } from "@field-ui/platform";

type LbLens = "artist" | "off";

const QUEUE_MAX = 8;
const SINGLE_HUE = "#60a5fa";

const HINTS: Record<LbLens, string> = {
  artist: "<b>color</b> = artist — one palette hue per act, hashed from the name",
  off: "<b>color</b> = off — a single hue; mass carries the whole signal",
};

const reduceMotion = () =>
  typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

function initLibrary(): () => void {
  const page = document.querySelector<HTMLElement>(".ex-library");
  if (!page) return () => {};
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
        const recipe = { ...base, render: [] as never[] };
        const bodies = rowsOf();
        bodies.push(queue);
        activeField = applyRecipe(scope, recipe, { bodies, annotateBodies: false });
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
  lensBtns.forEach((b) =>
    b.addEventListener(
      "click",
      () => {
        lens = (b.dataset.lbLens as LbLens) || "artist";
        page.dataset.lens = lens;
        lensBtns.forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
        if (lensHint) lensHint.innerHTML = HINTS[lens];
        applyLens();
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
        queue.style.removeProperty("--load");
      }
    },
    { signal: ac.signal },
  );

  applyLens();
  syncQueue();
  runField();

  return () => {
    ac.abort();
    activeField?.destroy();
  };
}

let teardown: (() => void) | undefined;
function init(): void {
  teardown?.();
  teardown = document.querySelector(".ex-library") ? initLibrary() : undefined;
}
if (document.readyState !== "loading") init();
else document.addEventListener("DOMContentLoaded", init);
document.addEventListener("astro:page-load", init);
document.addEventListener("astro:before-swap", () => {
  teardown?.();
  teardown = undefined;
});
