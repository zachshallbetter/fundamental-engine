/**
 * RenderBackend (#373) — the structural drawing contract between the engine and a surface. The
 * agnostic-primitive pattern (FieldHost for the DOM, ContourFont for fonts, FeedbackSink for
 * write-back) applied to rendering: the engine describes WHAT to draw in primitive calls; the
 * backend owns HOW — today a Canvas 2D context, tomorrow a WebGL/WebGPU/offscreen implementation
 * (the GPU IntegratorBackend frontier builds on exactly this seam).
 *
 * Scope (the first slice, deliberate): the OVERLAY surface renders exclusively through this
 * contract — every reading is line/text work, the primitive set below covers it completely. The
 * underlay matter modes (dots' radial gradients, metaballs, voronoi) still draw on the raw 2D
 * context and convert in a later slice; their needs (gradients, composite modes) will grow the
 * contract additively when they arrive.
 *
 * All coordinates are CSS pixels — the backend owns the dpr transform internally.
 */

/** One stroke pass: color as r,g,b 0-255 + alpha, a width, and the cap the arrows want. */
export interface Stroke {
  r: number;
  g: number;
  b: number;
  alpha: number;
  width: number;
}

export interface RenderBackend {
  /** size the backing store for a css-pixel viewport at a device-pixel ratio. */
  size(width: number, height: number, dpr: number): void;
  /** clear the whole surface. */
  clear(): void;
  /** stroke disjoint line segments packed [x1,y1,x2,y2, ...] — arrows, contours, grid walls. */
  segments(packed: ArrayLike<number>, stroke: Stroke): void;
  /** stroke one connected polyline through points packed [x,y, ...] — traced paths, grid lines. */
  polyline(points: ArrayLike<number>, stroke: Stroke): void;
  /** a filled rectangle — the data-reading chip plate. */
  rect(x: number, y: number, w: number, h: number, r: number, g: number, b: number, alpha: number): void;
  /** filled text at a baseline-middle anchor — the data-reading label. */
  text(value: string, x: number, y: number, r: number, g: number, b: number, alpha: number): void;
  /** measure a label at the backend's chip font — for plate sizing. */
  measureText(value: string): number;
}

const CHIP_FONT = '10px ui-monospace, SFMono-Regular, Menlo, monospace';

/**
 * The canonical Canvas 2D implementation. Wraps a context the caller acquired (core never touches
 * the DOM); the engine's default surface. Pure call-through — no state beyond the context, so a
 * recording stub satisfies the same contract in tests.
 */
export function canvas2dBackend(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D): RenderBackend {
  let W = 0;
  let H = 0;
  return {
    size(width, height, dpr) {
      W = width;
      H = height;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    },
    clear() {
      ctx.clearRect(0, 0, W, H);
    },
    segments(packed, stroke) {
      ctx.strokeStyle = `rgba(${stroke.r},${stroke.g},${stroke.b},${stroke.alpha})`;
      ctx.lineWidth = stroke.width;
      ctx.lineCap = 'round';
      ctx.beginPath();
      for (let i = 0; i + 3 < packed.length; i += 4) {
        ctx.moveTo(packed[i]!, packed[i + 1]!);
        ctx.lineTo(packed[i + 2]!, packed[i + 3]!);
      }
      ctx.stroke();
    },
    polyline(points, stroke) {
      if (points.length < 4) return;
      ctx.strokeStyle = `rgba(${stroke.r},${stroke.g},${stroke.b},${stroke.alpha})`;
      ctx.lineWidth = stroke.width;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(points[0]!, points[1]!);
      for (let i = 2; i + 1 < points.length; i += 2) ctx.lineTo(points[i]!, points[i + 1]!);
      ctx.stroke();
    },
    rect(x, y, w, h, r, g, b, alpha) {
      ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
      ctx.fillRect(x, y, w, h);
    },
    text(value, x, y, r, g, b, alpha) {
      ctx.font = CHIP_FONT;
      ctx.textBaseline = 'middle';
      ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
      ctx.fillText(value, x, y);
    },
    measureText(value) {
      ctx.font = CHIP_FONT;
      return ctx.measureText(value).width;
    },
  };
}
