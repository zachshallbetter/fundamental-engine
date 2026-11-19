/**
 * og-hero-field.ts — the live field behind the homepage social card (/og/home.png).
 *
 * The card is not an illustration of the field: it is a frame of the engine itself. This module runs
 * a seeded headless field at the card's size with the hero's declared bodies (the same tokens,
 * strength, range and spin as the `data-body` attributes on the "mass" word, its repelling full stop
 * and the thesis line in src/pages/index.astro), steps it, and draws the particles it reads back as
 * an SVG. The rects are where the card places that text (OG_HERO_LAYOUT), so the matter gathers and
 * swirls around the words it is behind. The rng is seeded, so every build draws the same frame.
 */
import { createField, headlessHost, seededRng } from '@fundamental-engine/core';

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

/** Moving matter is tinted toward the "mass" body's colour (#4da3ff); resting matter stays the cool
 *  base. The engine's own heat channel is folded in, so a hot particle reads hot either way. */
const HOT = [92, 176, 255] as const;
const COOL = [150, 164, 196] as const;

export interface OgHeroFieldFrame {
  svg: string;
  /** particles drawn — exported so the test can assert the frame is populated. */
  particles: number;
}

/**
 * Run the hero field and return one frame as an SVG string (OG_W × OG_H, transparent background).
 * `frames` steps are taken before the frame is read; streaks show each particle's velocity.
 */
export function renderOgHeroField({ seed = 11, frames = 45 } = {}): OgHeroFieldFrame {
  const host = headlessHost({ width: OG_W, height: OG_H });
  // render:'none' never touches the canvas argument; the cast mirrors the cookbook's signals-first
  // example (src/lib/cookbook/signals-first.ts).
  const field = createField(undefined as unknown as HTMLCanvasElement, {
    host,
    render: 'none',
    density: 5,
    rng: seededRng(seed),
  });

  const L = OG_HERO_LAYOUT;
  field.addBody({ tokens: ['gravity', 'swirl', 'pigment'], strength: 1.6, range: 340, spin: 1, color: '#4da3ff', rect: () => L.mass });
  field.addBody({ tokens: ['repel', 'pigment'], strength: 0.7, range: 150, color: '#ff9d5c', rect: () => L.stop });
  field.addBody({ tokens: ['attract', 'swirl', 'pigment'], strength: 0.45, range: 280, spin: 1.1, color: '#f0628e', rect: () => L.thesis });

  for (let i = 0; i < frames; i++) host.tick();

  const cap = field.particleCount();
  const cols = ['x', 'y', 'vx', 'vy', 'heat', 'size'].map(() => new Float32Array(cap));
  const n = field.readParticleChannels(['x', 'y', 'vx', 'vy', 'heat', 'size'], cols);
  field.destroy();
  const [xs, ys, vxs, vys, heats, sizes] = cols as [Float32Array, Float32Array, Float32Array, Float32Array, Float32Array, Float32Array];

  const f = (v: number) => v.toFixed(1);
  const parts: string[] = [];
  for (let i = 0; i < n; i++) {
    const x = xs[i]!;
    const y = ys[i]!;
    if (x < -20 || y < -20 || x > OG_W + 20 || y > OG_H + 20) continue;
    const speed = Math.hypot(vxs[i]!, vys[i]!);
    const heat = Math.min(1, Math.max(0, heats[i]!, speed / 4));
    const c = COOL.map((cv, k) => Math.round(cv + (HOT[k]! - cv) * heat)).join(',');
    const r = Math.max(1.6, Math.min(4, (sizes[i] || 1.4) * 1.2 + heat * 1.6));
    const a = (0.6 + heat * 0.4).toFixed(2);
    // a streak back along the velocity: the motion the frame is caught in
    const k = 9;
    const x0 = x - vxs[i]! * k;
    const y0 = y - vys[i]! * k;
    parts.push(
      `<line x1="${f(x0)}" y1="${f(y0)}" x2="${f(x)}" y2="${f(y)}" stroke="rgb(${c})" stroke-opacity="${(Number(a) * 0.6).toFixed(2)}" stroke-width="${f(r * 1.1)}" stroke-linecap="round"/>`,
      `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="rgb(${c})" fill-opacity="${a}"/>`,
    );
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${OG_W}" height="${OG_H}" viewBox="0 0 ${OG_W} ${OG_H}">${parts.join('')}</svg>`;
  return { svg, particles: n };
}
