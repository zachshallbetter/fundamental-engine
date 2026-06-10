// Calendar Field runtime. field-ui as an INVISIBLE measurement layer over a real launch
// schedule, where the field's input is time itself:
//   · a 1-second clock recomputes every launch's weight (--w) from its distance to T−0 and
//     re-renders the live countdown. The soonest launch is the heaviest; launches whose NET
//     has passed (the snapshot ages) or whose date is TBD fall to the floor and say so.
//   · the mission-control wall: the first upcoming launch with a valid future NET holds the
//     featured "next up" card. The pick is recomputed on every tick from the same passed/TBD
//     logic, so when a window passes the hero swaps and the wall advances on its own; rows
//     whose window passes drift into the dimmed "unscheduled" cluster at the rail's end.
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

// distance-to-T−0 → weight (0..1), floored for passed / TBD launches.
const weightOf = (net: number, now: number): number => {
  if (Number.isNaN(net) || net <= now) return W_FLOOR;
  const hours = (net - now) / 36e5;
  return Math.max(W_FLOOR, Math.min(1, 1 - Math.log(hours + 1) / HORIZON));
};

function initCalendar(): () => void {
  const page = document.querySelector<HTMLElement>(".ex-calendar");
  if (!page) return () => {};
  const ac = new AbortController();
  const zone = page.querySelector<HTMLElement>("[data-cal-zone]");
  const cluster = page.querySelector<HTMLElement>("[data-cal-cluster-list]");
  const hero = page.querySelector<HTMLElement>("[data-cal-hero]");
  const heroName = hero?.querySelector<HTMLElement>("[data-cal-hero-name]") ?? null;
  const heroMeta = hero?.querySelector<HTMLElement>("[data-cal-hero-meta]") ?? null;
  const heroPad = hero?.querySelector<HTMLElement>("[data-cal-hero-pad]") ?? null;
  const heroStatus = hero?.querySelector<HTMLElement>("[data-cal-hero-status]") ?? null;
  const heroCount = hero?.querySelector<HTMLElement>("[data-cal-count]") ?? null;
  const rows = (): HTMLElement[] => [...page.querySelectorAll<HTMLElement>(".cal-row")];
  const fieldBtn = page.querySelector<HTMLButtonElement>("[data-cal-field]");
  const lensBtns = [...page.querySelectorAll<HTMLButtonElement>("[data-cal-lens]")];
  const lensHint = page.querySelector<HTMLElement>("[data-cal-lens-hint]");

  let lens: CalendarLens = "status";
  let fieldOn = true;
  let activeField: { destroy(): void } | null = null;

  const catOf = (status: string): string => (lens === "status" ? catFor(status) : "#4da3ff");

  // ── the "next up" board — recomputed from the rail on every tick ───────────
  const updateHero = (now: number): void => {
    if (!hero) return;
    const pick = rows()
      .filter((r) => r.dataset.status !== "TBD")
      .map((r) => ({ r, net: Date.parse(r.dataset.net || "") }))
      .filter((x) => !Number.isNaN(x.net) && x.net > now)
      .sort((a, b) => a.net - b.net)[0];

    if (!pick) {
      // every window in the snapshot has passed or sits at TBD — say so, don't pretend.
      if (hero.dataset.state !== "empty") {
        hero.dataset.state = "empty";
        hero.dataset.id = "";
        if (heroName) heroName.textContent = "Nothing on the clock";
        if (heroMeta) heroMeta.textContent = "every window in this snapshot has passed or sits at TBD";
        if (heroPad) heroPad.textContent = "";
        if (heroStatus) heroStatus.hidden = true;
        if (heroCount) heroCount.textContent = "T− ——:——:——";
        rows().forEach((x) => x.removeAttribute("data-next"));
      }
      hero.style.setProperty("--w", W_FLOOR.toFixed(3));
      hero.dataset.strength = (0.4 + W_FLOOR * 1.6).toFixed(2);
      return;
    }

    const r = pick.r;
    if (hero.dataset.id !== r.dataset.id) {
      // the wall advances: a window passed (or the snapshot aged in) — swap the hero.
      hero.dataset.id = r.dataset.id || "";
      hero.dataset.net = r.dataset.net || "";
      hero.dataset.status = r.dataset.status || "";
      delete hero.dataset.state;
      if (heroName) heroName.textContent = r.dataset.name || "";
      if (heroMeta) heroMeta.textContent = r.dataset.pv || "";
      if (heroPad) heroPad.textContent = r.dataset.padloc || "";
      if (heroStatus) {
        heroStatus.hidden = false;
        heroStatus.textContent = r.dataset.status || "";
        heroStatus.dataset.status = r.dataset.status || "";
        heroStatus.title = r.dataset.statusName || "";
      }
      rows().forEach((x) => x.toggleAttribute("data-next", x === r));
      hero.style.setProperty("--cat", catOf(r.dataset.status || ""));
    }
    // weight + the centerpiece countdown, every second.
    const w = weightOf(pick.net, now);
    hero.style.setProperty("--w", w.toFixed(3));
    hero.dataset.strength = (0.4 + w * 1.6).toFixed(2);
    if (heroCount) {
      const s = Math.floor((pick.net - now) / 1000);
      const d = Math.floor(s / 86400);
      const hms = `${pad2(Math.floor((s % 86400) / 3600))}:${pad2(Math.floor((s % 3600) / 60))}:${pad2(s % 60)}`;
      const label = d > 0 ? `T− ${d}d ${hms}` : `T− ${hms}`;
      if (heroCount.textContent !== label) heroCount.textContent = label;
    }
  };

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
        // …and the card drifts to the unscheduled cluster at the rail's end.
        if (cluster && r.parentElement !== cluster) {
          const day = r.closest<HTMLElement>(".cal-day");
          r.removeAttribute("data-next");
          cluster.appendChild(r);
          if (day && !day.querySelector(".cal-row")) day.hidden = true;
        }
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
    updateHero(now);
  };

  // ── color lens — status speaks, or steps aside; size stays imminence ──────
  const applyLens = (): void => {
    for (const r of rows()) {
      r.style.setProperty("--cat", catOf(r.dataset.status || ""));
    }
    hero?.style.setProperty("--cat", catOf(hero.dataset.status || ""));
  };

  // ── the invisible scoped field (render: []) ───────────────────────────────
  const runField = (): void => {
    activeField?.destroy();
    activeField = null;
    if (!fieldOn || !zone) return;
    try {
      const base = recipeById("evidence-field");
      if (base) {
        // render: [] keeps the field invisible; the extra "attention" metric asks the
        // platform pipeline to write --field-attention per card (an eased 0..1 blend of
        // engagement, viewport-center proximity, and visibility) — read by the ink CSS.
        const recipe = {
          ...base,
          render: [] as never[],
          metrics: [...new Set([...(base.metrics ?? []), "attention"])],
        } as typeof base;
        const bodies = rows();
        if (hero) bodies.push(hero);
        activeField = applyRecipe(zone, recipe, { bodies, annotateBodies: false });
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
