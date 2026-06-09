// Evidence Field runtime. field-ui as an INVISIBLE measurement layer over real OpenAlex findings,
// with controls that make the transformation legible:
//   · Field on/off — off, the page collapses to a plain list (CSS via [data-field]); the scoped
//     field is destroyed and threads are cleared. On, the field runs and trust shows in the type.
//   · Weight by consensus / recency / balanced — recompute each finding's trust from the chosen
//     signal, then re-sort with a FLIP reflow so you watch the field re-settle.
//   · hover a finding → SVG threads to the works it builds on (referenced_works within the set).
//   · question tabs swap which topic is live.
// The scoped field runs with render: [] — particles compute (metrics flow) but are never drawn.
import { recipeById } from "@field-ui/core";
import { applyRecipe } from "@field-ui/platform";
import { EVIDENCE, type Signal, type Lens } from "../lib/copy.ts";

const NS = "http://www.w3.org/2000/svg";
const reduceMotion = () =>
  typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

function centerIn(el: HTMLElement, host: HTMLElement) {
  const r = el.getBoundingClientRect();
  const h = host.getBoundingClientRect();
  return { x: r.left - h.left + r.width / 2, y: r.top - h.top + r.height / 2 };
}

function initEvidence(): () => void {
  const page = document.querySelector<HTMLElement>(".ev-page");
  if (!page) return () => {};
  const ac = new AbortController();
  const tabs = [...page.querySelectorAll<HTMLButtonElement>("[data-ev-tab]")];
  const topics = [...page.querySelectorAll<HTMLElement>("[data-ev-topic]")];
  const fieldBtn = page.querySelector<HTMLButtonElement>("[data-ev-field]");
  const weightBtns = [...page.querySelectorAll<HTMLButtonElement>("[data-ev-weight]")];
  const hint = page.querySelector<HTMLElement>("[data-ev-hint]");
  const lensBtns = [...page.querySelectorAll<HTMLButtonElement>("[data-ev-lens]")];
  const lensHint = page.querySelector<HTMLElement>("[data-ev-lens-hint]");

  let signal: Signal = "consensus";
  let lens: Lens = (page.dataset.lens as Lens) || "field";
  let fieldOn = true;
  let activeField: { destroy(): void } | null = null;
  let topicAc: AbortController | null = null;

  const activeTopic = (): HTMLElement | undefined => topics.find((t) => !t.hidden) ?? topics[0];

  // ── weighting ────────────────────────────────────────────────────────────
  const trustOf = (
    f: HTMLElement,
    s: Signal,
    st: { lmax: number; ymin: number; yspan: number },
  ): number => {
    const cites = Number(f.dataset.cites) || 0;
    const year = Number(f.dataset.year) || st.ymin;
    const consensus = Math.log(cites + 1) / st.lmax;
    const recency = st.yspan > 0 ? (year - st.ymin) / st.yspan : 0.5;
    return s === "consensus" ? consensus : s === "recency" ? recency : (consensus + recency) / 2;
  };

  const reweight = (topic: HTMLElement): void => {
    const list = topic.querySelector<HTMLElement>("[data-ev-list]");
    if (!list) return;
    const findings = [...list.querySelectorAll<HTMLElement>(".ev-finding")];
    const cites = findings.map((f) => Number(f.dataset.cites) || 0);
    const years = findings.map((f) => Number(f.dataset.year) || 0).filter(Boolean);
    const st = {
      lmax: Math.log(Math.max(...cites, 1) + 1),
      ymin: Math.min(...years),
      yspan: Math.max(...years) - Math.min(...years),
    };
    // 1) set the new trust on every finding (drives --trust + the bar + the scoped field's pull)
    for (const f of findings) {
      const t = trustOf(f, signal, st);
      f.style.setProperty("--trust", t.toFixed(3));
      f.dataset.strength = (0.4 + t * 1.6).toFixed(2);
      const bar = f.querySelector<HTMLElement>(".ev-bar i");
      if (bar) bar.style.width = `${Math.round(t * 100)}%`;
    }
    // 2) re-sort by trust, FLIP-animating the reflow
    const ordered = [...findings].sort(
      (a, b) =>
        Number(b.style.getPropertyValue("--trust")) - Number(a.style.getPropertyValue("--trust")),
    );
    const firstTop = new Map(findings.map((f) => [f, f.getBoundingClientRect().top]));
    ordered.forEach((f) => list.appendChild(f));
    ordered.forEach((f, i) => {
      const rank = f.querySelector(".ev-rank");
      if (rank) rank.textContent = String(i + 1).padStart(2, "0");
      if (reduceMotion()) return;
      const dy = (firstTop.get(f) ?? 0) - f.getBoundingClientRect().top;
      if (!dy) return;
      f.style.transform = `translateY(${dy}px)`;
      f.style.transition = "none";
      requestAnimationFrame(() => {
        f.style.transition = "transform 0.5s cubic-bezier(.2, .7, .2, 1)";
        f.style.transform = "";
        f.addEventListener("transitionend", () => (f.style.transition = ""), { once: true });
      });
    });
  };

  // ── color lens — a second, orthogonal channel: size stays trust, color shows another aspect.
  const applyLens = (topic: HTMLElement): void => {
    const findings = [...topic.querySelectorAll<HTMLElement>(".ev-finding")];
    if (lens === "field") {
      // color by research subfield — the engine binding works to a discipline (server-assigned).
      findings.forEach((f) => f.style.setProperty("--cat", f.dataset.fieldColor || "#60a5fa"));
    } else if (lens === "trust") {
      // color off — size carries the whole signal.
      findings.forEach((f) => f.style.setProperty("--cat", "#60a5fa"));
    } else {
      // recency — a temporal hue ramp: cool (older) → warm (newer).
      const years = findings.map((f) => Number(f.dataset.year) || 0).filter(Boolean);
      const ymin = Math.min(...years);
      const yspan = Math.max(...years) - ymin || 1;
      findings.forEach((f) => {
        const n = ((Number(f.dataset.year) || ymin) - ymin) / yspan;
        f.style.setProperty("--cat", `hsl(${Math.round(205 + n * 125)} 74% 64%)`);
      });
    }
  };

  // ── the invisible scoped field (render: []) ──────────────────────────────
  const runField = (topic?: HTMLElement): void => {
    activeField?.destroy();
    activeField = null;
    if (!fieldOn || !topic) return;
    const list = topic.querySelector<HTMLElement>("[data-ev-list]");
    if (!list) return;
    try {
      const base = recipeById("evidence-field");
      if (base) {
        const recipe = { ...base, render: [] as never[] };
        activeField = applyRecipe(list, recipe, {
          bodies: [...list.querySelectorAll<HTMLElement>(".ev-finding")],
          annotateBodies: false,
        });
      }
    } catch {
      /* the static --trust layer stands on its own */
    }
  };

  // ── support-graph threads (hover) ────────────────────────────────────────
  const wireThreads = (topic: HTMLElement): void => {
    topicAc?.abort();
    topicAc = new AbortController();
    const list = topic.querySelector<HTMLElement>("[data-ev-list]");
    if (!list) return;
    let svg = list.querySelector<SVGSVGElement>("svg.ev-threads");
    if (!svg) {
      svg = document.createElementNS(NS, "svg") as SVGSVGElement;
      svg.setAttribute("class", "ev-threads");
      svg.setAttribute("aria-hidden", "true");
      list.prepend(svg);
    }
    const findings = [...list.querySelectorAll<HTMLElement>(".ev-finding")];
    const clear = (): void => {
      svg!.innerHTML = "";
      findings.forEach((f) => f.classList.remove("lit", "cited"));
    };
    const draw = (from: HTMLElement): void => {
      if (!fieldOn) return;
      const box = list.getBoundingClientRect();
      svg!.setAttribute("viewBox", `0 0 ${box.width} ${box.height}`);
      svg!.style.setProperty("--thread", getComputedStyle(from).getPropertyValue("--cat").trim());
      const a = centerIn(from, list);
      from.classList.add("lit");
      let d = "";
      for (const id of (from.dataset.supports || "").split(" ").filter(Boolean)) {
        const t = list.querySelector<HTMLElement>(`#${CSS.escape(id)}`);
        if (!t) continue;
        t.classList.add("cited");
        const b = centerIn(t, list);
        const my = (a.y + b.y) / 2;
        d += `<path d="M${a.x} ${a.y} C ${a.x} ${my}, ${b.x} ${my}, ${b.x} ${b.y}"/>`;
      }
      svg!.innerHTML = d;
    };
    findings.forEach((f) => {
      f.addEventListener("pointerenter", () => draw(f), { signal: topicAc!.signal });
      f.addEventListener("pointerleave", clear, { signal: topicAc!.signal });
    });
  };

  const wireTopic = (topic?: HTMLElement): void => {
    if (!topic) return;
    reweight(topic);
    applyLens(topic);
    wireThreads(topic);
    runField(topic);
  };

  // ── controls ─────────────────────────────────────────────────────────────
  weightBtns.forEach((b) =>
    b.addEventListener(
      "click",
      () => {
        signal = (b.dataset.evWeight as Signal) || "consensus";
        page.dataset.weight = signal;
        weightBtns.forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
        if (hint) hint.innerHTML = EVIDENCE.hints[signal];
        const t = activeTopic();
        if (t) reweight(t);
      },
      { signal: ac.signal },
    ),
  );

  lensBtns.forEach((b) =>
    b.addEventListener(
      "click",
      () => {
        lens = (b.dataset.evLens as Lens) || "field";
        page.dataset.lens = lens;
        lensBtns.forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
        if (lensHint) lensHint.innerHTML = EVIDENCE.lensHints[lens];
        const t = activeTopic();
        if (t) applyLens(t);
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
      const t = activeTopic();
      if (fieldOn) {
        runField(t);
      } else {
        activeField?.destroy();
        activeField = null;
        t?.querySelector(".ev-threads")?.replaceChildren();
        t?.querySelectorAll(".ev-finding").forEach((f) => f.classList.remove("lit", "cited"));
      }
    },
    { signal: ac.signal },
  );

  tabs.forEach((b) =>
    b.addEventListener(
      "click",
      () => {
        const slug = b.dataset.evTab!;
        topics.forEach((t) => (t.hidden = t.dataset.evTopic !== slug));
        tabs.forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
        wireTopic(topics.find((t) => t.dataset.evTopic === slug));
      },
      { signal: ac.signal },
    ),
  );

  wireTopic(activeTopic());
  return () => {
    ac.abort();
    topicAc?.abort();
    activeField?.destroy();
  };
}

let teardown: (() => void) | undefined;
function init(): void {
  teardown?.();
  teardown = document.querySelector(".ev-page") ? initEvidence() : undefined;
}
if (document.readyState !== "loading") init();
else document.addEventListener("DOMContentLoaded", init);
document.addEventListener("astro:page-load", init);
document.addEventListener("astro:before-swap", () => {
  teardown?.();
  teardown = undefined;
});
