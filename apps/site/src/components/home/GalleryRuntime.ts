// Gallery runtime — wires the "What it can do" exploration chapter on the home. Each helper guards
// on its own markup, so the whole thing no-ops on pages without the gallery (e.g. /eli5). Returns a
// single teardown. Reuses only proven engine surfaces:
//   · field:captured / field:released — real bubbling CustomEvents the sink dispatches (core/field.ts).
//   · --field-density — the metric the platform writes back onto a [data-feedback] body (feedback.ts).
//   · field.setRender(mode) — the Field Surfaces underlay switch on <field-root>.

type FieldEl = HTMLElement & { setRender?: (m: string) => void; rescan?: () => void };

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

/** #3 — See the field five ways: switch the <field-root> underlay render mode, only while in view. */
function initRenderTour(): () => void {
  const root = document.querySelector<HTMLElement>("[data-rendertour]");
  if (!root) return () => {};
  const field = document.querySelector("field-root") as FieldEl | null;
  const buttons = [...root.querySelectorAll<HTMLButtonElement>("button[data-render]")];
  const ac = new AbortController();
  let inView = false;
  let current = buttons[0];

  const apply = () => {
    if (inView && current) field?.setRender?.(current.dataset.render || "dots");
    else field?.setRender?.("dots");
  };
  const select = (b: HTMLButtonElement) => {
    current = b;
    buttons.forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    apply();
  };
  buttons.forEach((b) =>
    b.addEventListener("click", () => select(b), { signal: ac.signal }),
  );
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        inView = e.isIntersecting;
        apply();
      }
    },
    { threshold: 0.4 },
  );
  io.observe(root);

  return () => {
    ac.abort();
    io.disconnect();
    field?.setRender?.("dots");
  };
}

export function initGallery(): () => void {
  const teardowns = [initLifecycle(), initReadout(), initRenderTour()];
  return () => teardowns.forEach((t) => t());
}
