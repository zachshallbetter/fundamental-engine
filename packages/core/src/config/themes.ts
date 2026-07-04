/**
 * Field themes (#529) — the ambient palette as a first-class contract, not a fork. A theme bundles the
 * free-particle **heat ramp** (`cool` → `warm` ends, §20.8) and the background-wave **baseline**. Before
 * this, those were hardcoded module constants (`COOL`/`WARM` in `math.ts`, `WAVE_RGB` in `field.ts`), so
 * changing the look meant patching core. Now `FieldOptions.theme` picks a preset and
 * `gradientCool`/`gradientWarm`/`waveBaseline` override individual lanes — additive, the frozen surface
 * intact, and `theme: 'warm'` reproduces the shipped defaults byte-for-byte.
 */
import type { RGB } from '../math/math.ts';

export interface FieldTheme {
  /** the resting (cool) end of the free-particle heat ramp. */
  cool: RGB;
  /** the energized (warm) end of the heat ramp. */
  warm: RGB;
  /** the background-wave baseline colors (hex), built into the resting Currents. */
  wave: readonly string[];
}

/** Named presets. `warm` is the shipped 0.8.0 default; `cool` and `mono` are alternatives. */
export const THEMES: Record<string, FieldTheme> = {
  warm: { cool: [255, 224, 200], warm: [255, 110, 80], wave: ['#ff8a5c', '#f0628e', '#ffc46b'] },
  cool: { cool: [206, 226, 255], warm: [74, 132, 255], wave: ['#5c8aff', '#62a0f0', '#6bc4ff'] },
  mono: { cool: [232, 232, 238], warm: [148, 148, 158], wave: ['#8a8a96', '#b0b0bc', '#9a9aa6'] },
};

/** The default theme id — the shipped warm palette. */
export const DEFAULT_THEME = 'warm';
