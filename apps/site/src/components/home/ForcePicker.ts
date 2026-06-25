// Natural-field picker — selecting a field plays it OVER and UNDER the page (immersive), via the
// Field Surfaces API on the shared <field-root>:
//   · UNDER — a viewport-centred [data-body] source with whole-screen range drives the particles,
//     and each field picks its own underlay grammar via setRender: gravity/electromagnetic stay
//     dots (motion), strong → links (bonds between clustered particles), weak → trails (fade).
//   · OVER  — field.setOverlay(mode) draws the LIVE field structure in front of content
//     (streamlines for convergence, force-vectors for polarity; strong needs none — its bonds are
//     the underlay). setAccent tints both surfaces to the field's color.
// Active only while the [data-forcepick] section is in view; restored to dots/off on leave.
// rescan() on select/enter/leave. Shared by /eli5 and the home (/) — both render <NaturalFieldsSection>.
//
// The surfaces are driven via the element's ATTRIBUTES (accent/render/overlay), not its methods.
// <field-root> upgrades asynchronously (the idle boot in Base.astro — a plain setTimeout under
// Safari), so a method call made before the upgrade lands on a bare HTMLElement and is silently
// dropped, leaving the overlay dark until the next picker event. Attributes close that gap: set
// pre-upgrade they are the engine's construction-time config; set post-upgrade they forward
// through attributeChangedCallback to the same setters.
type FieldEl = HTMLElement & {
  rescan?: () => void;
};

export function initForcePicker(): () => void {
  const root = document.querySelector<HTMLElement>("[data-forcepick]");
  const source = document.querySelector<HTMLElement>("[data-forcesource]");
  const caption = document.querySelector<HTMLElement>("[data-forcecaption]");
  if (!root || !source) return () => {};
  const field = document.querySelector("field-root") as FieldEl | null;
  const cards = [...root.querySelectorAll<HTMLButtonElement>(".force-card")];
  // re-parent the source to <body> so its position:fixed is viewport-true.
  const home = source.parentElement;
  const anchor = source.nextSibling;
  document.body.appendChild(source);

  const ac = new AbortController();
  let current: HTMLButtonElement | undefined = cards[0];
  let inView = false;
  const rescan = () => field && field.rescan && field.rescan();
  // The page-wide field flow is the 'flow' UNDERLAY render (the nav toggle, data-nav-flow). When this
  // picker isn't engaged, restore the underlay to THAT, not a hard 'dots' — otherwise scrolling past
  // the section silently kills the global flow the user expects to be on. The overlay surface is
  // independent here: it's only the picker's own in-front reading, so it just goes off when idle.
  const restingRender = () =>
    field?.dataset.navFlow === "on" ? "flow" : "dots";

  const apply = () => {
    if (inView && current) {
      const c = current.dataset;
      source.setAttribute("data-body", c.token || "gravity");
      source.setAttribute("data-strength", c.strength || "1");
      source.setAttribute("data-range", c.range || "1300");
      source.setAttribute("data-color", c.color || "#6366f1");
      if (c.spin) source.setAttribute("data-spin", c.spin);
      else source.removeAttribute("data-spin");
      source.style.setProperty("--fc", c.color || "#6366f1");
      source.classList.add("on");
      field?.setAttribute("accent", c.color || "#6366f1"); // tint both surfaces to the field's color
      field?.setAttribute("render", c.render || "dots"); // UNDER grammar: dots / links (bonds) / trails (fade)
      field?.setAttribute("overlay", c.overlay || "off"); // OVER: live field structure, in front of content
    } else {
      source.removeAttribute("data-body");
      source.removeAttribute("data-spin");
      source.classList.remove("on");
      field?.setAttribute("render", restingRender());
      // only clear the overlay if we currently own it — avoid clobbering the render-tour
      // or any other controller that took over the overlay surface while we were off-screen.
      const ourOverlay = current?.dataset.overlay ?? "";
      const liveOverlay = field?.getAttribute("overlay") ?? "";
      if (!liveOverlay || liveOverlay === ourOverlay || liveOverlay === "off")
        field?.setAttribute("overlay", "off");
    }
    rescan();
  };

  const select = (card: HTMLButtonElement) => {
    current = card;
    cards.forEach((c) => c.setAttribute("aria-pressed", String(c === card)));
    if (caption) {
      const real = card.querySelector(".fc-real")?.textContent ?? "";
      const color = card.dataset.color || "#6366f1";
      caption.innerHTML = `<b style="color:${color}">${real}</b> ${card.dataset.caption || ""}.`;
    }
    apply();
  };

  cards.forEach((c) =>
    c.addEventListener("click", () => select(c), { signal: ac.signal }),
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
    source.removeAttribute("data-body");
    source.removeAttribute("data-spin");
    source.classList.remove("on");
    field?.setAttribute("render", restingRender());
    field?.setAttribute("overlay", "off");
    rescan();
    if (home) home.insertBefore(source, anchor); // restore for a same-page re-init
  };
}
