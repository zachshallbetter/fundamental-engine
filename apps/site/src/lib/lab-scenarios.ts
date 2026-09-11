/**
 * Lab scenario tags — curated, per-force scenarios the Lab sets up in one click.
 *
 * A tag is a declarative patch on the force's catalog conformance scenario (the same
 * `EXPERIMENTS` entry the test suite runs): move a particle, change a heading, extend the
 * run. It is applied BEFORE the Tune knobs, so a tag is "the scenario" and the knobs stay
 * "tune on top". Where the catalog expectations only describe the catalog setup (an
 * `exact` Δv pinned to one geometry, a `vx`-hard-coded bounce check), a tag carries its own
 * expectation list, which replaces the catalog list for that tag.
 *
 * Pure data + pure functions — no DOM — so `lab-scenarios.test.ts` can run every tag through
 * `runScenario` and pin that each one actually produces the behaviour it names. The Lab
 * page (`pages/lab.astro`) only renders the chips, keeps the active tag in state, and puts
 * `tag=<id>` in the share hash. Forces with no row here get no strip; add a row to add a
 * strip.
 */
import {
  exactDelta,
  movesToward,
  type Expectation,
  type Scenario,
  type ScenarioParticle,
  type ScenarioResult,
} from '@fundamental-engine/core';

/** A declarative change to a catalog scenario. Every field is optional; `{}` is the catalog itself. */
export interface ScenarioPatch {
  /** body attributes to override (strength, range, spin, angle, hw, absorbR, …). */
  body?: Partial<Scenario['body']>;
  /** per-particle overrides by index into the base scenario; indices beyond the base are ignored. */
  particles?: Record<number, Partial<ScenarioParticle>>;
  /** run length override. */
  frames?: number;
  /** RNG seed override (RNG forces: thermal, jet, spawn). */
  seed?: number;
}

/** One curated scenario for a force. */
export interface ScenarioTag {
  /** url-safe `[a-z0-9-]+` — goes in the share hash as `tag=<id>`. */
  id: string;
  /** chip text, e.g. `glancing`. */
  label: string;
  /** becomes `Scenario.label` for the run, e.g. `Two discs in a glancing collision (5px impact parameter)`. */
  desc: string;
  patch: ScenarioPatch;
  /** when present, REPLACES the catalog expectation list for this tag (tag-owned checks). */
  expectations?: Expectation[];
}

const f3 = (n: number) => (Math.abs(n) < 1e-9 ? '0' : n.toFixed(3));
const last = (r: ScenarioResult, i = 0) => r.trajectory[r.trajectory.length - 1]![i]!;
const peakSpeed = (r: ScenarioResult, i = 0) => {
  let m = 0;
  for (const fr of r.trajectory) m = Math.max(m, fr[i]?.speed ?? 0);
  return m;
};

/** Build an inline one-off expectation (mirrors the catalog's private helper). */
function check(
  label: string,
  kind: 'invariant' | 'exact',
  fn: (r: ScenarioResult) => { pass: boolean; measured: string; expected: string },
): Expectation {
  return { label, kind, check: fn };
}

// ── tag-owned expectations ─────────────────────────────────────────────────────

/** A jet feed particle is drawn to the nozzle and relaunched at jet speed within the run. */
const relaunchedWithinRun = () =>
  check('drawn in and relaunched within the run (peak |v| > 2)', 'invariant', (r) => {
    const peak = peakSpeed(r);
    return { pass: peak > 2, measured: `peak |v| = ${f3(peak)}`, expected: '> 2 (relaunched as a jet)' };
  });

/** A with-flow particle in a stream is carried past the body: it ends faster than it started. */
const carriedPastBody = () =>
  check('carried past the body along the flow (final vx > initial)', 'invariant', (r) => {
    const v0 = r.scenario.particles[0]!.vx ?? 0;
    const vN = last(r).vx;
    return { pass: vN > v0 + 1e-6, measured: `vx ${f3(v0)} → ${f3(vN)}`, expected: 'final > initial (accelerated along the flow)' };
  });

/** Wall bounce checks on the vertical component (the catalog hard-codes vx = 3). */
const reversesVy = (v0: number) =>
  check('velocity reverses off the wall (vy)', 'invariant', (r) => {
    const after = v0 + r.applyDelta[0]!.dvy;
    return { pass: after * v0 < 0, measured: `vy ${f3(v0)} → ${f3(after)}`, expected: 'sign flipped (reversed)' };
  });
const dampedVy = (v0: number) =>
  check('bounce is damped (e ≈ 0.85)', 'invariant', (r) => {
    const after = Math.abs(v0 + r.applyDelta[0]!.dvy);
    return { pass: after < Math.abs(v0), measured: `|vy| ${f3(after)}`, expected: `< ${f3(Math.abs(v0))} (energy lost)` };
  });

/** A right-way crosser at a gate is untouched at the membrane. */
const crossesUnhindered = () =>
  check('crosses unhindered (Δv = 0 at the membrane)', 'invariant', (r) => {
    const a = r.applyDelta[0]!;
    const mag = Math.hypot(a.dvx, a.dvy);
    const vN = last(r).vx;
    return { pass: mag < 1e-9 && vN > 0, measured: `|Δv| = ${f3(mag)}, final vx ${f3(vN)}`, expected: '0 (no reflection), still moving +x' };
  });

/** On the shear axis the ⟂ offset is zero, so there is nothing to drag. */
const noShearOnAxis = () =>
  check('no shear on the axis (Δv = 0)', 'invariant', (r) => {
    const a = r.applyDelta[0]!;
    const mag = Math.hypot(a.dvx, a.dvy);
    return { pass: mag < 1e-9, measured: `|Δv| = ${f3(mag)}`, expected: '0 (zero ⟂ offset)' };
  });

/** A sink only acts inside its capture radius — a particle that never enters is not captured. */
const notCaptured = () =>
  check('not captured beyond the capture radius', 'invariant', (r) => {
    const n = r.body.accreted;
    return { pass: n === 0, measured: `accreted = ${n}`, expected: '0 (never inside absorbR)' };
  });

// ── the curated table ──────────────────────────────────────────────────────────

const edgeOfRange = (desc: string): ScenarioTag => ({
  id: 'edge',
  label: 'edge',
  desc,
  patch: { particles: { 0: { x: -140 } } },
});

/**
 * Curated scenarios per force token. The first row of a force with an empty patch is the
 * catalog scenario itself (its chip is `on` when no tag is active). Forces not listed
 * show no strip.
 */
export const LAB_SCENARIO_TAGS: Readonly<Record<string, readonly ScenarioTag[]>> = {
  collide: [
    { id: 'head-on', label: 'head-on', desc: 'Two discs in a head-on elastic collision', patch: {} },
    {
      id: 'glancing',
      label: 'glancing',
      desc: 'Two discs in a glancing collision (5px impact parameter)',
      patch: { particles: { 1: { y: 305 } } },
    },
    {
      id: 'fast',
      label: 'fast',
      desc: 'Two discs in a fast head-on collision (4px/frame each)',
      patch: { particles: { 0: { vx: 4 }, 1: { vx: -4 } } },
    },
  ],
  jet: [
    { id: 'nozzle', label: 'nozzle', desc: 'A particle relaunched from the jet nozzle (the jet)', patch: {} },
    {
      id: 'far-field',
      label: 'far-field',
      desc: 'A particle 200px behind the nozzle, drawn in by the feed and relaunched',
      patch: { particles: { 0: { x: -200 } }, frames: 120 },
      expectations: [movesToward(), relaunchedWithinRun()],
    },
    {
      id: 'off-axis',
      label: 'off-axis',
      desc: 'A particle off the jet axis, drawn in by the feed and relaunched',
      patch: { particles: { 0: { x: -120, y: 90 } }, frames: 120 },
      expectations: [movesToward(), relaunchedWithinRun()],
    },
  ],
  attract: [
    { id: 'rest', label: 'at rest', desc: 'A particle 150px from an attractor', patch: {} },
    {
      id: 'flyby',
      label: 'flyby',
      desc: 'A particle 150px from an attractor, crossing at 4px/frame',
      patch: { particles: { 0: { vy: 4 } } },
    },
    edgeOfRange('A particle at the edge of an attractor’s range (290px)'),
  ],
  repel: [
    { id: 'mid', label: 'mid-range', desc: 'A particle 150px from a repeller', patch: {} },
    {
      id: 'point-blank',
      label: 'point-blank',
      desc: 'A particle 10px from a repeller',
      patch: { particles: { 0: { x: 140 } } },
    },
    edgeOfRange('A particle at the edge of a repeller’s range (290px)'),
  ],
  swirl: [
    { id: 'mid', label: 'mid-range', desc: 'A particle 150px from a swirl (spin +1)', patch: {} },
    {
      id: 'inner',
      label: 'inner',
      desc: 'A particle 30px from a swirl (spin +1)',
      patch: { particles: { 0: { x: 120 } } },
    },
    edgeOfRange('A particle at the edge of a swirl’s range (290px)'),
  ],
  stream: [
    { id: 'rest', label: 'at rest', desc: 'A particle in a stream along +x', patch: {} },
    {
      id: 'against-flow',
      label: 'against',
      desc: 'A particle moving against a stream along +x (3px/frame upstream)',
      patch: { particles: { 0: { vx: -3 } } },
    },
    {
      id: 'with-flow',
      label: 'with',
      desc: 'A particle moving with a stream along +x (3px/frame downstream)',
      patch: { particles: { 0: { vx: 3 } } },
      expectations: [exactDelta(0.233258, 0, 1e-3), carriedPastBody()],
    },
  ],
  wall: [
    { id: 'normal', label: 'normal', desc: 'A particle hitting a wall', patch: {} },
    {
      id: 'oblique',
      label: 'oblique',
      desc: 'A particle hitting a wall at an oblique angle',
      patch: { particles: { 0: { vx: 3, vy: 2 } } },
    },
    {
      id: 'from-above',
      label: 'from above',
      desc: 'A particle hitting the top face of a wall',
      patch: { particles: { 0: { x: 0, y: -30, vx: 0, vy: 3 } } },
      expectations: [reversesVy(3), dampedVy(3)],
    },
  ],
  gate: [
    { id: 'wrong-way', label: 'wrong-way', desc: 'A wrong-way crosser at a one-way membrane', patch: {} },
    {
      id: 'right-way',
      label: 'right-way',
      desc: 'A right-way crosser at a one-way membrane (moving along the heading)',
      patch: { particles: { 0: { vx: 3 } } },
      expectations: [crossesUnhindered()],
    },
  ],
  shear: [
    { id: 'off-axis', label: 'off-axis', desc: 'An off-axis particle in a shear gradient', patch: {} },
    {
      id: 'far-off-axis',
      label: 'far off-axis',
      desc: 'A far off-axis particle in a shear gradient (200px)',
      patch: { particles: { 0: { y: 200 } } },
    },
    {
      id: 'on-axis',
      label: 'on-axis',
      desc: 'A particle on the shear axis (zero ⟂ offset)',
      patch: { particles: { 0: { y: 0 } } },
      expectations: [noShearOnAxis()],
    },
  ],
  sink: [
    { id: 'inside', label: 'inside', desc: 'A particle drifting into a sink', patch: {} },
    {
      id: 'incoming',
      label: 'incoming',
      desc: 'A particle flying into a sink from 100px out',
      patch: { particles: { 0: { x: 100, vx: -3 } }, frames: 40 },
    },
    {
      id: 'miss',
      label: 'miss',
      desc: 'A particle passing a sink outside its capture radius',
      patch: { particles: { 0: { x: 100, vy: 3 } }, frames: 40 },
      expectations: [notCaptured()],
    },
  ],
};

/** The tags for a force (empty for forces with no curated scenarios). */
export const tagsFor = (force: string): readonly ScenarioTag[] => LAB_SCENARIO_TAGS[force] ?? [];

/** Look a tag up by id for a force; unknown or empty id → null. */
export const findTag = (force: string, id: string | null | undefined): ScenarioTag | null =>
  (id ? tagsFor(force).find((t) => t.id === id) : null) ?? null;

/** A default tag has an empty patch — it IS the catalog scenario. */
export const isDefaultTag = (tag: ScenarioTag): boolean => Object.keys(tag.patch).length === 0;

/**
 * Apply a tag's patch to a catalog scenario. Pure: the base is never touched, the result is
 * a deep clone (JSON round-trip — scenarios are plain data). `null` → a plain clone. A tag
 * also renames the run to its `desc`.
 */
export function applyScenarioTag<S extends Scenario>(base: S, tag: ScenarioTag | null): S {
  const s: S = JSON.parse(JSON.stringify(base));
  if (!tag) return s;
  const p = tag.patch;
  if (p.body) Object.assign(s.body, p.body);
  if (p.particles)
    for (const [k, v] of Object.entries(p.particles)) {
      const i = Number(k);
      if (s.particles[i]) Object.assign(s.particles[i], v);
    }
  if (p.frames != null) s.frames = p.frames;
  if (p.seed != null) s.seed = p.seed;
  s.label = tag.desc;
  return s;
}
