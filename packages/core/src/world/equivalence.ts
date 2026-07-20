/**
 * F1.4 — raw-field vs field-substrate equivalence harness (characterization only).
 *
 * The RAW field path is the authority: it is constructed directly (createField + addBody + tick), NOT
 * via the adapter. The adapted path routes the SAME construction through `DynamicsContract` + `hostWorld`.
 * Both are built from one fixture (identical compiled pattern, body identity/ordering, injected RNG,
 * clock/dt via tick, host geometry, placement, and transition count). Equivalence is compared at EVERY
 * transition, not only the final state.
 *
 * A clean pass establishes that the opaque field substrate preserves OBSERVABLE execution under the
 * declared conditions. It does NOT establish that the kernel represents or understands the field's laws.
 *
 * Field-aware (like the adapter); internal; not exported from the package entry.
 */
import { createField } from '../engine/field.ts';
import type { FieldHost } from '../engine/host.ts';
import type { FieldSnapshot } from '../engine/types.ts';
import type { CompiledPattern } from '../recipes/compile.ts';
import type { World, WorldStateSnapshot } from './world.ts';
import { hostWorld } from './kernel.ts';
import {
  worldFromCompiledPattern,
  fieldRuntimeDynamics,
  DEFAULT_FIELD_CONSTRUCTION,
} from './adapters/field-runtime.ts';
import type { FieldConstruction } from './adapters/field-runtime.ts';

// ── observable state & semantic trace ────────────────────────────────────────

export interface FieldObservableState {
  readonly id: string;
  readonly position?: { readonly x: number; readonly y: number; readonly z?: number };
  readonly metrics: Readonly<Record<string, number>>;
}

/** One step of a normalized semantic trace: the observable state of every body after that transition. */
export interface FieldSemanticStep {
  readonly step: number;
  readonly bodies: readonly FieldObservableState[];
  readonly bodyCount: number;
  readonly failure?: string;
}

// ── structural coverage (honest, per construct) ──────────────────────────────

export type CoverageClass =
  | 'represented'
  | 'substrate-owned'
  | 'observable-only'
  | 'lossy'
  | 'unavailable';

export interface CoverageEntry {
  readonly construct: string;
  readonly classification: CoverageClass;
}

/** No side map may upgrade a lossy/unavailable item to `represented`. */
export function structuralCoverage(): CoverageEntry[] {
  return [
    { construct: 'compiled attributes', classification: 'represented' },
    { construct: 'body identity', classification: 'represented' },
    { construct: 'relations', classification: 'represented' },
    { construct: 'dimensions', classification: 'observable-only' },
    { construct: 'snapshot state', classification: 'observable-only' },
    { construct: 'failure state', classification: 'observable-only' },
    { construct: 'force registry', classification: 'substrate-owned' },
    { construct: 'environment', classification: 'substrate-owned' },
    { construct: 'mutable runtime state', classification: 'substrate-owned' },
    { construct: 'rng', classification: 'substrate-owned' },
    { construct: 'time', classification: 'substrate-owned' },
    { construct: 'host geometry', classification: 'substrate-owned' },
    { construct: 'velocity / accumulated force', classification: 'lossy' },
    { construct: 'lifecycle callbacks', classification: 'unavailable' },
  ];
}

// ── snapshot fidelity ────────────────────────────────────────────────────────

export type SnapshotFidelity =
  | 'complete-restorable'
  | 'complete-nonrestorable'
  | 'partial-observable'
  | 'diagnostic-only';

/** The field snapshot exposes position + metrics but not velocity/registry/full state, and is not restorable. */
export const FIELD_SNAPSHOT_FIDELITY: SnapshotFidelity = 'partial-observable';

// ── conditional determinism ──────────────────────────────────────────────────

export interface EquivalenceConditions {
  readonly rngControlled: boolean;
  readonly timeControlled: boolean;
  readonly deltaControlled: boolean;
  readonly bodyOrderingControlled: boolean;
  readonly environmentControlled: boolean;
  readonly hostGeometryControlled: boolean;
}

export const CONTROLLED_CONDITIONS: EquivalenceConditions = {
  rngControlled: true,
  timeControlled: true,
  deltaControlled: true,
  bodyOrderingControlled: true,
  environmentControlled: true,
  hostGeometryControlled: true,
};

// ── fixture ──────────────────────────────────────────────────────────────────

export interface EquivalenceFixture {
  readonly compiled: CompiledPattern;
  readonly construction: FieldConstruction;
  readonly transitions: number;
  /** Declared numeric tolerance for floating-point fields (NOT a hidden test constant). */
  readonly tolerance: number;
  readonly conditions: EquivalenceConditions;
}

export function fixtureFrom(
  compiled: CompiledPattern,
  transitions: number,
  tolerance: number,
  construction: FieldConstruction = DEFAULT_FIELD_CONSTRUCTION,
): EquivalenceFixture {
  return { compiled, construction, transitions, tolerance, conditions: CONTROLLED_CONDITIONS };
}

// ── independent headless host (raw path must not use adapter internals) ───────

function headlessHost(width: number, height: number): { host: FieldHost; tick: () => void } {
  let frame: ((t: number) => void) | null = null;
  let t = 0;
  const root = { querySelectorAll: () => [], querySelector: () => null, contains: () => false } as unknown as ParentNode;
  const host: FieldHost = {
    root,
    viewport: () => ({ width, height, dpr: 1 }),
    scrollY: () => 0,
    scrollHeight: () => height,
    reducedMotion: () => false,
    hidden: () => false,
    raf: (cb) => {
      frame = cb;
      return 1;
    },
    cancelRaf: () => {
      frame = null;
    },
    createCanvas: () => {
      throw new Error('headless: no canvas');
    },
    onResize: () => () => {},
    onScroll: () => () => {},
    onVisibility: () => () => {},
    onInput: () => () => {},
    onBodyEvent: () => () => {},
  };
  return {
    host,
    tick: () => {
      t += 1000 / 60;
      const cb = frame;
      frame = null;
      cb?.(t);
    },
  };
}

function snapshotToStep(snap: FieldSnapshot, step: number): FieldSemanticStep {
  const bodies: FieldObservableState[] = snap.bodies.map((b) => ({
    id: b.id,
    ...(b.position ? { position: { x: b.position.x, y: b.position.y, z: b.position.z } } : {}),
    metrics: { ...b.metrics },
  }));
  return { step, bodies, bodyCount: bodies.length };
}

function readingToStep(reading: WorldStateSnapshot, step: number): FieldSemanticStep {
  return { step, bodies: reading.entities.map((e) => ({ id: e.id, ...(e.position ? { position: e.position } : {}), metrics: e.metrics ?? {} })), bodyCount: reading.entities.length };
}

// ── the two paths ────────────────────────────────────────────────────────────

/** RAW path — the authority. Constructed directly; NOT via the adapter. */
export function runRawPath(fixture: EquivalenceFixture): FieldSemanticStep[] {
  const { world } = worldFromCompiledPattern(fixture.compiled);
  const c = fixture.construction;
  const { host, tick } = headlessHost(c.hostWidth, c.hostHeight);
  const field = createField(undefined as never, { host, render: 'none', rng: c.makeRng(), now: c.makeNow() });
  world.entities.forEach((e, i) => {
    const rect = c.placement(i);
    const p = e.params;
    field.addBody({
      identity: { id: e.identity.id },
      tokens: [...e.tokens],
      ...(typeof p.strength === 'number' ? { strength: p.strength } : {}),
      ...(typeof p.range === 'number' ? { range: p.range } : {}),
      rect: () => rect,
    });
  });
  const trace: FieldSemanticStep[] = [snapshotToStep(field.snapshot() as FieldSnapshot, 0)];
  for (let s = 1; s <= fixture.transitions; s++) {
    tick();
    trace.push(snapshotToStep(field.snapshot() as FieldSnapshot, s));
  }
  field.destroy();
  return trace;
}

/** ADAPTED path — same construction, routed through DynamicsContract + hostWorld. */
export function runAdaptedPath(fixture: EquivalenceFixture): FieldSemanticStep[] {
  const { world } = worldFromCompiledPattern(fixture.compiled);
  const dynamics = fieldRuntimeDynamics(world, fixture.construction);
  const host = hostWorld(world, dynamics);
  const trace: FieldSemanticStep[] = [];
  const s0 = host.readState();
  if (s0.ok) trace.push(readingToStep(s0.value.reading, 0));
  for (let s = 1; s <= fixture.transitions; s++) {
    host.advance({ steps: 1 });
    const rs = host.readState();
    if (rs.ok) trace.push(readingToStep(rs.value.reading, s));
  }
  host.dispose();
  return trace;
}

// ── comparison ───────────────────────────────────────────────────────────────

export interface Divergence {
  readonly step: number;
  readonly bodyId?: string;
  readonly field: string;
  readonly detail: string;
}

export interface EquivalenceResult {
  readonly equivalent: boolean;
  readonly divergences: readonly Divergence[];
  readonly transitionsCompared: number;
  readonly tolerance: number;
  readonly conditions: EquivalenceConditions;
  readonly coverage: readonly CoverageEntry[];
  readonly snapshotFidelity: SnapshotFidelity;
}

/** Compare the two traces at EVERY transition. Exact for discrete; declared tolerance for floats. */
export function compareTraces(
  raw: readonly FieldSemanticStep[],
  adapted: readonly FieldSemanticStep[],
  fixture: EquivalenceFixture,
): EquivalenceResult {
  const divergences: Divergence[] = [];
  const tol = fixture.tolerance;
  if (raw.length !== adapted.length) {
    divergences.push({ step: -1, field: 'step-count', detail: `raw ${raw.length} vs adapted ${adapted.length}` });
  }
  const n = Math.min(raw.length, adapted.length);
  for (let i = 0; i < n; i++) {
    const r = raw[i]!;
    const a = adapted[i]!;
    if (r.bodyCount !== a.bodyCount) {
      divergences.push({ step: i, field: 'body-count', detail: `${r.bodyCount} vs ${a.bodyCount}` });
    }
    if (r.failure !== a.failure) {
      divergences.push({ step: i, field: 'failure', detail: `${r.failure ?? 'none'} vs ${a.failure ?? 'none'}` });
    }
    const m = Math.min(r.bodies.length, a.bodies.length);
    for (let j = 0; j < m; j++) {
      const rb = r.bodies[j]!;
      const ab = a.bodies[j]!;
      if (rb.id !== ab.id) {
        divergences.push({ step: i, bodyId: rb.id, field: 'body-identity/ordering', detail: `${rb.id} vs ${ab.id}` });
        continue;
      }
      if (rb.position && ab.position) {
        if (Math.abs(rb.position.x - ab.position.x) > tol) divergences.push({ step: i, bodyId: rb.id, field: 'position.x', detail: `${rb.position.x} vs ${ab.position.x}` });
        if (Math.abs(rb.position.y - ab.position.y) > tol) divergences.push({ step: i, bodyId: rb.id, field: 'position.y', detail: `${rb.position.y} vs ${ab.position.y}` });
      } else if (Boolean(rb.position) !== Boolean(ab.position)) {
        divergences.push({ step: i, bodyId: rb.id, field: 'position-presence', detail: 'one has position, the other does not' });
      }
      for (const key of Object.keys(rb.metrics)) {
        const rv = rb.metrics[key]!;
        const av = ab.metrics[key];
        if (av === undefined) divergences.push({ step: i, bodyId: rb.id, field: `metric.${key}`, detail: 'missing in adapted' });
        else if (Math.abs(rv - av) > tol) divergences.push({ step: i, bodyId: rb.id, field: `metric.${key}`, detail: `${rv} vs ${av}` });
      }
    }
  }
  return {
    equivalent: divergences.length === 0,
    divergences,
    transitionsCompared: n,
    tolerance: tol,
    conditions: fixture.conditions,
    coverage: structuralCoverage(),
    snapshotFidelity: FIELD_SNAPSHOT_FIDELITY,
  };
}

/** Final-state-only comparison — used ONLY to demonstrate it can false-pass where per-transition catches. */
export function compareFinalOnly(
  raw: readonly FieldSemanticStep[],
  adapted: readonly FieldSemanticStep[],
  fixture: EquivalenceFixture,
): boolean {
  const r = raw[raw.length - 1];
  const a = adapted[adapted.length - 1];
  if (!r || !a) return false;
  return compareTraces([r], [a], fixture).equivalent;
}
