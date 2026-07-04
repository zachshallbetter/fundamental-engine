/**
 * Currents — the carrier waves (§24, §2.3).
 *
 * Five layered standing waveforms that form the resting structure of the field:
 * they carry **bound** particles (shimmer) and impart a flow on the **free**
 * ones. Pure data + math here; rendering and the bound/free reservoir live in
 * the field loop.
 */

import type { RGB } from '../math/math.ts';

export interface Wave {
  /** vertical anchor as a fraction of viewport height. */
  baseFrac: number;
  amp: number;
  freq: number;
  phase: number;
  speed: number;
  color: RGB;
  /** 0 (back) … 1 (front) — drives opacity and parallax. */
  depth: number;
  /** travel direction (±1). */
  dir: number;
  /** scroll-parallax offset, eased. */
  offsetY: number;
}

/** A particle riding a wave line (the shimmer). */
export interface BoundParticle {
  /** index into the wave array. */
  wi: number;
  /** position along the wave, 0…1. */
  progress: number;
  /** vertical jitter offset. */
  phase: number;
  size: number;
  glow: boolean;
  /** drift speed along the wave (±). */
  speed: number;
}

const LAYERS = 5;
const BASE = [0.24, 0.4, 0.55, 0.7, 0.85] as const;

/** Build the five wave layers, coloring them from the palette (§24.4). */
export function buildWaves(palette: readonly RGB[]): Wave[] {
  const waves: Wave[] = [];
  for (let i = 0; i < LAYERS; i++) {
    waves.push({
      baseFrac: BASE[i] ?? 0.5,
      amp: 22 + i * 15,
      freq: 0.0012 + i * 0.0008,
      phase: (i * 1.7) % 6.28, // deterministic spread (no Math.random at module build)
      speed: 0.00013 + i * 0.00009,
      color: palette[i % palette.length] ?? [77, 163, 255],
      depth: i / (LAYERS - 1),
      dir: i % 2 ? -1 : 1,
      offsetY: 0,
    });
  }
  return waves;
}

/** Build the bound shimmer pool: `round(16·density)` riders per wave (§2.5). */
export function buildBound(waveCount: number, density: number, rand: () => number): BoundParticle[] {
  const per = Math.round(16 * density);
  const bound: BoundParticle[] = [];
  for (let wi = 0; wi < waveCount; wi++) {
    for (let k = 0; k < per; k++) {
      bound.push({
        wi,
        progress: rand(),
        phase: (rand() - 0.5) * 0.22 * Math.PI,
        size: 0.7 + rand() * 1.5,
        glow: rand() < 0.3,
        speed: (0.00035 + rand() * 0.0009) * (rand() < 0.5 ? 1 : -1),
      });
    }
  }
  return bound;
}

/** An engaged element the lines bend toward — the "spine" (§24). */
export interface WavePull {
  x: number;
  y: number;
  /** strength 0…1 (eased as the element engages/releases). */
  k: number;
}

/** The wave's y at horizontal position `x` and `time` seconds (§2.3). */
export function waveYat(
  w: Wave,
  x: number,
  time: number,
  H: number,
  waveSpeed = 1,
  amplitude = 1,
  pull?: WavePull
): number {
  let y =
    w.baseFrac * H +
    w.offsetY +
    Math.sin(x * w.freq + w.phase + time * w.speed * 1000 * waveSpeed) * w.amp * amplitude;
  // the engaged element bends the lines locally toward it (Gaussian falloff).
  if (pull && pull.k > 0.001) {
    const dx = x - pull.x;
    const s = 260;
    const fall = Math.exp(-(dx * dx) / (2 * s * s));
    y += (pull.y - y) * 0.42 * fall * pull.k * (0.45 + w.depth * 0.55);
  }
  return y;
}

/** The wave's slope at `x` — the derivative the free particles drift along. */
export function waveSlope(w: Wave, x: number, time: number, waveSpeed = 1, amplitude = 1): number {
  return (
    Math.cos(x * w.freq + w.phase + time * w.speed * 1000 * waveSpeed) * w.amp * w.freq * amplitude
  );
}

/** The circular wave's undulating radius at angle `theta` (radians) and `time` seconds. */
export function waveRAt(
  w: Wave,
  theta: number,
  time: number,
  maxRadius: number,
  waveSpeed = 1,
  amplitude = 1
): number {
  const baseR = w.baseFrac * maxRadius + w.offsetY;
  // Ensure an integer number of ripples so the circular path is closed (seamless)
  const N = Math.max(1, Math.round(w.freq * 2500));
  return baseR + Math.sin(N * theta + w.phase + time * w.speed * 1000 * waveSpeed) * w.amp * amplitude;
}

/** Calculate shortest distance and coordinates from a particle (px, py) to a wave. */
export function waveDistance(
  w: Wave,
  px: number,
  py: number,
  time: number,
  W: number,
  H: number,
  style: 'linear' | 'circular',
  center: { x: number; y: number },
  waveSpeed = 1,
  amplitude = 1,
  pull?: WavePull
): { dist: number; rWave: number; r: number; theta: number } {
  if (style === 'circular') {
    const dx = px - center.x;
    const dy = py - center.y;
    const r = Math.sqrt(dx * dx + dy * dy) || 1e-3;
    const theta = Math.atan2(dy, dx);
    const maxRadius = Math.min(W, H) * 0.48;
    const rWave = waveRAt(w, theta, time, maxRadius, waveSpeed, amplitude);
    return { dist: Math.abs(r - rWave), rWave, r, theta };
  } else {
    const yWave = waveYat(w, px, time, H, waveSpeed, amplitude, pull);
    return { dist: Math.abs(py - yWave), rWave: yWave, r: py, theta: 0 };
  }
}
