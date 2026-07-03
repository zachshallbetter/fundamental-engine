/**
 * The integrator — advances the field one tick (§2.2, §7).
 *
 * For each free particle: apply DOM-body forces (§4), the formation bias (§7),
 * then integrate and damp. Under first-class mass (§21.3) each additive body force is
 * scaled by `1/m` as it applies, while velocity-replacing (`kinematic`) forces are left
 * untouched. Reduced motion (`dt = 0`) freezes the sim (§18).
 *
 * INTEGRATION SCHEMES (`Env.integrator`): the default `'legacy'` is semi-implicit Euler
 * (forces update v, then `x += v·dt`, then a per-frame decay); `'fixed'` keeps the same order
 * but dt-scales the decays (doc 04 §Step 3). `'velocity-verlet'` (#659) is the opt-in
 * second-order scheme, in the stored-acceleration form:
 *
 *   x(t+dt) = x(t) + v(t)·dt + ½·a(t)·dt²      (position full-step, BEFORE the force pass)
 *   a′      = Δv/dt from the force pass          (forces evaluated at x(t+dt))
 *   v(t+dt) = v(t) + ½·(a(t) + a′)·dt           (velocity half-step average)
 *
 * Approximations, deliberate and documented (physics caveat canon): (1) the engine's force model
 * is impulse-based and velocity-dependent (drag-like forces read the CURRENT v), so a′ is taken
 * as the pass's net Δv/dt rather than re-evaluating forces at the averaged velocity — the
 * standard stored-acceleration treatment; (2) the per-step `FRICTION`/`HEAT_DECAY` decays stay
 * outside the scheme (dt-scaled, like `'fixed'`), which alone makes it NON-symplectic — this
 * buys positional accuracy, it does NOT make energy/momentum conserved (they are non-conserved
 * by design; particle COUNT remains the invariant); (3) a *kinematic* (velocity-REPLACING)
 * force — `jet`/`wall`/`lens`/`gate`/`warp` — is a discontinuity, not an acceleration: when one
 * fires, the replaced velocity stands un-averaged and the stored acceleration resets, so the
 * next position step doesn't extrapolate across the break; (4) a pair force's equal-and-opposite
 * leg on the NEIGHBOUR (`collide`/`link`) folds into that neighbour's own v(t) or Δv whenever
 * its turn comes — same class of caveat the fixed-timestep note below already carries.
 */

import type { Body, ConditionRegistry, Env, FieldImpulseAccumulator, Force, ForceRegistry, Particle } from './types.ts';
import type { FieldStore } from './field-store.ts';
import { accretionTarget } from './formations.ts';
import { waveYat, waveSlope, waveDistance, type Wave } from './currents.ts';
import { netField } from './streamlines.ts';
import { screenFactor } from './math.ts';
import { classifyBodyTokens, type ClassifiedTokens } from '../config/forces.config.ts';

export const FRICTION = 0.95;
export const HEAT_DECAY = 0.972;
const EDGE = 10;

export interface StepInput {
  store: FieldStore;
  bodies: readonly Body[];
  env: Env;
  forces: ForceRegistry;
  conditions: ConditionRegistry;
  /** the carrier waves — free particles drift along their slope (§2.3). */
  waves?: readonly Wave[];
  waveStyle?: 'linear' | 'circular';
  waveCenter?: { x: number; y: number } | null;
  separation?: number;
}

function passes(conds: ConditionRegistry, b: Body, p: Particle, env: Env): boolean {
  if (!b.when) return true;
  const fn = conds[b.when];
  return fn ? fn(b, p, env) : true;
}

/**
 * The body's classified token sets (the modifier contract, workover v0.3). The scanner fills
 * `b.classified` at parse time; bodies built elsewhere (conformance, tests, shadow paths) get
 * it memoized here on first touch — `tokens` never changes after construction, so the memo is
 * safe. The integrator iterates modifiers in the formalized order `spotlight → screen →
 * resonate`, then the core forces in authored order, then sources (the source pass).
 */
function classified(b: Body): ClassifiedTokens {
  return b.classified ?? (b.classified = classifyBodyTokens(b.tokens));
}

/**
 * Apply one force to a particle, honouring first-class mass (§21.3): an *additive* force's
 * velocity change is scaled by `1/m` (a = F/m, so heavier matter moves less), while a
 * `kinematic` force (a reflection / rotation / relaunch) sets velocity outright and is left
 * unscaled. `inv === 1` (the default, `m = 1`) is the identity path either way. The z lane is
 * scaled identically so depth-enabled fields keep `a = F/m` on all three axes (a heavy particle
 * pushed off-plane accelerates as little along z as it does in x/y).
 */
/**
 * Apply one force to a particle AND, when `env.accum` is present, record its net per-force Δv into
 * the accumulator (doc 04). The single canonical capture path: the integrator's hot loop, the
 * diagnostics (`accumulateAt`/causality), and any Field-Query probe all run a force through here, so
 * "what did this force contribute?" is computed in exactly one place. The velocity update is unchanged
 * from the pre-accumulator engine — `accum` is a read-only inspection sink. `inv` is the mass factor
 * (1 = unit mass); kinematic forces are left unscaled.
 */
export function applyAndRecord(f: Force, b: Body, p: Particle, env: Env, inv = 1): void {
  const bvx = p.vx;
  const bvy = p.vy;
  const bvz = p.vz ?? 0;
  const bvh = p.heat;
  const bvs = p.spin ?? 0;
  const bage = p.age;
  f.apply(b, p, env);
  if (!(inv === 1 || f.kinematic)) {
    p.vx = bvx + (p.vx - bvx) * inv;
    p.vy = bvy + (p.vy - bvy) * inv;
    if (p.vz !== undefined) p.vz = bvz + (p.vz - bvz) * inv;
  }
  // velocity-Verlet (#659): mirror the fast path's discontinuity mark on the capture path too.
  if (f.kinematic && env.integrator === 'velocity-verlet' && (p.vx !== bvx || p.vy !== bvy || (p.vz ?? 0) !== bvz))
    env.kinTouch = true;
  const acc = env.accum;
  if (acc !== undefined) {
    const dvx = p.vx - bvx;
    const dvy = p.vy - bvy;
    const dvz = (p.vz ?? 0) - bvz;
    if (dvx !== 0 || dvy !== 0 || dvz !== 0) {
      acc.linear.x += dvx;
      acc.linear.y += dvy;
      acc.linear.z += dvz;
      acc.attribution.push({ force: f.token, channel: 'linear', contribution: { x: dvx, y: dvy, z: dvz } });
    }
    // thermal channel (doc 04 §Step 6): capture the per-force heat change too, so attribution answers
    // "which force *heated* matter here", not only "which moved it". Capture-only — the heat mutation
    // is the force's own; recording it changes nothing.
    const dh = p.heat - bvh;
    if (dh !== 0) {
      acc.thermal = (acc.thermal ?? 0) + dh;
      acc.attribution.push({ force: f.token, channel: 'thermal', contribution: dh });
    }
    // angular channel (doc 04 §Step 6): capture the per-force change in angular velocity (spin about
    // the z axis). Like thermal, capture-only — a `torque` force writes `p.spin`; recording the delta
    // changes nothing. The accumulator's angular lane is 3D; 2D spin lives in its z component.
    const ds = (p.spin ?? 0) - bvs;
    if (ds !== 0) {
      const ang = (acc.angular ??= { x: 0, y: 0, z: 0 });
      ang.z += ds;
      acc.attribution.push({ force: f.token, channel: 'angular', contribution: ds });
    }
    // temporal channel (doc 04 §Step 6): capture a per-force change in `age` (frames-to-live) for MORTAL
    // matter — "which force aged / extended this particle's life here". Δage lands in `temporal.decay`
    // (life lost when negative). Only mortal particles carry `age`; immortal ones (age undefined) never
    // engage the lane, so this is byte-identical for the conserved base field. Capture-only.
    if (bage !== undefined && p.age !== undefined) {
      const da = p.age - bage;
      if (da !== 0) {
        const tmp = (acc.temporal ??= {});
        tmp.decay = (tmp.decay ?? 0) + da;
        acc.attribution.push({ force: f.token, channel: 'temporal', contribution: da });
      }
    }
    // semantic channel (doc 04 §Step 6): annotate the contribution with the body's conserved-attention
    // multiplier in effect (`b.attn` scales this body's effective force strength — integrator §2.4). This
    // is body-level metadata — "this force's influence here was attention-scaled to X" — not a particle
    // delta. Only when attention is active (attn defined and ≠ 1), so the neutral field is byte-identical.
    if (b.attn !== undefined && b.attn !== 1) {
      (acc.semantic ??= {}).attention = b.attn;
      acc.attribution.push({ force: f.token, channel: 'semantic', contribution: b.attn });
    }
  }
}

function applyForce(f: Force, b: Body, p: Particle, env: Env, inv: number): void {
  // NOTE (doc 04 §Step 3): the fixed-timestep integrator does NOT dt-scale force impulses here. The
  // single-particle capture trick (rescale `p`'s Δv) is unsound for forces that also mutate a
  // neighbour in the same pass — `collide`/`link` apply an equal-and-opposite impulse to `q`, which
  // this path can't see, so scaling only `p` would break momentum conservation. Frame-rate-correct
  // force impulses wait for the force-contract change, where every contribution (including a pair's
  // `q` leg) flows through the accumulator. Fixed mode currently corrects only the per-step decays.
  // Default hot path: byte-identical to the pre-accumulator engine (zero overhead — no capture).
  if (env.accum === undefined) {
    if (inv === 1 || f.kinematic) {
      // velocity-Verlet (#659): a kinematic force that actually changes velocity marks the
      // particle's pass as a discontinuity (env.kinTouch) — the half-step average is skipped.
      // One boolean test on the default path; the capture only runs under the opt-in mode.
      if (f.kinematic && env.integrator === 'velocity-verlet') {
        const bvx = p.vx;
        const bvy = p.vy;
        const bvz = p.vz ?? 0;
        f.apply(b, p, env);
        if (p.vx !== bvx || p.vy !== bvy || (p.vz ?? 0) !== bvz) env.kinTouch = true;
        return;
      }
      f.apply(b, p, env);
      return;
    }
    const bvx = p.vx;
    const bvy = p.vy;
    const bvz = p.vz ?? 0;
    f.apply(b, p, env);
    p.vx = bvx + (p.vx - bvx) * inv;
    p.vy = bvy + (p.vy - bvy) * inv;
    // only rescale z when the force actually engaged the lane — never materialize a spurious 0
    // on a flat (z-less) particle.
    if (p.vz !== undefined) p.vz = bvz + (p.vz - bvz) * inv;
    return;
  }
  // Attribution requested: delegate to the shared capture path.
  applyAndRecord(f, b, p, env, inv);
}

/** A fresh, empty impulse accumulator (dimension-aware shape; only `linear` is populated today). */
export function makeAccumulator(): FieldImpulseAccumulator {
  return { linear: { x: 0, y: 0, z: 0 }, attribution: [] };
}

/**
 * Zero the per-frame density + thermodynamic accumulators on every body. Runs at the top of
 * every step — including the frozen (`dt === 0`) path (#967) — so `b.count` never carries a
 * stale value into `writeFeedback()`. The subsequent particle pass re-accumulates when the sim
 * is live; when frozen, the counts stay at 0 and `--d` drains to the engagement-only baseline.
 */
function resetDensity(bodies: readonly Body[]): void {
  for (const b of bodies) {
    b.count = 0;
    // thermodynamic accumulators (workover v0.3 §"Metrics") share the density window/cadence.
    const th = b.thermo;
    if (th) {
      th.n = 0;
      th.sx = 0;
      th.sy = 0;
      th.ss = 0;
      th.ss2 = 0;
      th.sh = 0;
    }
  }
}

export function step(input: StepInput): void {
  const { store, bodies, env, forces, conditions, waves, separation } = input;
  const dt = env.dt;
  if (dt === 0) {
    // Motion is frozen (reduced-motion / maxMotionBudget 0): skip integration, but the
    // density/thermo bookkeeping MUST still drain. `writeFeedback()` runs unconditionally
    // every frame, easing `b.d` toward `feedbackTarget(b.count, b.on)`. If we returned before
    // zeroing the counts, `b.count` would hold its last live value forever — `--d`/`--field-density`
    // (and the font-weight channel) would report particle presence from a sim that is no longer
    // running (#967). The doctrine is "motion freezes; the signals stay honest": engagement
    // (`b.on`, dt-independent) still reads truthfully, so `b.d` eases to `feedbackTarget(0, b.on)`
    // — the engagement-only baseline — instead of lying about frozen density.
    resetDensity(bodies);
    return;
  }
  // the opt-in second-order scheme (#659) — see the header doc for the math + approximations.
  const verlet = env.integrator === 'velocity-verlet';
  const { W, H, form } = env;
  // expose the net structure field so field-following forces (`fieldflow`) can read the
  // superposition of every body's field() — the same vector the streamlines view draws.
  env.fieldAt = (x, y) => netField(bodies, forces, x, y);
  resetDensity(bodies);
  // visible `screen` bodies (workover v0.3): each damps OTHER bodies' forces on matter inside
  // its range (quiet zones / text shielding). No screens on the page (the common case) ⇒ this
  // stays null and the whole pass is skipped — zero cost and zero behavior change.
  let screens: Body[] | null = null;
  for (const b of bodies) {
    if (b.vis && b.tokens.length > 0 && classified(b).modifiers.indexOf('screen') >= 0)
      (screens ??= []).push(b);
  }
  const screenFall: number[] | null = screens ? new Array<number>(screens.length) : null;
  const hasWaves = !!waves && waves.length > 0;
  const hasBodies = bodies.length > 0;
  let dead: Particle[] | null = null; // mortal (spawned) matter that expired this tick
  // the accretion target for `conv` — the first visible sink body (§7).
  const conv = form.conv > 0.02 ? accretionTarget(bodies) : null;

  // the optional z lane (z-axis.md): D = 0 — the default — is the flat field, where
  // every z term below is exactly 0 and the 2D behavior is preserved bit-for-bit.
  const D = env.D ?? 0;

  for (const p of store.particles) {
    // captured matter is held inside a sink core, drifting to it (§6.9). The core
    // lives on the z = 0 plane, so held matter also settles flat.
    if (p.cap) {
      p.x += (p.cap.cx - p.x) * 0.18;
      p.y += (p.cap.cy - p.y) * 0.18;
      if (p.z) p.z += -p.z * 0.18;
      // held matter has no acceleration of its own — drop any stored Verlet lane so a later
      // release doesn't extrapolate a stale a(t). Only ever defined under the opt-in mode.
      if (p.ax !== undefined) p.ax = p.ay = p.az = 0;
      continue;
    }
    // normalize the optional lane once: after this the lane is concrete numbers for
    // the rest of this particle's frame (forces and the integrate step write through).
    if (p.z === undefined) p.z = 0;
    if (p.vz === undefined) p.vz = 0;
    // velocity-Verlet (#659): the position FULL-STEP runs first, from last step's velocity and
    // stored acceleration — x(t+dt) = x(t) + v(t)·dt + ½·a(t)·dt² — so the force pass below
    // evaluates a′ at x(t+dt). v0 keeps v(t) for the half-step average after the pass.
    let v0x = 0;
    let v0y = 0;
    let v0z = 0;
    if (verlet) {
      const h = 0.5 * dt * dt;
      p.x += p.vx * dt + (p.ax ?? 0) * h;
      p.y += p.vy * dt + (p.ay ?? 0) * h;
      p.z! += p.vz! * dt + (p.az ?? 0) * h;
      v0x = p.vx;
      v0y = p.vy;
      v0z = p.vz!;
      env.kinTouch = false;
    }
    const pz = p.z;

    // wave current (§2.3): near a wave line, drift along its slope like debris.
    if (hasWaves) {
      if (input.waveStyle === 'circular') {
        let near: Wave | null = null;
        let nd = 1e9;
        let nearR = 0;
        let nearRWave = 0;
        let nearTheta = 0;
        const c = input.waveCenter || { x: W / 2, y: H / 2 };
        for (const w of waves!) {
          const res = waveDistance(w, p.x, p.y, env.t, W, H, 'circular', c);
          if (res.dist < nd) {
            nd = res.dist;
            near = w;
            nearR = res.r;
            nearRWave = res.rWave;
            nearTheta = res.theta;
          }
        }
        if (near && nd < 70) {
          const factor = 1 - nd / 70;
          // Tangential drift
          const tx = -Math.sin(nearTheta) * near.dir;
          const ty = Math.cos(nearTheta) * near.dir;
          p.vx += tx * 0.035 * factor;
          p.vy += ty * 0.035 * factor;

          // Radial pull towards the wave radius
          const rx = Math.cos(nearTheta) * Math.sign(nearRWave - nearR);
          const ry = Math.sin(nearTheta) * Math.sign(nearRWave - nearR);
          p.vx += rx * 0.05 * factor;
          p.vy += ry * 0.05 * factor;
        }
      } else {
        let near: Wave | null = null;
        let nd = 1e9;
        for (const w of waves!) {
          const d = Math.abs(waveYat(w, p.x, env.t, H) - p.y);
          if (d < nd) {
            nd = d;
            near = w;
          }
        }
        if (near && nd < 70) {
          p.vx += near.dir * 0.035 * (1 - nd / 70);
          p.vy += waveSlope(near, p.x, env.t) * 0.1 * (1 - nd / 70);
        }
      }
    }

    // formation currents (§7), before the body forces: a lateral lane, an
    // even-scatter pull toward a per-particle target, and convergence to the core.
    if (form.driftX) p.vx += form.driftX * 0.02;
    if (form.spread > 0.02) {
      const gx = p.gx ?? 0.5;
      const gy = p.gy ?? 0.5;
      const tx = ((gx + env.frameN * 0.00004) % 1) * W;
      const ty = gy * H;
      p.vx += (tx - p.x) * 0.0006 * form.spread;
      p.vy += (ty - p.y) * 0.0006 * form.spread;
      if (D > 0) p.vz! += ((p.gz ?? 0.5) * D - pz) * 0.0006 * form.spread;
    }
    if (conv) {
      const cdx = conv.cx - p.x;
      const cdy = conv.cy - p.y;
      const cdz = -pz; // the sink core sits on the z = 0 plane
      const cd = Math.hypot(cdx, cdy, cdz) || 1;
      p.vx += (cdx / cd) * form.conv * 0.06;
      p.vy += (cdy / cd) * form.conv * 0.06;
      p.vz! += (cdz / cd) * form.conv * 0.06;
    }

    // DOM body forces — the page's elements move the field (§4).
    if (hasBodies) {
      // per-particle screen factors (workover v0.3): one distance per screen body, computed
      // once and reused across every body's pass below.
      if (screens) {
        for (let i = 0; i < screens.length; i++) {
          const s = screens[i]!;
          const sdx = s.cx - p.x;
          const sdy = s.cy - p.y;
          screenFall![i] = screenFactor(
            Math.sqrt(sdx * sdx + sdy * sdy),
            s.range,
            s.strength,
            s.screenMin ?? 0,
          );
        }
      }
      // first-class mass (§21.3): an additive force's Δv is scaled by 1/m as it applies
      // (see applyForce); kinematic forces set velocity outright and are left unscaled.
      const inv = p.m !== 1 && p.m > 0 ? 1 / p.m : 1;
      for (const b of bodies) {
        if (!b.vis || b.tokens.length === 0) continue;
        // matter tagging (#444): a selective body (data-affects) acts only on its species;
        // matter outside the set is skipped entirely (no force, no density sample). Undefined
        // affects ⇒ acts on all matter — the default, so untagged fields are bit-for-bit unchanged.
        if (b.affects !== undefined && !b.affects.has(p.species ?? 0)) continue;
        // shaped sources (§ Stage C): reference the nearest point on the element's box, not
        // its centre, so matter shells the shape. Clamp is inlined (no allocation in the hot
        // loop); inside the box dx=dy=0 → no directional pull, the right no-op.
        let dx: number;
        let dy: number;
        if (b.shaped) {
          const lx = b.cx - b.hw;
          const rx = b.cx + b.hw;
          const ty = b.cy - b.hh;
          const by = b.cy + b.hh;
          const nx = p.x < lx ? lx : p.x > rx ? rx : p.x;
          const ny = p.y < ty ? ty : p.y > by ? by : p.y;
          dx = nx - p.x;
          dy = ny - p.y;
        } else {
          dx = b.cx - p.x;
          dy = b.cy - p.y;
        }
        // optional z lane (z-axis.md): bodies live on the z = 0 plane, so the z leg of
        // the particle→body vector is just −p.z — exactly 0 in a flat field. Matter
        // that drifts into the volume is pulled back toward the plane by the same
        // falloffs that pull it across it.
        const dz = -p.z!;
        const d2 = dx * dx + dy * dy + dz * dz;
        // range cull: a ranged body can't reach past ~1.6× its range (the largest
        // on-state multiplier, tether's 1.575×). Skip the sqrt, the modifier pass,
        // and every apply for matter beyond it. range 0 = global → never culled.
        if (b.range > 0 && d2 >= b.range * b.range * 2.56) continue;
        const d = Math.sqrt(d2);
        // density sampling for two-way feedback (engine bookkeeping, ungated, §8) — and the
        // thermodynamic sample (workover v0.3 §"Metrics"), same window, same cadence.
        if (b.feedback && d < b.range * 0.5) {
          b.count += 1 - d / (b.range * 0.5);
          const th = (b.thermo ??= { n: 0, sx: 0, sy: 0, ss: 0, ss2: 0, sh: 0 });
          const s2 = p.vx * p.vx + p.vy * p.vy;
          th.n++;
          th.sx += p.vx;
          th.sy += p.vy;
          th.ss += Math.sqrt(s2);
          th.ss2 += s2;
          th.sh += p.heat;
        }
        if (b.when && !passes(conditions, b, p, env)) continue;
        env.dx = dx;
        env.dy = dy;
        env.dz = dz;
        env.dist = d < 1 ? 1 : d;
        // modifier pass (§20.3, formalized by the workover v0.3 modifier contract): the body's
        // OWN modifiers evaluate in the contract order `spotlight → screen → resonate`
        // (cls.modifiers is pre-sorted), then any custom modify() hooks on its other tokens
        // (dynamic discovery — unchanged behavior for registry-extended forces). spotlight
        // gates siblings, resonate scales their strength; `screen` contributes through the
        // cross-body factor below (a screen body never attenuates its own siblings). Gates OR
        // and strength factors multiply, so the composed value is order-independent — the
        // order is the *contract* (pinned for future modifiers where it will matter).
        const cls = classified(b);
        let sMul = 1;
        let gated = false;
        let hasModifier = false;
        for (const tok of cls.modifiers) {
          const mod = forces[tok]?.modify;
          if (!mod) continue;
          hasModifier = true;
          const m = mod(b, p, env);
          if (m.strength != null) sMul *= m.strength;
          if (m.gate) gated = true;
        }
        for (const tok of cls.forces) {
          const mod = forces[tok]?.modify;
          if (!mod) continue;
          hasModifier = true;
          const m = mod(b, p, env);
          if (m.strength != null) sMul *= m.strength;
          if (m.gate) gated = true;
        }
        if (gated) continue; // spotlight cone excludes this particle
        // `screen` (workover v0.3): OTHER bodies' quiet zones damp this body's force on this
        // particle. Factors were computed once per particle above; a screen never damps itself.
        let screenMul = 1;
        if (screens) {
          for (let i = 0; i < screens.length; i++) {
            if (screens[i] !== b) screenMul *= screenFall![i]!;
          }
        }
        // conserved-attention multiplier (§2.4): a page-level effective strength,
        // 1 = neutral (the default, so the live field is untouched until opted in).
        const attn = b.attn ?? 1;
        // the composed effective-strength multiplier: resonate's S(t) × the attention
        // budget × the screen attenuation. 1 ⇒ the untouched fast path.
        const mul = sMul * attn * screenMul;
        if (!hasModifier && mul === 1) {
          for (const tok of b.tokens) {
            const f = forces[tok];
            if (f) applyForce(f, b, p, env, inv);
          }
        } else if (!hasModifier) {
          const origS = b.strength;
          b.strength = origS * mul;
          for (const tok of b.tokens) {
            const f = forces[tok];
            if (f) applyForce(f, b, p, env, inv);
          }
          b.strength = origS;
        } else {
          const origS = b.strength;
          b.strength = origS * mul;
          for (const tok of b.tokens) {
            const f = forces[tok];
            if (f && !f.modify) applyForce(f, b, p, env, inv);
          }
          b.strength = origS;
        }
      }
    }

    // short-range particle-to-particle separation to prevent clumping
    if (separation && separation > 0) {
      const ns = env.neighbors(p, 12);
      for (const n of ns) {
        const dx = p.x - n.x;
        const dy = p.y - n.y;
        const dz = (p.z ?? 0) - (n.z ?? 0);
        const dist = Math.hypot(dx, dy, dz) || 0.1;
        if (dist < 12) {
          const force = ((12 - dist) / 12) * separation * 0.12;
          p.vx += (dx / dist) * force;
          p.vy += (dy / dist) * force;
          if (p.vz !== undefined) p.vz! += (dz / dist) * force;
        }
      }
    }

    // velocity-Verlet second half (#659): fold this step's impulse into the half-step average.
    if (verlet) {
      // the pass's net Δv is a′·dt — every force above evaluated at the updated position.
      const dvx = p.vx - v0x;
      const dvy = p.vy - v0y;
      const dvz = p.vz! - v0z;
      if (env.kinTouch) {
        // a kinematic (velocity-REPLACING) force fired: a discontinuity, not an acceleration.
        // The replaced velocity stands as-is; the stored acceleration resets so the next
        // position step doesn't extrapolate across the break.
        p.ax = p.ay = p.az = 0;
      } else {
        // v(t+dt) = v(t) + ½·(a(t) + a′)·dt — ½·a(t)·dt from the stored lane, ½·Δv for a′.
        p.vx = v0x + 0.5 * ((p.ax ?? 0) * dt + dvx);
        p.vy = v0y + 0.5 * ((p.ay ?? 0) * dt + dvy);
        p.vz = v0z + 0.5 * ((p.az ?? 0) * dt + dvz);
        p.ax = dvx / dt;
        p.ay = dvy / dt;
        p.az = dvz / dt;
      }
    }

    // global safety cap (§20.10): no token or composite may drive a free particle past
    // c (the unit system's "speed of light"). The natural primitives self-clamp; this
    // enforces it for *every* force. A non-finite velocity slips the `> c²` test — the
    // conformance safety sweep is what catches a NaN-producing force.
    const cap = env.c;
    const sp2 = p.vx * p.vx + p.vy * p.vy + p.vz! * p.vz!;
    if (sp2 > cap * cap) {
      const k = cap / Math.sqrt(sp2);
      p.vx *= k;
      p.vy *= k;
      p.vz! *= k;
    }

    // agent speed cap (FieldHandle.addAgent): clamp |v| to the agent's own top speed, after the
    // global c cap so an agent is bounded by whichever is tighter. undefined ⇒ skip (the swarm).
    if (p.maxSpeed !== undefined) {
      const ms2 = p.maxSpeed * p.maxSpeed;
      const as2 = p.vx * p.vx + p.vy * p.vy + p.vz! * p.vz!;
      if (as2 > ms2) {
        const k = p.maxSpeed / Math.sqrt(as2);
        p.vx *= k;
        p.vy *= k;
        p.vz! *= k;
      }
    }

    // integrate, then damp (§2.2). The z lane integrates identically — inert at 0. Under the opt-in
    // fixed-timestep integrator (doc 04 §Step 3) the per-step damping scales with `dt` (`FRICTION^dt`)
    // so it is frame-rate independent; at `dt === 1` `Math.pow(FRICTION, 1) === FRICTION`, so the
    // default path is byte-identical. Velocity-Verlet already took its position full-step before
    // the force pass (its decays are dt-scaled like fixed's).
    if (!verlet) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z! += p.vz! * dt;
    }
    const fr = env.integrator === 'fixed' || verlet ? Math.pow(FRICTION, dt) : FRICTION;
    p.vx *= fr;
    p.vy *= fr;
    p.vz! *= fr;
    // optional orientation lane (doc 04 §Step 6): advance angle by spin and damp the spin, ONLY when a
    // force gave this particle angular velocity — undefined ⇒ inert ⇒ byte-identical to the spin-less
    // engine. Mirrors the position integrate + FRICTION damp above.
    if (p.spin !== undefined) {
      p.orient = (p.orient ?? 0) + p.spin * dt;
      p.spin *= fr;
    }

    // wander (after damping, so it stays lively): a periodic brownian jitter every 40 frames, plus
    // a smooth curl-noise eddy (§7). Agents (report defined) opt out — their motion is force- and
    // steering-driven, not the ambient swarm drift.
    if (p.report === undefined) {
      if (env.frameN % 40 === 0 && form.wander > 0) {
        const wsc = 0.05 * form.wander;
        p.vx += ((env.rng ?? Math.random)() - 0.5) * wsc;
        p.vy += ((env.rng ?? Math.random)() - 0.5) * wsc;
        // the brownian kick gains a z leg in a volume — through the same injectable rng (#371)
        if (D > 0) p.vz! += ((env.rng ?? Math.random)() - 0.5) * wsc;
      }
      if (form.wander > 0.05) {
        const cn =
          (Math.sin(p.x * 0.0032 + env.t * 0.12) + Math.cos(p.y * 0.0034 - env.t * 0.15)) *
          Math.PI;
        p.vx += Math.cos(cn) * 0.013 * form.wander;
        p.vy += Math.sin(cn) * 0.013 * form.wander;
      }
    }

    p.heat *= env.integrator === 'fixed' || verlet ? Math.pow(HEAT_DECAY, dt) : HEAT_DECAY;

    // mortal matter ages (the class-[S] sink): spawned particles carry a finite `age`
    // and despawn at ≤ 0, so a continuous source stays budgeted. Immortal base-field
    // matter (age undefined) is untouched — the conserved field is unchanged.
    if (p.age != null) {
      p.age -= dt;
      if (p.age <= 0) (dead ??= []).push(p);
    }

    if (p.report === undefined) {
      // toroidal wrap at the edges (z wraps only in a depth > 0 volume). Swarm matter only —
      // teleporting a creature across the field reads wrong.
      if (p.x < -EDGE) p.x = W + EDGE;
      else if (p.x > W + EDGE) p.x = -EDGE;
      if (p.y < -EDGE) p.y = H + EDGE;
      else if (p.y > H + EDGE) p.y = -EDGE;
      if (D > 0) {
        if (p.z! < -EDGE) p.z = D + EDGE;
        else if (p.z! > D + EDGE) p.z = -EDGE;
      }
    } else {
      // agents bounce off the field edge instead of wrapping (a creature stays in the world).
      if (p.x < 0) { p.x = 0; p.vx = Math.abs(p.vx); }
      else if (p.x > W) { p.x = W; p.vx = -Math.abs(p.vx); }
      if (p.y < 0) { p.y = 0; p.vy = Math.abs(p.vy); }
      else if (p.y > H) { p.y = H; p.vy = -Math.abs(p.vy); }
      if (D > 0) {
        if (p.z! < 0) { p.z = 0; p.vz = Math.abs(p.vz!); }
        else if (p.z! > D) { p.z = D; p.vz = -Math.abs(p.vz!); }
      }
      // the agent integrated this step — let its bound transform (a mesh) follow.
      p.report(p);
    }
  }

  // class-[S] sources (§20.1): a body-level pass *after* the per-particle loop, so a
  // source emits matter once per frame (not once per existing particle) via env.spawn.
  if (hasBodies) {
    for (const b of bodies) {
      if (!b.vis || b.tokens.length === 0) continue;
      for (const tok of b.tokens) forces[tok]?.source?.(b, env);
    }
  }

  // remove expired mortal matter (swap-remove is O(1); order is not significant).
  if (dead) for (const p of dead) store.remove(p);
}
