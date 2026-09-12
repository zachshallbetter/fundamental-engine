/**
 * Lab scenario tags — curated, named set-ups per force (collide → head-on / glancing,
 * jet → nozzle / far-field, …) that put the detector into a known scenario in one click.
 *
 * A tag is a declarative PATCH over the force's catalog experiment (`EXPERIMENTS` in
 * `@fundamental-engine/core`): body attributes, per-particle initial state (by index),
 * frames, seed. The Lab applies the patch to the catalog scenario BEFORE the Tune knobs,
 * so "tag = the scenario, knobs = tuning on top". A tag may carry its own expectations
 * when the catalog's checks assume the default geometry (a far-field jet particle is
 * pulled IN by the feed before it is relaunched, so `recedesFromBody` is the wrong
 * question); without them the catalog list is used and, as with any knob, its `exact`
 * checks are marked default-only.
 *
 * Pure data + pure functions — no DOM — so `lab-scenarios.test.ts` can run every tag
 * through `runScenario` and pin that its effective expectations pass.
 */
import type { Expectation, Scenario, ScenarioParticle, ScenarioResult } from '@fundamental-engine/core';
import { exactDelta, movesToward } from '@fundamental-engine/core';

/** A declarative patch over a catalog scenario. Every key is optional; `{}` is the scenario itself. */
export interface ScenarioPatch {
  /** body attributes to override (merged over the catalog body). */
  body?: Partial<Scenario['body']>;
  /** per-particle overrides by index into the catalog `particles`; indices beyond the base are ignored. */
  particles?: Record<number, Partial<ScenarioParticle>>;
  frames?: number;
  seed?: number;
}

export interface ScenarioTag {
  /** url-safe `[a-z0-9-]+`; goes into the share hash as `tag=<id>`. */
  id: string;
  /** chip text, e.g. `glancing`. */
  label: string;
  /** becomes `Scenario.label` for the run (the Tune note + the exported record). */
  desc: string;
  patch: ScenarioPatch;
  /** when present, REPLACES the catalog expectation list for this tag (tag-owned checks). */
  expectations?: Expectation[];
}

const f3 = (n: number) => (Math.abs(n) < 1e-9 ? '0' : n.toFixed(3));
const check = (
  label: string,
  kind: Expectation['kind'],
  fn: (r: ScenarioResult) => { pass: boolean; measured: string; expected: string },
): Expectation => ({ label, kind, check: fn });
const last = (r: ScenarioResult) => r.trajectory[r.trajectory.length - 1]![0]!;
const peakSpeed = (r: ScenarioResult) => r.trajectory.reduce((m, fr) => Math.max(m, fr[0]?.speed ?? 0), 0);

/** The test particle is pulled in and relaunched: its speed peaks well above the feed's gentle pull. */
const relaunchedWithinRun = () =>
  check('drawn in and relaunched within the run', 'invariant', (r) => {
    const pk = peakSpeed(r);
    return { pass: pk > 2, measured: `peak |v| = ${f3(pk)}`, expected: '> 2 (a jet, not the feed)' };
  });

/** The membrane/axis leaves the particle alone: no frame-0 Δv at all. */
const noDelta = (label: string, expected: string) =>
  check(label, 'invariant', (r) => {
    const a = r.applyDelta[0]!;
    const mag = Math.hypot(a.dvx, a.dvy);
    return { pass: mag < 1e-9, measured: `|Δv| = ${f3(mag)}`, expected };
  });

/**
 * The curated first cut. Every force with a strip lists its DEFAULT tag first (an empty
 * patch — the catalog scenario itself), so the strip always has a way back. Forces not
 * listed get no strip. Add a row to add a scenario; the test suite pins that its
 * effective expectations pass on the real engine.
 */
export const LAB_SCENARIO_TAGS: Readonly<Record<string, readonly ScenarioTag[]>> = {
  attract: [
    { id: 'at-rest', label: 'at rest', desc: 'A particle at rest 150px from an attractor', patch: {} },
    { id: 'flyby', label: 'flyby', desc: 'A particle flying past an attractor at 4px/frame, 150px out', patch: { particles: { 0: { vy: 4 } } } },
    { id: 'edge', label: 'range edge', desc: 'A particle at rest just inside the attractor’s range edge (290px)', patch: { particles: { 0: { x: -140 } } } },
  ],
  repel: [
    { id: 'at-rest', label: 'at rest', desc: 'A particle at rest 150px from a repeller', patch: {} },
    { id: 'point-blank', label: 'point-blank', desc: 'A particle at rest 10px from a repeller', patch: { particles: { 0: { x: 140 } } } },
    { id: 'edge', label: 'range edge', desc: 'A particle at rest just inside the repeller’s range edge (290px)', patch: { particles: { 0: { x: -140 } } } },
  ],
  swirl: [
    { id: 'at-rest', label: 'at rest', desc: 'A particle at rest 150px from a swirl (spin +1)', patch: {} },
    { id: 'inner', label: 'inner', desc: 'A particle at rest 30px from a swirl (spin +1)', patch: { particles: { 0: { x: 120 } } } },
    { id: 'edge', label: 'range edge', desc: 'A particle at rest just inside the swirl’s range edge (290px)', patch: { particles: { 0: { x: -140 } } } },
  ],
  stream: [
    { id: 'at-rest', label: 'at rest', desc: 'A particle at rest in a stream along +x', patch: {} },
    { id: 'against-flow', label: 'against flow', desc: 'A particle moving against a stream along +x (vx −3)', patch: { particles: { 0: { vx: -3 } } } },
    {
      id: 'with-flow',
      label: 'with flow',
      desc: 'A particle already moving with a stream along +x (vx 3) — carried past the body',
      patch: { particles: { 0: { vx: 3 } } },
      expectations: [
        exactDelta(0.233258, 0, 1e-3),
        check('carried past the body along the flow', 'invariant', (r) => {
          const v0 = r.scenario.particles[0]!.vx ?? 0;
          const v1 = last(r).vx;
          return { pass: v1 > v0 && last(r).x > r.body.cx, measured: `vx ${f3(v0)} → ${f3(v1)}, x ${f3(last(r).x)}`, expected: 'final vx > initial, past the body' };
        }),
      ],
    },
  ],
  jet: [
    { id: 'nozzle', label: 'nozzle', desc: 'A particle relaunched from the jet nozzle (the jet)', patch: {} },
    {
      id: 'far-field',
      label: 'far-field',
      desc: 'A particle 200px upstream of the jet — fed in by the pull, then relaunched',
      patch: { particles: { 0: { x: -200 } }, frames: 120 },
      expectations: [movesToward(), relaunchedWithinRun()],
    },
    {
      id: 'off-axis',
      label: 'off-axis',
      desc: 'A particle off the jet axis (120px back, 90px up) — fed in by the pull, then relaunched',
      patch: { particles: { 0: { x: -120, y: 90 } }, frames: 120 },
      expectations: [movesToward(), relaunchedWithinRun()],
    },
  ],
  wall: [
    { id: 'head-on', label: 'head-on', desc: 'A particle hitting a wall head-on', patch: {} },
    { id: 'oblique', label: 'oblique', desc: 'A particle hitting a wall at an angle (vx 3, vy 2)', patch: { particles: { 0: { vx: 3, vy: 2 } } } },
    {
      id: 'from-above',
      label: 'from above',
      desc: 'A particle hitting the wall’s top face from above (vy 3)',
      patch: { particles: { 0: { x: 0, y: -30, vx: 0, vy: 3 } } },
      expectations: [
        check('velocity reverses off the wall (vy)', 'invariant', (r) => {
          const after = 3 + r.applyDelta[0]!.dvy;
          return { pass: after < 0, measured: `vy 3 → ${f3(after)}`, expected: '< 0 (reversed)' };
        }),
        check('bounce is damped (e ≈ 0.85)', 'invariant', (r) => {
          const after = Math.abs(3 + r.applyDelta[0]!.dvy);
          return { pass: after < 3, measured: `|vy| ${f3(after)}`, expected: '< 3 (energy lost)' };
        }),
      ],
    },
  ],
  gate: [
    { id: 'wrong-way', label: 'wrong-way', desc: 'A wrong-way crosser at a one-way membrane', patch: {} },
    {
      id: 'right-way',
      label: 'right-way',
      desc: 'A right-way crosser at a one-way membrane (vx 3, along the heading) — passes unhindered',
      patch: { particles: { 0: { vx: 3 } } },
      expectations: [
        noDelta('crosses unhindered (no Δv at the membrane)', '0 (the gate is open this way)'),
        check('keeps crossing along the heading', 'invariant', (r) => {
          const vx = last(r).vx;
          return { pass: vx > 0, measured: `final vx ${f3(vx)}`, expected: '> 0 (through)' };
        }),
      ],
    },
  ],
  shear: [
    { id: 'off-axis', label: 'off-axis', desc: 'An off-axis particle in a shear gradient', patch: {} },
    { id: 'far-off-axis', label: 'far off-axis', desc: 'A particle 200px off the shear axis — a stronger drag', patch: { particles: { 0: { y: 200 } } } },
    {
      id: 'on-axis',
      label: 'on-axis',
      desc: 'A particle on the shear axis — zero offset, zero shear',
      patch: { particles: { 0: { y: 0 } } },
      expectations: [noDelta('no shear on the axis (Δv = 0)', '0 (offset is zero)')],
    },
  ],
  sink: [
    { id: 'inside', label: 'inside', desc: 'A particle drifting into a sink', patch: {} },
    { id: 'incoming', label: 'incoming', desc: 'A particle flying into a sink from 100px out (vx −3)', patch: { particles: { 0: { x: 100, vx: -3 } }, frames: 40 } },
    {
      id: 'miss',
      label: 'miss',
      desc: 'A particle crossing 100px from a sink (vy 3) — outside the capture radius',
      patch: { particles: { 0: { x: 100, vy: 3 } }, frames: 40 },
      expectations: [
        check('not captured beyond the capture radius', 'invariant', (r) => {
          const n = r.body.accreted ?? 0;
          return { pass: n === 0 && !last(r).cap, measured: `accreted = ${n}`, expected: '0 (outside absorbR)' };
        }),
      ],
    },
  ],
  collide: [
    { id: 'head-on', label: 'head-on', desc: 'Two discs in a head-on elastic collision', patch: {} },
    { id: 'glancing', label: 'glancing', desc: 'Two discs in a glancing collision (5px impact parameter)', patch: { particles: { 1: { y: 305 } } } },
    { id: 'fast', label: 'fast', desc: 'Two discs in a fast head-on collision (±4px/frame)', patch: { particles: { 0: { vx: 4 }, 1: { vx: -4 } } } },
  ],
};

/** The tag strip for a force — empty when the force has no curated scenarios. */
export const tagsFor = (force: string): readonly ScenarioTag[] => LAB_SCENARIO_TAGS[force] ?? [];

/** Look a tag up by id for a force; `null` for an unknown id (an unknown `tag=` in a share link is ignored). */
export function findTag(force: string, id: string | null | undefined): ScenarioTag | null {
  if (!id) return null;
  return tagsFor(force).find((t) => t.id === id) ?? null;
}

/** A default tag has an empty patch — it IS the catalog scenario. */
export const isDefaultTag = (tag: ScenarioTag): boolean =>
  Object.keys(tag.patch).length === 0 && !tag.expectations;

/**
 * Apply a tag's patch to a catalog scenario. Pure: returns a deep clone (the base is never
 * mutated); `null` returns a plain clone. A non-null tag sets `label` to its `desc`.
 */
export function applyScenarioTag<S extends Scenario>(base: S, tag: ScenarioTag | null): S {
  const s: S = JSON.parse(JSON.stringify(base));
  if (!tag) return s;
  const p = tag.patch;
  s.label = tag.desc;
  if (p.body) s.body = { ...s.body, ...p.body };
  if (p.particles) {
    for (const [k, patch] of Object.entries(p.particles)) {
      const i = Number(k);
      if (Number.isInteger(i) && i >= 0 && i < s.particles.length) s.particles[i] = { ...s.particles[i]!, ...patch };
    }
  }
  if (p.frames != null) s.frames = p.frames;
  if (p.seed != null) s.seed = p.seed;
  return s;
}
