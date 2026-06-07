/**
 * RelationshipAgent (system-contracts §7) — an active connection between two bodies. It is not
 * merely a rendered line: it carries strength, tension, and memory; it strengthens with use and
 * decays over time; it can transfer attention and emit thresholded events.
 *
 * The dynamics here are pure (plain state + dt), so they are deterministic and node-testable. The
 * rendering (a line, a current) and the DOM event dispatch live in the field loop / feedback layer.
 */
import { Thresholder } from './event-agent.ts';

export interface RelationshipAgent {
  id: string;
  /** body ids. */
  from: string;
  to: string;
  /** relationship kind, e.g. 'cites', 'reply', 'depends'. */
  type: string;
  /** active coupling strength ∈ [0,1]. */
  strength: number;
  /** instantaneous strain ∈ [0,1] (e.g. distance vs. desired). */
  tension: number;
  /** slow-moving accumulated familiarity ∈ [0,1]. */
  memory: number;
  /** whether it was used this tick. */
  active: boolean;
}

export interface RelationshipDynamics {
  /** strength gained per second while active. */
  strengthen: number;
  /** strength lost per second while idle. */
  decay: number;
  /** memory gained per second while active (lost at half-rate while idle). */
  remember: number;
}

export const DEFAULT_RELATIONSHIP_DYNAMICS: RelationshipDynamics = {
  strengthen: 1.5,
  decay: 0.3,
  remember: 0.2,
};

const clamp01 = (n: number): number => (n < 0 ? 0 : n > 1 ? 1 : n);

/**
 * Advance a relationship one step. `active` is whether it was exercised this tick (a click, a
 * traversal, attention flowing across it); `tension` is the current strain. Strengthens toward 1
 * while active, decays toward 0 while idle, and memory follows more slowly — so a long-used
 * relationship stays warm after a pause, while a one-off fades.
 */
export function updateRelationship(
  r: RelationshipAgent,
  active: boolean,
  tension: number,
  dt: number,
  dyn: RelationshipDynamics = DEFAULT_RELATIONSHIP_DYNAMICS,
): void {
  r.active = active;
  r.tension = clamp01(tension);
  r.strength = clamp01(r.strength + (active ? dyn.strengthen : -dyn.decay) * dt);
  r.memory = clamp01(r.memory + (active ? dyn.remember : -dyn.remember * 0.5) * dt);
}

/**
 * Attention transferred across a relationship: a fraction of the source body's attention flows to
 * the target, scaled by the live strength. Pure — returns the amount to add at `to` and remove at
 * `from` (the caller applies it, conserving the budget).
 */
export function attentionTransfer(r: RelationshipAgent, fromAttention: number, rate = 0.25): number {
  return fromAttention * r.strength * rate;
}

/** A relationship paired with a strength thresholder, for `field:relationship-strengthened` events. */
export interface WatchedRelationship {
  agent: RelationshipAgent;
  threshold: Thresholder;
}

/** Build a watched relationship with a sensible strengthen/weaken threshold. */
export function watchRelationship(agent: RelationshipAgent, debounceMs = 400): WatchedRelationship {
  return { agent, threshold: new Thresholder({ enter: 0.6, exit: 0.3, debounceMs }) };
}
