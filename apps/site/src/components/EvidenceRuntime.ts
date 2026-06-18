// Evidence Field runtime. Fundamental as an INVISIBLE measurement layer over real OpenAlex findings,
// with controls that make the transformation legible:
//   · Field on/off — off, the page collapses to a plain list (CSS via [data-field]); the scoped
//     field is destroyed and threads are cleared. On, the field runs and trust shows in the type.
//   · Weight by consensus / recency / balanced — recompute each finding's trust from the chosen
//     signal, then re-sort with a FLIP reflow so you watch the field re-settle.
//   · hover a finding → SVG threads to the works it builds on (referenced_works within the set).
//   · question tabs swap which topic is live.
//   · LIVE — once per visit (~4s in) the page asks OpenAlex for every work's CURRENT citation
//     count (one batched request per topic) and updates each finding in place; the existing
//     reweight path then re-settles trust in front of the reader. Once, not a poll: citations
//     move slowly, so re-polling would be theater. Works the API misses keep snapshot values.
// The scoped field runs with render: [] — particles compute (metrics flow) but are never drawn.
import { logNormalize, recipeById, weightToStrength } from "@fundamental-engine/core";
import { applyRecipe, threadOverlay, withFlip, type ThreadOverlay } from "@fundamental-engine/dom";
import { EVIDENCE, type Signal, type Lens } from "../lib/copy.ts";
import { wireLiveChip, politeLoop } from "../lib/live-data.ts";
import { pageRuntime } from "../lib/page-runtime.ts";
import { wireSegments, wireFieldToggle } from "../lib/controls.ts";
import { fmtInt } from "../lib/fmt.ts";
import { READING_PACE_MAX, scrollV } from "../lib/reading-pace.ts";

const reduceMotion = () =>
  typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

// ── reveal pacing ──────────────────────────────────────────────────────────
const BATCH_SIZE = 4;
const DWELL_MS = 350; // sustained reading-pace time near the sentinel before a batch reveals
const LOAD_REVEAL = 0.5; // a sink charged past this short-circuits the dwell (field on only)
const BATCH_COOLDOWN_MS = 600; // floor between batches so successive reveals settle, not dump

function initEvidence(page: HTMLElement): () => void {
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
    st: { cmax: number; ymin: number; yspan: number },
  ): number => {
    const cites = Number(f.dataset.cites) || 0;
    const year = Number(f.dataset.year) || st.ymin;
    const consensus = logNormalize(cites, st.cmax);
    const recency = st.yspan > 0 ? (year - st.ymin) / st.yspan : 0.5;
    return s === "consensus" ? consensus : s === "recency" ? recency : (consensus + recency) / 2;
  };

  const reweight = (topic: HTMLElement): void => {
    const list = topic.querySelector<HTMLElement>("[data-ev-list]");
    if (!list) return;
    const findings = [...list.querySelectorAll<HTMLElement>(".ev-finding")].filter((f) => !f.hidden);
    const cites = findings.map((f) => Number(f.dataset.cites) || 0);
    const years = findings.map((f) => Number(f.dataset.year) || 0).filter(Boolean);
    const st = {
      cmax: Math.max(...cites),
      ymin: Math.min(...years),
      yspan: Math.max(...years) - Math.min(...years),
    };
    // 1) set the new trust on every finding (drives --trust + the bar + the scoped field's pull)
    for (const f of findings) {
      const t = trustOf(f, signal, st);
      f.style.setProperty("--trust", t.toFixed(3));
      f.dataset.strength = weightToStrength(t).toFixed(2);
      const bar = f.querySelector<HTMLElement>(".ev-bar i");
      if (bar) bar.style.width = `${Math.round(t * 100)}%`;
    }
    // 2) re-sort by trust, FLIP-animating the reflow
    const ordered = [...findings].sort(
      (a, b) =>
        Number(b.style.getPropertyValue("--trust")) - Number(a.style.getPropertyValue("--trust")),
    );
    withFlip(
      () => findings,
      () => {
        ordered.forEach((f) => list.appendChild(f));
        // the sink sentinel stays the list's last child (re-sorting appends findings after it)
        const sentinel = list.querySelector("[data-ev-sentinel]");
        if (sentinel) list.appendChild(sentinel);
        ordered.forEach((f, i) => {
          const rank = f.querySelector(".ev-rank");
          if (rank) rank.textContent = String(i + 1).padStart(2, "0");
        });
      },
      { axis: "y" },
    );
  };

  // ── color lens — a second, orthogonal channel: size stays trust, color shows another aspect.
  const applyLens = (topic: HTMLElement): void => {
    const findings = [...topic.querySelectorAll<HTMLElement>(".ev-finding")].filter((f) => !f.hidden);
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
        // the sink sentinel joins the field so particles drifting past the list's end accrete
        // into it — the engine writes the fill back as --load, which paces the reveal.
        const sentinel = list.querySelector<HTMLElement>("[data-ev-sentinel]");
        const bodies = [...list.querySelectorAll<HTMLElement>(".ev-finding")].filter((f) => !f.hidden);
        if (sentinel) bodies.push(sentinel);
        // renderless — invisible; the extra "attention" metric asks the platform pipeline to
        // write --field-attention (an eased 0..1 blend of engagement, center proximity,
        // visibility) back to every finding each frame.
        activeField = applyRecipe(list, base, {
          bodies,
          annotateBodies: false,
          renderless: true,
          extraMetrics: ["attention"],
        });
      }
    } catch {
      /* the static --trust layer stands on its own */
    }
  };

  // ── support-graph threads (hover) ────────────────────────────────────────
  // Geometry + lit/cited marks live in the platform's threadOverlay (it adopts an existing
  // svg.ev-threads and never stacks duplicates); the hover wiring and the supports → targets
  // resolution stay here. One overlay per topic list, reused across re-wires, so clear()
  // always reaches every mark this page made.
  const overlays = new Map<HTMLElement, ThreadOverlay>();
  const overlayFor = (list: HTMLElement): ThreadOverlay => {
    let ov = overlays.get(list);
    if (!ov) {
      ov = threadOverlay(list, { className: "ev-threads" });
      overlays.set(list, ov);
    }
    return ov;
  };
  const wireThreads = (topic: HTMLElement): void => {
    topicAc?.abort();
    topicAc = new AbortController();
    const list = topic.querySelector<HTMLElement>("[data-ev-list]");
    if (!list) return;
    const overlay = overlayFor(list);
    const findings = [...list.querySelectorAll<HTMLElement>(".ev-finding")].filter((f) => !f.hidden);
    const draw = (from: HTMLElement): void => {
      if (!fieldOn) return;
      const targets = (from.dataset.supports || "")
        .split(" ")
        .filter(Boolean)
        .map((id) => list.querySelector<HTMLElement>(`#${CSS.escape(id)}`))
        .filter((t): t is HTMLElement => t !== null);
      overlay.draw(from, targets, {
        color: getComputedStyle(from).getPropertyValue("--cat").trim(),
      });
    };
    findings.forEach((f) => {
      f.addEventListener("pointerenter", () => draw(f), { signal: topicAc!.signal });
      f.addEventListener("pointerleave", () => overlay.clear(), { signal: topicAc!.signal });
    });
  };

  // ── scroll-gated accretion reveal ───────────────────────────────────────
  // Owns its own AbortController: revealBatch's cleanup re-wires threads (which churns
  // topicAc), so the reveal loop must NOT share that lifetime or it dies after one batch.
  let revealAc: AbortController | null = null;

  const hiddenDeferred = (topic: HTMLElement): HTMLElement[] =>
    [...topic.querySelectorAll<HTMLElement>("[data-ev-deferred]")].filter((f) => f.hidden);

  const revealBatch = (topic: HTMLElement): boolean => {
    const batch = hiddenDeferred(topic).slice(0, BATCH_SIZE);
    if (!batch.length) return false;
    batch.forEach((f) => {
      f.hidden = false;
      f.setAttribute("data-ev-new", "");
    });
    const cleanup = (): void => {
      batch.forEach((f) => f.removeAttribute("data-ev-new"));
      reweight(topic); // fold the new items into the current weighting + rank numbers
      wireThreads(topic);
      runField(topic); // rescan: the new bodies join the scoped field (no-op when field is off)
    };
    if (reduceMotion()) cleanup();
    else setTimeout(cleanup, 500);
    return true;
  };

  // IO only marks the sentinel visible/not; a rAF loop does the gating, because IO is
  // edge-triggered — a "too fast" rejection or a same-position batch would otherwise never
  // re-fire. The loop reveals when the user has been at reading pace near the sentinel for
  // DWELL_MS (or the sink's --load is charged — the field's own pacing signal, when it's on),
  // with a cooldown between batches. Stops itself when nothing is left to reveal.
  const wireScrollReveal = (topic: HTMLElement): void => {
    revealAc?.abort();
    revealAc = null;
    const sentinel = topic.querySelector<HTMLElement>("[data-ev-sentinel]");
    if (!sentinel || !hiddenDeferred(topic).length) return;
    const ctl = new AbortController();
    revealAc = ctl;

    let intersecting = false;
    let slowSince = 0;
    let lastReveal = 0;
    let raf = 0;

    const tick = (t: number): void => {
      if (ctl.signal.aborted || !intersecting) {
        raf = 0;
        return;
      }
      // both reads are inline styles (written by the platform / engine), so they avoid
      // the forced style recalc getComputedStyle would cost per frame.
      if (scrollV() < READING_PACE_MAX) {
        if (!slowSince) slowSince = t;
        const load = parseFloat(sentinel.style.getPropertyValue("--load")) || 0;
        const ready = t - slowSince >= DWELL_MS || load >= LOAD_REVEAL;
        if (ready && t - lastReveal >= BATCH_COOLDOWN_MS) {
          lastReveal = t;
          const revealed = revealBatch(topic);
          if (!revealed || !hiddenDeferred(topic).length) {
            ctl.abort();
            if (revealAc === ctl) revealAc = null;
            return;
          }
        }
      } else {
        slowSince = 0;
      }
      raf = requestAnimationFrame(tick);
    };

    // IO starts/stops the gating loop, so nothing runs while the sentinel is far offscreen.
    const io = new IntersectionObserver(
      (entries) => {
        intersecting = entries.some((e) => e.isIntersecting);
        if (!intersecting) {
          slowSince = 0;
          cancelAnimationFrame(raf);
          raf = 0;
        } else if (!raf) {
          raf = requestAnimationFrame(tick);
        }
      },
      { threshold: 0, rootMargin: "0px 0px 160px 0px" },
    );
    io.observe(sentinel);
    ctl.signal.addEventListener("abort", () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    });
  };

  const wireTopic = (topic?: HTMLElement): void => {
    if (!topic) return;
    reweight(topic);
    applyLens(topic);
    wireThreads(topic);
    runField(topic);
    wireScrollReveal(topic);
  };

  // ── controls ─────────────────────────────────────────────────────────────
  wireSegments(
    weightBtns,
    "evWeight",
    (v) => {
      signal = (v as Signal) || "consensus";
      page.dataset.weight = signal;
      if (hint) hint.innerHTML = EVIDENCE.hints[signal];
      const t = activeTopic();
      if (t) reweight(t);
    },
    ac.signal,
  );

  wireSegments(
    lensBtns,
    "evLens",
    (v) => {
      lens = (v as Lens) || "field";
      page.dataset.lens = lens;
      if (lensHint) lensHint.innerHTML = EVIDENCE.lensHints[lens];
      const t = activeTopic();
      if (t) applyLens(t);
    },
    ac.signal,
  );

  wireFieldToggle(
    fieldBtn,
    page,
    (on) => {
      fieldOn = on;
      const t = activeTopic();
      if (fieldOn) {
        runField(t);
      } else {
        activeField?.destroy();
        activeField = null;
        const list = t?.querySelector<HTMLElement>("[data-ev-list]");
        if (list) overlays.get(list)?.clear();
      }
    },
    ac.signal,
  );

  wireSegments(
    tabs,
    "evTab",
    (slug) => {
      topics.forEach((t) => (t.hidden = t.dataset.evTopic !== slug));
      wireTopic(topics.find((t) => t.dataset.evTopic === slug));
      // topic state is shareable: reflect the active tab in the URL (no history entry)
      history.replaceState(history.state, "", `#${slug}`);
    },
    ac.signal,
  );

  wireTopic(activeTopic());

  // Deep links: the hash can name a topic (#do-violent-video-games…, written by the tab
  // handler above) or a finding id (#slug--W123…, possibly in the deferred range where the
  // browser's load-time scroll found a hidden target). Activate the right tab, reveal the
  // deferred range when the target sits inside it (no batch animation — the user asked for
  // that spot), and re-scroll.
  const hashId = location.hash ? decodeURIComponent(location.hash.slice(1)) : "";
  const hashTarget = hashId ? document.getElementById(hashId) : null;
  const hashTopic =
    topics.find((t) => t.dataset.evTopic === hashId) ??
    hashTarget?.closest<HTMLElement>("[data-ev-topic]") ??
    null;
  if (hashTopic) {
    let rewire = false;
    if (hashTarget?.hasAttribute("data-ev-deferred")) {
      hashTopic
        .querySelectorAll<HTMLElement>("[data-ev-deferred]")
        .forEach((f) => (f.hidden = false));
      rewire = true;
    }
    if (hashTopic.hidden) {
      const slug = hashTopic.dataset.evTopic!;
      topics.forEach((t) => (t.hidden = t.dataset.evTopic !== slug));
      tabs.forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.evTab === slug)));
      rewire = true;
    }
    if (rewire) wireTopic(hashTopic);
    if (hashTarget && hashTarget !== hashTopic) hashTarget.scrollIntoView();
  }

  // ── live citations — trust itself updates, ONCE per visit ─────────────────
  // ~4s after the initial wiring (politeLoop skips hidden tabs), fetch CURRENT
  // cited_by_count for every work on the page — one batched OpenAlex request per
  // topic, work ids pipe-joined from the findings' element ids (slug--W123…).
  // Every finding updates IN PLACE, deferred (still-hidden) ones included, so
  // batches the accretion reveal surfaces later already carry refreshed counts:
  //   · data-cites + the formatted figure (+ the trust block's aria-label),
  //   · a quiet "±N since snapshot" line, only where the count actually moved,
  // then the EXISTING reweight path re-runs for the active topic — --trust,
  // data-strength, the bar width, and the FLIP re-sort all flow through the
  // same code the weight buttons use, so trust literally re-settles in front of
  // the reader. The other topic folds in via wireTopic on its next tab switch.
  // The run only fails when EVERY batch failed; works missing from a response
  // keep their snapshot values. No repeat (everyMs: null): citations move
  // slowly — polling would be theater.
  const chipEl = page.querySelector<HTMLElement>("[data-ev-live]");
  const chip = wireLiveChip(chipEl, chipEl?.dataset.snapshotLabel || "OpenAlex");
  const refreshCitations = async (): Promise<void> => {
    const results = await Promise.allSettled(
      topics.map(async (topic) => {
        const findings = [...topic.querySelectorAll<HTMLElement>(".ev-finding")];
        const ids = findings.map((f) => f.id.split("--").pop() ?? "").filter(Boolean);
        if (!ids.length) return;
        const url =
          "https://api.openalex.org/works" +
          `?filter=ids.openalex:${ids.join("|")}&per-page=50&select=id,cited_by_count`;
        const res = await fetch(url, { signal: ac.signal });
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as {
          results?: { id?: string; cited_by_count?: number }[];
        };
        const counts = new Map<string, number>();
        for (const w of data.results ?? []) {
          const wid = (w.id ?? "").split("/").pop();
          if (wid && typeof w.cited_by_count === "number") counts.set(wid, w.cited_by_count);
        }
        for (const f of findings) {
          const next = counts.get(f.id.split("--").pop() ?? "");
          if (next === undefined) continue; // missing from the response — keep the snapshot
          const prev = Number(f.dataset.cites) || 0;
          f.dataset.cites = String(next);
          const fig = f.querySelector<HTMLElement>(".ev-cites");
          if (fig) fig.textContent = fmtInt(next);
          const trust = f.querySelector<HTMLElement>(".ev-trust");
          trust?.setAttribute("aria-label", `${next} citations`);
          const delta = next - prev;
          if (delta !== 0 && trust) {
            let note = trust.querySelector<HTMLElement>(".ev-cites-delta");
            if (!note) {
              note = document.createElement("span");
              note.className = "ev-cites-delta";
              trust.insertBefore(note, trust.querySelector(".ev-bar"));
            }
            note.textContent = `${delta > 0 ? "+" : "−"}${fmtInt(Math.abs(delta))} since snapshot`;
            note.dataset.dir = delta > 0 ? "up" : "down";
          }
        }
      }),
    );
    if (!results.some((r) => r.status === "fulfilled")) throw new Error("openalex unreachable");
    const t = activeTopic();
    if (t) reweight(t); // the existing path — trust re-settles where the reader is looking
  };
  politeLoop({
    run: refreshCitations,
    firstDelayMs: 4000,
    everyMs: null, // once per visit — see above
    signal: ac.signal,
    onSuccess: () => chip.ok(),
    onFailure: () => chip.fail(),
  });

  return () => {
    ac.abort();
    topicAc?.abort();
    revealAc?.abort();
    chip.destroy();
    activeField?.destroy();
  };
}

pageRuntime(".ev-page", initEvidence);
