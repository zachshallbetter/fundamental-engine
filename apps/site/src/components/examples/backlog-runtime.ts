// Backlog Field runtime. Fundamental as an INVISIBLE measurement layer over the repo's own
// work stream:
//   · Field on/off — off, the page collapses to a plain tracker (CSS via [data-field]); the
//     scoped field is destroyed and threads are cleared. On, the field runs and activity
//     shows in the type.
//   · Weight by activity / freshness — re-blend each item's --w from its normalized signals
//     (data-act, data-rec), then re-sort within each lane with a 2D FLIP reflow. The re-sort
//     runs on the CURRENT arrangement, so it re-orders a hand-triaged lane (the lens wins).
//   · hover an item → SVG threads to the items it references (refs[] present on the page).
//   · the cycle bar is a real sink body: the engine writes --load back, and CSS turns it
//     into the glow. The bar's fill stays data arithmetic (shipped / capacity), recomputed
//     from the CURRENT lanes and marked "(local)" when triage diverges from the snapshot.
//   · DRAG — hand-rolled pointer drag, no library, no HTML5 DnD. pointerdown on a card
//     (not its link) arms after 6px of mouse/pen travel; on TOUCH a long-press (~280ms,
//     held still) arms instead — a moved touch is a scroll, never a drag, so the page
//     pans normally at rest. While a touch drag is in flight the runtime consumes
//     touchmove (non-passive) — touch-action is latched at gesture start, so the
//     mid-gesture .wl-drag { touch-action: none } alone could not stop the pan.
//     The ORIGINAL card lifts to position:fixed while a
//     placeholder holds its slot; a slim indicator marks the drop slot; the page edge-
//     scrolls; pointerup commits with a FLIP settle; Esc/pointercancel aborts to origin.
//     While a card is in flight it carries data-active, so the platform's attention metric
//     reads it as engaged and --field-attention rises — the field re-measures the drag.
//     Keyboard: Space/Enter lifts, arrows move (Left/Right across lanes), Esc cancels.
//     HONESTY: triage is a LOCAL SANDBOX — the arrangement persists to localStorage only;
//     GitHub is never written.
// The scoped field runs render-less (applyRecipe renderless) — particles compute (metrics flow) but are never drawn.
import { recipeById, weightToStrength } from "@fundamental-engine/core";
import { applyRecipe, threadOverlay, withFlip as flipReflow } from "@fundamental-engine/platform";
import { wireFieldToggle, wireSegments } from "../../lib/controls";
import { pageRuntime } from "../../lib/page-runtime";
import { persisted } from "../../lib/persisted";

type BacklogWeight = "activity" | "freshness";
type LaneId = "open" | "shipped";

// the canonical slot is fui:backlog:board:v1; the pre-helper key migrates forward on first
// read (it stored JSON, so the helper's legacy migration covers it).
const STORE_KEY = "backlog:board:v1";
const LEGACY_STORE_KEYS = ["field-ui:backlog:board:v1"];
const DRAG_THRESHOLD = 6; // px of travel before a mouse/pen pointerdown becomes a drag
const EDGE = 60; // px from the viewport edge where auto-scroll engages
const EDGE_SPEED = 16; // max px/frame of auto-scroll
const TOUCH_HOLD = 280; // ms a touch must hold still before the drag arms (long-press)
const TOUCH_SLOP = 8; // px of touch travel that turns a pending press into a SCROLL

const reduceMotion = (): boolean =>
  typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

// the lens blends — must match the server-side default in backlog.astro.
const BLENDS: Record<BacklogWeight, { act: number; rec: number }> = {
  activity: { act: 0.65, rec: 0.35 },
  freshness: { act: 0.25, rec: 0.75 },
};

const HINTS: Record<BacklogWeight, string> = {
  activity: "<b>size</b> = activity, comment-leaning — the items people argue about carry the mass",
  freshness: "<b>size</b> = freshness, recency-leaning — the items touched last pull hardest",
};

function initBacklog(page: HTMLElement): () => void {
  const ac = new AbortController();
  const zone = page.querySelector<HTMLElement>("[data-wl-zone]");
  const sink = page.querySelector<HTMLElement>("[data-wl-cycle]");
  const fieldBtn = page.querySelector<HTMLButtonElement>("[data-wl-field]");
  const weightBtns = [...page.querySelectorAll<HTMLButtonElement>("[data-wl-weight]")];
  const hint = page.querySelector<HTMLElement>("[data-wl-hint]");
  const rows = (): HTMLElement[] => [...page.querySelectorAll<HTMLElement>(".wl-item")];

  // board geography — the two lanes and their lists, by id
  const LANES: LaneId[] = ["open", "shipped"];
  const laneEl = (id: LaneId): HTMLElement | null =>
    page.querySelector<HTMLElement>(`[data-wl-lane="${id}"]`);
  const listEl = (id: LaneId): HTMLElement | null =>
    page.querySelector<HTMLElement>(`[data-wl-list="${id}"]`);
  const cardsIn = (list: HTMLElement): HTMLElement[] => [
    ...list.querySelectorAll<HTMLElement>(".wl-item"),
  ];
  const numOf = (card: HTMLElement): number => Number(card.id.replace("wi-", ""));
  const laneName = (list: HTMLElement): string =>
    list.dataset.wlList === "shipped" ? "Shipped" : "In flight";

  // honesty plumbing — local triage vs the server snapshot
  const announceEl = page.querySelector<HTMLElement>("[data-wl-announce]");
  const resetBtn = page.querySelector<HTMLButtonElement>("[data-wl-reset]");
  const localMarks = [...page.querySelectorAll<HTMLElement>("[data-wl-local]")];
  const cycleCountEl = page.querySelector<HTMLElement>("[data-wl-cycle-count]");
  const cycleFillEl = page.querySelector<HTMLElement>("[data-wl-cycle-fill]");
  const cycleNoteEl = page.querySelector<HTMLElement>("[data-wl-cycle-note]");
  const snapshot = Number(zone?.dataset.wlSnapshot) || Date.now();
  const capacity = Number(zone?.dataset.wlCapacity) || 20;
  const cycleDays = Number(zone?.dataset.wlDays) || 14;

  const say = (msg: string): void => {
    if (announceEl) announceEl.textContent = msg;
  };

  let weight: BacklogWeight = "activity";
  let fieldOn = true;
  let activeField: { destroy(): void } | null = null;

  // ── arrangement bookkeeping (lane + order, keyed by item number) ───────────
  const arrangement = (): Record<LaneId, number[]> => {
    const out = { open: [] as number[], shipped: [] as number[] };
    for (const id of LANES) {
      const list = listEl(id);
      if (list) out[id] = cardsIn(list).map(numOf);
    }
    return out;
  };
  // captured from the server-rendered DOM, BEFORE any restore — this is the truth.
  const server = arrangement();
  const sameOrder = (a: number[], b: number[]): boolean =>
    a.length === b.length && a.every((n, i) => n === b[i]);
  const sameSet = (a: number[], b: number[]): boolean =>
    a.length === b.length && [...a].sort((x, y) => x - y).join() === [...b].sort((x, y) => x - y).join();
  // lane membership is what changes the cycle arithmetic → drives the "(local)" mark
  const lanesDiverged = (): boolean => {
    const cur = arrangement();
    return !sameSet(cur.open, server.open) || !sameSet(cur.shipped, server.shipped);
  };
  const orderDiverged = (): boolean => {
    const cur = arrangement();
    return !sameOrder(cur.open, server.open) || !sameOrder(cur.shipped, server.shipped);
  };

  // ── recount — lane headers + the cycle bar, from the CURRENT lanes ─────────
  // An item with closedAt inside the window counts; an open item hand-triaged into
  // Shipped counts as locally shipped "now" (inside the window by construction);
  // an item dragged OUT of Shipped stops counting. Honest, and marked "(local)".
  const recount = (): void => {
    for (const id of LANES) {
      const lane = laneEl(id);
      const list = listEl(id);
      const n = lane?.querySelector<HTMLElement>("[data-wl-count]");
      if (n && list) n.textContent = String(cardsIn(list).length);
    }
    const shippedList = listEl("shipped");
    if (!shippedList) return;
    let count = 0;
    for (const card of cardsIn(shippedList)) {
      const closed = card.dataset.closed;
      if (!closed || snapshot - Date.parse(closed) <= cycleDays * 864e5) count++;
    }
    const local = lanesDiverged();
    if (cycleCountEl) cycleCountEl.textContent = `${count}/${capacity}`;
    if (cycleFillEl)
      cycleFillEl.style.width = `${Math.min(100, Math.round((count / capacity) * 100))}%`;
    sink?.toggleAttribute("data-over", count > capacity);
    if (cycleNoteEl) {
      const over = count > capacity;
      cycleNoteEl.textContent = local
        ? over
          ? `locally triaged: ${(count / capacity).toFixed(1)}× the stated capacity — GitHub unchanged`
          : `locally triaged: ${capacity - count} of capacity left — GitHub unchanged`
        : over
          ? `the ${cycleDays} days before the snapshot ran ${(count / capacity).toFixed(1)}× the stated capacity`
          : `${capacity - count} of capacity left in the window`;
    }
    localMarks.forEach((m) => (m.hidden = !local));
    if (resetBtn) resetBtn.disabled = !orderDiverged();
  };

  // ── persistence — the arrangement saves locally on drop; GitHub is never written ──
  const board = persisted<{ snap?: number; open?: number[]; shipped?: number[] } | null>(
    STORE_KEY,
    null,
    { legacyKeys: LEGACY_STORE_KEYS },
  );
  const persist = (): void => board.set({ snap: snapshot, ...arrangement() });
  const hasStored = (): boolean => board.get() !== null;
  const restore = (): void => {
    const data = board.get();
    if (!data) return;
    const stored = [...(data.open ?? []), ...(data.shipped ?? [])];
    const known = new Set([...server.open, ...server.shipped]);
    if (
      data.snap !== snapshot ||
      stored.length !== known.size ||
      !stored.every((n) => known.has(n))
    ) {
      board.clear(); // a new snapshot invalidates old triage
      return;
    }
    for (const id of LANES) {
      const list = listEl(id);
      if (!list) continue;
      for (const n of data[id] ?? []) {
        const card = page.querySelector<HTMLElement>(`#wi-${n}`);
        if (card) list.appendChild(card);
      }
    }
  };

  // ── FLIP helper — capture rects, mutate, animate the deltas away ───────────
  const withFlip = (els: HTMLElement[], mutate: () => void, ms = 400): void =>
    flipReflow(() => els, mutate, { duration: ms });

  // ── weighting — re-blend --w + data-strength, then FLIP re-sort per lane ──
  // The FLIP is 2D (top AND left): cards live in a board, so a re-sort can move
  // a card in both axes. Runs on the current (possibly hand-triaged) arrangement.
  const reweight = (): void => {
    const blend = BLENDS[weight];
    for (const r of rows()) {
      const w =
        blend.act * (Number(r.dataset.act) || 0) + blend.rec * (Number(r.dataset.rec) || 0);
      r.style.setProperty("--w", w.toFixed(3));
      r.dataset.strength = weightToStrength(w).toFixed(2);
    }
    for (const id of LANES) {
      const list = listEl(id);
      if (!list) continue;
      const items = cardsIn(list);
      const ordered = [...items].sort(
        (a, b) =>
          Number(b.style.getPropertyValue("--w")) - Number(a.style.getPropertyValue("--w")),
      );
      withFlip(items, () => ordered.forEach((r) => list.appendChild(r)), 500);
    }
    // the lens re-ordered a saved triage → keep what's stored current (still local-only)
    if (hasStored()) persist();
    recount();
  };

  // ── reference threads (hover) — the SVG overlays the whole board so threads cross lanes ──
  // Geometry + lit/cited classes are the platform's threadOverlay (the family's centerIn
  // cubic, sampled at hover time, so a re-arranged board threads correctly on the next
  // hover); drops just clear any live thread (the wires re-fire from the same cards). The
  // hover SEMANTICS — the color choice and the --thread-live density mirror — stay here.
  const threads = zone ? threadOverlay(zone, { className: "ev-threads" }) : null;
  let liveRaf = 0;
  const clearThreads = (): void => {
    cancelAnimationFrame(liveRaf);
    liveRaf = 0;
    threads?.clear();
    zone?.querySelector<SVGSVGElement>("svg.ev-threads")?.style.removeProperty("--thread-live");
  };
  const wireThreads = (): void => {
    if (!zone || !threads) return;
    const draw = (from: HTMLElement): void => {
      if (!fieldOn || drag?.active) return;
      const targets = (from.dataset.refs || "")
        .split(" ")
        .filter(Boolean)
        .map((id) => zone.querySelector<HTMLElement>(`#${CSS.escape(id)}`))
        .filter((t): t is HTMLElement => t !== null);
      threads.draw(from, targets, {
        color: getComputedStyle(from).getPropertyValue("--cat").trim(),
      });
      // follow the hovered card's --d (an inline style the engine writes — cheap to read)
      cancelAnimationFrame(liveRaf);
      const svg = zone.querySelector<SVGSVGElement>("svg.ev-threads");
      const followLive = (): void => {
        svg?.style.setProperty("--thread-live", from.style.getPropertyValue("--d") || "0");
        liveRaf = requestAnimationFrame(followLive);
      };
      followLive();
    };
    rows().forEach((r) => {
      r.addEventListener("pointerenter", () => draw(r), { signal: ac.signal });
      r.addEventListener("pointerleave", clearThreads, { signal: ac.signal });
    });
  };

  // ── the invisible scoped field (renderless) ───────────────────────────────
  const runField = (): void => {
    activeField?.destroy();
    activeField = null;
    if (!fieldOn || !zone) return;
    try {
      const base = recipeById("evidence-field");
      if (base) {
        // renderless — invisible; metrics gain the attention + recency lanes. Attention:
        // the pipeline writes an eased --field-attention (hover/focus + viewport-center
        // proximity + visibility) back to every card; a dragged card carries data-active,
        // which the pipeline reads as engaged — attention rises in flight. Recency: every
        // card declares data-field-at (its updatedAt), so the pipeline's recency lane is
        // GROUNDED in that world timestamp — --field-recency is freshness(updatedAt, now),
        // not an interaction guess.
        // the cycle bar joins as a sink — the engine writes its fill back as --load.
        const bodies = rows();
        if (sink) bodies.push(sink);
        activeField = applyRecipe(zone, base, {
          bodies,
          annotateBodies: false,
          renderless: true,
          extraMetrics: ["attention", "recency"],
        });
      }
    } catch {
      /* the static --w layer stands on its own */
    }
  };

  // ── pointer drag — hand-rolled; links still click; 6px arms; Esc aborts ────
  interface DragState {
    card: HTMLElement;
    pointerId: number;
    startX: number;
    startY: number;
    lastX: number;
    lastY: number;
    active: boolean;
    /** true for pointerType "touch" — arms by long-press, not by travel */
    touch: boolean;
    /** the pending long-press timer (touch only) */
    hold: number;
    placeholder: HTMLElement | null;
    indicator: HTMLElement | null;
    originList: HTMLElement;
    originNext: Element | null;
    raf: number;
  }
  let drag: DragState | null = null;

  const clearLaneTargets = (): void =>
    LANES.forEach((id) => laneEl(id)?.removeAttribute("data-wl-drop"));

  // the slim insertion indicator: where the card will land (between cards / lane end)
  const placeIndicator = (): void => {
    if (!drag?.active || !drag.indicator) return;
    const { lastX: x, lastY: y, card, indicator, placeholder } = drag;
    let target: LaneId | null = null;
    for (const id of LANES) {
      const r = laneEl(id)?.getBoundingClientRect();
      if (r && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) {
        target = id;
        break;
      }
    }
    clearLaneTargets();
    if (!target) {
      // outside both lanes → the drop falls back to the origin slot
      if (placeholder && indicator.previousElementSibling !== placeholder)
        placeholder.after(indicator);
      return;
    }
    laneEl(target)?.setAttribute("data-wl-drop", "");
    const list = listEl(target);
    if (!list) return;
    let before: HTMLElement | null = null;
    for (const c of cardsIn(list)) {
      if (c === card) continue; // the original is position:fixed — out of flow
      const r = c.getBoundingClientRect();
      if (y < r.top + r.height / 2) {
        before = c;
        break;
      }
    }
    if (before) {
      if (indicator.nextElementSibling !== before || indicator.parentElement !== list)
        list.insertBefore(indicator, before);
    } else if (indicator.parentElement !== list || indicator.nextElementSibling) {
      list.appendChild(indicator);
    }
  };

  // per-frame while dragging: edge auto-scroll (±60px, proportional) + slot tracking.
  // The lifted card is position:fixed, so scrolling never moves it — only the slot.
  const dragFrame = (): void => {
    if (!drag?.active) return;
    const y = drag.lastY;
    if (y < EDGE) window.scrollBy(0, -((EDGE - y) / EDGE) * EDGE_SPEED);
    else if (y > innerHeight - EDGE) window.scrollBy(0, ((y - (innerHeight - EDGE)) / EDGE) * EDGE_SPEED);
    placeIndicator();
    drag.raf = requestAnimationFrame(dragFrame);
  };

  const armDrag = (): void => {
    if (!drag) return;
    const { card } = drag;
    try {
      card.setPointerCapture(drag.pointerId);
    } catch {
      /* capture can fail if the pointer is already gone */
    }
    const r = card.getBoundingClientRect();
    // a placeholder holds the origin slot while the ORIGINAL card flies (no clone)
    const ph = document.createElement("li");
    ph.className = "wl-placeholder";
    ph.setAttribute("aria-hidden", "true");
    ph.style.height = `${r.height}px`;
    card.after(ph);
    drag.placeholder = ph;
    const ind = document.createElement("li");
    ind.className = "wl-indicator";
    ind.setAttribute("aria-hidden", "true");
    ph.after(ind);
    drag.indicator = ind;
    card.classList.add("wl-drag"); // fixed + grabbing + touch-action:none (drag only)
    card.style.left = `${r.left}px`;
    card.style.top = `${r.top}px`;
    card.style.width = `${r.width}px`;
    // engaged: the metric pipeline treats [data-active] as engaged → --field-attention rises
    card.setAttribute("data-active", "");
    page.classList.add("wl-grabbing");
    drag.active = true;
    clearThreads();
    drag.raf = requestAnimationFrame(dragFrame);
  };

  const finishDrag = (commit: boolean): void => {
    if (!drag) return;
    const d = drag;
    drag = null;
    clearTimeout(d.hold);
    cancelAnimationFrame(d.raf);
    clearLaneTargets();
    page.classList.remove("wl-grabbing");
    if (!d.active) return; // never armed — it was a plain click
    const { card, placeholder, indicator } = d;
    try {
      card.releasePointerCapture(d.pointerId);
    } catch {
      /* already released */
    }
    const flying = card.getBoundingClientRect();
    // where it lands: the indicator's slot on commit, the origin slot on abort
    let destList = d.originList;
    let destBefore: Element | null = d.originNext;
    if (commit && indicator?.parentElement) {
      destList = indicator.parentElement as HTMLElement;
      let n: Element | null = indicator.nextElementSibling;
      while (n && !(n instanceof HTMLElement && n.classList.contains("wl-item")))
        n = n.nextElementSibling;
      destBefore = n;
    }
    const others = rows().filter((r) => r !== card);
    withFlip(others, () => {
      placeholder?.remove();
      indicator?.remove();
      destList.insertBefore(card, destBefore);
      card.classList.remove("wl-drag");
      card.removeAttribute("data-active");
      card.style.removeProperty("left");
      card.style.removeProperty("top");
      card.style.removeProperty("width");
      card.style.removeProperty("transform");
    });
    // settle the card itself, from its in-flight viewport position (scaled) to the slot —
    // matched by centers so the scale unwinds without a jump
    if (!reduceMotion()) {
      const landed = card.getBoundingClientRect();
      const dx = flying.left + flying.width / 2 - (landed.left + landed.width / 2);
      const dy = flying.top + flying.height / 2 - (landed.top + landed.height / 2);
      if (dx || dy) {
        card.style.transform = `translate(${dx}px, ${dy}px) scale(${(flying.width / Math.max(1, landed.width)).toFixed(4)})`;
        card.style.transition = "none";
        card.style.zIndex = "30";
        requestAnimationFrame(() => {
          card.style.transition = "transform 320ms cubic-bezier(.2, .7, .2, 1)";
          card.style.transform = "";
          card.addEventListener(
            "transitionend",
            () => {
              card.style.removeProperty("transition");
              card.style.removeProperty("z-index");
            },
            { once: true },
          );
        });
      }
    }
    clearThreads(); // the board's geometry changed; threads re-measure on the next hover
    recount();
    if (commit) {
      persist();
      const list = card.parentElement as HTMLElement;
      const pos = cardsIn(list).indexOf(card) + 1;
      say(
        `#${numOf(card)} dropped — position ${pos} of ${cardsIn(list).length} in ${laneName(list)}. Local only; GitHub unchanged.`,
      );
    } else {
      say(`drag canceled — #${numOf(card)} returned to its place`);
    }
  };

  const onPointerDown = (e: PointerEvent, card: HTMLElement): void => {
    if (e.button !== 0 || drag || kbCard) return;
    if ((e.target as Element).closest("a, button")) return; // the title link still clicks
    drag = {
      card,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      lastX: e.clientX,
      lastY: e.clientY,
      active: false,
      touch: e.pointerType === "touch",
      hold: 0,
      placeholder: null,
      indicator: null,
      originList: card.parentElement as HTMLElement,
      originNext: card.nextElementSibling,
      raf: 0,
    };
    if (drag.touch) {
      // TOUCH arms by LONG-PRESS: travel before the hold elapses means scroll (the
      // pending press is abandoned and the browser pans as usual). The 6px move-arm
      // can never win on touch — the browser claims the pan and fires pointercancel
      // first, because touch-action is latched before .wl-drag could change it.
      const d = drag;
      d.hold = window.setTimeout(() => {
        if (drag === d && !d.active) armDrag();
      }, TOUCH_HOLD);
    }
  };

  window.addEventListener(
    "pointermove",
    (e) => {
      if (!drag || e.pointerId !== drag.pointerId) return;
      drag.lastX = e.clientX;
      drag.lastY = e.clientY;
      if (!drag.active) {
        const travel = Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY);
        if (drag.touch) {
          // a touch that travels before the long-press fires is a SCROLL — abandon
          // the pending press and let the browser pan
          if (travel > TOUCH_SLOP) {
            clearTimeout(drag.hold);
            drag = null;
          }
          return;
        }
        if (travel < DRAG_THRESHOLD) return;
        armDrag();
      }
      const dx = e.clientX - drag.startX;
      const dy = e.clientY - drag.startY;
      // reduced motion: the card still follows, it just doesn't scale up
      drag.card.style.transform = `translate(${dx}px, ${dy}px)${reduceMotion() ? "" : " scale(1.03)"}`;
    },
    { signal: ac.signal },
  );
  // while a touch drag is in flight the page must not pan under it: touch-action was
  // latched at gesture start (before .wl-drag applied), so the pan is refused HERE, by
  // consuming touchmove. At rest this listener never preventDefaults — scroll is normal.
  window.addEventListener(
    "touchmove",
    (e) => {
      if (drag?.touch && drag.active) e.preventDefault();
    },
    { passive: false, signal: ac.signal },
  );
  // the long-press that lifts a card must not also summon the context menu
  window.addEventListener(
    "contextmenu",
    (e) => {
      if (drag?.touch) e.preventDefault();
    },
    { signal: ac.signal },
  );
  window.addEventListener(
    "pointerup",
    (e) => {
      if (drag && e.pointerId === drag.pointerId) finishDrag(true);
    },
    { signal: ac.signal },
  );
  window.addEventListener(
    "pointercancel",
    (e) => {
      if (drag && e.pointerId === drag.pointerId) finishDrag(false);
    },
    { signal: ac.signal },
  );
  window.addEventListener(
    "keydown",
    (e) => {
      if (e.key === "Escape" && drag?.active) {
        e.preventDefault();
        finishDrag(false);
      }
    },
    { signal: ac.signal },
  );

  // ── keyboard triage — Space/Enter lifts & drops, arrows move, Esc cancels ──
  let kbCard: HTMLElement | null = null;
  let kbOrigin: { list: HTMLElement; next: Element | null } | null = null;

  const kbDrop = (commit: boolean): void => {
    const card = kbCard;
    if (!card) return;
    kbCard = null;
    card.classList.remove("wl-kb");
    card.removeAttribute("data-active");
    if (!commit && kbOrigin) {
      const o = kbOrigin;
      withFlip(rows(), () => o.list.insertBefore(card, o.next));
      say(`canceled — #${numOf(card)} returned to its place`);
    } else {
      persist();
      const list = card.parentElement as HTMLElement;
      const pos = cardsIn(list).indexOf(card) + 1;
      say(
        `#${numOf(card)} dropped — position ${pos} of ${cardsIn(list).length} in ${laneName(list)}. Local only; GitHub unchanged.`,
      );
    }
    kbOrigin = null;
    clearThreads();
    recount();
  };

  const kbMove = (card: HTMLElement, key: string): void => {
    const list = card.parentElement as HTMLElement;
    const siblings = cardsIn(list);
    const i = siblings.indexOf(card);
    const isOpen = list.dataset.wlList === "open";
    if (key === "ArrowUp" && i > 0) {
      withFlip(siblings, () => list.insertBefore(card, siblings[i - 1]!));
    } else if (key === "ArrowDown" && i < siblings.length - 1) {
      withFlip(siblings, () => siblings[i + 1]!.after(card));
    } else if ((key === "ArrowRight" && isOpen) || (key === "ArrowLeft" && !isOpen)) {
      // the board reads left→right: In flight, Shipped
      const other = listEl(isOpen ? "shipped" : "open");
      if (!other) return;
      const target = cardsIn(other);
      const before = target[Math.min(i, target.length)] ?? null;
      withFlip(rows(), () => other.insertBefore(card, before));
    } else {
      return;
    }
    card.focus({ preventScroll: false });
    clearThreads();
    recount();
    const now = card.parentElement as HTMLElement;
    say(
      `#${numOf(card)} — position ${cardsIn(now).indexOf(card) + 1} of ${cardsIn(now).length} in ${laneName(now)}`,
    );
  };

  // ── controls ───────────────────────────────────────────────────────────────
  wireSegments(
    weightBtns,
    "wlWeight",
    (value) => {
      weight = (value as BacklogWeight) || "activity";
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
        sink?.style.removeProperty("--load");
        clearThreads();
      }
    },
    ac.signal,
  );

  // "reset board" — restore the server order, clear local storage
  resetBtn?.addEventListener(
    "click",
    () => {
      if (drag?.active) finishDrag(false);
      if (kbCard) kbDrop(false);
      board.clear();
      withFlip(rows(), () => {
        for (const id of LANES) {
          const list = listEl(id);
          if (!list) continue;
          for (const n of server[id]) {
            const card = page.querySelector<HTMLElement>(`#wi-${n}`);
            if (card) list.appendChild(card);
          }
        }
      }, 500);
      clearThreads();
      recount();
      say("board reset to the server order");
    },
    { signal: ac.signal },
  );

  // per-card wiring: pointer drag + keyboard lift (cards are tabindex="0",
  // described by the visually-hidden #wl-dnd-help instructions)
  rows().forEach((card) => {
    card.addEventListener("pointerdown", (e) => onPointerDown(e, card), { signal: ac.signal });
    card.addEventListener(
      "keydown",
      (e) => {
        if (e.target !== card) return; // never hijack the title link
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          if (kbCard === card) {
            kbDrop(true);
          } else {
            if (kbCard) kbDrop(true);
            kbCard = card;
            kbOrigin = { list: card.parentElement as HTMLElement, next: card.nextElementSibling };
            card.classList.add("wl-kb");
            // same engagement contract as the pointer drag — attention rises while lifted
            card.setAttribute("data-active", "");
            say(
              `#${numOf(card)} lifted — arrows move it, Space or Enter drops, Escape cancels. Local only; GitHub unchanged.`,
            );
          }
        } else if (
          kbCard === card &&
          ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)
        ) {
          e.preventDefault();
          kbMove(card, e.key);
        } else if (kbCard === card && e.key === "Escape") {
          e.preventDefault();
          kbDrop(false);
        }
      },
      { signal: ac.signal },
    );
    // focus leaving a lifted card cancels the lift (Esc semantics, never a silent commit)
    card.addEventListener(
      "focusout",
      () => {
        if (kbCard === card) kbDrop(false);
      },
      { signal: ac.signal },
    );
  });

  restore(); // saved local triage (if any, and only for this snapshot)
  recount();
  wireThreads();
  runField();

  return () => {
    ac.abort();
    cancelAnimationFrame(liveRaf);
    if (drag) {
      clearTimeout(drag.hold);
      cancelAnimationFrame(drag.raf);
    }
    drag = null;
    activeField?.destroy();
  };
}

pageRuntime(".ex-backlog", initBacklog);
