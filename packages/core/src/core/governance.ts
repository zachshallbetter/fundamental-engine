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
import { PASSPORTS } from '../contracts/passport.ts';
import type { ForcePassport } from '../contracts/passport.ts';

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

// ── Dimension-coupling passports (substrate governance 05 — `field/no-dimension-coupling-without-passport`)
// A force that COUPLES dimensions (a change in one dimension drives a change in another) must declare it
// in its passport's `couplesDimensions`. The cleanest unarguable signal is `conservesSpeed`: a force that
// preserves |v| while moving particles necessarily *redirects velocity* — it couples the linear-velocity
// components (and, for a torque-style force, `linear`→`angular`). This lint reports any such force that
// declares no coupling, and any declared dimension that is not a known lane. Pure over the passports.

/** The dimension lanes a coupling may name — the accumulator's channels (doc 04). */
const COUPLING_DIMENSIONS: ReadonlySet<string> = new Set(['linear', 'angular', 'thermal', 'temporal', 'semantic']);

/** Lint force passports for the dimension-coupling rule (substrate governance 05). With the shipped
 *  passports this returns `[]` — every speed-conserving force (`wall`, `magnetism`) declares its coupling —
 *  so the lint guards future drift (a new coupler that forgets to declare, or a typo'd dimension name). */
export function lintDimensionCoupling(passports: readonly ForcePassport[] = Object.values(PASSPORTS)): GovernanceWarning[] {
  const out: GovernanceWarning[] = [];
  for (const p of passports) {
    const declared = p.couplesDimensions ?? [];
    if (p.movesParticles && p.conservesSpeed && declared.length === 0) {
      out.push({
        rule: 'field/no-dimension-coupling-without-passport',
        severity: 'error',
        subject: p.token,
        message: `"${p.token}" conserves speed (it redirects velocity) but declares no couplesDimensions — a dimension-coupling force must declare its coupling.`,
      });
    }
    for (const d of declared) {
      if (!COUPLING_DIMENSIONS.has(d)) {
        out.push({
          rule: 'field/no-dimension-coupling-without-passport',
          severity: 'warning',
          subject: p.token,
          message: `"${p.token}" declares couplesDimensions ["${d}"], but "${d}" is not a known dimension lane (${[...COUPLING_DIMENSIONS].join(', ')}).`,
        });
      }
    }
  }
  return out;
}
