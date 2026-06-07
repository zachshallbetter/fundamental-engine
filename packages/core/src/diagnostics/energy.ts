/**
 * Energy diagnostics (visualization-methods-taxonomy §7). Pure accounting over a particle set —
 * kinetic, thermal, and total energy, plus per-step drift. The data behind the "energy view": it
 * reads state, never mutates it (the energy view must not affect integration).
 */
import type { Particle } from '../core/types.ts';

/** Kinetic energy Σ ½·m·|v|². */
export function kineticEnergy(particles: readonly Particle[]): number {
  let k = 0;
  for (const p of particles) k += 0.5 * (p.m || 1) * (p.vx * p.vx + p.vy * p.vy);
  return k;
}

/** Thermal energy proxy Σ heat (agitation held as per-particle heat ∈ [0,1]). */
export function thermalEnergy(particles: readonly Particle[]): number {
  let t = 0;
  for (const p of particles) t += p.heat;
  return t;
}

export interface EnergyReport {
  kinetic: number;
  thermal: number;
  total: number;
  count: number;
}

/** A full energy snapshot for the dashboard. */
export function energyReport(particles: readonly Particle[]): EnergyReport {
  const kinetic = kineticEnergy(particles);
  const thermal = thermalEnergy(particles);
  return { kinetic, thermal, total: kinetic + thermal, count: particles.length };
}

/** Fractional energy drift between two snapshots — for stability/conservation checks. */
export function energyDrift(before: number, after: number): number {
  if (before === 0) return after === 0 ? 0 : Infinity;
  return Math.abs(after - before) / Math.abs(before);
}
