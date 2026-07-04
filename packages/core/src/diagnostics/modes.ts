/**
 * The four debug/graph render modes (visualization-methods-taxonomy "Render Modes Catalog" —
 * previously `planned`): topology, inspector, causality, prediction. Each is a pure data/geometry
 * function (testable, no canvas) plus a thin `draw*` helper. Like the C1 overlays these *reveal*
 * state — they read bodies/agents/forces and never mutate physics.
 *
 *   topology    relationship-agent coupling graph (strength → width, memory → glow)
 *   inspector   a debug HUD of body/agent/metric/contract counts
 *   causality   per-force contribution to motion at a point (reuses causalityAt)
 *   prediction  a deterministic forward "ghost" trajectory of a probe under the body forces
 */
import type { Body, ForceRegistry } from '../engine/types.ts';
import type { RelationshipAgent } from '../agents/relationship.ts';
import { FRICTION } from '../engine/integrator.ts';
import { forceVectorAt, type CausalContribution } from './probes.ts';

type Ctx = CanvasRenderingContext2D;
type Pt = { x: number; y: number };

function arrow(ctx: Ctx, x: number, y: number, dx: number, dy: number, head = 4): void {
  const len = Math.hypot(dx, dy);
  if (len < 0.001) return;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + dx, y + dy);
  const a = Math.atan2(dy, dx);
  ctx.lineTo(x + dx - head * Math.cos(a - 0.4), y + dy - head * Math.sin(a - 0.4));
  ctx.moveTo(x + dx, y + dy);
  ctx.lineTo(x + dx - head * Math.cos(a + 0.4), y + dy - head * Math.sin(a + 0.4));
  ctx.stroke();
}

// ── topology ────────────────────────────────────────────────────────────────────
/** A relationship resolved to two endpoint positions, ready to draw. */
export interface TopologyEdge {
  from: Pt;
  to: Pt;
  type: string;
  /** active coupling strength ∈ [0,1] → line width. */
  strength: number;
  /** accumulated familiarity ∈ [0,1] → persistence glow. */
  memory: number;
  active: boolean;
}

/** Position lookup for a body id (returns undefined for unplaced bodies). */
export type PositionOf = (bodyId: string) => Pt | undefined;

/**
 * Resolve relationship agents to drawable edges via a position lookup. Agents whose endpoints have
 * no position are dropped (you can only draw what you can place). Pure.
 */
export function topologyEdges(agents: readonly RelationshipAgent[], posOf: PositionOf): TopologyEdge[] {
  const out: TopologyEdge[] = [];
  for (const a of agents) {
    const from = posOf(a.from);
    const to = posOf(a.to);
    if (!from || !to) continue;
    out.push({ from, to, type: a.type, strength: a.strength, memory: a.memory, active: a.active });
  }
  return out;
}

/** Draw the coupling graph: thicker = stronger, brighter = more memory, accent = active this tick. */
export function drawTopology(
  ctx: Ctx,
  agents: readonly RelationshipAgent[],
  posOf: PositionOf,
  opts: { color?: string; activeColor?: string; maxWidth?: number } = {},
): void {
  const color = opts.color ?? '77,163,255';
  const activeColor = opts.activeColor ?? '45,212,191';
  const maxWidth = opts.maxWidth ?? 4;
  ctx.save();
  for (const e of topologyEdges(agents, posOf)) {
    const alpha = 0.18 + 0.62 * e.memory;
    ctx.strokeStyle = `rgba(${e.active ? activeColor : color},${alpha.toFixed(3)})`;
    ctx.lineWidth = 0.5 + maxWidth * e.strength;
    ctx.beginPath();
    ctx.moveTo(e.from.x, e.from.y);
    ctx.lineTo(e.to.x, e.to.y);
    ctx.stroke();
  }
  ctx.restore();
}

// ── inspector ─────────────────────────────────────────────────────────────────────
/** A snapshot of system counts/metrics for the inspector HUD. */
export interface InspectorSnapshot {
  bodies?: number;
  particles?: number;
  agents?: number;
  relationships?: number;
  contracts?: number;
  metrics?: Record<string, number | string>;
}

export interface InspectorRow {
  label: string;
  value: string;
}

const fmt = (v: number | string): string => (typeof v === 'number' ? (Number.isInteger(v) ? String(v) : v.toFixed(3)) : v);

/** Flatten a snapshot to ordered label/value rows (counts first, then metrics). Pure. */
export function inspectorRows(snap: InspectorSnapshot): InspectorRow[] {
  const rows: InspectorRow[] = [];
  const add = (label: string, v: number | undefined) => {
    if (v !== undefined) rows.push({ label, value: fmt(v) });
  };
  add('bodies', snap.bodies);
  add('particles', snap.particles);
  add('agents', snap.agents);
  add('relationships', snap.relationships);
  add('contracts', snap.contracts);
  if (snap.metrics) for (const k of Object.keys(snap.metrics)) rows.push({ label: k, value: fmt(snap.metrics[k]!) });
  return rows;
}

/** Draw the inspector as a compact monospace panel (top-left by default). */
export function drawInspector(ctx: Ctx, snap: InspectorSnapshot, opts: { x?: number; y?: number; width?: number } = {}): void {
  const rows = inspectorRows(snap);
  const x = opts.x ?? 12;
  const y = opts.y ?? 12;
  const w = opts.width ?? 180;
  const lh = 16;
  const h = rows.length * lh + 10;
  ctx.save();
  ctx.font = '11px ui-monospace, monospace';
  ctx.fillStyle = 'rgba(11,11,16,0.78)';
  ctx.fillRect(x, y, w, h);
  rows.forEach((r, i) => {
    const yy = y + 8 + i * lh + 8;
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.fillText(r.label, x + 8, yy);
    ctx.fillStyle = '#4da3ff';
    ctx.textAlign = 'right';
    ctx.fillText(r.value, x + w - 8, yy);
    ctx.textAlign = 'left';
  });
  ctx.restore();
}

// ── causality ──────────────────────────────────────────────────────────────────────
/** A per-token causal contribution ranked by magnitude, with its share of the total. */
export interface CausalBar {
  token: string;
  magnitude: number;
  /** share of total |contribution| ∈ [0,1]. */
  fraction: number;
}

/** Rank causal contributions by magnitude (desc) with each one's fraction of the total. Pure. */
export function causalityBars(contribs: readonly CausalContribution[]): CausalBar[] {
  const mags = contribs.map((c) => ({ token: c.token, magnitude: Math.hypot(c.dvx, c.dvy) }));
  const total = mags.reduce((s, m) => s + m.magnitude, 0) || 1;
  return mags
    .map((m) => ({ token: m.token, magnitude: m.magnitude, fraction: m.magnitude / total }))
    .sort((a, b) => b.magnitude - a.magnitude);
}

/** Draw causality at a point: a vector per contributing force from the origin, plus a ranked bar list. */
export function drawCausality(
  ctx: Ctx,
  contribs: readonly CausalContribution[],
  origin: Pt,
  opts: { scale?: number; x?: number; y?: number; width?: number } = {},
): void {
  const scale = opts.scale ?? 8;
  ctx.save();
  // vectors from the probe origin
  ctx.strokeStyle = 'rgba(240,136,62,0.85)';
  ctx.lineWidth = 1.5;
  for (const c of contribs) arrow(ctx, origin.x, origin.y, c.dvx * scale, c.dvy * scale, 5);
  // ranked bars
  const bars = causalityBars(contribs);
  const bx = opts.x ?? origin.x + 14;
  const by = opts.y ?? origin.y + 14;
  const bw = opts.width ?? 120;
  ctx.font = '10px ui-monospace, monospace';
  bars.forEach((b, i) => {
    const yy = by + i * 14;
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fillRect(bx, yy, bw, 8);
    ctx.fillStyle = '#f0883e';
    ctx.fillRect(bx, yy, bw * b.fraction, 8);
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillText(b.token, bx + bw + 6, yy + 8);
  });
  ctx.restore();
}

// ── prediction ───────────────────────────────────────────────────────────────────
export interface GhostOptions {
  /** number of forward steps to simulate (default 60). */
  steps?: number;
  /** velocity damping per step (default = the integrator's FRICTION). */
  friction?: number;
  /** scale applied to summed force Δv per step (default 1). */
  forceScale?: number;
  /** the ghost probe's charge (for charge/magnetism forces; default 0). */
  charge?: number;
}

/**
 * A deterministic forward "ghost" trajectory: integrate one probe under the class-A body forces,
 * summing each (force, body) Δv per step and damping by friction — the same shape the real
 * integrator uses, kept dependency-light. Pure and repeatable: same inputs → same path. This is the
 * *prediction* overlay's data (an expected future path), not the live sim.
 */
export function ghostTrajectory(
  forces: ForceRegistry,
  tokens: readonly string[],
  bodies: readonly Body[],
  start: { x: number; y: number; vx: number; vy: number },
  opts: GhostOptions = {},
): Pt[] {
  const steps = opts.steps ?? 60;
  const friction = opts.friction ?? FRICTION;
  const scale = opts.forceScale ?? 1;
  const charge = opts.charge ?? 0;
  let x = start.x;
  let y = start.y;
  let vx = start.vx;
  let vy = start.vy;
  const path: Pt[] = [{ x, y }];
  for (let i = 0; i < steps; i++) {
    let ax = 0;
    let ay = 0;
    const probe = { vx, vy, charge, m: 1, heat: 0 };
    for (const t of tokens) {
      const f = forces[t];
      if (!f) continue;
      for (const b of bodies) {
        const v = forceVectorAt(f, b, x, y, probe);
        ax += v.x;
        ay += v.y;
      }
    }
    vx = (vx + ax * scale) * friction;
    vy = (vy + ay * scale) * friction;
    x += vx;
    y += vy;
    path.push({ x, y });
  }
  return path;
}

/** Draw a ghost trajectory as a dashed path that fades toward the predicted future. */
export function drawPrediction(ctx: Ctx, points: readonly Pt[], opts: { color?: string } = {}): void {
  if (points.length < 2) return;
  const color = opts.color ?? '255,255,255';
  ctx.save();
  ctx.setLineDash([3, 4]);
  ctx.lineWidth = 1.5;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    const alpha = 0.6 * (1 - i / points.length);
    ctx.strokeStyle = `rgba(${color},${alpha.toFixed(3)})`;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  ctx.restore();
}
