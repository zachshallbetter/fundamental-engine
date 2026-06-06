/**
 * Expectation builders — the named checks that define "appropriate reaction".
 *
 * Two flavours: invariants (direction, speed change, conservation — robust to tuning)
 * and exact checks (the precise per-frame Δv from the spec formula). Most operate on
 * the frame-0 force delta (pure force, before friction) or the trajectory; a few do a
 * controlled direct `apply` (cutoff, grid gradient, modifier gating) via the registry.
 */
import type { Body, Env, Particle, ScalarGrid } from '../core/types.ts';
import type { Expectation, ExpectationResult, ScenarioResult } from './types.ts';
import { allForces } from './run.ts';

const f3 = (n: number) => (Math.abs(n) < 1e-9 ? '0' : n.toFixed(3));
const ok = (pass: boolean, measured: string, expected: string): ExpectationResult => ({
  pass,
  measured,
  expected,
});

function toBodyUnit(r: ScenarioResult): { ux: number; uy: number } {
  const p = r.scenario.particles[0]!;
  const dx = r.body.cx - p.x;
  const dy = r.body.cy - p.y;
  const d = Math.hypot(dx, dy) || 1;
  return { ux: dx / d, uy: dy / d };
}

/** Δv on the test particle points toward the body. */
export function movesToward(): Expectation {
  return {
    label: 'pulled toward the body',
    kind: 'invariant',
    check(r) {
      const { ux, uy } = toBodyUnit(r);
      const { dvx, dvy } = r.applyDelta[0]!;
      const along = dvx * ux + dvy * uy;
      return ok(along > 1e-6, `Δv·û = ${f3(along)}`, '> 0 (inward)');
    },
  };
}

/** Δv on the test particle points away from the body. */
export function movesAway(): Expectation {
  return {
    label: 'pushed away from the body',
    kind: 'invariant',
    check(r) {
      const { ux, uy } = toBodyUnit(r);
      const { dvx, dvy } = r.applyDelta[0]!;
      const along = dvx * ux + dvy * uy;
      return ok(along < -1e-6, `Δv·û = ${f3(along)}`, '< 0 (outward)');
    },
  };
}

/** Over the whole run, the test particle ends farther from the body than it began — it rode
 *  an outgoing wavefront out. Trajectory-based (a wave needs frames to form), for class-[C]
 *  forces whose effect can't be read from a single frame-0 apply on an empty grid. */
export function endsFartherOut(minGain = 1.05): Expectation {
  return {
    label: 'rides the wavefront outward',
    kind: 'invariant',
    check(r) {
      const b = r.body;
      const first = r.trajectory[0]![0]!;
      const last = r.trajectory[r.trajectory.length - 1]![0]!;
      const r0 = Math.hypot(first.x - b.cx, first.y - b.cy) || 1;
      const rN = Math.hypot(last.x - b.cx, last.y - b.cy);
      return ok(rN > r0 * minGain, `r ${f3(r0)}→${f3(rN)}`, `> ${minGain}× (outward)`);
    },
  };
}

/** The exact frame-0 Δv matches the spec formula. */
export function exactDelta(dvx: number, dvy: number, tol = 2e-3): Expectation {
  return {
    label: `Δv = (${f3(dvx)}, ${f3(dvy)})`,
    kind: 'exact',
    check(r) {
      const a = r.applyDelta[0]!;
      const pass = Math.abs(a.dvx - dvx) < tol && Math.abs(a.dvy - dvy) < tol;
      return ok(pass, `(${f3(a.dvx)}, ${f3(a.dvy)})`, `(${f3(dvx)}, ${f3(dvy)}) ±${tol}`);
    },
  };
}

/** Speed is preserved by the force (rotation only): |v+Δv| ≈ |v|. */
export function speedPreserved(tol = 0.02): Expectation {
  return {
    label: 'speed preserved (no work done)',
    kind: 'invariant',
    check(r) {
      const p = r.scenario.particles[0]!;
      const vx = p.vx ?? 0;
      const vy = p.vy ?? 0;
      const before = Math.hypot(vx, vy) || 1;
      const a = r.applyDelta[0]!;
      const after = Math.hypot(vx + a.dvx, vy + a.dvy);
      const rel = Math.abs(after - before) / before;
      return ok(rel < tol, `|v| ${f3(before)} → ${f3(after)}`, `±${(tol * 100).toFixed(0)}%`);
    },
  };
}

/** The force bleeds speed without redirecting (drag): final speed < initial, same heading. */
export function speedReduced(): Expectation {
  return {
    label: 'speed bled off',
    kind: 'invariant',
    check(r) {
      const p = r.scenario.particles[0]!;
      const before = Math.hypot(p.vx ?? 0, p.vy ?? 0) || 1;
      const a = r.applyDelta[0]!;
      const after = Math.hypot((p.vx ?? 0) + a.dvx, (p.vy ?? 0) + a.dvy);
      return ok(after < before - 1e-6, `|v| ${f3(before)} → ${f3(after)}`, '< initial');
    },
  };
}

/** The force is perpendicular to velocity (does no work): Δv·v ≈ 0, Δv ≠ 0. */
export function perpendicularToVelocity(tol = 1e-3): Expectation {
  return {
    label: 'force ⟂ velocity (no work)',
    kind: 'invariant',
    check(r) {
      const p = r.scenario.particles[0]!;
      const a = r.applyDelta[0]!;
      const dot = (p.vx ?? 0) * a.dvx + (p.vy ?? 0) * a.dvy;
      const mag = Math.hypot(a.dvx, a.dvy);
      return ok(mag > 1e-6 && Math.abs(dot) < tol, `Δv·v = ${f3(dot)}, |Δv| = ${f3(mag)}`, '≈ 0, |Δv| > 0');
    },
  };
}

/** Total frame-0 momentum change across the particle set is ≈ 0 (e.g. an elastic collision). */
export function momentumConserved(tol = 1e-6): Expectation {
  return {
    label: 'momentum conserved across the pair',
    kind: 'invariant',
    check(r) {
      let sx = 0;
      let sy = 0;
      for (const a of r.applyDelta) {
        sx += a.dvx;
        sy += a.dvy;
      }
      return ok(Math.hypot(sx, sy) < tol, `Σ Δp = ${f3(Math.hypot(sx, sy))}`, '≈ 0');
    },
  };
}

const distAt = (r: ScenarioResult, frame: number, i: number, j: number) => {
  const a = r.trajectory[frame]![i]!;
  const b = r.trajectory[frame]![j]!;
  return Math.hypot(a.x - b.x, a.y - b.y);
};

/** Over the run, two particles end farther apart than they began (they repel/separate). */
export function separates(i = 0, j = 1): Expectation {
  return {
    label: 'the two particles separate',
    kind: 'invariant',
    check(r) {
      const start = distAt(r, 0, i, j);
      const end = distAt(r, r.trajectory.length - 1, i, j);
      return ok(end > start + 1e-6, `gap ${f3(start)} → ${f3(end)}`, 'end > start');
    },
  };
}

const distToBody = (r: ScenarioResult, frame: number, i = 0) => {
  const p = r.trajectory[frame]![i]!;
  return Math.hypot(p.x - r.body.cx, p.y - r.body.cy);
};

/** Over the run, the test particle ends closer to the body than it began. */
export function approachesBody(): Expectation {
  return {
    label: 'ends closer to the body',
    kind: 'invariant',
    check(r) {
      const start = distToBody(r, 0);
      const end = distToBody(r, r.trajectory.length - 1);
      return ok(end < start - 1e-6, `dist ${f3(start)} → ${f3(end)}`, 'end < start');
    },
  };
}

/** Over the run, the test particle ends farther from the body than it began. */
export function recedesFromBody(): Expectation {
  return {
    label: 'ends farther from the body',
    kind: 'invariant',
    check(r) {
      const start = distToBody(r, 0);
      const end = distToBody(r, r.trajectory.length - 1);
      return ok(end > start + 1e-6, `dist ${f3(start)} → ${f3(end)}`, 'end > start');
    },
  };
}

/** The test particle gains heat over the run. */
export function heats(): Expectation {
  return {
    label: 'particle gains heat',
    kind: 'invariant',
    check(r) {
      const end = r.trajectory[r.trajectory.length - 1]![0]!;
      return ok(end.heat > 1e-4, `heat = ${f3(end.heat)}`, '> 0');
    },
  };
}

// ── checks that do a controlled direct apply via the registry ────────────────────

function probeEnv(over: Partial<Env> = {}): Env {
  return {
    dx: 0,
    dy: 0,
    dist: 1,
    form: { driftX: 0, wander: 0, orbit: 0, spread: 0, conv: 0 },
    W: 1200,
    H: 800,
    t: 0,
    frameN: 0,
    dt: 1,
    c: 12,
    G: 1,
    spark: () => {},
    supernova: () => {},
    spawn: () => {},
    neighbors: () => [],
    grid: () => ({ sample: () => 0, deposit: () => {}, gradient: () => ({ x: 0, y: 0 }) }),
    ...over,
  };
}

function cloneParticle(p: import('./types.ts').ScenarioParticle): Particle {
  return {
    x: p.x,
    y: p.y,
    vx: p.vx ?? 0,
    vy: p.vy ?? 0,
    m: 1,
    heat: p.heat ?? 0,
    size: p.size ?? 1,
    cap: null,
    ...(p.charge != null ? { charge: p.charge } : {}),
    ...(p.color != null ? { color: p.color } : {}),
  };
}

/** Beyond ~1.6× range the force does nothing (the integrator's cull / each force's cutoff). */
export function noEffectBeyondRange(): Expectation {
  return {
    label: 'no effect beyond range',
    kind: 'invariant',
    check(r) {
      const force = allForces()[r.scenario.force]!;
      const range = r.body.range || 300;
      const p = cloneParticle({ x: r.body.cx + range * 2, y: r.body.cy });
      const env = probeEnv({ dx: r.body.cx - p.x, dy: r.body.cy - p.y, dist: range * 2 });
      const vx0 = p.vx;
      const vy0 = p.vy;
      force.apply(r.body, p, env);
      const mag = Math.hypot(p.vx - vx0, p.vy - vy0);
      return ok(mag < 1e-9, `|Δv| = ${f3(mag)} at 2× range`, '≈ 0');
    },
  };
}

/** A field-buffer force deposits a mark and steers along the grid gradient (§20.1 [C]). */
export function followsGradient(gx: number, gy: number): Expectation {
  return {
    label: 'deposits + follows the grid gradient',
    kind: 'invariant',
    check(r) {
      const force = allForces()[r.scenario.force]!;
      const deposits: number[][] = [];
      const grid: ScalarGrid = {
        sample: () => 0.5,
        deposit: (x, y, a) => deposits.push([x, y, a]),
        gradient: () => ({ x: gx, y: gy }),
      };
      const sp = r.scenario.particles[0]!;
      const p = cloneParticle(sp);
      const env = probeEnv({
        dx: r.body.cx - p.x,
        dy: r.body.cy - p.y,
        dist: Math.hypot(r.body.cx - p.x, r.body.cy - p.y) || 1,
        grid: () => grid,
      });
      const vx0 = p.vx;
      force.apply(r.body, p, env);
      const along = (p.vx - vx0) * gx + (p.vy - (sp.vy ?? 0)) * gy;
      void vx0;
      return ok(
        deposits.length > 0 && along > 0,
        `deposits ${deposits.length}, Δv·∇ = ${f3(along)}`,
        'deposits > 0, follows up-gradient',
      );
    },
  };
}

/** A modifier gates its siblings outside a heading cone and lets them act inside it. */
export function gatesOutsideCone(insideAngle: number, outsideAngle: number): Expectation {
  return {
    label: 'gates outside the cone, acts inside',
    kind: 'invariant',
    check(r) {
      const force = allForces()[r.scenario.force]!;
      if (!force.modify) return ok(false, 'no modify()', 'a modifier force');
      const at = (ang: number) => {
        const p = cloneParticle({ x: r.body.cx + Math.cos(ang) * 100, y: r.body.cy + Math.sin(ang) * 100 });
        const env = probeEnv({ dx: r.body.cx - p.x, dy: r.body.cy - p.y, dist: 100 });
        return force.modify!(r.body, p, env).gate === true;
      };
      const outGated = at(outsideAngle);
      const inGated = at(insideAngle);
      return ok(outGated && !inGated, `out=${outGated} in=${inGated}`, 'out=true, in=false');
    },
  };
}

/** The force does nothing to neutral (charge-free) matter. */
export function unaffectedWhenNeutral(): Expectation {
  return {
    label: 'neutral matter is unaffected',
    kind: 'invariant',
    check(r) {
      const force = allForces()[r.scenario.force]!;
      const p = cloneParticle(r.scenario.particles[0]!);
      delete (p as { charge?: number }).charge; // truly neutral
      const d = Math.hypot(r.body.cx - p.x, r.body.cy - p.y) || 1;
      const env = probeEnv({ dx: r.body.cx - p.x, dy: r.body.cy - p.y, dist: d });
      const vx0 = p.vx;
      const vy0 = p.vy;
      force.apply(r.body, p, env);
      const mag = Math.hypot(p.vx - vx0, p.vy - vy0);
      return ok(mag < 1e-9, `|Δv| = ${f3(mag)} (q = 0)`, '≈ 0');
    },
  };
}

/** The particle adopts and carries the body's tint on overlap (conserved colour). */
export function adoptsTint(): Expectation {
  return {
    label: 'adopts and carries the tint',
    kind: 'invariant',
    check(r) {
      const force = allForces()[r.scenario.force]!;
      const p = cloneParticle(r.scenario.particles[0]!);
      const d = Math.hypot(r.body.cx - p.x, r.body.cy - p.y) || 1;
      const env = probeEnv({ dx: r.body.cx - p.x, dy: r.body.cy - p.y, dist: d });
      force.apply(r.body, p, env);
      return ok(!!p.color, `color = ${p.color ?? 'none'}`, 'set to the body tint');
    },
  };
}

/** A modifier scales sibling strength as 1 + sin(ω·t) over time. */
export function modulatesStrength(): Expectation {
  return {
    label: 'strength oscillates as 1 + sin(ωt)',
    kind: 'invariant',
    check(r) {
      const force = allForces()[r.scenario.force]!;
      if (!force.modify) return ok(false, 'no modify()', 'a modifier force');
      const p = cloneParticle(r.scenario.particles[0]!);
      let min = Infinity;
      let max = -Infinity;
      for (let i = 0; i < 64; i++) {
        const env = probeEnv({ t: i / 8, dx: 1, dy: 0, dist: 1 });
        const s = force.modify(r.body, p, env).strength ?? 1;
        min = Math.min(min, s);
        max = Math.max(max, s);
      }
      // a clean sinusoid swings roughly [0, 2] (around 1)
      return ok(min < 0.2 && max > 1.8, `range [${f3(min)}, ${f3(max)}]`, '≈ [0, 2]');
    },
  };
}
