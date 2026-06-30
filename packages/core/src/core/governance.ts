/**
 * Governance lint (substrate critical-path 05 §governance). Pure checks that keep powerful field
 * behavior explainable and accessible. `lintProjections` is the MVP: it enforces the projection
 * accessibility rules — a projection that can express motion must declare a reduced-motion equivalent,
 * and every projection should declare an accessibility equivalent (accessibility is an *alternate
 * projection of the same state*, not a fallback). `ProjectionRegistry.lint` delegates here.
 *
 * Pure over plain {@link FieldProjectionInfo} metadata, so it runs in CI, devtools, or a docs check
 * with no live field. The lane-separation / coupling-passport / relationship-as-force rules (which
 * need force + formation passports) are a later step.
 */
import type { FieldProjectionInfo, FieldProjectionSurface, GovernanceWarning } from './types.ts';

/** Surfaces that can express *motion* — a projection touching one of these must offer a non-motion
 *  equivalent for `prefers-reduced-motion`. (Inherently-static/non-visual surfaces are exempt.) */
const MOTION_SURFACES: ReadonlySet<FieldProjectionSurface> = new Set([
  'css',
  'canvas',
  'svg',
  'typography',
  'spatial',
  'native',
]);

/** Lint a set of registered projections (substrate 05 §field-lint-rules). Order follows the input. */
export function lintProjections(projections: readonly FieldProjectionInfo[]): GovernanceWarning[] {
  const out: GovernanceWarning[] = [];
  for (const p of projections) {
    const motion = p.surfaces.some((s) => MOTION_SURFACES.has(s));
    if (motion && !p.reducedMotionEquivalent) {
      out.push({
        rule: 'field/reduced-motion-equivalent-required',
        severity: 'error', // an accessibility-contract violation (doc 05 §severity)
        subject: p.id,
        message: `Projection "${p.id}" can express motion (${p.surfaces.filter((s) => MOTION_SURFACES.has(s)).join(', ')}) but declares no reducedMotionEquivalent. Reduced motion must translate the behavior, not remove it.`,
      });
    }
    if (!p.accessibilityEquivalent) {
      out.push({
        rule: 'field/accessibility-equivalent-required',
        severity: 'warning',
        subject: p.id,
        message: `Projection "${p.id}" declares no accessibilityEquivalent. Accessibility is an alternate projection of the same field state, not a fallback.`,
      });
    }
  }
  return out;
}
