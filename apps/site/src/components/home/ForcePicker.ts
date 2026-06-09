// Natural-field picker — selecting a field plays it OVER and UNDER the page (immersive), via the
// Field Surfaces API on the shared <field-root>:
//   · UNDER — a viewport-centred [data-body] source with whole-screen range drives the particles,
//     and each field picks its own underlay grammar via setRender: gravity/electromagnetic stay
//     dots (motion), strong → links (bonds between clustered particles), weak → trails (fade).
//   · OVER  — field.setOverlay(mode) draws the LIVE field structure in front of content
//     (streamlines for convergence, force-vectors for polarity; strong needs none — its bonds are
//     the underlay). setAccent tints both surfaces to the field's colour.
// Active only while the [data-forcepick] section is in view; restored to dots/off on leave.
// rescan() on select/enter/leave. Shared by /eli5 and the home (/) — both render <NaturalFieldsSection>.
type FieldEl = HTMLElement & {
  rescan?: () => void;
  setRender?: (m: string) => void;
  setOverlay?: (m: string) => void;
  setAccent?: (hex: string) => void;
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

  const apply = () => {
    if (inView && current) {
      const c = current.dataset;
      source.setAttribute("data-body", c.token || "gravity");
      source.setAttribute("data-strength", c.strength || "1");
      source.setAttribute("data-range", c.range || "1300");
      source.setAttribute("data-color", c.color || "#6366f1");
      source.style.setProperty("--fc", c.color || "#6366f1");
      source.classList.add("on");
      field?.setAccent?.(c.color || "#6366f1"); // tint both surfaces to the field's colour
      field?.setRender?.(c.render || "dots"); // UNDER grammar: dots / links (bonds) / trails (fade)
      field?.setOverlay?.(c.overlay || "off"); // OVER: live field structure, in front of content
    } else {
      source.removeAttribute("data-body");
      source.classList.remove("on");
      field?.setRender?.("dots");
      field?.setOverlay?.("off");
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
    source.classList.remove("on");
    field?.setRender?.("dots");
    field?.setOverlay?.("off");
    rescan();
    if (home) home.insertBefore(source, anchor); // restore for a same-page re-init
  };
}
