// Evidence Field runtime. field-ui as an INVISIBLE measurement layer over the findings:
//   · the scoped field runs with render: [] — the particles compute (so the metrics flow) but are
//     never drawn. Each finding's citation-trust drives its pull, and the field writes --field-*
//     back onto it, on top of the static --trust floor.
//   · the citation support graph (referenced_works within the set) is drawn as SVG threads on hover —
//     field-ui's relationship model, with real edges.
//   · question tabs swap which topic is live.
import { recipeById } from "@field-ui/core";
import { applyRecipe } from "@field-ui/platform";

const NS = "http://www.w3.org/2000/svg";

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

  let activeField: { destroy(): void } | null = null;
  let topicAc: AbortController | null = null;

  const wireTopic = (topic?: HTMLElement): void => {
    activeField?.destroy();
    activeField = null;
    topicAc?.abort();
    if (!topic) return;
    const list = topic.querySelector<HTMLElement>("[data-ev-list]");
    if (!list) return;
    const findings = [...list.querySelectorAll<HTMLElement>(".ev-finding")];
    topicAc = new AbortController();

    // SVG overlay for the support-graph threads.
    let svg = list.querySelector<SVGSVGElement>("svg.ev-threads");
    if (!svg) {
      svg = document.createElementNS(NS, "svg") as SVGSVGElement;
      svg.setAttribute("class", "ev-threads");
      svg.setAttribute("aria-hidden", "true");
      list.prepend(svg);
    }
    const clear = (): void => {
      svg!.innerHTML = "";
      findings.forEach((f) => f.classList.remove("lit", "cited"));
    };
    const draw = (from: HTMLElement): void => {
      const ids = (from.dataset.supports || "").split(" ").filter(Boolean);
      const a = centerIn(from, list);
      const box = list.getBoundingClientRect();
      svg!.setAttribute("viewBox", `0 0 ${box.width} ${box.height}`);
      let d = "";
      from.classList.add("lit");
      for (const id of ids) {
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

    // The invisible scoped field — render NOTHING (particles compute, never drawn); guarded so the
    // static --trust layer always stands even if the engine path changes.
    try {
      const base = recipeById("evidence-field");
      if (base) {
        const recipe = { ...base, render: [] as never[] };
        activeField = applyRecipe(list, recipe, { bodies: findings, annotateBodies: false });
      }
    } catch {
      /* no-op: the page reads correctly from --trust alone */
    }
  };

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

  wireTopic(topics.find((t) => !t.hidden) ?? topics[0]);
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
