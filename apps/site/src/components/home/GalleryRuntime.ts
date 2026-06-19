// Gallery runtime — wires the "What it can do" exploration chapter on the home. Each helper guards
// on its own markup, so the whole thing no-ops on pages without the gallery (e.g. /eli5). Returns a
// single teardown. Reuses only proven engine surfaces:
//   · field:captured / field:released — real bubbling CustomEvents the sink dispatches (core/field.ts).
//   · --field-density — the metric the platform writes back onto a [data-feedback] body (feedback.ts).
//   · field.setRender(mode) — the Field Surfaces underlay switch on <field-root>.

import { bindData } from "@fundamental-engine/dom";

import { VisualBindingRegistry } from "@fundamental-engine/dom";

type FieldEl = HTMLElement & {
  setRender?: (m: string) => void;
  setOverlay?: (m: string | string[]) => void;
  setFormation?: (name: string) => void;
  rescan?: () => void;
};

interface SearchRec {
  id: string;
  title: string;
  relevance: number;
}

/** #8 — Data as field participants: records become bodies via bindData + a recipe; re-rank live. */
function initBindData(): () => void {
  const list = document.querySelector<HTMLElement>("[data-bd-list]");
  if (!list) return () => {};
  const btn = document.querySelector<HTMLButtonElement>("[data-bd-rerank]");
  let records: SearchRec[] = [
    { id: "bd-engine", title: "the engine computes the field", relevance: 0.95 },
    { id: "bd-platform", title: "the platform binds it to the DOM", relevance: 0.78 },
    { id: "bd-recipes", title: "recipes compose behaviours", relevance: 0.61 },
    { id: "bd-forces", title: "forces are the vocabulary", relevance: 0.43 },
    { id: "bd-eli5", title: "explained like you're five", relevance: 0.27 },
  ];
  const mapper = (rec: SearchRec) => ({
    id: rec.id,
    label: rec.title,
    body: { tokens: ["attract"], strength: 0.4 + rec.relevance * 1.5, feedback: true },
    metrics: { relevance: rec.relevance },
  });
  const content = (rec: SearchRec) =>
    `<span class="bd-title">${rec.title}</span>` +
    `<span class="bd-bar"><i style="width:${Math.round(rec.relevance * 100)}%"></i></span>` +
    `<span class="bd-score">${rec.relevance.toFixed(2)}</span>`;
  const binding = bindData<SearchRec>(list, records, mapper, {
    recipe: "search-relevance-field",
    className: "bd-row",
    content,
  });
  const ac = new AbortController();
  btn?.addEventListener(
    "click",
    () => {
      records = records
        .map((r) => ({ ...r, relevance: Math.round((0.15 + Math.random() * 0.85) * 100) / 100 }))
        .sort((a, b) => b.relevance - a.relevance);
      binding.update(records);
    },
    { signal: ac.signal },
  );
  return () => {
    ac.abort();
    binding.destroy();
  };
}

/** Shared "pick a mode, apply it to the page field while in view" wiring for the pill demos. */
function initPillTour(
  rootSel: string,
  buttonAttr: string,
  fallback: string,
  apply: (field: FieldEl | null, value: string) => void,
): () => void {
  const root = document.querySelector<HTMLElement>(rootSel);
  if (!root) return () => {};
  const field = document.querySelector("field-root") as FieldEl | null;
  const buttons = [...root.querySelectorAll<HTMLButtonElement>(`button[${buttonAttr}]`)];
  if (!buttons.length) return () => {};
  const ac = new AbortController();
  let inView = false;
  let current = buttons[0];
  const run = () => apply(field, inView && current ? current.dataset[buttonAttr.replace("data-", "")] || fallback : fallback);
  const select = (b: HTMLButtonElement) => {
    current = b;
    buttons.forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    run();
  };
  buttons.forEach((b) => b.addEventListener("click", () => select(b), { signal: ac.signal }));
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        inView = e.isIntersecting;
        run();
      }
    },
    { threshold: 0.4 },
  );
  io.observe(root);
  return () => {
    ac.abort();
    io.disconnect();
    apply(field, fallback);
  };
}

/** #4 — Capture · hold · release: count the sink's real field:captured / field:released events. */
function initLifecycle(): () => void {
  const panel = document.querySelector<HTMLElement>("[data-lifecycle]");
  if (!panel) return () => {};
  const ac = new AbortController();
  const capEl = panel.querySelector<HTMLElement>("[data-cap-count]");
  const relEl = panel.querySelector<HTMLElement>("[data-rel-count]");
  const log = panel.querySelector<HTMLElement>("[data-cap-log]");
  let captured = 0;
  let released = 0;

  const line = (text: string, kind: string) => {
    if (!log) return;
    const li = document.createElement("li");
    li.className = `cap-line cap-${kind}`;
    li.textContent = text;
    log.prepend(li);
    while (log.childElementCount > 6) log.lastElementChild?.remove();
  };

  // The events bubble (composed) up from the sink body, so one listener on the panel catches them.
  panel.addEventListener(
    "field:captured",
    (e) => {
      const n = (e as CustomEvent).detail?.count ?? 1;
      captured += n;
      if (capEl) capEl.textContent = String(captured);
      line(`captured +${n}`, "in");
    },
    { signal: ac.signal },
  );
  panel.addEventListener(
    "field:released",
    (e) => {
      const n = (e as CustomEvent).detail?.count ?? 0;
      released += n;
      if (relEl) relEl.textContent = String(released);
      line(`released ${n} — supernova`, "out");
    },
    { signal: ac.signal },
  );

  return () => ac.abort();
}

/** #1 — The contract, in numbers: mirror the engine-written --field-density off a [data-readout] body. */
function initReadout(): () => void {
  const body = document.querySelector<HTMLElement>("[data-readout]");
  if (!body) return () => {};
  const out = document.querySelector<HTMLElement>("[data-readout-value]");
  let raf = 0;
  let alive = true;
  const read = () => {
    if (!alive) return;
    const cs = getComputedStyle(body);
    const d =
      parseFloat(cs.getPropertyValue("--field-density")) ||
      parseFloat(cs.getPropertyValue("--d")) ||
      0;
    if (out) out.textContent = d.toFixed(2);
    body.style.setProperty("--d", String(d)); // drive the inline bar + weight from the same value
    raf = requestAnimationFrame(read);
  };
  raf = requestAnimationFrame(read);
  return () => {
    alive = false;
    cancelAnimationFrame(raf);
  };
}

/** #3 — Field Surfaces: the matter mode (underlay, exclusive) plus the overlay readings (additive —
 *  any set of them stacks on the front surface). Applied to the whole-page field only while the
 *  panel is in view; restores to dots / off on leave. The caption line defines whatever was last
 *  touched: "<mode> — what it draws · what it reads". */
function initRenderTour(): () => void {
  const root = document.querySelector<HTMLElement>("[data-rendertour]");
  if (!root) return () => {};
  const field = document.querySelector("field-root") as FieldEl | null;
  const matter = [...root.querySelectorAll<HTMLButtonElement>("button[data-render]")];
  const readings = [...root.querySelectorAll<HTMLButtonElement>("button[data-overlay-mode]")];
  const caption = root.querySelector<HTMLElement>("[data-rt-caption]");
  if (!matter.length) return () => {};
  const ac = new AbortController();
  let inView = false;
  let mode = matter[0];
  const active = new Set<string>();
  // resting underlay = the page-wide field flow (the nav toggle, data-nav-flow → the 'flow' render).
  // When this panel isn't driving its own matter mode, fall back to THAT, not a hard 'dots' — so
  // scrolling past the panel doesn't silently kill the global flow. The overlay surface is this
  // panel's own in-front readings only, so it simply clears to off when no reading is active.
  const restingRender = () =>
    field?.dataset.navFlow === "on" ? "flow" : "dots";
  const run = () => {
    field?.setRender?.(inView && mode ? mode.dataset.render || "dots" : restingRender());
    const stack = inView ? [...active] : [];
    field?.setOverlay?.(stack.length ? stack : "off");
  };
  const say = (b: HTMLButtonElement) => {
    const name = b.dataset.render ?? b.dataset.overlayMode;
    if (caption && name && b.dataset.def) caption.textContent = `${name} — ${b.dataset.def}`;
  };
  matter.forEach((b) =>
    b.addEventListener(
      "click",
      () => {
        mode = b;
        matter.forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
        say(b);
        run();
      },
      { signal: ac.signal },
    ),
  );
  readings.forEach((b) =>
    b.addEventListener(
      "click",
      () => {
        const name = b.dataset.overlayMode;
        if (!name) return;
        if (active.has(name)) active.delete(name);
        else active.add(name);
        b.setAttribute("aria-pressed", String(active.has(name)));
        say(b);
        run();
      },
      { signal: ac.signal },
    ),
  );
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        inView = e.isIntersecting;
        run();
      }
    },
    { threshold: 0.4 },
  );
  io.observe(root);
  return () => {
    ac.abort();
    io.disconnect();
    field?.setRender?.(restingRender());
    field?.setOverlay?.("off");
  };
}

/** #6 — Formations: re-arrange the whole page field — ambient / wells / lanes / scatter / accretion. */
function initFormationTour(): () => void {
  return initPillTour("[data-formationtour]", "data-formation", "ambient", (f, v) => f?.setFormation?.(v));
}

/** #7 — Contour Charge: the bound ring SVG receives the heading's live --d/--load via the
 *  platform's visual-binding mirroring (the engine handles the physics: engagement-gated capture,
 *  falling-edge discharge — this only wires the representation). */
function initContourCharge(): () => void {
  const stage = document.querySelector<HTMLElement>("[data-chargetour]");
  if (!stage) return () => {};
  const reg = new VisualBindingRegistry();
  reg.scan(stage);
  reg.setMirroring(true);
  return () => reg.setMirroring(false);
}

export function initGallery(): () => void {
  const teardowns = [
    initLifecycle(),
    initReadout(),
    initRenderTour(),
    initFormationTour(),
    initContourCharge(),
    initBindData(),
  ];
  return () => teardowns.forEach((t) => t());
}
