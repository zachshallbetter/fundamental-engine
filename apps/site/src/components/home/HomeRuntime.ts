// Home-page interaction runtime — all the page-specific behaviour that drives the live
// manual: the hero flow toggle, install-command copy, body dragging, the accretion meter,
// agitate bursts, formation pills + scroll cues, conserved-attention / causality toggles,
// the chapter-rail active state, and hover threads. Extracted from index.astro so the page
// is a composition file. `initHomeRuntime()` wires everything and returns a teardown that
// aborts every listener and disconnects every observer; the page orchestrator calls it on
// `astro:before-swap` so nothing survives a client-side navigation.
//
// The wired controls are looked up by selector/id, so this is safe to call once the home
// markup is in the DOM. `<field-root>` upgrades asynchronously (Base.astro defers the import
// to requestIdleCallback, which Safari does not implement — it falls back to setTimeout(300)).
// Long-lived field state is driven through the element's ATTRIBUTES, not methods: attributes
// set before the upgrade become the engine's construction-time config; set after, they forward
// through attributeChangedCallback. One-shots (burst, flowTo/clearFlow) and hover-transients
// (threads) stay imperative — their window is user-interaction-gated, so the element will
// always be upgraded by the time they fire.

import { recipeById } from "@field-ui/core";
import { applyRecipe } from "@field-ui/platform";

type FieldEl = HTMLElement & {
  rescan?: () => void;
  flowTo?: (x: number, y: number, opts?: unknown) => void;
  clearFlow?: () => void;
  burst?: (x: number, y: number, color?: string) => void;
  setFormation?: (name: string) => void;
  threads?: (list: unknown) => void;
};

export function initHomeRuntime(): () => void {
  const ac = new AbortController();
  const sig = ac.signal;
  const obs: Array<{ disconnect: () => void }> = [];

  const field = document.querySelector("field-root") as FieldEl | null;
  const rescan = () => field && field.rescan && field.rescan();

  // flow focus (field.flowTo): when on, the field bends toward the pointer — matter streams
  // in, the streamlines/spine curve to it. A live demo of the controlled flow-field API.
  const flowToggle = document.getElementById("flowToggle");
  if (flowToggle) {
    let flowing = false;
    const onFlowMove = (e: PointerEvent) =>
      field &&
      field.flowTo &&
      field.flowTo(e.clientX, e.clientY, { strength: 1.3, radius: 460 });
    flowToggle.addEventListener(
      "click",
      () => {
        flowing = !flowing;
        flowToggle.setAttribute("aria-pressed", String(flowing));
        flowToggle.classList.toggle("on", flowing);
        if (flowing) {
          window.addEventListener("pointermove", onFlowMove, {
            passive: true,
            signal: sig,
          });
        } else {
          window.removeEventListener("pointermove", onFlowMove);
          field && field.clearFlow && field.clearFlow();
        }
      },
      { signal: sig },
    );
    // make sure a navigation away relaxes the field
    obs.push({
      disconnect: () => field && field.clearFlow && field.clearFlow(),
    });
  }

  // copy the install command on click
  document.querySelectorAll<HTMLElement>("[data-copy]").forEach((el) => {
    el.addEventListener(
      "click",
      () => {
        const text = el.getAttribute("data-copy") || el.textContent || "";
        navigator.clipboard?.writeText(text).then(() => {
          el.classList.add("copied");
          setTimeout(() => el.classList.remove("copied"), 1100);
        });
      },
      { signal: sig },
    );
  });

  // Hero accretion (Body Matter Interaction): the hero bodies — "mass" and both CTAs — are sink
  // vessels that gather the field's matter and charge (the engine writes --load back onto them; the
  // glow grows). As the page scrolls them up toward the viewport top they reach the edge and RELEASE
  // it in a burst — a discrete supernova-style ejection at the body's position. Each body fires once
  // per pass and re-arms after it falls back below the line, so scrolling up and down recharges and
  // re-explodes. rAF-gated so the scroll listener never reads layout more than once a frame.
  {
    const heroBodies = [...document.querySelectorAll<HTMLElement>("[data-hero-body]")];
    if (heroBodies.length && field) {
      const RELEASE_LINE = 96; // px from the viewport top — "close to the top"
      const armed = new Set<HTMLElement>(heroBodies); // all start armed (they're below the line)
      let ticking = false;
      const check = () => {
        ticking = false;
        for (const el of heroBodies) {
          const r = el.getBoundingClientRect();
          if (r.bottom <= 0) continue; // fully scrolled past — leave it disarmed until it returns
          const near = r.top <= RELEASE_LINE;
          if (near && armed.has(el)) {
            const cx = r.left + r.width / 2;
            const cy = Math.max(r.top + r.height / 2, 12);
            field.burst?.(cx, cy, el.dataset.color || "#4da3ff"); // release in a burst
            armed.delete(el);
          } else if (!near && !armed.has(el)) {
            armed.add(el); // back below the line → re-arm to charge and fire again
          }
        }
      };
      window.addEventListener(
        "scroll",
        () => {
          if (ticking) return;
          ticking = true;
          requestAnimationFrame(check);
        },
        { passive: true, signal: sig },
      );
    }
  }

  // drag any [data-drag] body within its stage — pointer + keyboard
  document.querySelectorAll<HTMLElement>("[data-drag]").forEach((el) => {
    const stage = el.closest(".stage") as HTMLElement | null;
    if (!stage) return;
    // it's an interactive control, so make it focusable + keyboard-operable
    el.setAttribute("tabindex", "0");
    if (!el.hasAttribute("role")) el.setAttribute("role", "button");
    if (!el.hasAttribute("aria-label")) {
      const what =
        el.getAttribute("data-body") || (el.textContent || "").trim() || "body";
      el.setAttribute("aria-label", what + " — drag, or use arrow keys to move");
    }
    // centre the body on (x, y) px within the stage, clamped
    const place = (x: number, y: number) => {
      const r = stage.getBoundingClientRect();
      el.style.left = Math.max(0, Math.min(r.width, x)) + "px";
      el.style.top = Math.max(0, Math.min(r.height, y)) + "px";
      // no rescan here: the engine re-measures every body's rect on its own
      // (frameN % 6), so the force centre follows the moved chip automatically.
      // rescan() rebuilds the whole body set from scratch (the scanner zeroes
      // each body's accreted/density/count), so calling it on every pointermove
      // would reset the accretion meter, the density feedback, and the self-layout
      // offsets — the very things these demos are meant to show.
    };
    el.addEventListener(
      "pointerdown",
      (e) => {
        e.preventDefault();
        // capture can throw (pointer already released, synthetic ids) — a failed capture
        // must not kill the whole drag wiring; the move/up listeners still work without it.
        try {
          el.setPointerCapture(e.pointerId);
        } catch {
          /* drag continues uncaptured */
        }
        const move = (ev: PointerEvent) => {
          const r = stage.getBoundingClientRect();
          place(ev.clientX - r.left, ev.clientY - r.top);
        };
        const up = () => {
          el.removeEventListener("pointermove", move);
          el.removeEventListener("pointerup", up);
        };
        el.addEventListener("pointermove", move);
        el.addEventListener("pointerup", up);
      },
      { signal: sig },
    );
    el.addEventListener(
      "keydown",
      (e) => {
        const step = e.shiftKey ? 36 : 12;
        const sr = stage.getBoundingClientRect();
        const er = el.getBoundingClientRect();
        let cx = er.left + er.width / 2 - sr.left; // current centre, stage-relative
        let cy = er.top + er.height / 2 - sr.top;
        if (e.key === "ArrowLeft") cx -= step;
        else if (e.key === "ArrowRight") cx += step;
        else if (e.key === "ArrowUp") cy -= step;
        else if (e.key === "ArrowDown") cy += step;
        else return;
        e.preventDefault();
        place(cx, cy);
      },
      { signal: sig },
    );
  });

  // accretion meter — the engine writes --load onto the sink body as it fills; mirror that
  // onto the meter bar's fill. Watch the body's inline style (the engine sets the var via
  // setProperty) so the bar tracks load without polling.
  document.querySelectorAll<HTMLElement>(".meter").forEach((meter) => {
    const fill = meter.querySelector("i") as HTMLElement | null;
    const core = meter
      .closest(".stage")
      ?.querySelector(".body-core") as HTMLElement | null;
    if (!fill || !core) return;
    const sync = () => {
      const load =
        parseFloat(getComputedStyle(core).getPropertyValue("--load")) || 0;
      fill.style.width = (Math.min(1, Math.max(0, load)) * 100).toFixed(1) + "%";
    };
    const mo = new MutationObserver(sync);
    mo.observe(core, { attributes: true, attributeFilter: ["style"] });
    obs.push(mo);
    sync();
  });

  // agitate — a burst at the target + a chip kick + a shock ring
  document.querySelectorAll<HTMLElement>("[data-agitate]").forEach((btn) => {
    btn.addEventListener(
      "click",
      () => {
        const target = document.querySelector(
          btn.dataset.agitate as string,
        ) as HTMLElement | null;
        if (!target) return;
        const r = target.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        const color = (
          getComputedStyle(target).getPropertyValue("--cc") || "#4da3ff"
        ).trim();
        if (field && field.burst) field.burst(cx, cy, color);
        target.classList.add("agitated");
        setTimeout(() => target.classList.remove("agitated"), 500);
        const stage = target.closest(".stage") as HTMLElement | null;
        if (stage) {
          const ring = document.createElement("span");
          ring.className = "shock";
          ring.style.setProperty("--cc", color);
          const sr = stage.getBoundingClientRect();
          ring.style.left = cx - sr.left + "px";
          ring.style.top = cy - sr.top + "px";
          stage.appendChild(ring);
          setTimeout(() => ring.remove(), 700);
        }
      },
      { signal: sig },
    );
  });

  // formation pills. setFormation has no attribute equivalent, but the upgrade-race window is
  // acceptably narrow here: the pills require a user click, and the scroll-IO path fires only
  // after the user has scrolled to threshold 0.5 — both gated on user interaction that
  // practically cannot happen within the 300ms boot delay. Left imperative intentionally.
  const setForm = (name: string) => {
    if (field && field.setFormation) field.setFormation(name);
    const readout = document.getElementById("form-name");
    if (readout) readout.textContent = name;
  };
  document.querySelectorAll<HTMLElement>(".form-pill").forEach((p) =>
    p.addEventListener(
      "click",
      () => {
        document
          .querySelectorAll(".form-pill")
          .forEach((x) => x.classList.toggle("on", x === p));
        setForm(p.dataset.form as string);
      },
      { signal: sig },
    ),
  );

  // each [data-form] section cues the formation as it scrolls into view
  const formObs = new IntersectionObserver(
    (entries) => {
      for (const e of entries)
        if (e.isIntersecting)
          setForm((e.target as HTMLElement).dataset.form as string);
    },
    { threshold: 0.5 },
  );
  document
    .querySelectorAll<HTMLElement>("section[data-form]")
    .forEach((s) => formObs.observe(s));
  obs.push(formObs);

  // conserved attention (§2.4): switch the field's finite strength budget ON only while its
  // demo is in view, so the rest of the manual is unaffected. Driven via the `attention`
  // attribute (not setAttention()) so the write survives the upgrade race: the IO can fire
  // within the first 300ms under Safari before <field-root> upgrades, and a method call on a
  // bare HTMLElement is silently dropped.
  const attnSection = document.querySelector("[data-attention-demo]");
  if (attnSection && field) {
    const attnObs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) field.setAttribute("attention", "");
          else field.removeAttribute("attention");
        }
      },
      { threshold: 0.45 },
    );
    attnObs.observe(attnSection);
    obs.push(attnObs);
  }

  // cross-boundary causality (Concept 4): density spills to neighbours — on only while its
  // demo is in view. Same attribute-write pattern as attention above.
  const causalSection = document.querySelector("[data-causality-demo]");
  if (causalSection && field) {
    const causalObs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) field.setAttribute("causality", "");
          else field.removeAttribute("causality");
        }
      },
      { threshold: 0.45 },
    );
    causalObs.observe(causalSection);
    obs.push(causalObs);
  }

  // chapter rail active state + the Wayfinding Current field (recipe `wayfinding-current`,
  // experimental — the invisible-fields family applied to the chapter rail, answering "where have I
  // been"). Signals-only: the in-view chapter's rail link is marked engaged (data-field-attention),
  // so the metric pipeline ACCRETES --field-memory on the chapters you dwell on and decays it slowly
  // as you move on — the engine computing the wake (Sink/Accretion), not us hand-painting it. The CSS
  // in ChapterRail.astro draws a left-edge tick from --field-memory. Reduced motion / engine off →
  // the var stays unset → the plain .active rail.
  const chapters = [...document.querySelectorAll<HTMLElement>(".chapter")];
  const links = [...document.querySelectorAll<HTMLElement>(".chapter-rail a")];
  const rail = document.querySelector<HTMLElement>(".chapter-rail");
  const onScroll = () => {
    let active = chapters[0] && chapters[0].id;
    for (const ch of chapters)
      if (ch.getBoundingClientRect().top < innerHeight * 0.35) active = ch.id;
    links.forEach((a) => {
      const on = (a as HTMLElement).dataset.ch === active;
      a.classList.toggle("active", on);
      // ground the field's "current" signal: the active link is engaged, so the pipeline accretes
      // its memory while it's in view (supplied attention wins over the measured value).
      if (on) a.setAttribute("data-field-attention", "1");
      else a.removeAttribute("data-field-attention");
    });
  };
  window.addEventListener("scroll", onScroll, { passive: true, signal: sig });
  onScroll();

  // the signals-only Wayfinding Current binding over the rail links (render: [] — nothing drawn)
  const railReduceMotion =
    typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (rail && links.length && !railReduceMotion) {
    try {
      const base = recipeById("wayfinding-current");
      if (base) {
        const railField = applyRecipe(
          rail,
          { ...base, render: [] as never[] },
          { bodies: links, annotateBodies: false },
        );
        obs.push({ disconnect: () => railField.destroy() });
      }
    } catch {
      /* the plain .active rail stands on its own */
    }
  }

  // threads between a hovered item and its set. threads() has no attribute equivalent and is
  // hover-gated — by the time a pointer can enter an item, the 300ms boot has elapsed and
  // <field-root> is upgraded. Left imperative intentionally.
  document.querySelectorAll<HTMLElement>("[data-threads]").forEach((set) => {
    const items = [...set.querySelectorAll<HTMLElement>(".ti")];
    items.forEach((it) => {
      it.addEventListener(
        "pointerenter",
        () => {
          items.forEach((x) => {
            x.classList.toggle("lit", x === it);
            x.classList.toggle("dim", x !== it);
          });
          if (field && field.threads) {
            field.threads(
              items
                .filter((x) => x !== it)
                .map((x) => ({
                  a: it,
                  b: x,
                  color: (
                    getComputedStyle(it).getPropertyValue("--cat") || "#4da3ff"
                  ).trim(),
                })),
            );
          }
        },
        { signal: sig },
      );
      it.addEventListener(
        "pointerleave",
        () => {
          items.forEach((x) => x.classList.remove("lit", "dim"));
          if (field && field.threads) field.threads(null);
        },
        { signal: sig },
      );
    });
  });

  // the engine runs its own resize handler (resize → scan), so we don't mirror resize here.
  // One deferred rescan after <field-root> upgrades, as a startup safety net for the body
  // set on first paint.
  const startupRescan = setTimeout(rescan, 250);

  return () => {
    clearTimeout(startupRescan);
    ac.abort();
    obs.forEach((o) => o.disconnect());
    // reset any attribute-driven state so a re-init (astro:page-load) starts clean
    field?.removeAttribute("attention");
    field?.removeAttribute("causality");
  };
}
