/**
 * DOM download helpers (Phase: frontier). Triggering a file download needs `document` (an anchor
 * click), so these live in `@field-ui/platform`, not `field-ui`. The pure serializers stay in
 * core: `segmentsToSvg` (vector) and `canvasToPng` (a canvas's own `toDataURL`). Pair them here to
 * actually save a file.
 */
import { canvasToPng } from 'field-ui';

/** Trigger a browser download of a data/blob URL. */
export function downloadUrl(url: string, filename: string): void {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/** Download arbitrary text (e.g. an SVG document from `segmentsToSvg`) as a file. */
export function downloadText(text: string, filename: string, mime = 'image/svg+xml'): void {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  downloadUrl(url, filename);
  URL.revokeObjectURL(url);
}

/** Download a canvas as a PNG file (`canvasToPng` + a download). */
export function downloadCanvasPng(canvas: HTMLCanvasElement, filename = 'field.png'): void {
  downloadUrl(canvasToPng(canvas), filename);
}
