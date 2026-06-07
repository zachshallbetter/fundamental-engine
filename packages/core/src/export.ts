/**
 * Field export serializers (visualization-methods-taxonomy §15). Turn a field into a portable
 * artifact: an SVG of vector segments (field lines, contours, relationship overlays), or a PNG data
 * URL of the canvas. Both are DOM-global-free — `segmentsToSvg` is pure, and `canvasToPng` calls the
 * passed canvas's own `toDataURL`. The download helpers (which need `document`) live in
 * `@field-ui/platform` (`downloadUrl` / `downloadText` / `downloadCanvasPng`).
 */
import type { Segment } from './diagnostics/render.ts';

const round = (n: number): number => Math.round(n * 100) / 100;

export interface SvgOptions {
  stroke?: string;
  strokeWidth?: number;
  background?: string;
}

/** Serialize line segments to a standalone SVG document. Pure — no DOM. */
export function segmentsToSvg(segments: readonly Segment[], width: number, height: number, opts: SvgOptions = {}): string {
  const bg = opts.background ? `<rect width="${width}" height="${height}" fill="${opts.background}"/>` : '';
  const lines = segments
    .map((s) => `<line x1="${round(s.x1)}" y1="${round(s.y1)}" x2="${round(s.x2)}" y2="${round(s.y2)}"/>`)
    .join('');
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    bg +
    `<g stroke="${opts.stroke ?? '#4da3ff'}" stroke-width="${opts.strokeWidth ?? 1}" fill="none">${lines}</g>` +
    `</svg>`
  );
}

/** A PNG data URL of a canvas (the rasterized field) — the canvas's own `toDataURL`, no globals. */
export function canvasToPng(canvas: HTMLCanvasElement): string {
  return canvas.toDataURL('image/png');
}
