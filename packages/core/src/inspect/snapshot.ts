/**
 * Snapshot regression (testing-and-conformance §12). Run a seeded scenario through the real engine
 * and capture a small, deterministic fingerprint of the result — particle count and mean speed /
 * heat at the final frame. Because the runner is deterministic (seeded RNG), the same scenario
 * always yields the same snapshot, so a snapshot saved today catches an accidental physics change
 * tomorrow. Pure aside from running the (pure) simulation.
 */
import type { Scenario } from '../conformance/types.ts';
import { runScenario } from '../conformance/run.ts';

export interface SceneSnapshot {
  force: string;
  frames: number;
  seed: number;
  particleCount: number;
  meanSpeed: number;
  meanHeat: number;
}

const mean = (xs: number[]): number => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const round = (n: number): number => Math.round(n * 1e6) / 1e6;

/** Capture a deterministic snapshot of a scenario's final frame. */
export function captureSnapshot(scenario: Scenario): SceneSnapshot {
  const result = runScenario(scenario);
  const last = result.trajectory[result.trajectory.length - 1] ?? [];
  return {
    force: scenario.force,
    frames: scenario.frames,
    seed: scenario.seed ?? 0,
    particleCount: last.length,
    meanSpeed: round(mean(last.map((p) => p.speed))),
    meanHeat: round(mean(last.map((p) => p.heat))),
  };
}

/** Compare two snapshots; returns a list of fields that differ beyond `tol` (empty = match). */
export function compareSnapshot(a: SceneSnapshot, b: SceneSnapshot, tol = 1e-6): string[] {
  const diffs: string[] = [];
  if (a.force !== b.force) diffs.push(`force: ${a.force} → ${b.force}`);
  if (a.particleCount !== b.particleCount) diffs.push(`particleCount: ${a.particleCount} → ${b.particleCount}`);
  if (Math.abs(a.meanSpeed - b.meanSpeed) > tol) diffs.push(`meanSpeed: ${a.meanSpeed} → ${b.meanSpeed}`);
  if (Math.abs(a.meanHeat - b.meanHeat) > tol) diffs.push(`meanHeat: ${a.meanHeat} → ${b.meanHeat}`);
  return diffs;
}
