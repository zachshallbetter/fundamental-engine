// Calendar Field runtime. Fundamental as an INVISIBLE measurement layer over a real launch
// schedule, where the field's input is time itself — rendered in three calendar geometries:
//   · DAY — a single day's agenda with an hour gutter; ‹ › arrows walk the data's range.
//   · WEEK — seven columns from the snapshot's today, plus a narrow "later +" summary.
//   · MONTH — a real Sun–Sat month grid with compact launch chips (the chips are the bodies).
// All three views render from the same 30 records. Switching views re-renders the records
// zone and re-applies the scoped field over the new bodies — the field doesn't care about
// the layout; it measures whatever geometry you give it.
//   · a 1-second clock recomputes every launch's weight (--w) from its distance to T−0,
//     re-renders every countdown (full in day/week, compact in month chips), and re-picks
//     the featured "next up" card. When a window passes, the classification changes and the
//     mounted view re-renders: passed launches drift to "unscheduled" in day/week and dim
//     in place in month. Rows whose window has passed say so — the snapshot ages honestly.
//   · the view choice persists in localStorage and reflects as ?view= (shareable; the URL
//     wins over storage on init). Default: week.
//   · Field on/off — off, the page collapses to a flat calendar (CSS via [data-field]); the
//     scoped field is destroyed. The countdowns keep ticking — they're data, not field.
//   · Color by status / off — --cat encodes launch status, or steps aside entirely.
// The scoped field runs with render: [] — particles compute (metrics flow) but are never drawn.
import { imminence, recipeById, weightToStrength } from "@fundamental-engine/core";
import { applyPattern } from "@fundamental-engine/dom";
import calendar from "../../data/examples/calendar.json";
import { pageRuntime } from "../../lib/page-runtime.ts";
import { persisted } from "../../lib/persisted.ts";
import { wireSegments, wireFieldToggle } from "../../lib/controls.ts";

type CalendarView = "day" | "week" | "month";
type CalendarLens = "status" | "off";

interface Rec {
  id: string;
  name: string;
  provider: string;
  vehicle: string;
  pad: string;
  location: string;
  net: string;
  netMs: number;
  status: string;
  statusName: string;
  orbit: string;
  dayKey: string | null; // yyyy-mm-dd (UTC) for dated launches; null for TBD / unparsable
}

// imminence math — must match the server-side render in calendar.astro: the core temporal
// kernel (imminence: log-ramped to T−0 across the horizon), floored at 0.08 for passed /
// TBD launches. The floor is page semantics; the ramp is the kernel.
const HORIZON_MS = 30 * 24 * 36e5; // the 30-day horizon
const W_FLOOR = 0.08;

// status → anchor color — must match calendar.astro.
const STATUS_CAT: Record<string, string> = { Go: "#2dd4bf", TBC: "#fbbf24" };
const catFor = (status: string): string => STATUS_CAT[status] ?? "#8a93a6";

const LENS_HINTS: Record<CalendarLens, string> = {
  status: "<b>color</b> = launch status — Go is confirmed, TBC awaits confirmation",
  off: "<b>color</b> = off — imminence carries the whole signal",
};

const VIEWS: readonly CalendarView[] = ["day", "week", "month"];
const isView = (v: unknown): v is CalendarView => VIEWS.includes(v as CalendarView);

// the view choice's storage slot — fui:cal-view, same key the page has always used. The
// pre-persisted() format stored the bare view string ("week"), which isn't valid JSON; the
// one-time shim below re-encodes it in place so existing visitors keep their choice.
const viewStore = persisted<CalendarView>("cal-view", "week");
const migrateBareViewValue = (): void => {
  try {
    const raw = localStorage.getItem("fui:cal-view");
    if (raw != null && isView(raw)) localStorage.setItem("fui:cal-view", JSON.stringify(raw));
  } catch {
    /* storage unavailable — week stands */
  }
};

const pad2 = (n: number): string => String(n).padStart(2, "0");
const esc = (s: string): string =>
  s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

// ── UTC day arithmetic (keys are yyyy-mm-dd) ─────────────────────────────────
const DAY_MS = 86400000;
const dayMs = (key: string): number => Date.parse(`${key}T00:00:00Z`);
const keyOf = (ms: number): string => new Date(ms).toISOString().slice(0, 10);
const addDays = (key: string, n: number): string => keyOf(dayMs(key) + n * DAY_MS);
const sundayOf = (key: string): string => {
  const ms = dayMs(key);
  return keyOf(ms - new Date(ms).getUTCDay() * DAY_MS);
};
const hhmm = (ms: number): string => {
  const d = new Date(ms);
  return `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`;
};

const fmtDayLong = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
  timeZone: "UTC",
});
const fmtWd = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "UTC" });
const fmtShort = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});
const fmtMonthYear = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

// ── the records — one list, three geometries ─────────────────────────────────
const records: Rec[] = calendar.launches.map((l) => {
  const netMs = Date.parse(l.net);
  return {
    id: l.id,
    name: l.name,
    provider: l.provider,
    vehicle: l.vehicle,
    pad: l.pad,
    location: l.location,
    net: l.net,
    netMs,
    status: l.status,
    statusName: l.statusName,
    orbit: l.orbit,
    dayKey: l.status === "TBD" || Number.isNaN(netMs) ? null : l.net.slice(0, 10),
  };
});
const byId = new Map(records.map((r) => [r.id, r]));
const datedDays = [...new Set(records.filter((r) => r.dayKey).map((r) => r.dayKey as string))].sort();
const MIN_DAY = datedDays[0];
const MAX_DAY = datedDays[datedDays.length - 1];
const SNAP_DAY = calendar.snapshotAt.slice(0, 10);

const byNet = (a: Rec, b: Rec): number => a.netMs - b.netMs;
const isPassed = (r: Rec, now: number): boolean =>
  r.status !== "TBD" && !Number.isNaN(r.netMs) && r.netMs <= now;

// distance-to-T−0 → weight (0..1): the imminence kernel, floored for passed / TBD launches.
const weightOf = (r: Rec, now: number): number => {
  if (r.status === "TBD" || Number.isNaN(r.netMs) || r.netMs <= now) return W_FLOOR;
  return Math.max(W_FLOOR, imminence(r.netMs, now, HORIZON_MS));
};

// the full countdown (day/week cards + the hero) and the compact one (month chips).
const fullLabel = (r: Rec, now: number): string => {
  if (r.status === "TBD" || Number.isNaN(r.netMs)) return "TBD";
  if (r.netMs <= now) return "window passed · snapshot";
  const s = Math.floor((r.netMs - now) / 1000);
  const d = Math.floor(s / 86400);
  const hms = `${pad2(Math.floor((s % 86400) / 3600))}:${pad2(Math.floor((s % 3600) / 60))}:${pad2(s % 60)}`;
  return d > 0 ? `T− ${d}d ${hms}` : `T− ${hms}`;
};
const compactLabel = (r: Rec, now: number): string => {
  if (r.status === "TBD" || Number.isNaN(r.netMs)) return "TBD";
  if (r.netMs <= now) return "passed";
  const s = Math.floor((r.netMs - now) / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `T−${d}d ${pad2(h)}h`;
  if (h > 0) return `T−${pad2(h)}h ${pad2(m)}m`;
  return `T−${pad2(m)}m ${pad2(s % 60)}s`;
};

function initCalendar(page: HTMLElement): () => void {
  const ac = new AbortController();
  const zone = page.querySelector<HTMLElement>("[data-cal-zone]");
  const viewsRoot = page.querySelector<HTMLElement>("[data-cal-views]");
  const hero = page.querySelector<HTMLElement>("[data-cal-hero]");
  const heroName = hero?.querySelector<HTMLElement>("[data-cal-hero-name]") ?? null;
  const heroMeta = hero?.querySelector<HTMLElement>("[data-cal-hero-meta]") ?? null;
  const heroPad = hero?.querySelector<HTMLElement>("[data-cal-hero-pad]") ?? null;
  const heroStatus = hero?.querySelector<HTMLElement>("[data-cal-hero-status]") ?? null;
  const heroCount = hero?.querySelector<HTMLElement>("[data-cal-count]") ?? null;
  const fieldBtn = page.querySelector<HTMLButtonElement>("[data-cal-field]");
  const lensBtns = [...page.querySelectorAll<HTMLButtonElement>("[data-cal-lens]")];
  const lensHint = page.querySelector<HTMLElement>("[data-cal-lens-hint]");
  const viewBtns = [...page.querySelectorAll<HTMLButtonElement>("[data-cal-view]")];

  let lens: CalendarLens = "status";
  let fieldOn = true;
  let activeField: { destroy(): void } | null = null;
  let viewAc: AbortController | null = null;
  let heroId: string | null = null;
  let passedSig = -1;

  // view choice: the URL wins over storage; default week. Persisted + reflected on switch.
  let view: CalendarView = "week";
  const urlView = new URLSearchParams(location.search).get("view");
  if (isView(urlView)) view = urlView;
  else {
    migrateBareViewValue();
    const stored = viewStore.get();
    if (isView(stored)) view = stored;
  }

  // day view selection: default = the day of the next upcoming launch (else the last day).
  const pickHero = (now: number): Rec | undefined =>
    records
      .filter((r) => r.status !== "TBD" && !Number.isNaN(r.netMs) && r.netMs > now)
      .sort(byNet)[0];
  let selectedDay = pickHero(Date.now())?.dayKey ?? MAX_DAY;

  const catOf = (status: string): string => (lens === "status" ? catFor(status) : "#4da3ff");
  const mounted = (): HTMLElement[] =>
    viewsRoot ? [...viewsRoot.querySelectorAll<HTMLElement>("[data-id]")] : [];

  // ── the shared body contract — same attributes in every geometry ───────────
  const bodyAttrs = (r: Rec, now: number, range: number): string => {
    const w = weightOf(r, now);
    return (
      `data-body="attract" data-feedback data-hot data-range="${range}"` +
      ` data-strength="${weightToStrength(w).toFixed(2)}" data-id="${esc(r.id)}"` +
      ` data-net="${esc(r.net)}" data-status="${esc(r.status)}"` +
      (isPassed(r, now) ? " data-passed" : "") +
      (heroId && r.id === heroId ? " data-next" : "") +
      ` style="--w:${w.toFixed(3)};--cat:${catOf(r.status)};"`
    );
  };

  const cardInner = (r: Rec, now: number): string => `
    <div class="cal-body">
      <span class="cal-name">${esc(r.name)}</span>
      <span class="cal-meta">${esc(r.provider)} · ${esc(r.vehicle)}</span>
      <span class="cal-meta cal-meta-dim">${esc(r.pad)} · ${esc(r.location)}</span>
    </div>
    <div class="cal-side">
      <span class="cal-count" data-cal-count>${fullLabel(r, now)}</span>
      <span class="cal-chips">
        <span class="cal-status" data-status="${esc(r.status)}" title="${esc(r.statusName)}">${esc(r.status)}</span>
        ${r.orbit && r.orbit !== "N/A" ? `<span class="cal-orbit">${esc(r.orbit)}</span>` : ""}
      </span>
    </div>`;

  // ── DAY — the agenda: one selected day, an hour gutter, ‹ › within the data ─
  const renderDay = (now: number): string => {
    const dayRecs = records
      .filter((r) => r.dayKey === selectedDay && !isPassed(r, now))
      .sort(byNet);
    const unsched = records.filter((r) => r.status === "TBD" || isPassed(r, now));
    const isLast = selectedDay >= MAX_DAY;
    const list = dayRecs.length
      ? `<ol class="cal-list cal-agenda-list">${dayRecs
          .map(
            (r) => `<li class="cal-slot">
              <span class="cal-hour">${hhmm(r.netMs)}<small>UTC</small></span>
              <div class="cal-row" ${bodyAttrs(r, now, 200)}>${cardInner(r, now)}</div>
            </li>`,
          )
          .join("")}</ol>`
      : `<p class="cal-empty">No launches this day — the snapshot schedules nothing here.</p>`;
    const cluster =
      isLast && unsched.length
        ? `<section class="cal-agenda-un">
            <h3 class="cal-day-h">Unscheduled<span class="cal-day-tz">window passed · date TBD</span></h3>
            <ol class="cal-list">${unsched
              .map((r) => `<li class="cal-row" ${bodyAttrs(r, now, 200)}>${cardInner(r, now)}</li>`)
              .join("")}</ol>
          </section>`
        : unsched.length
          ? `<p class="cal-agenda-foot">${unsched.length} unscheduled — window passed · date TBD — collected on the schedule's last day (${fmtShort.format(new Date(dayMs(MAX_DAY)))})</p>`
          : "";
    return `<section class="cal-agenda">
      <header class="cal-agenda-h">
        <button type="button" class="cal-nav" data-cal-prev aria-label="Previous day"${selectedDay <= MIN_DAY ? " disabled" : ""}>‹</button>
        <h2 class="cal-agenda-date">${fmtDayLong.format(new Date(dayMs(selectedDay)))}
          <span class="cal-day-tz">UTC</span>${selectedDay === SNAP_DAY ? '<span class="cal-today-tag">today · snapshot</span>' : ""}
        </h2>
        <button type="button" class="cal-nav" data-cal-next aria-label="Next day"${isLast ? " disabled" : ""}>›</button>
      </header>
      ${list}
      ${cluster}
    </section>`;
  };

  // ── WEEK — 7 columns from the snapshot's today + a narrow "later +" column ──
  const renderWeek = (now: number): string => {
    const weekDays = Array.from({ length: 7 }, (_, i) => addDays(SNAP_DAY, i));
    const weekEnd = weekDays[6];
    const later = records
      .filter((r) => r.dayKey && r.dayKey > weekEnd && !isPassed(r, now))
      .sort(byNet);
    const unsched = records.filter((r) => r.status === "TBD" || isPassed(r, now));
    const cols = weekDays
      .map((key) => {
        const recs = records
          .filter((r) => r.dayKey === key && !isPassed(r, now))
          .sort(byNet);
        const d = new Date(dayMs(key));
        const cards = recs.length
          ? `<ol class="cal-wlist">${recs
              .map(
                (r) => `<li class="cal-wcard" ${bodyAttrs(r, now, 160)}>
                  <span class="cal-wtime">${hhmm(r.netMs)} UTC</span>
                  <span class="cal-wname">${esc(r.name)}</span>
                  <span class="cal-wmeta">${esc(r.provider)}</span>
                  <span class="cal-wfoot">
                    <span class="cal-count-c" data-cal-count-compact>${compactLabel(r, now)}</span>
                    <span class="cal-status" data-status="${esc(r.status)}" title="${esc(r.statusName)}">${esc(r.status)}</span>
                  </span>
                </li>`,
              )
              .join("")}</ol>`
          : `<p class="cal-wempty">no launches</p>`;
        return `<section class="cal-wcol"${key === SNAP_DAY ? " data-today" : ""}>
          <h3 class="cal-wcol-h"><span class="cal-wd">${fmtWd.format(d)}</span><b>${d.getUTCDate()}</b>${key === SNAP_DAY ? '<span class="cal-today-tag">today · snapshot</span>' : ""}</h3>
          ${cards}
        </section>`;
      })
      .join("");
    const laterCol = `<section class="cal-wcol cal-wcol--later">
      <h3 class="cal-wcol-h"><span class="cal-wd">later</span><b>+</b></h3>
      <div class="cal-wlater">
        ${
          later.length
            ? `<p><b>${later.length}</b> beyond this week</p><p class="cal-wlater-dim">next ${fmtShort.format(new Date(dayMs(later[0].dayKey as string)))}</p>`
            : `<p class="cal-wlater-dim">nothing beyond this week</p>`
        }
        ${unsched.length ? `<p><b>${unsched.length}</b> unscheduled</p><p class="cal-wlater-dim">window passed · date TBD</p>` : ""}
      </div>
    </section>`;
    return `<div class="cal-week">${cols}${laterCol}</div>`;
  };

  // ── MONTH — a real Sun–Sat grid over the weeks the data spans ───────────────
  const renderMonth = (now: number): string => {
    const start = sundayOf(MIN_DAY);
    const end = addDays(sundayOf(MAX_DAY), 6);
    const minD = new Date(dayMs(MIN_DAY));
    const maxD = new Date(dayMs(MAX_DAY));
    const monthLabel =
      minD.getUTCMonth() === maxD.getUTCMonth() && minD.getUTCFullYear() === maxD.getUTCFullYear()
        ? fmtMonthYear.format(minD)
        : `${fmtMonthYear.format(minD)} – ${fmtMonthYear.format(maxD)}`;
    const chip = (r: Rec): string =>
      `<li class="cal-chip" ${bodyAttrs(r, now, 120)} title="${esc(r.name)} · ${esc(r.statusName)}">
        <span class="cal-dot" aria-hidden="true"></span>
        <span class="cal-chip-n">${esc(r.name)}</span>
        <span class="cal-chip-c" data-cal-count-compact>${compactLabel(r, now)}</span>
      </li>`;
    let cells = "";
    for (let key = start; key <= end; key = addDays(key, 1)) {
      const inData = key >= MIN_DAY && key <= MAX_DAY;
      const recs = records.filter((r) => r.dayKey === key).sort(byNet);
      const more = recs.length - 3;
      cells += `<div class="cal-mcell"${key === SNAP_DAY ? " data-today" : ""}${inData ? "" : " data-out"}>
        <span class="cal-mdate">${new Date(dayMs(key)).getUTCDate()}</span>
        ${
          recs.length
            ? `<ul class="cal-mchips">${recs.slice(0, 3).map(chip).join("")}${more > 0 ? `<li class="cal-more">+${more} more</li>` : ""}</ul>`
            : ""
        }
      </div>`;
    }
    const tbd = records.filter((r) => r.status === "TBD");
    const strip = tbd.length
      ? `<section class="cal-mun">
          <h3 class="cal-mun-h">Unscheduled<span class="cal-day-tz">date TBD</span></h3>
          <ul class="cal-mchips cal-mun-list">${tbd.map(chip).join("")}</ul>
        </section>`
      : "";
    return `<div class="cal-month">
      <header class="cal-month-h">
        <h2>${monthLabel}</h2>
        <span class="cal-month-note">weeks start Sunday · UTC · today ringed at the snapshot</span>
      </header>
      <div class="cal-mgrid">
        ${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((w) => `<span class="cal-mwd">${w}</span>`).join("")}
        ${cells}
      </div>
      ${strip}
    </div>`;
  };

  // ── view mount — re-render the zone, re-wire its controls, re-apply the field ─
  const VIEW_RENDER: Record<CalendarView, (now: number) => string> = {
    day: renderDay,
    week: renderWeek,
    month: renderMonth,
  };

  const renderView = (): void => {
    if (!viewsRoot) return;
    // the old view's listeners die with it — one AbortController per mounted view.
    viewAc?.abort();
    viewAc = new AbortController();
    const now = Date.now();
    viewsRoot.innerHTML = VIEW_RENDER[view](now);
    viewsRoot.dataset.view = view;
    if (view === "day") {
      viewsRoot.querySelector<HTMLButtonElement>("[data-cal-prev]")?.addEventListener(
        "click",
        () => {
          if (selectedDay > MIN_DAY) selectedDay = addDays(selectedDay, -1);
          renderView();
        },
        { signal: viewAc.signal },
      );
      viewsRoot.querySelector<HTMLButtonElement>("[data-cal-next]")?.addEventListener(
        "click",
        () => {
          if (selectedDay < MAX_DAY) selectedDay = addDays(selectedDay, 1);
          renderView();
        },
        { signal: viewAc.signal },
      );
    }
    // the bodies changed — destroy + re-apply the recipe over the new geometry.
    runField();
  };

  const setView = (v: CalendarView): void => {
    if (v === view) return;
    view = v;
    viewBtns.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.calView === v)));
    viewStore.set(v); // storage may be unavailable — the URL still carries the choice
    const url = new URL(location.href);
    url.searchParams.set("view", v);
    history.replaceState(history.state, "", url);
    renderView();
  };

  // ── the "next up" board — recomputed from the records on every tick ─────────
  const updateHero = (now: number): void => {
    if (!hero) return;
    const pick = pickHero(now);
    if (!pick) {
      // every window in the snapshot has passed or sits at TBD — say so, don't pretend.
      heroId = null;
      if (hero.dataset.state !== "empty") {
        hero.dataset.state = "empty";
        hero.dataset.id = "";
        if (heroName) heroName.textContent = "Nothing on the clock";
        if (heroMeta) heroMeta.textContent = "every window in this snapshot has passed or sits at TBD";
        if (heroPad) heroPad.textContent = "";
        if (heroStatus) heroStatus.hidden = true;
        if (heroCount) heroCount.textContent = "T− ——:——:——";
      }
      hero.style.setProperty("--w", W_FLOOR.toFixed(3));
      hero.dataset.strength = weightToStrength(W_FLOOR).toFixed(2);
      return;
    }
    heroId = pick.id;
    if (hero.dataset.id !== pick.id) {
      // the wall advances: a window passed (or the snapshot aged in) — swap the hero.
      hero.dataset.id = pick.id;
      hero.dataset.net = pick.net;
      hero.dataset.status = pick.status;
      delete hero.dataset.state;
      if (heroName) heroName.textContent = pick.name;
      if (heroMeta) heroMeta.textContent = `${pick.provider} · ${pick.vehicle}`;
      if (heroPad) heroPad.textContent = `${pick.pad} · ${pick.location}`;
      if (heroStatus) {
        heroStatus.hidden = false;
        heroStatus.textContent = pick.status;
        heroStatus.dataset.status = pick.status;
        heroStatus.title = pick.statusName;
      }
      hero.style.setProperty("--cat", catOf(pick.status));
    }
    // weight + the centerpiece countdown, every second.
    const w = weightOf(pick, now);
    hero.style.setProperty("--w", w.toFixed(3));
    hero.dataset.strength = weightToStrength(w).toFixed(2);
    if (heroCount) {
      const label = fullLabel(pick, now);
      if (heroCount.textContent !== label) heroCount.textContent = label;
    }
  };

  // ── the 1 Hz clock — time in, weight + countdown out, in whatever view is mounted ─
  const tick = (): void => {
    const now = Date.now();
    // a window just passed — the classification changed, so the mounted view re-renders
    // (passed launches drift to unscheduled in day/week, dim in place in month).
    const sig = records.reduce((n, r) => n + (isPassed(r, now) ? 1 : 0), 0);
    if (sig !== passedSig) {
      passedSig = sig;
      renderView();
    }
    updateHero(now);
    for (const el of mounted()) {
      const r = byId.get(el.dataset.id || "");
      if (!r) continue;
      const w = weightOf(r, now);
      el.style.setProperty("--w", w.toFixed(3));
      el.dataset.strength = weightToStrength(w).toFixed(2);
      el.toggleAttribute("data-next", r.id === heroId);
      el.toggleAttribute("data-passed", isPassed(r, now));
      const c = el.querySelector<HTMLElement>("[data-cal-count]");
      if (c) {
        const label = fullLabel(r, now);
        if (c.textContent !== label) c.textContent = label;
      }
      const cc = el.querySelector<HTMLElement>("[data-cal-count-compact]");
      if (cc) {
        const label = compactLabel(r, now);
        if (cc.textContent !== label) cc.textContent = label;
      }
    }
  };

  // ── color lens — status speaks, or steps aside; size stays imminence ──────
  const applyLens = (): void => {
    for (const el of mounted()) {
      el.style.setProperty("--cat", catOf(byId.get(el.dataset.id || "")?.status || ""));
    }
    hero?.style.setProperty("--cat", catOf(hero.dataset.status || ""));
  };

  // ── the invisible scoped field (render: []) — re-applied per mounted geometry ─
  const runField = (): void => {
    activeField?.destroy();
    activeField = null;
    if (!fieldOn || !zone) return;
    try {
      const base = recipeById("evidence-field");
      if (base) {
        // renderless keeps the field invisible; the extra "attention" metric asks the
        // platform pipeline to write --field-attention per card (an eased 0..1 blend of
        // engagement, viewport-center proximity, and visibility) — read by the ink CSS.
        const bodies = viewsRoot
          ? [...viewsRoot.querySelectorAll<HTMLElement>("[data-body]")]
          : [];
        if (hero) bodies.push(hero);
        activeField = applyPattern(zone, base, {
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

  // ── controls ───────────────────────────────────────────────────────────────
  viewBtns.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.calView === view)));
  wireSegments(
    viewBtns,
    "calView",
    (v) => {
      if (isView(v)) setView(v);
    },
    ac.signal,
  );

  wireSegments(
    lensBtns,
    "calLens",
    (v) => {
      lens = (v as CalendarLens) || "status";
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

  passedSig = records.reduce((n, r) => n + (isPassed(r, Date.now()) ? 1 : 0), 0);
  updateHero(Date.now()); // sets heroId before the first render bakes data-next
  renderView();
  tick();
  const clock = setInterval(tick, 1000);

  return () => {
    clearInterval(clock);
    ac.abort();
    viewAc?.abort();
    activeField?.destroy();
  };
}

pageRuntime(".ex-calendar", initCalendar);
