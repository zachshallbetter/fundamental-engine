/**
 * Field export (visualization-methods-taxonomy §15). Turn a field into a portable artifact: a PNG
 * raster of the canvas, or an SVG of vector segments (field lines, contours, relationship overlays).
 * `segmentsToSvg` is pure and testable; the canvas/download helpers are thin DOM glue.
 *
 * Quarantine note: this is the only core module besides `core/browser-host.ts` that touches DOM
 * globals (`document.createElement` for the download anchor). It is allowlisted in
 * `core/dom-boundary.test.ts`; keep the rest of core renderer-agnostic.
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

/** A PNG data URL of a canvas (the rasterized field). Thin DOM. */
export function canvasToPng(canvas: HTMLCanvasElement): string {
  return canvas.toDataURL('image/png');
}

/** Trigger a browser download of a data/blob URL. Thin DOM. */
export function downloadUrl(url: string, filename: string): void {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/** Download arbitrary text (e.g. an SVG document) as a file. Thin DOM. */
export function downloadText(text: string, filename: string, mime = 'image/svg+xml'): void {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  downloadUrl(url, filename);
  URL.revokeObjectURL(url);
}

/** Download a canvas as a PNG file. Thin DOM. */
export function downloadCanvasPng(canvas: HTMLCanvasElement, filename = 'field.png'): void {
  downloadUrl(canvasToPng(canvas), filename);
}
