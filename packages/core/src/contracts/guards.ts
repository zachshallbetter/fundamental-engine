/**
 * Contract guards (system-contracts §17 Error Taxonomy, §18 Non-Negotiables).
 *
 * Dev-mode runtime assertions that *enforce* the contracts: a source must be budgeted, a
 * visualization must not mutate physics, a particle must stay finite, a Shadow-DOM body must be
 * measurable, fieldflow must have a field to follow. Each guard is a no-op unless contract checks
 * are enabled, which default ON outside `NODE_ENV === 'production'` — so a production bundle that
 * defines `process.env.NODE_ENV` can dead-code-eliminate the check bodies, and behaviour is never
 * affected in production.
 */
import type { Particle, Vec2 } from '../core/types.ts';
import type { ForcePassport } from './passport.ts';
import type { SourceBudget } from './types.ts';

/** The named error taxonomy (§17). */
export type FieldUIErrorCode =
  | 'NO_FIELD_SOURCE' // fieldflow has nothing to follow
  | 'UNBUDGETED_SOURCE' // a source lacks a cap / lifespan
  | 'UNSTABLE_ENERGY' // energy grows beyond threshold
  | 'NAN_PARTICLE' // invalid particle state
  | 'SHADOW_BODY_UNMEASURABLE' // a body has no valid rect
  | 'MISSING_REDUCED_MOTION' // no accessible fallback
  | 'VISUALIZATION_MUTATES_PHYSICS' // a debug/render layer has side effects
  | 'PASSPORT_VIOLATION'; // a force contradicts its declared passport

/** A contract violation, carrying its taxonomy code. */
export class FieldUIError extends Error {
  readonly code: FieldUIErrorCode;
  constructor(code: FieldUIErrorCode, message: string) {
    super(`[Fundamental:${code}] ${message}`);
    this.name = 'FieldUIError';
    this.code = code;
  }
}

// ── dev flag ────────────────────────────────────────────────────────────────────────────────
function defaultDev(): boolean {
  // Read NODE_ENV via globalThis so this typechecks without @types/node and is safe in the browser.
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
  return env?.NODE_ENV !== 'production';
}
let CHECKS = defaultDev();

/** Turn contract checks on or off explicitly (tests, or to silence in a specific env). */
export function setContractChecks(on: boolean): void {
  CHECKS = on;
}
/** Whether contract checks are currently active. */
export function contractChecksEnabled(): boolean {
  return CHECKS;
}

function fail(code: FieldUIErrorCode, message: string): never {
  throw new FieldUIError(code, message);
}

// ── dev diagnostics: non-throwing no-op warnings (#543) ───────────────────────────────────────

/** Diagnostic codes for SILENT no-ops — a call that returned a neutral value (0, {0,0}, nothing)
 *  because a prerequisite was missing. Advisory, not a contract violation: the call is legal, it
 *  just couldn't do anything. */
export type FieldUINoOpCode =
  | 'NOOP_NO_HEATMAP'; // a heatmap-dependent read ran with the heatmap layer off

const warnedOnce = new Set<string>();

/**
 * Dev-only, deduped `console.warn` for a SILENT no-op: a method that returned a neutral value
 * because a prerequisite is missing, so an embedder learns *why* nothing happened instead of
 * debugging a mysterious zero. No-op in production (gated by the same `CHECKS` flag the guards use,
 * so a bundler that defines `NODE_ENV` dead-code-eliminates it). Deduped by message, so a call made
 * every frame warns at most once. Never throws — the no-op is legal; this only explains it.
 */
export function devWarnNoOp(code: FieldUINoOpCode, message: string): void {
  if (!CHECKS) return;
  const key = `${code}:${message}`;
  if (warnedOnce.has(key)) return;
  warnedOnce.add(key);
  console.warn(`[Fundamental:${code}] ${message}`);
}

/** Clear the no-op warning dedup set — for tests that assert the warn fires. */
export function resetNoOpWarnings(): void {
  warnedOnce.clear();
}

// ── guards ──────────────────────────────────────────────────────────────────────────────────

/** A particle's numeric state must stay finite (no NaN/Infinity). */
export function assertParticleFinite(p: Particle, where = 'particle'): void {
  if (!CHECKS) return;
  if (!Number.isFinite(p.x) || !Number.isFinite(p.y) || !Number.isFinite(p.vx) || !Number.isFinite(p.vy))
    fail('NAN_PARTICLE', `${where}: non-finite state (x=${p.x}, y=${p.y}, vx=${p.vx}, vy=${p.vy})`);
}

/** A registered Shadow-DOM body must produce a usable rectangle. */
export function assertBodyMeasurable(rect: DOMRect | undefined, id = 'body'): void {
  if (!CHECKS) return;
  if (!rect || !Number.isFinite(rect.width) || !Number.isFinite(rect.height) || (rect.width === 0 && rect.height === 0))
    fail('SHADOW_BODY_UNMEASURABLE', `${id}: no valid rect (a registered body must be measurable)`);
}

/** Any matter source (class S) must declare a budget — no unbounded creation. */
export function assertSourceBudgeted(passport: ForcePassport, budget: SourceBudget | undefined): void {
  if (!CHECKS) return;
  if (!passport.isSource) return;
  if (!budget || !(budget.maxParticles > 0) || !(budget.particleLife > 0))
    fail('UNBUDGETED_SOURCE', `${passport.token}: a source needs maxParticles > 0 and particleLife > 0`);
}

/** Fieldflow (and any transport) must have a field to follow. */
export function assertFieldSource(sample: Vec2 | null | undefined, token = 'fieldflow'): void {
  if (!CHECKS) return;
  if (!sample || (sample.x === 0 && sample.y === 0))
    fail('NO_FIELD_SOURCE', `${token}: no field to follow at the sampled point (needs a field() source nearby)`);
}

/** Total energy must not exceed a stability ceiling (catches runaway integration). */
export function assertStableEnergy(energy: number, max: number): void {
  if (!CHECKS) return;
  if (!Number.isFinite(energy) || energy > max)
    fail('UNSTABLE_ENERGY', `energy ${energy} exceeds stability ceiling ${max}`);
}

/** An interactive/motion-dependent field must declare a reduced-motion fallback. */
export function assertReducedMotionFallback(hasFallback: boolean, where = 'field'): void {
  if (!CHECKS) return;
  if (!hasFallback)
    fail('MISSING_REDUCED_MOTION', `${where}: motion-dependent meaning needs a reduced-motion fallback`);
}

/**
 * Run a visualization read against a snapshot of the bodies/particles and assert it mutated
 * nothing. `read` should only sample state; if its run changes the snapshot signature, the layer
 * is doing work it must declare as feedback.
 */
export function assertVisualizationPure<T>(signature: () => string, read: () => T, name = 'visualization'): T {
  if (!CHECKS) return read();
  const before = signature();
  const out = read();
  if (signature() !== before)
    fail('VISUALIZATION_MUTATES_PHYSICS', `${name} mutated physics state (reclassify it as feedback or a force)`);
  return out;
}

/**
 * Validate a single force against its passport at registration time: the live `field()` presence
 * must match `ownsField`, and class-derived flags must agree. Cheap; runs once per force.
 */
export function checkForceContract(
  force: { token: string; field?: unknown },
  passport: ForcePassport | undefined,
): void {
  if (!CHECKS) return;
  if (!passport) fail('PASSPORT_VIOLATION', `${force.token}: no passport (every force needs one)`);
  const ownsField = typeof (force as { field?: unknown }).field === 'function';
  if (passport!.ownsField !== ownsField)
    fail('PASSPORT_VIOLATION', `${force.token}: passport.ownsField=${passport!.ownsField} but field() ${ownsField ? 'exists' : 'is absent'}`);
}
