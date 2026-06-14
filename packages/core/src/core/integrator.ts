/**
 * The integrator — advances the field one tick (§2.2, §7).
 *
 * For each free particle: apply DOM-body forces (§4), the formation bias (§7),
 * then integrate and damp. Under first-class mass (§21.3) each additive body force is
 * scaled by `1/m` as it applies, while velocity-replacing (`kinematic`) forces are left
 * untouched. Reduced motion (`dt = 0`) freezes the sim (§18).
 */

import type { Body, ConditionRegistry, Env, Force, ForceRegistry, Particle } from './types.ts';
import type { FieldStore } from './field-store.ts';
import { accretionTarget } from './formations.ts';
import { waveYat, waveSlope, type Wave } from './currents.ts';
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
function applyForce(f: Force, b: Body, p: Particle, env: Env, inv: number): void {
  if (inv === 1 || f.kinematic) {
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
}

export function step(input: StepInput): void {
  const { store, bodies, env, forces, conditions, waves } = input;
  const dt = env.dt;
  if (dt === 0) return;
  const { W, H, form } = env;
  // expose the net structure field so field-following forces (`fieldflow`) can read the
  // superposition of every body's field() — the same vector the streamlines view draws.
  env.fieldAt = (x, y) => netField(bodies, forces, x, y);
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
      continue;
    }
    // normalize the optional lane once: after this the lane is concrete numbers for
    // the rest of this particle's frame (forces and the integrate step write through).
    if (p.z === undefined) p.z = 0;
    if (p.vz === undefined) p.vz = 0;
    const pz = p.z;

    // wave current (§2.3): near a wave line, drift along its slope like debris.
    if (hasWaves) {
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

    // integrate, then damp (§2.2). The z lane integrates identically — inert at 0.
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.z! += p.vz! * dt;
    p.vx *= FRICTION;
    p.vy *= FRICTION;
    p.vz! *= FRICTION;

    // wander (after damping, so it stays lively): a periodic brownian jitter
    // every 40 frames, plus a smooth curl-noise eddy (§7).
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

    p.heat *= HEAT_DECAY;

    // mortal matter ages (the class-[S] sink): spawned particles carry a finite `age`
    // and despawn at ≤ 0, so a continuous source stays budgeted. Immortal base-field
    // matter (age undefined) is untouched — the conserved field is unchanged.
    if (p.age != null) {
      p.age -= dt;
      if (p.age <= 0) (dead ??= []).push(p);
    }

    // toroidal wrap at the edges (z wraps only in a depth > 0 volume).
    if (p.x < -EDGE) p.x = W + EDGE;
    else if (p.x > W + EDGE) p.x = -EDGE;
    if (p.y < -EDGE) p.y = H + EDGE;
    else if (p.y > H + EDGE) p.y = -EDGE;
    if (D > 0) {
      if (p.z! < -EDGE) p.z = D + EDGE;
      else if (p.z! > D + EDGE) p.z = -EDGE;
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
