// Stage field-line overlay — runs the real engine probe (traceField / traceDipole) to
// draw each force's true trajectories (and dipole field lines) into the page's `.stage`
// elements. Extracted from index.astro so the home page is a composition, not the host
// for this behaviour. `initStageFieldOverlay()` paints once and returns a teardown that
// disconnects observers and removes the canvases it created — the page orchestrator calls
// it on `astro:before-swap` so overlays never survive a client-side navigation.
import { expandPreset } from "@field-ui/core";
import { traceField, traceDipole } from "../../lib/field-probe.ts";

function hexToRgb(hex?: string) {
  const h = (hex || "#4da3ff").replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function drawTrace(
  cvs: HTMLCanvasElement,
  stage: HTMLElement,
  trace: any,
  color: string,
  dipole: any,
) {
  const w = stage.offsetWidth || 400;
  const h = stage.offsetHeight || 300;
  cvs.width = w;
  cvs.height = h;
  const ctx = cvs.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, w, h);
  const cx = w / 2,
    cy = h / 2;
  const R = Math.min(w, h) * 0.42; // a normalized extent of 1 maps to this many px
  const [r, g, b] = hexToRgb(color);

  // dipole field lines (the structure of B / E) — the primary visualization for the
  // magnetism/charge stages (the trajectory trace is suppressed for them by the caller, so
  // the two don't overlap or sit off-centre). Continuous curves, no arrowheads.
  if (dipole) {
    ctx.lineWidth = 1;
    ctx.strokeStyle = `rgba(${r},${g},${b},0.34)`;
    const lines = new Path2D(); // every line shares one style — batch into a single stroke
    for (const path of dipole.paths) {
      if (path.length < 2) continue;
      for (let i = 0; i < path.length; i++) {
        const px = cx + path[i].x * R,
          py = cy + path[i].y * R;
        if (i === 0) lines.moveTo(px, py);
        else lines.lineTo(px, py);
      }
    }
    ctx.stroke(lines);
  }

  if (trace.special === "pigment") {
    // pigment exerts no force — show the dye it carries: a stain + streaks that tint up
    const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
    grd.addColorStop(0, `rgba(${r},${g},${b},0.32)`);
    grd.addColorStop(0.6, `rgba(${r},${g},${b},0.12)`);
    grd.addColorStop(1, `rgba(${r},${g},${b},0)`);
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fill();
    for (let row = -1; row <= 1; row++) {
      const y = cy + row * R * 0.4;
      const steps = 26;
      for (let i = 0; i < steps; i++) {
        const t = i / steps;
        const x0 = cx - R + t * 2 * R;
        // neutral entering left → full tint past the body centre (picks up the dye)
        const mix = Math.max(0, Math.min(1, (t - 0.35) / 0.4));
        const cr = Math.round(150 + (r - 150) * mix);
        const cg = Math.round(160 + (g - 160) * mix);
        const cb = Math.round(170 + (b - 170) * mix);
        ctx.strokeStyle = `rgba(${cr},${cg},${cb},0.45)`;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(x0, y);
        ctx.lineTo(x0 + (2 * R) / steps + 1, y);
        ctx.stroke();
      }
      // arrowhead
      ctx.strokeStyle = `rgba(${r},${g},${b},0.5)`;
      ctx.beginPath();
      ctx.moveTo(cx + R, y);
      ctx.lineTo(cx + R - 6, y - 3);
      ctx.moveTo(cx + R, y);
      ctx.lineTo(cx + R - 6, y + 3);
      ctx.stroke();
    }
    return;
  }

  // annotation rings (capture radius, rest shell)
  ctx.setLineDash([3, 4]);
  ctx.lineWidth = 1.3;
  for (const ring of trace.rings) {
    ctx.strokeStyle = `rgba(${r},${g},${b},0.5)`;
    ctx.beginPath();
    ctx.arc(cx, cy, ring.r * R, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // real trajectories — fade faint→bright along travel, arrowhead at the leading end.
  // The fade is quantized into a few alpha buckets so all segments batch into a handful
  // of stroke() calls (one per bucket) instead of one per segment — the per-segment
  // version was the dominant main-thread cost of painting ~58 stages.
  const BUCKETS = 8;
  const buckets: Path2D[] = Array.from({ length: BUCKETS }, () => new Path2D());
  const heads = new Path2D();
  for (const path of trace.paths) {
    const n = path.length;
    if (n < 2) continue;
    for (let i = 1; i < n; i++) {
      const bi = Math.min(BUCKETS - 1, Math.floor((i / n) * BUCKETS));
      const p = buckets[bi]!;
      p.moveTo(cx + path[i - 1].x * R, cy + path[i - 1].y * R);
      p.lineTo(cx + path[i].x * R, cy + path[i].y * R);
    }
    const head = path[n - 1];
    const tail = path[Math.max(0, n - 4)];
    const hx = cx + head.x * R,
      hy = cy + head.y * R;
    const dx = head.x - tail.x,
      dy = head.y - tail.y;
    const d = Math.hypot(dx, dy);
    if (d > 1e-4) {
      const ux = dx / d,
        uy = dy / d,
        sz = 5;
      heads.moveTo(hx, hy);
      heads.lineTo(hx - ux * sz - uy * sz * 0.5, hy - uy * sz + ux * sz * 0.5);
      heads.moveTo(hx, hy);
      heads.lineTo(hx - ux * sz + uy * sz * 0.5, hy - uy * sz - ux * sz * 0.5);
    }
  }
  ctx.lineWidth = 1.1;
  for (let bi = 0; bi < BUCKETS; bi++) {
    const a = 0.07 + 0.4 * ((bi + 0.5) / BUCKETS);
    ctx.strokeStyle = `rgba(${r},${g},${b},${a})`;
    ctx.stroke(buckets[bi]!);
  }
  ctx.strokeStyle = `rgba(${r},${g},${b},0.62)`;
  ctx.lineWidth = 1.2;
  ctx.stroke(heads);
}

/**
 * Paint the field-line overlay into every `.stage` on the page and return a teardown that
 * removes the canvases and disconnects their ResizeObservers. Idempotent at the call site:
 * the orchestrator tears the previous run down before re-painting.
 *
 * Two phases, because each trace runs a REAL engine scenario (80–130 frames of
 * simulation) and ~58 of them in one task dominated the home page's TBT:
 *  - EAGER (cheap): resolve each stage's probe config from the chip's data-* attrs and
 *    insert its `canvas.stage-field` immediately — the DOM contract (every traceable
 *    stage owns its canvas) holds from first paint.
 *  - LAZY (expensive): the engine probe + painting run only as a stage approaches the
 *    viewport (IntersectionObserver, generous margin), one stage per idle slice, so no
 *    load-time long task and the diagram is always there before the reader is.
 */
export function initStageFieldOverlay(): () => void {
  const observers: ResizeObserver[] = [];
  const canvases: HTMLCanvasElement[] = [];
  let cancelled = false;

  interface StageJob {
    stage: HTMLElement;
    cvs: HTMLCanvasElement;
    chip: HTMLElement;
    token: string;
    override: {
      tokens?: string[];
      strength?: number;
      range?: number;
      spin?: number;
      angleDeg?: number;
    };
  }

  // Phase 1 — cheap, synchronous: attribute parsing + one canvas insert per stage.
  const resolveStage = (stageNode: Element): StageJob | null => {
    const stage = stageNode as HTMLElement;
    const chip = stage.querySelector(
      "[data-body], [data-preset]",
    ) as HTMLElement | null;
    if (!chip) return null;
    // Trace the SAME force the live chip configures — read its real data-* attrs so the
    // path matches the on-screen particles (heading, strength, range, spin, sibling tokens).
    const num = (v: any) =>
      v != null && v !== "" && isFinite(Number(v)) ? Number(v) : undefined;
    let token: string;
    let override: {
      tokens?: string[];
      strength?: number;
      range?: number;
      spin?: number;
      angleDeg?: number;
    };
    if (chip.dataset.body) {
      const raw = chip.dataset.body;
      token = raw.split(/\s+/)[0]!; // primary force of a composed body
      override = {
        tokens: raw.split(/\s+/).filter(Boolean),
        strength: num(chip.dataset.strength),
        range: num(chip.dataset.range),
        spin: num(chip.dataset.spin),
        angleDeg: num(chip.dataset.angle),
      };
    } else {
      // a preset chip names a COMPOSITION (blackhole, galaxy, …) — expand it to its real
      // sub-bodies and trace the primary one with its real attrs, so the preset stages get
      // the same field-line overlay as single-force rows (the trace is the dominant force's
      // true path; the live chip still runs the full composition).
      const sub = expandPreset(chip.dataset.preset ?? "")[0];
      if (!sub || !sub.tokens.length) {
        // a silent return here once hid eight broken stage canvases for months — say so in dev.
        if (import.meta.env.DEV)
          console.warn(
            `[StageFieldOverlay] stage not traced: preset "${chip.dataset.preset}" expanded to no traceable sub-body`,
          );
        return null;
      }
      token = sub.tokens[0]!;
      override = {
        tokens: [...sub.tokens],
        strength: num(sub.strength),
        range: num(sub.range),
        spin: num(sub.spin),
        angleDeg: num(sub.angle),
      };
    }
    const cvs = document.createElement("canvas");
    cvs.className = "stage-field";
    cvs.setAttribute("aria-hidden", "true");
    stage.insertBefore(cvs, stage.firstChild);
    canvases.push(cvs);
    return { stage, cvs, chip, token, override };
  };

  // Phase 2 — expensive, deferred: run the engine probe and paint. Failure prunes the
  // canvas so a broken trace never leaves a permanently blank stage behind.
  const paintStage = (job: StageJob): void => {
    const { stage, cvs, chip, token, override } = job;
    let trace;
    let dipole = null;
    try {
      trace = traceField(token, override);
      dipole = traceDipole(token, override); // null unless magnetism / charge
    } catch (e) {
      if (import.meta.env.DEV)
        console.warn(`[StageFieldOverlay] stage not traced: token "${token}" threw during trace`, e);
      cvs.remove();
      return;
    }
    if (!trace) {
      if (import.meta.env.DEV)
        console.warn(`[StageFieldOverlay] stage not traced: token "${token}" has no trace (skipped silently)`);
      cvs.remove();
      return;
    }
    const cc =
      (getComputedStyle(chip).getPropertyValue("--cc") || "").trim() ||
      "#4da3ff";

    // a dipole force (magnetism/charge) shows ONLY its field-line diagram — suppress the
    // trajectory trace so the two representations don't overlap or sit off-centre.
    const shown = dipole ? { paths: [], rings: trace.rings } : trace;
    const draw = () => drawTrace(cvs, stage, shown, cc, dipole);
    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(stage);
    observers.push(ro);
  };

  // Resolve every stage now (cheap) …
  const jobs = new Map<Element, StageJob>();
  document.querySelectorAll(".stage").forEach((stageNode) => {
    const job = resolveStage(stageNode);
    if (job) jobs.set(stageNode, job);
  });

  // … and trace each one only as it nears the viewport, one stage per idle slice (a
  // single trace is itself tens of ms of simulation — batching two would be a long task
  // again under a 4x CPU throttle). The margin keeps the diagram ahead of the reader;
  // the timeout/setTimeout fallback guarantees progress where idle callbacks stall.
  const queue: StageJob[] = [];
  let scheduled = false;
  const schedule = (): void => {
    if (scheduled || cancelled) return;
    scheduled = true;
    const run = () => {
      scheduled = false;
      if (cancelled) return;
      const start = performance.now();
      while (queue.length && performance.now() - start < 2) paintStage(queue.shift()!);
      if (queue.length) schedule();
    };
    if ("requestIdleCallback" in window) requestIdleCallback(run, { timeout: 200 });
    else setTimeout(run, 16);
  };
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        io.unobserve(e.target);
        const job = jobs.get(e.target);
        if (job) queue.push(job);
      }
      if (queue.length) schedule();
    },
    { rootMargin: "500px 0px" },
  );
  jobs.forEach((job) => io.observe(job.stage));

  return () => {
    cancelled = true;
    io.disconnect();
    observers.forEach((o) => o.disconnect());
    canvases.forEach((c) => c.remove());
  };
}
