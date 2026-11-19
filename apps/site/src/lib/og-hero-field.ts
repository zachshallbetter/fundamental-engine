/**
 * og-hero-field.ts — the live field behind the homepage social card (/og/home.png).
 *
 * The card is not an illustration of the field: it is a frame the engine drew. This module runs a
 * seeded headless field at the card's size with the site's own field settings (the `<field-root>` in
 * src/layouts/Base.astro: render="dots", density 3.6, grid-warp 3, grid-intensity 0.5, accent #4da3ff, resting-motion flow) and the
 * hero's declared bodies (the same tokens, strength, range and spin as the `data-body` attributes on
 * the "mass" word, its repelling full stop and the thesis line in src/pages/index.astro). The rects
 * are where the card places that text (OG_HERO_LAYOUT), so the lattice bends and the matter gathers
 * around the words it is behind.
 *
 * Nothing is re-styled here. The engine's dots renderer draws into a recording 2D context and its
 * `grid` overlay draws through a recording RenderBackend; both record what the last frame drew and
 * serialize it as SVG. The rng is seeded, so every build draws the same frame.
 */
import { createField, headlessHost, seededRng } from '@fundamental-engine/core';
import type { RenderBackend } from '@fundamental-engine/core';

export const OG_W = 1200;
export const OG_H = 630;

/** Where the card lays out the hero text, in card pixels. The OG route positions its text from the
 *  same numbers, so the bodies sit under the words they belong to. */
export const OG_HERO_LAYOUT = {
  margin: 60,
  labelTop: 60,
  /** top of the two-line headline ("Elements have" / "mass."). */
  titleTop: 118,
  titleSize: 132,
  titleLine: 0.94,
  /** the "mass" word on the second headline line. */
  mass: { left: 60, top: 242, width: 330, height: 124 },
  /** the full stop after it (the hero's repel body). */
  stop: { left: 392, top: 242, width: 40, height: 124 },
  /** the thesis line, two lines at the bottom of the card. */
  thesisTop: 452,
  thesisSize: 40,
  thesis: { left: 60, top: 452, width: 1000, height: 118 },
} as const;

export interface OgHeroFieldFrame {
  /** the engine's last frame as SVG (OG_W × OG_H, transparent): the warped grid under the dots. */
  svg: string;
  /** dots drawn — exported so the test can assert the frame is populated. */
  particles: number;
  /** grid polylines drawn by the engine's `grid` overlay. */
  gridLines: number;
  /** the "mass" body's eased density (its --d channel), which drives the word's glow on the site. */
  massDensity: number;
}

const f = (v: number) => (Math.round(v * 10) / 10).toString();

/** A 2D context that records the circles the dots renderer fills in the current frame. Everything
 *  else the renderer calls is a no-op; a full-surface clear starts a new frame. */
function recordingCanvas(circles: string[]) {
  const state: Record<string, unknown> = { fillStyle: '#000', strokeStyle: '#000', globalAlpha: 1, lineWidth: 1 };
  let pending: [number, number, number] | null = null;
  const noop = () => gradient;
  const gradient = { addColorStop: () => {} };
  const methods: Record<string, (...a: number[]) => unknown> = {
    beginPath: () => { pending = null; },
    arc: (x, y, r) => { pending = [x, y, r]; },
    fill: () => {
      const fill = state.fillStyle;
      if (!pending || typeof fill !== 'string' || !fill.startsWith('rgba(')) return;
      const m = fill.match(/rgba\(([\d.]+),([\d.]+),([\d.]+),([\d.e-]+)\)/);
      if (!m || Number(m[4]) <= 0.003) return;
      const [x, y, r] = pending;
      circles.push(`<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="rgb(${m[1]},${m[2]},${m[3]})" fill-opacity="${Number(m[4]).toFixed(3)}"/>`);
    },
    clearRect: (x, y, w, h) => { if (x <= 0 && y <= 0 && w >= OG_W && h >= OG_H) circles.length = 0; },
    fillRect: (x, y, w, h) => { if (x <= 0 && y <= 0 && w >= OG_W && h >= OG_H) circles.length = 0; },
    measureText: () => ({ width: 0 }),
  };
  const ctx = new Proxy({}, {
    get: (_, k: string) => (k in methods ? methods[k] : k in state ? state[k] : noop),
    set: (_, k: string, v) => { state[k] = v; return true; },
  });
  return { width: OG_W, height: OG_H, style: {}, getContext: () => ctx } as unknown as HTMLCanvasElement;
}

/** A RenderBackend that records the overlay's polylines and segments since its last clear(). */
function recordingBackend(lines: string[]): RenderBackend {
  const stroke = (s: { r: number; g: number; b: number; alpha: number; width: number }) =>
    `fill="none" stroke="rgb(${Math.round(s.r)},${Math.round(s.g)},${Math.round(s.b)})" stroke-opacity="${s.alpha.toFixed(3)}" stroke-width="${s.width}" stroke-linecap="round" stroke-linejoin="round"`;
  return {
    size: () => {},
    clear: () => { lines.length = 0; },
    polyline(pts, s) {
      if (pts.length < 4) return;
      let d = `M${f(pts[0]!)} ${f(pts[1]!)}`;
      for (let i = 2; i + 1 < pts.length; i += 2) d += `L${f(pts[i]!)} ${f(pts[i + 1]!)}`;
      lines.push(`<path d="${d}" ${stroke(s)}/>`);
    },
    segments(packed, s) {
      let d = '';
      for (let i = 0; i + 3 < packed.length; i += 4) d += `M${f(packed[i]!)} ${f(packed[i + 1]!)}L${f(packed[i + 2]!)} ${f(packed[i + 3]!)}`;
      if (d) lines.push(`<path d="${d}" ${stroke(s)}/>`);
    },
    rect: () => {},
    text: () => {},
    measureText: () => 0,
  };
}

/**
 * Run the hero field and return its last frame as an SVG string. `frames` steps are taken first.
 */
export function renderOgHeroField({ seed = 11, frames = 60 } = {}): OgHeroFieldFrame {
  const circles: string[] = [];
  const lines: string[] = [];
  const host = headlessHost({ width: OG_W, height: OG_H });
  const field = createField(recordingCanvas(circles), {
    host,
    // the site's <field-root> settings (Base.astro), with the grid overlay switched on
    render: 'dots',
    overlay: 'grid',
    gridWarp: 3,
    gridIntensity: 0.5,
    accent: '#4da3ff',
    density: 3.6,
    waves: false,
    restingMotion: 'flow',
    background: 'transparent',
    overlayBackend: recordingBackend(lines),
    rng: seededRng(seed),
  });

  const L = OG_HERO_LAYOUT;
  let massDensity = 0;
  field.addBody({
    tokens: ['gravity', 'swirl', 'pigment'], strength: 1.6, range: 340, spin: 1, color: '#4da3ff', rect: () => L.mass,
    onFeedback: (ch) => { massDensity = ch.density ?? 0; },
  });
  field.addBody({ tokens: ['repel', 'pigment'], strength: 0.7, range: 150, color: '#ff9d5c', rect: () => L.stop });
  field.addBody({ tokens: ['attract', 'swirl', 'pigment'], strength: 0.45, range: 280, spin: 1.1, color: '#f0628e', rect: () => L.thesis });

  for (let i = 0; i < frames; i++) host.tick();
  field.destroy();

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${OG_W}" height="${OG_H}" viewBox="0 0 ${OG_W} ${OG_H}">${lines.join('')}${circles.join('')}</svg>`;
  return { svg, particles: circles.length, gridLines: lines.length, massDensity: Math.min(1, Math.max(0, massDensity)) };
}
