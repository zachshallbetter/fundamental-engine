// Calendar Field runtime. field-ui as an INVISIBLE measurement layer over a real launch
// schedule, where the field's input is time itself:
//   · a 1-second clock recomputes every launch's weight (--w) from its distance to T−0 and
//     re-renders the live countdown. The soonest launch is the heaviest; launches whose NET
//     has passed (the snapshot ages) or whose date is TBD fall to the floor and say so.
//   · Field on/off — off, the page collapses to a flat schedule (CSS via [data-field]); the
//     scoped field is destroyed. The countdowns keep ticking — they're data, not field.
//   · Color by status / off — --cat encodes launch status, or steps aside entirely.
// The scoped field runs with render: [] — particles compute (metrics flow) but are never drawn.
import { recipeById } from "@field-ui/core";
import { applyRecipe } from "@field-ui/platform";

type CalendarLens = "status" | "off";

// imminence math — must match the server-side render in calendar.astro:
// log-ramped against a 30-day horizon, floored at 0.08 for passed / TBD launches.
const HORIZON = Math.log(24 * 30 + 1);
const W_FLOOR = 0.08;

// status → anchor color — must match calendar.astro.
const STATUS_CAT: Record<string, string> = { Go: "#2dd4bf", TBC: "#fbbf24" };
const catFor = (status: string): string => STATUS_CAT[status] ?? "#8a93a6";

const LENS_HINTS: Record<CalendarLens, string> = {
  status: "<b>color</b> = launch status — Go is confirmed, TBC awaits confirmation",
  off: "<b>color</b> = off — imminence carries the whole signal",
};

const pad2 = (n: number): string => String(n).padStart(2, "0");

function initCalendar(): () => void {
  const page = document.querySelector<HTMLElement>(".ex-calendar");
  if (!page) return () => {};
  const ac = new AbortController();
  const list = page.querySelector<HTMLElement>("[data-cal-list]");
  const rows = (): HTMLElement[] => [...page.querySelectorAll<HTMLElement>(".cal-row")];
  const fieldBtn = page.querySelector<HTMLButtonElement>("[data-cal-field]");
  const lensBtns = [...page.querySelectorAll<HTMLButtonElement>("[data-cal-lens]")];
  const lensHint = page.querySelector<HTMLElement>("[data-cal-lens-hint]");

  let lens: CalendarLens = "status";
  let fieldOn = true;
  let activeField: { destroy(): void } | null = null;

  // ── the 1 Hz clock — time in, weight + countdown out ──────────────────────
  const tick = (): void => {
    const now = Date.now();
    for (const r of rows()) {
      const status = r.dataset.status || "";
      const net = Date.parse(r.dataset.net || "");
      let w = W_FLOOR;
      let label: string;
      if (status === "TBD" || Number.isNaN(net)) {
        label = "TBD";
      } else if (net <= now) {
        // the snapshot has aged past this window — say so rather than pretending.
        label = "window passed · snapshot";
      } else {
        const hours = (net - now) / 36e5;
        w = Math.max(W_FLOOR, Math.min(1, 1 - Math.log(hours + 1) / HORIZON));
        const s = Math.floor((net - now) / 1000);
        const d = Math.floor(s / 86400);
        const hms = `${pad2(Math.floor((s % 86400) / 3600))}:${pad2(Math.floor((s % 3600) / 60))}:${pad2(s % 60)}`;
        label = d > 0 ? `T− ${d}d ${hms}` : `T− ${hms}`;
      }
      r.style.setProperty("--w", w.toFixed(3));
      r.dataset.strength = (0.4 + w * 1.6).toFixed(2);
      const count = r.querySelector<HTMLElement>("[data-cal-count]");
      if (count && count.textContent !== label) count.textContent = label;
    }
  };

  // ── color lens — status speaks, or steps aside; size stays imminence ──────
  const applyLens = (): void => {
    for (const r of rows()) {
      r.style.setProperty("--cat", lens === "status" ? catFor(r.dataset.status || "") : "#4da3ff");
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
        const recipe = { ...base, render: [] as never[] };
        activeField = applyRecipe(list, recipe, { bodies: rows(), annotateBodies: false });
      }
    } catch {
      /* the static --w layer stands on its own */
    }
  };

  // ── controls ───────────────────────────────────────────────────────────────
  lensBtns.forEach((b) =>
    b.addEventListener(
      "click",
      () => {
        lens = (b.dataset.calLens as CalendarLens) || "status";
        page.dataset.lens = lens;
        lensBtns.forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
        if (lensHint) lensHint.innerHTML = LENS_HINTS[lens];
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
      }
    },
    { signal: ac.signal },
  );

  tick();
  applyLens();
  runField();
  const clock = setInterval(tick, 1000);

  return () => {
    clearInterval(clock);
    ac.abort();
    activeField?.destroy();
  };
}

let teardown: (() => void) | undefined;
function init(): void {
  teardown?.();
  teardown = document.querySelector(".ex-calendar") ? initCalendar() : undefined;
}
if (document.readyState !== "loading") init();
else document.addEventListener("DOMContentLoaded", init);
document.addEventListener("astro:page-load", init);
document.addEventListener("astro:before-swap", () => {
  teardown?.();
  teardown = undefined;
});
