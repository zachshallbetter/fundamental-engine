/**
 * Probe diagnostics (visualization-methods-taxonomy §3/§4, §11). Probes are instruments fired into
 * the field to read it: a force's *vector* at a point (Δv on a probe — `field magnitude != force
 * magnitude`), and the per-token *causality* breakdown of why motion happened. Works for body→
 * particle (class-A) forces; class-B/C/D forces need neighbours/grids the conformance runner wires.
 */
import type { Body, Particle, Env, Force, ForceRegistry, Formation, Vec2 } from '../core/types.ts';

/** An instrument particle. */
export interface Probe {
  vx: number;
  vy: number;
  charge: number;
  m: number;
  heat: number;
}

/** The standard probe set (viz-taxonomy §4). */
export const PROBE_PRESETS: Readonly<Record<string, Probe>> = {
  neutral: { vx: 0, vy: 0, charge: 0, m: 1, heat: 0 },
  positive: { vx: 1, vy: 0, charge: 1, m: 1, heat: 0 },
  negative: { vx: 1, vy: 0, charge: -1, m: 1, heat: 0 },
  still: { vx: 0, vy: 0, charge: 1, m: 1, heat: 0 },
  fast: { vx: 6, vy: 0, charge: 1, m: 1, heat: 0 },
  hot: { vx: 0, vy: 0, charge: 0, m: 1, heat: 1 },
  massive: { vx: 0, vy: 0, charge: 0, m: 6, heat: 0 },
};

function probeEnv(b: Body, x: number, y: number): Env {
  const dx = b.cx - x;
  const dy = b.cy - y;
  return {
    dx,
    dy,
    dist: Math.max(Math.hypot(dx, dy), 1),
    form: {} as Formation,
    c: 12,
    G: 1,
    t: 0,
  } as unknown as Env;
}

/**
 * The force vector a class-A force exerts on a probe at (x, y): the Δv from a single `apply()`. A
 * still or neutral probe correctly reads zero for velocity- or charge-dependent forces (magnetism,
 * charge) — that's the point of probes.
 */
export function forceVectorAt(force: Force, b: Body, x: number, y: number, probe: Probe = PROBE_PRESETS.neutral!): Vec2 {
  const p = {
    x,
    y,
    vx: probe.vx,
    vy: probe.vy,
    charge: probe.charge,
    m: probe.m,
    heat: probe.heat,
    size: 1,
    cap: null,
  } as unknown as Particle;
  try {
    force.apply(b, p, probeEnv(b, x, y));
  } catch {
    return { x: 0, y: 0 };
  }
  return { x: p.vx - probe.vx, y: p.vy - probe.vy };
}

export interface CausalContribution {
  token: string;
  dvx: number;
  dvy: number;
}

/** Decompose the motion at (x, y) into per-token contributions — the causality overlay's data. */
export function causalityAt(
  registry: ForceRegistry,
  tokens: readonly string[],
  b: Body,
  x: number,
  y: number,
  probe: Probe = PROBE_PRESETS.neutral!,
): CausalContribution[] {
  const out: CausalContribution[] = [];
  for (const t of tokens) {
    const f = registry[t];
    if (!f) continue;
    const v = forceVectorAt(f, b, x, y, probe);
    out.push({ token: t, dvx: v.x, dvy: v.y });
  }
  return out;
}
