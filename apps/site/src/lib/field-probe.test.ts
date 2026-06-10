/**
 * Per-force demo accuracy — proves every field-line trace exhibits the characteristic
 * behavior of the force it claims to show, run with the SAME live demo attributes the
 * page renders (via `DEMO_OVERRIDES`). Each check is a robust invariant of the force's
 * definition (attract → inward, swirl → orbits, magnetism → curves, gate → reflects, …),
 * measured on the real engine trajectory. A failure means the on-page demo does not
 * actually demonstrate its force.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { traceRaw, traceDipole, WARP_PAIR_D, WARP_THROAT, type RawTrace } from './field-probe.ts';
import { DEMO_OVERRIDES } from './demo-forces.ts';

const mean = (xs: number[]): number => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const std = (xs: number[]): number => {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
};

interface Part {
  i: number;
  x0: number; y0: number; xN: number; yN: number;
  vx0: number; vy0: number; vxN: number; vyN: number;
  r0: number; rN: number; sp0: number; spN: number;
  turn: number; sweep: number; capN: boolean;
  peakAlong: number; // max velocity projected on heading, over the whole run (catches a jet relaunch)
  rebounded: boolean; // started moving inward, later moved radially outward (a collision bounce)
}
interface Analysis {
  parts: Part[];
  cx: number; cy: number;
  headingX: number; headingY: number;
  initCount: number; finalCount: number;
  body: RawTrace['result']['body'];
}

function analyze(raw: RawTrace): Analysis {
  const traj = raw.result.trajectory;
  const { cx, cy } = raw.result.body;
  const a = (raw.angleDeg * Math.PI) / 180;
  const headingX = Math.cos(a), headingY = Math.sin(a);
  const n0 = traj[0]!.length;
  const parts: Part[] = [];
  for (let i = 0; i < n0; i++) {
    const states: { x: number; y: number; vx: number; vy: number; cap?: boolean }[] = [];
    for (let f = 0; f < traj.length; f++) {
      const p = traj[f]![i];
      if (!p) break;
      states.push(p);
    }
    if (states.length < 2) continue;
    const A = states[0]!, B = states[states.length - 1]!;
    let turn = 0, sweep = 0, peakAlong = -Infinity, everOut = false;
    const startedIn = (A.x - cx) * A.vx + (A.y - cy) * A.vy < 0; // moving radially inward at frame 0
    for (let k = 0; k < states.length; k++) {
      const v = states[k]!;
      peakAlong = Math.max(peakAlong, v.vx * headingX + v.vy * headingY);
      if ((v.x - cx) * v.vx + (v.y - cy) * v.vy > 0.5) everOut = true; // moving radially outward
      if (k === 0) continue;
      const u = states[k - 1]!;
      const du = Math.hypot(u.vx, u.vy) || 1, dv = Math.hypot(v.vx, v.vy) || 1;
      let dot = (u.vx * v.vx + u.vy * v.vy) / (du * dv);
      dot = Math.max(-1, Math.min(1, dot));
      turn += Math.acos(dot);
      const a0 = Math.atan2(u.y - cy, u.x - cx), a1 = Math.atan2(v.y - cy, v.x - cx);
      let d = a1 - a0;
      while (d > Math.PI) d -= 2 * Math.PI;
      while (d < -Math.PI) d += 2 * Math.PI;
      sweep += d;
    }
    parts.push({
      i,
      x0: A.x, y0: A.y, xN: B.x, yN: B.y,
      vx0: A.vx, vy0: A.vy, vxN: B.vx, vyN: B.vy,
      r0: Math.hypot(A.x - cx, A.y - cy), rN: Math.hypot(B.x - cx, B.y - cy),
      sp0: Math.hypot(A.vx, A.vy), spN: Math.hypot(B.vx, B.vy),
      turn, sweep: Math.abs(sweep), capN: !!B.cap,
      peakAlong, rebounded: startedIn && everOut,
    });
  }
  return {
    parts, cx, cy, headingX, headingY,
    initCount: n0, finalCount: traj[traj.length - 1]!.length,
    body: raw.result.body,
  };
}

// displacement of a part projected on the heading
const along = (p: Part, A: Analysis): number => (p.xN - p.x0) * A.headingX + (p.yN - p.y0) * A.headingY;
const centroidR = (parts: Part[], pick: (p: Part) => [number, number]): number => {
  const xs = parts.map((p) => pick(p)[0]), ys = parts.map((p) => pick(p)[1]);
  const mx = mean(xs), my = mean(ys);
  return mean(parts.map((p) => Math.hypot(pick(p)[0] - mx, pick(p)[1] - my)));
};

/** Each check returns a human-readable measurement + a pass boolean. */
type Check = (A: Analysis) => { ok: boolean; detail: string };

const CHECKS: Record<string, Check> = {
  // ── canonical nine ──────────────────────────────────────────────────────────
  attract: (A) => {
    const r0 = mean(A.parts.map((p) => p.r0)), rN = mean(A.parts.map((p) => p.rN));
    return { ok: rN < r0 * 0.92, detail: `meanR ${r0.toFixed(0)}→${rN.toFixed(0)} (want inward)` };
  },
  repel: (A) => {
    const r0 = mean(A.parts.map((p) => p.r0)), rN = mean(A.parts.map((p) => p.rN));
    return { ok: rN > r0 * 1.08, detail: `meanR ${r0.toFixed(0)}→${rN.toFixed(0)} (want outward)` };
  },
  swirl: (A) => {
    const sweep = mean(A.parts.map((p) => p.sweep));
    const r0 = mean(A.parts.map((p) => p.r0)), rN = mean(A.parts.map((p) => p.rN));
    return { ok: sweep > 0.5 && rN > r0 * 0.4, detail: `sweep ${sweep.toFixed(2)}rad, meanR ${r0.toFixed(0)}→${rN.toFixed(0)} (orbit, not collapse)` };
  },
  stream: (A) => {
    const d = mean(A.parts.map((p) => along(p, A)));
    return { ok: d > 20, detail: `along-heading disp ${d.toFixed(0)} (want >20)` };
  },
  viscosity: (A) => {
    const sp0 = mean(A.parts.map((p) => p.sp0)), spN = mean(A.parts.map((p) => p.spN));
    return { ok: spN < sp0 * 0.6, detail: `meanSpeed ${sp0.toFixed(2)}→${spN.toFixed(2)} (want bled off)` };
  },
  jet: (A) => {
    const peak = Math.max(...A.parts.map((p) => p.peakAlong));
    return { ok: peak > 2, detail: `peak relaunch speed along heading ${peak.toFixed(2)} (want >2)` };
  },
  tether: (A) => {
    const rest = A.body.range * 0.6;
    const e0 = mean(A.parts.map((p) => Math.abs(p.r0 - rest))), eN = mean(A.parts.map((p) => Math.abs(p.rN - rest)));
    return { ok: eN < e0 * 0.8, detail: `|r-rest| ${e0.toFixed(0)}→${eN.toFixed(0)} (want converge to shell)` };
  },
  wall: (A) => {
    const bounced = A.parts.filter((p) => p.vx0 * p.vxN < 0 || p.vy0 * p.vyN < 0).length;
    return { ok: bounced > 0, detail: `${bounced} probes reversed a velocity component (want >0)` };
  },
  sink: (A) => {
    const caps = A.parts.filter((p) => p.capN).length;
    const r0 = mean(A.parts.map((p) => p.r0)), rN = mean(A.parts.map((p) => p.rN));
    return { ok: caps > 0 || rN < r0 * 0.6, detail: `${caps} captured, meanR ${r0.toFixed(0)}→${rN.toFixed(0)}` };
  },

  // ── natural primitives ──────────────────────────────────────────────────────
  gravity: (A) => {
    const r0 = mean(A.parts.map((p) => p.r0)), rN = mean(A.parts.map((p) => p.rN));
    return { ok: rN < r0 * 0.9, detail: `meanR ${r0.toFixed(0)}→${rN.toFixed(0)} (want strong inward)` };
  },
  charge: (A) => {
    // right-seeded probes got +q (repelled out), left-seeded got −q (attracted in) → groups separate.
    const right = A.parts.filter((p) => p.x0 - A.cx >= 0), left = A.parts.filter((p) => p.x0 - A.cx < 0);
    const sep0 = Math.abs(mean(right.map((p) => p.x0)) - mean(left.map((p) => p.x0)));
    const sepN = Math.abs(mean(right.map((p) => p.xN)) - mean(left.map((p) => p.xN)));
    const rOut = mean(right.map((p) => p.rN)) - mean(right.map((p) => p.r0));
    return { ok: sepN > sep0 * 1.05 || rOut > 0, detail: `+/- centroid sep ${sep0.toFixed(0)}→${sepN.toFixed(0)} (want demix)` };
  },
  magnetism: (A) => {
    const turn = mean(A.parts.map((p) => p.turn));
    return { ok: turn > 0.4, detail: `mean path turning ${turn.toFixed(2)}rad (want curved)` };
  },
  thermal: (A) => {
    const r0 = centroidR(A.parts, (p) => [p.x0, p.y0]), rN = centroidR(A.parts, (p) => [p.xN, p.yN]);
    return { ok: rN > r0 * 1.2, detail: `cluster spread ${r0.toFixed(0)}→${rN.toFixed(0)} (want agitate out)` };
  },
  collide: (A) => {
    // all seeded moving inward; an elastic contact rebounds at least one back outward.
    const out = A.parts.filter((p) => p.rebounded).length;
    return { ok: out > 0, detail: `${out} probes rebounded after contact (want >0)` };
  },
  diffuse: (A) => {
    const moved = mean(A.parts.map((p) => Math.hypot(p.xN - p.x0, p.yN - p.y0)));
    const r0 = mean(A.parts.map((p) => p.r0)), rN = mean(A.parts.map((p) => p.rN));
    return { ok: moved > 4 && rN <= r0 * 1.05, detail: `moved ${moved.toFixed(1)}, meanR ${r0.toFixed(0)}→${rN.toFixed(0)} (follow trail inward)` };
  },
  propagate: (A) => {
    // the expanding shock-train (pulse model) sweeps matter OUTWARD — probes ride the front out.
    const r0 = mean(A.parts.map((p) => p.r0)), rN = mean(A.parts.map((p) => p.rN));
    return { ok: rN > r0 * 1.05, detail: `meanR ${r0.toFixed(0)}→${rN.toFixed(0)} (want ride front outward)` };
  },
  memory: (A) => {
    const r0 = mean(A.parts.map((p) => p.r0)), rN = mean(A.parts.map((p) => p.rN));
    return { ok: rN < r0 * 0.92, detail: `meanR ${r0.toFixed(0)}→${rN.toFixed(0)} (want inward)` };
  },

  // ── designed-extended ───────────────────────────────────────────────────────
  lens: (A) => {
    // a lens only rotates velocity — it never ADDS energy (so spN ≤ sp0, friction aside), and the
    // path bends a moderate amount (not a tight blur of full loops). Absolute speed decays from
    // friction regardless, so checking "speed preserved" is wrong; check "no energy added + bends".
    const sp0 = mean(A.parts.map((p) => p.sp0)), spN = mean(A.parts.map((p) => p.spN));
    const turn = mean(A.parts.map((p) => p.turn));
    return { ok: turn > 0.15 && turn < 6 && spN <= sp0 * 1.05, detail: `turn ${turn.toFixed(2)}rad, speed ${sp0.toFixed(2)}→${spN.toFixed(2)} (bend, no energy added)` };
  },
  gate: (A) => {
    // seeded against heading; the one-way membrane flips some to travel WITH the heading.
    const flipped = A.parts.filter((p) => (p.vx0 * A.headingX + p.vy0 * A.headingY) < 0 && (p.vxN * A.headingX + p.vyN * A.headingY) > 0).length;
    return { ok: flipped > 0, detail: `${flipped} probes reflected to pass-direction (want >0)` };
  },
  buoyancy: (A) => {
    const s0 = std(A.parts.map((p) => p.y0 - A.cy)), sN = std(A.parts.map((p) => p.yN - A.cy));
    return { ok: sN > s0 * 1.2, detail: `vertical spread ${s0.toFixed(0)}→${sN.toFixed(0)} (want density sort)` };
  },
  shear: (A) => {
    // heading vertical → vertical velocity grows with horizontal offset; opposite signs each side.
    const right = A.parts.filter((p) => p.x0 - A.cx > 5), left = A.parts.filter((p) => p.x0 - A.cx < -5);
    const vr = mean(right.map((p) => p.vyN)), vl = mean(left.map((p) => p.vyN));
    return { ok: Math.sign(vr) !== Math.sign(vl) && Math.abs(vr - vl) > 0.05, detail: `vy right ${vr.toFixed(2)} vs left ${vl.toFixed(2)} (want shear gradient)` };
  },
  crystallize: (A) => {
    const sp0 = mean(A.parts.map((p) => p.sp0)), spN = mean(A.parts.map((p) => p.spN));
    return { ok: spN < sp0 * 0.5, detail: `meanSpeed ${sp0.toFixed(2)}→${spN.toFixed(2)} (want snap/lock)` };
  },
  align: (A) => {
    const a0 = std(A.parts.map((p) => Math.atan2(p.vy0, p.vx0)));
    const aN = std(A.parts.map((p) => Math.atan2(p.vyN, p.vxN)));
    return { ok: aN < a0 * 0.7, detail: `heading spread ${a0.toFixed(2)}→${aN.toFixed(2)}rad (want converge)` };
  },
  wind: (A) => {
    const moved = mean(A.parts.map((p) => Math.hypot(p.xN - p.x0, p.yN - p.y0)));
    return { ok: moved > 12, detail: `mean drift ${moved.toFixed(1)} (want >12, curl meander)` };
  },
  cohesion: (A) => {
    const r0 = centroidR(A.parts, (p) => [p.x0, p.y0]), rN = centroidR(A.parts, (p) => [p.xN, p.yN]);
    return { ok: rN < r0 * 1.02, detail: `cluster radius ${r0.toFixed(0)}→${rN.toFixed(0)} (want surface tension hold/tighten)` };
  },
  pressure: (A) => {
    const r0 = centroidR(A.parts, (p) => [p.x0, p.y0]), rN = centroidR(A.parts, (p) => [p.xN, p.yN]);
    return { ok: rN > r0 * 1.05, detail: `cluster radius ${r0.toFixed(0)}→${rN.toFixed(0)} (want even-fill expand)` };
  },
  hunt: (A) => {
    const pred = A.parts.find((p) => p.i === 0);
    if (!pred) return { ok: false, detail: 'no predator probe' };
    const prey = A.parts.filter((p) => p.i !== 0);
    const d0 = Math.min(...prey.map((q) => Math.hypot(q.x0 - pred.x0, q.y0 - pred.y0)));
    const dN = Math.min(...prey.map((q) => Math.hypot(q.xN - pred.xN, q.yN - pred.yN)));
    return { ok: dN < d0, detail: `predator→nearest-prey ${d0.toFixed(0)}→${dN.toFixed(0)} (want chase closes)` };
  },
  spawn: (A) => ({ ok: A.finalCount > A.initCount, detail: `pool ${A.initCount}→${A.finalCount} (want source creates)` }),
  link: (A) => {
    // bonded cluster stays cohesive at a rest length (range·0.35); not collapsed, not exploded.
    const L = A.body.range * 0.35;
    const r = centroidR(A.parts, (p) => [p.xN, p.yN]);
    return { ok: r > L * 0.2 && r < L * 3, detail: `cluster radius ${r.toFixed(0)} vs rest L ${L.toFixed(0)} (want held)` };
  },
  morph: (A) => {
    const ts = (A.body.targets ?? []) as { x: number; y: number }[];
    if (!ts.length) return { ok: false, detail: 'no targets' };
    const md = (p: Part, x: number, y: number): number => Math.min(...ts.map((t) => Math.hypot(x - t.x, y - t.y)));
    const d0 = mean(A.parts.map((p) => md(p, p.x0, p.y0))), dN = mean(A.parts.map((p) => md(p, p.xN, p.yN)));
    return { ok: dN < d0 * 0.85, detail: `dist-to-target ${d0.toFixed(0)}→${dN.toFixed(0)} (want assemble)` };
  },
  resonate: (A) => {
    const r0 = mean(A.parts.map((p) => p.r0)), rN = mean(A.parts.map((p) => p.rN));
    return { ok: rN < r0 * 0.92, detail: `meanR ${r0.toFixed(0)}→${rN.toFixed(0)} (pulsing attract → inward)` };
  },
  fieldflow: (A) => {
    // probes are released at REST beside a magnet; only fieldflow's transport along the net
    // dipole field can move them — real drift from zero proves the field-follow does work.
    const moved = mean(A.parts.map((p) => Math.hypot(p.xN - p.x0, p.yN - p.y0)));
    const spN = mean(A.parts.map((p) => p.spN));
    return { ok: moved > 20 && spN > 0.3, detail: `mean drift ${moved.toFixed(1)} from rest, final speed ${spN.toFixed(2)} (want stream along the lines)` };
  },
  warp: (A) => {
    // probes driven into throat A must RELOCATE: end near the paired throat (down the
    // heading), not at A — and the pool is conserved (a wormhole, not a source or sink).
    const px = A.cx + A.headingX * WARP_PAIR_D, py = A.cy + A.headingY * WARP_PAIR_D;
    const relocated = A.parts.filter((p) => Math.hypot(p.xN - px, p.yN - py) < WARP_THROAT * 2).length;
    const conserved = A.finalCount === A.initCount;
    return { ok: relocated >= A.parts.length / 2 && conserved, detail: `${relocated}/${A.parts.length} probes emerged at the pair, pool ${A.initCount}→${A.finalCount} (want relocation, conserved)` };
  },
  spotlight: (A) => {
    // stream gated to a cone around the heading: probes inside the cone travel along it; outside don't.
    const inCone = (p: Part): boolean => {
      const dx = p.x0 - A.cx, dy = p.y0 - A.cy, d = Math.hypot(dx, dy) || 1;
      return (dx / d) * A.headingX + (dy / d) * A.headingY > 0.5;
    };
    const inside = A.parts.filter(inCone), outside = A.parts.filter((p) => !inCone(p));
    if (!inside.length || !outside.length) return { ok: false, detail: 'cone groups empty' };
    const di = mean(inside.map((p) => along(p, A))), dout = mean(outside.map((p) => along(p, A)));
    return { ok: di > dout + 5, detail: `along-heading inside ${di.toFixed(0)} vs outside ${dout.toFixed(0)} (want cone gate)` };
  },
};

for (const [token, check] of Object.entries(CHECKS)) {
  test(`demo accurate: ${token}`, () => {
    const override = DEMO_OVERRIDES[token];
    const raw = traceRaw(token, override);
    assert.ok(raw, `${token}: traceRaw returned null`);
    const A = analyze(raw!);
    assert.ok(A.parts.length > 0 || token === 'spawn', `${token}: no probe trajectories`);
    const { ok, detail } = check(A);
    assert.ok(ok, `${token} — ${detail}`);
  });
}

// pigment is the one non-kinematic force: it tints, never moves matter. Verify it stays put.
test('demo accurate: pigment (no kinematic effect)', () => {
  // pigment's probe recipe is `special` (traceRaw returns null); the contract is "no force".
  // Assert the engine force itself never changes velocity by tracing it as a plain body.
  const raw = traceRaw('repel', { tokens: ['pigment'], strength: 1.5, range: 280, spin: 1, angleDeg: -90 });
  assert.ok(raw, 'pigment-as-body trace failed');
  const A = analyze(raw!);
  const moved = mean(A.parts.map((p) => Math.hypot(p.xN - p.x0, p.yN - p.y0)));
  assert.ok(moved < 2, `pigment must not move matter — mean displacement ${moved.toFixed(2)}`);
});

// Dipole field-line render (Stage B): magnetism and charge produce real traced field lines;
// everything else opts out (null), so only the dipole forces get the diagram overlay.
for (const token of ['magnetism', 'charge'] as const) {
  test(`dipole field lines: ${token} traces a non-empty diagram`, () => {
    const trace = traceDipole(token, DEMO_OVERRIDES[token]);
    assert.ok(trace, `${token} should produce a dipole trace`);
    assert.ok(trace!.paths.length >= 3, `${token} should draw multiple field lines`);
    assert.ok(
      trace!.paths.every((line) => line.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y))),
      `${token} field lines must be finite`,
    );
  });
}

test('dipole field lines: non-dipole forces opt out', () => {
  assert.equal(traceDipole('attract'), null);
  assert.equal(traceDipole('gravity'), null);
  assert.equal(traceDipole('swirl'), null);
});
