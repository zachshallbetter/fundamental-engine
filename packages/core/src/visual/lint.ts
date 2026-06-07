/**
 * Visual + scene lint rules (testing-and-conformance §14, visual-language §5.2). Static checks over
 * a scene descriptor that catch the common misconfigurations the docs warn about — magnetism with
 * no charge, fieldflow with no field to follow, an unbudgeted source, a missing reduced-motion
 * fallback, color carrying meaning alone, saturation/glow over the accessibility caps. Pure: it
 * reports findings, it does not touch the DOM.
 */
import { passportFor } from '../contracts/passport.ts';

export type LintSeverity = 'info' | 'warning' | 'error' | 'fatal';

export interface LintFinding {
  rule: string;
  severity: LintSeverity;
  message: string;
}

/** What a scene declares, for the linter to reason about. All fields optional. */
export interface SceneDescriptor {
  /** force tokens present on the page's bodies. */
  forces?: readonly string[];
  /** are any particles charged (so charge/magnetism can act)? */
  hasChargedParticles?: boolean;
  /** does any force own a field() for transport/field-lines to read? */
  hasFieldSource?: boolean;
  /** are field lines being rendered? */
  fieldLinesEnabled?: boolean;
  /** declared sources and whether each is budgeted. */
  sources?: readonly { token: string; budgeted: boolean }[];
  /** particle count in the busiest local cell. */
  localCellParticles?: number;
  /** is there a reduced-motion fallback for motion-dependent meaning? */
  reducedMotionFallback?: boolean;
  /** the max saturation a color layer uses, and its cap. */
  saturation?: number;
  saturationCap?: number;
  /** the max glow a layer uses, and its cap. */
  glow?: number;
  glowCap?: number;
  /** does any state rely on color alone to convey meaning? */
  colorOnlyMeaning?: boolean;
  /** is any expressive glyph missing accessible text? */
  glyphOnlySemanticText?: boolean;
}

const LOCAL_CELL_MAX = 400;

/** Run all lint rules over a scene; returns every finding (empty = clean). */
export function runVisualLint(scene: SceneDescriptor): LintFinding[] {
  const out: LintFinding[] = [];
  const forces = scene.forces ?? [];
  const add = (rule: string, severity: LintSeverity, message: string): void => {
    out.push({ rule, severity, message });
  };

  // physics activity
  for (const token of forces) {
    const p = passportFor(token);
    if (!p) continue;
    if (p.requiresCharge && scene.hasChargedParticles === false)
      add('inactive-force', 'warning', `${token} requires charge but no charged particles are present — it will appear inactive`);
    if (p.usesFieldAt && scene.hasFieldSource === false)
      add('no-field-source', 'warning', `${token} follows a field but no force nearby owns a field() — nothing to follow`);
  }

  // field lines need a field() to trace
  if (scene.fieldLinesEnabled && scene.hasFieldSource === false)
    add('field-lines-no-source', 'warning', 'field lines are enabled but no force owns a field() to trace');

  // sources must be budgeted
  for (const s of scene.sources ?? [])
    if (!s.budgeted) add('unbudgeted-source', 'error', `source "${s.token}" has no budget (cap + lifespan required)`);

  // performance
  if ((scene.localCellParticles ?? 0) > LOCAL_CELL_MAX)
    add('local-cell-overload', 'warning', `local cell particle count ${scene.localCellParticles} exceeds ${LOCAL_CELL_MAX}`);

  // accessibility
  if (scene.reducedMotionFallback === false)
    add('missing-reduced-motion', 'error', 'motion-dependent meaning has no reduced-motion fallback');
  if (scene.colorOnlyMeaning) add('color-only-meaning', 'error', 'color must not be the only carrier of meaning (add icon/text/outline)');
  if (scene.glyphOnlySemanticText) add('glyph-only-text', 'error', 'expressive glyphs must not be the only semantic text (add sr-only text)');
  if (scene.saturation != null && scene.saturationCap != null && scene.saturation > scene.saturationCap)
    add('saturation-over-cap', 'warning', `saturation ${scene.saturation} exceeds the accessibility cap ${scene.saturationCap}`);
  if (scene.glow != null && scene.glowCap != null && scene.glow > scene.glowCap)
    add('glow-over-cap', 'warning', `glow ${scene.glow} exceeds the cap ${scene.glowCap}`);

  return out;
}
