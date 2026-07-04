/**
 * Visual channels (visual-language §3, §5, §6, §9) — the metric→appearance mappings, as pure
 * functions returning plain value objects plus CSS string builders. Every channel is bounded so a
 * runaway metric can't blow out contrast, saturation, or glow (the §5.2 accessibility caps). The
 * caller writes the strings to the DOM; nothing here touches it.
 */
import type { ElementMetrics } from '../agents/element-agent.ts';
import { clamp, lerp } from '../math/math.ts';
import { clamp01, mapRange } from './mapping.ts';

// ── Typography (§3) — generalizes the engine's density→weight mapping ───────────────────────────
export interface TypographyOpts {
  /** variable-font weight range. */
  weight?: [number, number];
  /** optical-size range. */
  opsz?: [number, number];
  /** letter-spacing range in em. */
  tracking?: [number, number];
}
export interface TypographyValue {
  weight: number;
  opsz: number;
  tracking: number;
  /** text-shadow glow radius in px (from attention). */
  glow: number;
}

/** Map density (presence) and attention (emphasis) to live variable-font axes + glow. */
export function typography(m: ElementMetrics, opts: TypographyOpts = {}): TypographyValue {
  const d = clamp01(m.density ?? 0);
  const a = clamp01(m.attention ?? 0);
  const [wLo, wHi] = opts.weight ?? [300, 800];
  const [oLo, oHi] = opts.opsz ?? [12, 48];
  const [tLo, tHi] = opts.tracking ?? [0, -0.02];
  return {
    weight: Math.round(lerp(wLo, wHi, d)),
    opsz: Math.round(lerp(oLo, oHi, d)),
    tracking: lerp(tLo, tHi, d),
    glow: lerp(0, 12, a),
  };
}

/** The CSS a `TypographyValue` produces (font-variation-settings + text-shadow). */
export function typographyCss(v: TypographyValue, glowColor = 'currentColor'): Record<string, string> {
  return {
    'font-variation-settings': `"wght" ${v.weight}, "opsz" ${v.opsz}`,
    'letter-spacing': `${v.tracking.toFixed(3)}em`,
    'text-shadow': v.glow > 0.1 ? `0 0 ${v.glow.toFixed(1)}px ${glowColor}` : 'none',
  };
}

// ── Color (§5.1) — bounded HSL response ─────────────────────────────────────────────────────────
export interface Hsl {
  h: number;
  s: number;
  l: number;
  a: number;
}
export interface ColorCaps {
  /** max saturation (a11y §5.2). */
  maxSat: number;
  /** lightness floor/ceiling to keep contrast. */
  minL: number;
  maxL: number;
}
export const DEFAULT_COLOR_CAPS: ColorCaps = { maxSat: 0.9, minL: 0.25, maxL: 0.85 };

/**
 * Field-driven color (§5.1): density deepens tone, heat warms the hue + lifts it, attention raises
 * saturation, entropy desaturates and jitters the hue, coherence pulls back toward the base hue,
 * memory adds a persistent tint. Bounded by the accessibility caps so it never blows out.
 */
export function fieldColor(base: Hsl, m: ElementMetrics, caps: ColorCaps = DEFAULT_COLOR_CAPS): Hsl {
  const heat = clamp01(m.heat ?? 0);
  const entropy = clamp01(m.entropy ?? 0);
  const coherence = clamp01(m.coherence ?? 0);
  const attention = clamp01(m.attention ?? 0);
  const density = clamp01(m.density ?? 0);
  const memory = clamp01(m.memory ?? 0);

  // hue: heat shifts toward warm (~30°); entropy jitters; coherence pulls back to base.
  const warmTarget = 30;
  let h = lerp(base.h, warmTarget, heat * 0.5);
  h += entropy * 24 * (((h % 7) - 3) / 3); // deterministic per-hue jitter, not random
  h = lerp(h, base.h, coherence * 0.6);
  h = ((h % 360) + 360) % 360;

  // saturation: attention raises it, entropy lowers it; capped.
  const s = clamp(base.s + attention * 0.4 - entropy * 0.5, 0, caps.maxSat);
  // lightness: density deepens (darkens) the tone, heat lifts it; clamped for contrast.
  const l = clamp(base.l - density * 0.2 + heat * 0.15, caps.minL, caps.maxL);
  // alpha: a faint persistent memory tint nudges opacity up.
  const a = clamp01(base.a + memory * 0.1);
  return { h, s, l, a };
}

export function hslString(c: Hsl): string {
  return `hsl(${c.h.toFixed(0)} ${(c.s * 100).toFixed(0)}% ${(c.l * 100).toFixed(0)}% / ${c.a.toFixed(2)})`;
}

// ── Shape (§6) ──────────────────────────────────────────────────────────────────────────────────
export interface ShapeValue {
  /** scale multiplier. */
  scale: number;
  /** corner radius in px. */
  radius: number;
  /** stroke width in px. */
  stroke: number;
}
/** Pressure swells scale; coherence sharpens corners; attention thickens the stroke. */
export function shape(m: ElementMetrics): ShapeValue {
  return {
    scale: mapRange(clamp01(m.pressure ?? 0), 0, 1, 1, 1.25, 'ease-out'),
    radius: mapRange(clamp01(m.coherence ?? 0), 0, 1, 16, 2),
    stroke: mapRange(clamp01(m.attention ?? 0), 0, 1, 1, 3),
  };
}

// ── Emission / glow (§9) ────────────────────────────────────────────────────────────────────────
export interface EmissionValue {
  /** glow radius in px. */
  radius: number;
  /** glow alpha. */
  alpha: number;
}
export interface EmissionOpts {
  maxGlow?: number;
  /** under reduced motion, emission becomes a flat static highlight, not a pulsing bloom. */
  reducedMotion?: boolean;
}
/** Heat drives emission; capped by maxGlow and flattened under reduced motion. */
export function emission(m: ElementMetrics, opts: EmissionOpts = {}): EmissionValue {
  const heat = clamp01(m.heat ?? 0);
  const max = opts.maxGlow ?? 24;
  const radius = mapRange(heat, 0, 1, 0, max, opts.reducedMotion ? 'linear' : 'ease-out');
  return { radius, alpha: clamp01(heat * (opts.reducedMotion ? 0.5 : 0.8)) };
}
