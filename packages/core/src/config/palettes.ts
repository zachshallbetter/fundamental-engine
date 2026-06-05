/**
 * Colour templates for the field's travelling accent (§9) and particle tint. The
 * accent journeys through these stops as you scroll; `setPalette` / the `palette`
 * option swap the whole set live.
 *
 * `ours` is the canonical forces journey; the others are recognizable scientific
 * ramps. Stops are ordered cool → hot (or by spectrum), chosen to read as accents
 * on the dark substrate.
 */

import { ACCENT_JOURNEY } from './forces.config.ts';

export const PALETTES: Record<string, readonly string[]> = {
  /** the canonical forces accent journey. */
  ours: ACCENT_JOURNEY,
  /** classic heatmap: cool blue → cyan → green → yellow → orange → red. */
  heatmap: ['#2b3a8c', '#2d8fd4', '#3fd07a', '#ffe14d', '#ff8a3d', '#e23b3b'],
  /** thermal "ironbow": deep purple → magenta → red → amber → pale yellow. */
  infrared: ['#2a0a4a', '#8e24aa', '#e53935', '#ff8f00', '#ffd54f', '#fffde7'],
  /** the visible spectrum: red → orange → yellow → green → teal → blue → violet. */
  spectrum: ['#ff3b30', '#ff9500', '#ffcc00', '#34c759', '#00c7be', '#007aff', '#af52de'],
};

/** Names of the built-in palettes, in display order. */
export const PALETTE_NAMES = ['ours', 'heatmap', 'infrared', 'spectrum'] as const;

/**
 * Resolve a palette option to its colour stops: a name looks up `PALETTES`, an array
 * is used as-is, anything unknown or empty falls back to the canonical journey.
 */
export function resolvePalette(p?: string | readonly string[]): readonly string[] {
  if (Array.isArray(p)) return p.length > 0 ? p : ACCENT_JOURNEY;
  if (typeof p === 'string') return PALETTES[p] ?? ACCENT_JOURNEY;
  return ACCENT_JOURNEY;
}
