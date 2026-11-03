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

import { patternById, BURST_RADIUS } from "@fundamental-engine/core";
import { applyPattern } from "@fundamental-engine/dom";

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

  // Guided entry is optional: links and controls in every lesson keep working independently.
  const guide = document.querySelector<HTMLElement>("[data-field-guide]");
  const lessons = [
    ["top", "Start here: the field and the DOM"],
    ["try", "Try it: edit the DOM input"],
    ["proof", "Inbox: authored importance"],
    ["why", "Tradeoffs: measured signals"],
    ["how", "The loop: five verbs"],
    ["trust", "Trust: inspect both readings"],
    ["engine", "Engine: one contract, many forces"],
    ["shipped", "Shipped: working applications"],
    ["hosts", "Hosts: one model across runtimes"],
    ["evidence", "Evidence: inspect declared sources"],
    ["invisible-fields", "Examples: fields over real data"],
    ["install", "Install: choose your host package"],
    ["explore", "Explore: continue into the docs"],
  ] as const;
  let lesson = 0;
  let guideNavigating = false;
  let guideTargetId: string | null = null;
  let guideNavigationTimer = 0;
  const showLesson = (index: number) => {
    lesson = Math.max(0, Math.min(lessons.length - 1, index));
    const section = document.getElementById(lessons[lesson]![0]);
    const progress = guide?.querySelector("[data-guide-progress]");
    const title = guide?.querySelector("[data-guide-title]");
    const prev = guide?.querySelector<HTMLButtonElement>("[data-guide-prev]");
    const next = guide?.querySelector<HTMLButtonElement>("[data-guide-next]");
    if (progress) progress.textContent = `Walkthrough · ${lesson + 1} of ${lessons.length}`;
    if (title) title.textContent = lessons[lesson]![1];
    if (prev) prev.disabled = lesson === 0;
    if (next) next.textContent = lesson === lessons.length - 1 ? "Finish walkthrough" : "Next lesson →";
    guideNavigating = true;
    guideTargetId = lessons[lesson]![0];
    window.clearTimeout(guideNavigationTimer);
    guideNavigationTimer = window.setTimeout(() => { guideNavigating = false; guideTargetId = null; }, 4000);
    section?.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  };
  document.querySelectorAll<HTMLElement>("[data-guide-start]").forEach((start) => start.addEventListener("click", (event) => {
    event.preventDefault();
    if (guide) guide.hidden = false;
    showLesson(0);
    guide?.querySelector<HTMLElement>("[data-guide-next]")?.focus({ preventScroll: true });
  }, { signal: sig }));
  guide?.querySelector("[data-guide-prev]")?.addEventListener("click", () => showLesson(lesson - 1), { signal: sig });
  guide?.querySelector("[data-guide-next]")?.addEventListener("click", () => {
    if (lesson === lessons.length - 1) { if (guide) guide.hidden = true; return; }
    showLesson(lesson + 1);
  }, { signal: sig });
  guide?.querySelector("[data-guide-close]")?.addEventListener("click", () => { if (guide) guide.hidden = true; }, { signal: sig });
  if (guide) {
    const guideObserver = new IntersectionObserver((entries) => {
      if (guide.hidden) return;
      if (guideNavigating) {
        const reachedTarget = entries.some((entry) => entry.target.id === guideTargetId && entry.isIntersecting);
        if (!reachedTarget) return;
        guideNavigating = false;
        guideTargetId = null;
        window.clearTimeout(guideNavigationTimer);
        return;
      }
      const current = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      const idx = lessons.findIndex(([id]) => current?.target === document.getElementById(id));
      if (idx >= 0 && idx !== lesson) {
        lesson = idx;
        const progress = guide.querySelector("[data-guide-progress]");
        const title = guide.querySelector("[data-guide-title]");
        const prev = guide.querySelector<HTMLButtonElement>("[data-guide-prev]");
        const next = guide.querySelector<HTMLButtonElement>("[data-guide-next]");
        if (progress) progress.textContent = `Walkthrough · ${lesson + 1} of ${lessons.length}`;
        if (title) title.textContent = lessons[lesson]![1];
        if (prev) prev.disabled = lesson === 0;
        if (next) next.textContent = lesson === lessons.length - 1 ? "Finish walkthrough" : "Next lesson →";
      }
    }, { rootMargin: "-15% 0px -55% 0px" });
    lessons.forEach(([id]) => { const section = document.getElementById(id); if (section) guideObserver.observe(section); });
    obs.push(guideObserver);
  }

  // Trust's morph cue is opt-in and owns only its temporary body declaration/render mode.
  const trust = document.getElementById("trust");
  const trustToggle = document.querySelector<HTMLButtonElement>("[data-trust-morph]");
  const consoleTrigger = document.getElementById("dc-trigger") as FieldEl | null;
  const trustPath = document.getElementById("trust-arrow-path");
  const trustArrow = trustPath?.ownerSVGElement;
  let priorRender: string | null = null;
  let cueOn = false;
  let cueSourceY = 0;
  let burstTimer = 0;
  const cueAttrs = ["data-body", "data-target", "data-strength", "data-range", "data-color"] as const;
  let priorCueAttrs = new Map<string, string | null>();
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const restoreCueAttrs = () => {
    if (!consoleTrigger) return;
    for (const name of cueAttrs) {
      const value = priorCueAttrs.get(name);
      if (value == null) consoleTrigger.removeAttribute(name);
      else consoleTrigger.setAttribute(name, value);
    }
    priorCueAttrs.clear();
  };
  const updateTrustTarget = () => {
    if (!trustArrow || !trustPath || !trustToggle || !consoleTrigger || !cueOn) return;
    const source = trustToggle.getBoundingClientRect();
    if (source.bottom <= 0 || source.top >= window.innerHeight || source.right <= 0 || source.left >= window.innerWidth) {
      setTrustCue(false, true);
      return;
    }
    const target = consoleTrigger.getBoundingClientRect();
    const x = target.left + target.width / 2;
    const tipY = target.top - 10;
    const shaftTop = tipY - 48;
    const headTop = tipY - 12;
    trustArrow.setAttribute("viewBox", `0 0 ${window.innerWidth} ${window.innerHeight}`);
    trustPath.setAttribute("d", `M${x} ${shaftTop}L${x} ${tipY}M${x - 10} ${headTop}L${x} ${tipY}L${x + 10} ${headTop}`);
  };
  const restoreTrustCue = () => {
    if (!field || !consoleTrigger) return;
    window.clearTimeout(burstTimer);
    burstTimer = 0;
    restoreCueAttrs();
    if (priorRender !== null) field.setAttribute("render", priorRender);
    priorRender = null;
    field.rescan?.();
  };
  const setTrustCue = (on: boolean, burst = false) => {
    if (!trustToggle || !consoleTrigger || !field) return;
    if (on === cueOn) return;
    if (on && reduced.matches) return;
    if (on && burstTimer) restoreTrustCue();
    cueOn = on;
    trustToggle.setAttribute("aria-pressed", String(on));
    trustToggle.textContent = on ? "Stop particle arrow" : "Form an arrow with particles";
    if (on && !reduced.matches) {
      priorCueAttrs = new Map(cueAttrs.map((name) => [name, consoleTrigger.getAttribute(name)]));
      priorRender = field.getAttribute("render") ?? "none";
      if (priorRender === "none") field.setAttribute("render", "dots");
      consoleTrigger.setAttribute("data-body", "morph pigment");
      consoleTrigger.setAttribute("data-target", "#trust-arrow-path");
      consoleTrigger.setAttribute("data-strength", "0.65");
      consoleTrigger.setAttribute("data-range", "120");
      consoleTrigger.setAttribute("data-color", "#52d8ff");
      cueSourceY = trustToggle.getBoundingClientRect().top;
      updateTrustTarget();
    } else {
      if (burst && !reduced.matches) {
        consoleTrigger.removeAttribute("data-target");
        consoleTrigger.setAttribute("data-body", "repel thermal");
        consoleTrigger.setAttribute("data-strength", "4.5");
        consoleTrigger.setAttribute("data-range", String(Math.ceil(Math.hypot(window.innerWidth, window.innerHeight) * 1.5)));
        if (priorRender === "none") field.setAttribute("render", "dots");
        burstTimer = window.setTimeout(() => {
          consoleTrigger.setAttribute("data-body", "viscosity");
          consoleTrigger.setAttribute("data-strength", "3.2");
          field.rescan?.();
          burstTimer = window.setTimeout(restoreTrustCue, 800);
        }, 400);
      } else {
        restoreCueAttrs();
        if (priorRender !== null) field.setAttribute("render", priorRender);
        priorRender = null;
      }
    }
    rescan();
  };
  window.addEventListener("resize", updateTrustTarget, { passive: true, signal: sig });
  document.addEventListener("scroll", () => {
    if (!cueOn) return;
    updateTrustTarget();
    if (cueOn && Math.abs(trustToggle!.getBoundingClientRect().top - cueSourceY) > 8) setTrustCue(false, true);
  }, { passive: true, capture: true, signal: sig });
  trustToggle?.addEventListener("click", () => setTrustCue(trustToggle.getAttribute("aria-pressed") !== "true"), { signal: sig });
  const trustObserver = trust && new IntersectionObserver((entries) => {
    if (entries.some((entry) => !entry.isIntersecting)) setTrustCue(false, true);
  }, { threshold: 0.08 });
  if (trust && trustObserver) { trustObserver.observe(trust); obs.push(trustObserver); }
  const trustCueObserver = trustToggle && new IntersectionObserver((entries) => {
    if (cueOn && entries.some((entry) => !entry.isIntersecting)) setTrustCue(false, true);
  });
  if (trustToggle && trustCueObserver) { trustCueObserver.observe(trustToggle); obs.push(trustCueObserver); }
  reduced.addEventListener?.("change", () => { if (reduced.matches) setTrustCue(false); }, { signal: sig });
  document.querySelector("[data-open-console]")?.addEventListener("click", () => {
    if (consoleTrigger?.getAttribute("aria-expanded") !== "true") consoleTrigger?.click();
    consoleTrigger?.focus();
  }, { signal: sig });
  obs.push({ disconnect: () => setTrustCue(false) });

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

  // Hero absorb-and-release is now driven entirely by the body contract (the public API): the CTAs
  // are attention-gated `sink attract` vessels (data-when="active" in Button.astro), so they absorb
  // the field's matter while hovered/focused — charging their --load glow — and the engine discharges
  // it in a supernova burst on the falling edge of engagement. "mass" swirls (data-body="swirl")
  // rather than accreting. No page-specific scroll-burst wiring — an external consumer gets the same
  // behaviour from the attributes alone.

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
        // tie to the same AbortSignal as the outer listeners so a navigation mid-drag (sig.abort())
        // tears these down too — otherwise move/up orphan if the pointer never lifts before nav.
        el.addEventListener("pointermove", move, { signal: sig });
        el.addEventListener("pointerup", up, { signal: sig });
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
          // size the shock ring to the REAL burst front: field.burst shoves + heats matter
          // within BURST_RADIUS engine (page-px) units, so the ring expands to exactly that
          // reach instead of an arbitrary painted scale — the visual marks what the burst
          // actually touched. --shock-r is the final radius; the CSS grows the ring to it.
          ring.style.setProperty("--shock-r", BURST_RADIUS + "px");
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
  rail?.classList.add("rail-managed"); // JS present → manage the reveal (no-JS leaves the rail visible)
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
    // reveal the rail once the hero is behind us — a clean hero, then the wayfinding TOC fades in
    rail?.classList.toggle("revealed", scrollY > innerHeight * 0.6);
  };
  window.addEventListener("scroll", onScroll, { passive: true, signal: sig });
  onScroll();

  // ── Hero signature: the warped grid (the spacetime-curvature image). The page field's `grid`
  // overlay — the reference lattice deflected by [data-body] mass, with the "mass" headline a gravity
  // well — is bold across the hero and fades out as the hero scrolls away, so it never competes with
  // the body text below. It owns the overlay only in the hero zone: other controllers (nav toggles,
  // the render-tour panel, the force picker) take the overlay over as their sections scroll in, and
  // the fade is gated to the grid so it never dims THEIR readings. The overlay surface is the single
  // light-DOM `canvas[data-field-overlay]`.
  // The grid is a hero flourish, not a persistent scroll companion. Once the reader scrolls past the
  // hero we RETIRE it — flip the nav grid toggle off so the control reflects reality and the reader can
  // opt it back on — and stop auto-asserting it (a manual re-enable then sticks at full opacity).
  // The hero grid is a visual flourish gated on the user's grid toggle (data-nav-grid, default on for
  // the home hero). The toggle is a STABLE user control — scrolling never changes it or its button.
  // Near the hero we draw the grid and fade its opacity as it scrolls away; once it's out of the hero
  // we stop drawing it (so it costs no fill-rate and any flow overlay shows at full opacity). That stop
  // is purely a draw optimization keyed to an internal flag — it never reads or writes the toggle.
  // Composes with an active flow overlay so the two coexist.
  let heroGridDrawn = false; // internal draw-state for the hero flourish — NOT the user toggle
  const setGridOverlay = (withGrid: boolean) => {
    if (!field) return;
    const stack: string[] = [];
    if (field.dataset.navFlow === "on") stack.push("streamlines"); // keep any active flow overlay
    if (withGrid) stack.push("grid");
    field.setOverlay?.(stack.length ? stack : "off");
    heroGridDrawn = withGrid;
  };
  const heroGrid = () => {
    if (sig.aborted) return;
    const oc = document.querySelector<HTMLElement>("canvas[data-field-overlay]");
    // fade HERO_GRID_MAX→0 across the first 0.6 viewport so the lattice is a hero flourish, not a
    // persistent scroll companion. Smoothstep (t²(3−2t)) so the fade opens softly and eases out; the
    // ceiling is held below 1 so the screen-blend lattice never overwhelms the hero copy.
    const HERO_GRID_MAX = 0.72;
    const t = Math.max(0, Math.min(1, 1 - scrollY / (innerHeight * 0.6)));
    const smoothT = t * t * (3 - 2 * t);
    const fade = HERO_GRID_MAX * smoothT;
    // Draw the grid only while the user wants it (toggle on) AND it's still near the hero; once it has
    // faded out, stop drawing it. This is a pure draw optimization — the toggle/button are untouched,
    // so scrolling never flips the control.
    const wantGrid = field?.dataset.navGrid === "on";
    const shouldDraw = wantGrid && fade > 0.02;
    // Drive the ASSERT off the real overlay attribute, not the flag: <field-root> upgrades async, so an
    // early setOverlay() is a no-op — re-checking the attribute each tick retries until it sticks. The
    // flag only scopes the DE-assert so we retire our own hero grid, never a grid the user pinned on.
    const hasGrid = (field?.getAttribute("overlay") ?? "").includes("grid");
    if (field && shouldDraw && !hasGrid) setGridOverlay(true);
    else if (field && !shouldDraw && hasGrid && heroGridDrawn) setGridOverlay(false);
    if (oc) oc.style.opacity = heroGridDrawn ? String(fade) : "1";
  };
  window.addEventListener("scroll", heroGrid, { passive: true, signal: sig });
  heroGrid();
  // the engine boots deferred (idle / ~1.5s) and other controllers settle the overlay on load, so
  // re-assert once the element is defined + a couple of delayed ticks to land after that settling.
  if ("customElements" in window)
    customElements.whenDefined("field-root").then(() => requestAnimationFrame(heroGrid));
  setTimeout(heroGrid, 600);
  setTimeout(heroGrid, 1700);

  // the signals-only Wayfinding Current binding over the rail links (renderless — nothing drawn)
  const railReduceMotion =
    typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (rail && links.length && !railReduceMotion) {
    try {
      const base = patternById("wayfinding-current");
      if (base) {
        const railField = applyPattern(rail, base, {
          renderless: true,
          bodies: links,
          annotateBodies: false,
        });
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
    clearTimeout(guideNavigationTimer);
    ac.abort();
    obs.forEach((o) => o.disconnect());
    // reset any attribute-driven state so a re-init (astro:page-load) starts clean
    field?.removeAttribute("attention");
    field?.removeAttribute("causality");
  };
}
