// Stage field-line overlay — runs the real engine probe (traceField / traceDipole) to
// draw each force's true trajectories (and dipole field lines) into the page's `.stage`
// elements. Extracted from index.astro so the home page is a composition, not the host
// for this behaviour. `initStageFieldOverlay()` paints once and returns a teardown that
// disconnects observers and removes the canvases it created — the page orchestrator calls
// it on `astro:before-swap` so overlays never survive a client-side navigation.
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
    for (const path of dipole.paths) {
      if (path.length < 2) continue;
      ctx.beginPath();
      for (let i = 0; i < path.length; i++) {
        const px = cx + path[i].x * R,
          py = cy + path[i].y * R;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
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

  // real trajectories — fade faint→bright along travel, arrowhead at the leading end
  for (const path of trace.paths) {
    const n = path.length;
    if (n < 2) continue;
    ctx.lineWidth = 1.1;
    for (let i = 1; i < n; i++) {
      const a = 0.07 + 0.4 * (i / n);
      ctx.strokeStyle = `rgba(${r},${g},${b},${a})`;
      ctx.beginPath();
      ctx.moveTo(cx + path[i - 1].x * R, cy + path[i - 1].y * R);
      ctx.lineTo(cx + path[i].x * R, cy + path[i].y * R);
      ctx.stroke();
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
      ctx.strokeStyle = `rgba(${r},${g},${b},0.62)`;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(hx, hy);
      ctx.lineTo(hx - ux * sz - uy * sz * 0.5, hy - uy * sz + ux * sz * 0.5);
      ctx.moveTo(hx, hy);
      ctx.lineTo(hx - ux * sz + uy * sz * 0.5, hy - uy * sz - ux * sz * 0.5);
      ctx.stroke();
    }
  }
}

/**
 * Paint the field-line overlay into every `.stage` on the page and return a teardown that
 * removes the canvases and disconnects their ResizeObservers. Idempotent at the call site:
 * the orchestrator tears the previous run down before re-painting.
 */
export function initStageFieldOverlay(): () => void {
  const observers: ResizeObserver[] = [];
  const canvases: HTMLCanvasElement[] = [];

  document.querySelectorAll(".stage").forEach((stageNode) => {
    const stage = stageNode as HTMLElement;
    const chip = stage.querySelector(
      "[data-body], [data-preset]",
    ) as HTMLElement | null;
    if (!chip) return;
    const raw = chip.dataset.body || chip.dataset.preset || "";
    const token = raw.split(/\s+/)[0]; // primary force of a composed body
    // Trace the SAME force the live chip configures — read its real data-* attrs so the
    // path matches the on-screen particles (heading, strength, range, spin, sibling tokens).
    const num = (v: any) =>
      v != null && v !== "" && isFinite(Number(v)) ? Number(v) : undefined;
    const override = chip.dataset.body
      ? {
          tokens: raw.split(/\s+/).filter(Boolean),
          strength: num(chip.dataset.strength),
          range: num(chip.dataset.range),
          spin: num(chip.dataset.spin),
          angleDeg: num(chip.dataset.angle),
        }
      : {};
    let trace;
    let dipole = null;
    try {
      trace = traceField(token, override);
      dipole = traceDipole(token, override); // null unless magnetism / charge
    } catch (e) {
      return;
    }
    if (!trace) return;
    const cc =
      (getComputedStyle(chip).getPropertyValue("--cc") || "").trim() ||
      "#4da3ff";

    const cvs = document.createElement("canvas");
    cvs.className = "stage-field";
    cvs.setAttribute("aria-hidden", "true");
    stage.insertBefore(cvs, stage.firstChild);
    canvases.push(cvs);

    // a dipole force (magnetism/charge) shows ONLY its field-line diagram — suppress the
    // trajectory trace so the two representations don't overlap or sit off-centre.
    const shown = dipole ? { paths: [], rings: trace.rings } : trace;
    const draw = () => drawTrace(cvs, stage, shown, cc, dipole);
    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(stage);
    observers.push(ro);
  });

  return () => {
    observers.forEach((o) => o.disconnect());
    canvases.forEach((c) => c.remove());
  };
}
