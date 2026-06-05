/**
 * Physics conformance (the Lab as a detector) — types.
 *
 * A `Scenario` fires a known particle (or particles) into a known force with known
 * attributes. `runScenario` (run.ts) simulates it with the real engine and returns
 * the trajectory plus the frame-0 force delta per particle. An `Expectation` is a
 * predicate over that result — an invariant ("moves toward the body", "speed
 * preserved", "momentum conserved") or an exact check against the spec formula. A
 * force "reacts appropriately" iff every expectation passes. The same catalog drives
 * the test suite and the Lab instrument.
 */
import type { Body } from '../core/types.ts';

/** A force's input class — decides how the runner wires the env (§20.1). */
export type ForceClass =
  | 'A' // body → particle (single particle, no services)
  | 'B' // particle ↔ particle (needs env.neighbors)
  | 'C' // field-buffer (needs env.grid)
  | 'D' // shape-assignment (springs matter to body.targets — a mark/chart, §20.3)
  | 'S' // source / sink (creates or destroys matter via env.spawn; budgeted, §20.1)
  | 'modifier'; // resonate / spotlight (no-op apply; affect siblings via modify())

/** Initial state for one injected particle. */
export interface ScenarioParticle {
  x: number;
  y: number;
  vx?: number;
  vy?: number;
  heat?: number;
  size?: number;
  charge?: number;
  color?: string;
  species?: number;
  /** stable scatter fraction in [0,1]; `morph` hashes it to a target index (§20.3 [D]). */
  gx?: number;
}

/** A controlled experiment: particle(s) sent into a force with specific attributes. */
export interface Scenario {
  /** the force under test (its token). */
  force: string;
  /** body tokens (default `[force]`); modifiers pair with a base, e.g. `['resonate','attract']`. */
  tokens?: string[];
  label: string;
  family: 'canonical' | 'natural' | 'extended';
  klass: ForceClass;
  /** body attributes — strength, range, spin, angle, M, cx, cy, hw, hh, on, … */
  body: Partial<Body>;
  /** initial particle state(s); `particles[0]` is the tracked test particle. */
  particles: ScenarioParticle[];
  /** how many frames to simulate. */
  frames: number;
  /** seed for RNG forces (thermal, jet) so the run is reproducible. */
  seed?: number;
}

/** One particle's state at one captured frame. */
export interface FrameState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  heat: number;
  speed: number;
}

/** The frame-0 force delta a particle receives (one direct `apply`, before friction). */
export interface ApplyDelta {
  dvx: number;
  dvy: number;
}

/** The result of simulating a scenario. */
export interface ScenarioResult {
  scenario: Scenario;
  /** `[frame][particleIndex]`, including frame 0 (the initial state). */
  trajectory: FrameState[][];
  /** per-particle frame-0 force effect (pure force, no friction) — for exact/invariant checks. */
  applyDelta: ApplyDelta[];
  /** the resolved full body (for `forceAt` field rendering in the Lab). */
  body: Body;
}

export interface ExpectationResult {
  pass: boolean;
  /** what was observed, formatted for display. */
  measured: string;
  /** what was required, formatted for display. */
  expected: string;
}

/** A single named check that defines part of "appropriate reaction". */
export interface Expectation {
  label: string;
  kind: 'invariant' | 'exact';
  check(result: ScenarioResult): ExpectationResult;
}

/** A force's full conformance spec: its experiment + the checks that define correctness. */
export interface ForceConformance {
  scenario: Scenario;
  expectations: Expectation[];
}
