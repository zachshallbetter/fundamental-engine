/**
 * FieldRuntime adapter (F1.3/F1.4) — the ONE-WAY bridge, and the ONLY file in `world/` permitted to
 * import the field runtime. Direction:
 *
 *     CompiledPattern  →(worldFromCompiledPattern)→  generic World declarations
 *     World            →(fieldRuntimeDynamics)→      DynamicsContract over an OPAQUE field substrate
 *
 * The field runtime is an `opaque-native` execution substrate. It advertises ONLY what it genuinely
 * supports (lossy snapshot ⇒ no restore/replay), never claims declarative equivalence, and records that
 * behavioral interpretation is unresolved rather than asserting it. Evolution stays executable force
 * code inside the field (the F1.1 finding).
 */
import { createField } from '../../engine/field.ts';
import { FIELD_VERSION } from '../../version.ts';
import type { CompiledPattern } from '../../recipes/compile.ts';
import type { FieldHandle, FieldSnapshot } from '../../engine/types.ts';
import type { FieldHost } from '../../engine/host.ts';
import { createWorldEnvelope } from '../envelope.ts';
import type { WorldVersionEnvelope } from '../envelope.ts';
import type {
  EntityStateReading,
  ParamValue,
  World,
  WorldEntity,
  WorldInvariant,
  WorldProjection,
  WorldRelation,
  WorldStateSnapshot,
} from '../world.ts';
import type {
  DynamicsContract,
  DynamicsEvidence,
  DynamicsExecutionContext,
  DynamicsResult,
  DynamicsSnapshot,
  EvidenceRecord,
  Transition,
} from '../dynamics.ts';

export interface FieldRuntimeMappingReport {
  readonly preserved: readonly string[];
  readonly transformed: readonly string[];
  readonly omitted: readonly string[];
}

const NUMERIC_ATTRS: Record<string, string> = {
  'data-strength': 'strength',
  'data-range': 'range',
  'data-spin': 'spin',
  'data-angle': 'angle',
};

function paramsFromAttributes(attrs: Record<string, string>): Record<string, ParamValue> {
  const out: Record<string, ParamValue> = {};
  for (const [attr, value] of Object.entries(attrs)) {
    if (attr === 'data-body') continue;
    const key = NUMERIC_ATTRS[attr];
    if (key) {
      const n = Number(value);
      if (!Number.isNaN(n)) out[key] = n;
    } else if (value === '') {
      out[attr.replace(/^data-/, '')] = true;
    } else {
      out[attr.replace(/^data-/, '')] = value;
    }
  }
  return out;
}

/** Translate a compiled pattern into a generic World, with an explicit preserved/transformed/omitted map. */
export function worldFromCompiledPattern(
  compiled: CompiledPattern,
): { world: World; mapping: FieldRuntimeMappingReport } {
  const entities: WorldEntity[] = compiled.bodies.map((b, i) => {
    const attrs = b.attributes;
    const id = attrs['data-id'] ?? `body-${i}`;
    return {
      identity: { id, kind: attrs['data-body'] },
      tokens: b.tokens,
      params: paramsFromAttributes(attrs),
    };
  });

  const relations: WorldRelation[] = compiled.relationships.map((r) => ({
    from: r.from,
    to: r.to,
    type: r.type,
    ...(r.strength != null ? { strength: r.strength } : {}),
  }));

  const invariants: WorldInvariant[] = [];
  const expected = compiled.recipe.expected;
  if (expected) {
    if (expected.particleCount != null) {
      invariants.push({ id: 'particle-count', kind: 'count', spec: { metric: 'particles', value: expected.particleCount } });
    }
    if (expected.entropyRange) {
      invariants.push({ id: 'entropy-range', kind: 'range', spec: { metric: 'entropy', min: expected.entropyRange[0], max: expected.entropyRange[1] } });
    }
  }

  const projections: WorldProjection[] = [];
  if (compiled.render.underlay) projections.push({ id: 'underlay', surface: 'underlay', declares: [compiled.render.underlay] });
  if (compiled.render.overlay.length) projections.push({ id: 'overlay', surface: 'overlay', declares: compiled.render.overlay });
  if (compiled.feedback.length) projections.push({ id: 'feedback', surface: 'feedback', declares: compiled.feedback.map((f) => f.metric) });

  const world: World = {
    envelope: createWorldEnvelope(compiled.id, { worldSchema: '0.1.0' }),
    entities,
    relations,
    invariants,
    projections,
  };

  const mapping: FieldRuntimeMappingReport = {
    preserved: ['entity.identity', 'entity.tokens', 'relations', 'invariants(expected)'],
    transformed: ['data-* attribute bag → typed params', 'render/feedback → generic projections'],
    omitted: [
      'lawful evolution (force apply(b,p,env) code) — OPAQUE, stays in the field substrate',
      'live velocities / particle ids / registry / grids (unreconstructible closure state)',
    ],
  };
  return { world, mapping };
}

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

interface FieldState {
  readonly field: FieldHandle;
  readonly tick: () => void;
  readonly step: number;
  readonly envelope: WorldVersionEnvelope;
}

export interface FieldAdvanceInput {
  readonly steps?: number;
}

export interface FieldAdvanceOutput {
  readonly steps: number;
}

const SOURCE = { kind: 'substrate', id: 'field-runtime' } as const;

function record(id: string, kind: string, observedAt: number, payload: unknown): EvidenceRecord {
  return { id, kind, source: SOURCE, observedAt, payload };
}

function evidence(parts: Partial<DynamicsEvidence>): DynamicsEvidence {
  return {
    declaredInputs: parts.declaredInputs ?? [],
    substrateResponses: parts.substrateResponses ?? [],
    checkedInvariants: parts.checkedInvariants ?? [],
    executionTrace: parts.executionTrace ?? [],
    unresolvedInterpretations: parts.unresolvedInterpretations ?? [],
  };
}

/**
 * Controlled construction inputs for the field substrate. Owned by the FIXTURE (F1.4), NOT the adapter,
 * so a raw baseline and the adapted path can be built from identical inputs. The adapter is under test;
 * it must not define or regenerate the baseline.
 */
export interface FieldConstruction {
  readonly hostWidth: number;
  readonly hostHeight: number;
  /** Produces a FRESH identical PRNG stream on each call (raw and adapted paths must not share state). */
  readonly makeRng: () => () => number;
  /** Produces a FRESH identical clock on each call (controls `now`, so the wall clock is not an input). */
  readonly makeNow: () => () => number;
  readonly placement: (index: number) => { readonly left: number; readonly top: number; readonly width: number; readonly height: number };
}

export const DEFAULT_FIELD_CONSTRUCTION: FieldConstruction = {
  hostWidth: 400,
  hostHeight: 300,
  makeRng: () => {
    let seed = 1;
    return () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  },
  makeNow: () => {
    let t = 0;
    return () => (t += 1000 / 60);
  },
  placement: (i) => ({ left: 50 + (i % 5) * 60, top: 50 + Math.floor(i / 5) * 60, width: 40, height: 40 }),
};

/**
 * A DynamicsContract backed by the OPAQUE Fundamental field runtime. It runs a declared World's entities
 * through a headless field. `executionKind: 'opaque-native'`; it advertises only what the runtime
 * supports (lossy snapshot, no restore/replay); it never claims to know the internal force laws, and it
 * records that behavioral interpretation is unresolved rather than asserting it.
 */
export function fieldRuntimeDynamics(
  world: World,
  construction: FieldConstruction = DEFAULT_FIELD_CONSTRUCTION,
): DynamicsContract<FieldState, FieldAdvanceInput, FieldAdvanceOutput> {
  return {
    identity: { id: `field-runtime:${world.envelope.worldInstance}`, version: FIELD_VERSION },
    executionKind: 'opaque-native',
    capabilities: {
      initialize: true,
      advance: true,
      snapshot: true,
      restore: false, // snapshot is lossy — cannot reconstruct State
      replay: false,
      inspectInternalState: false, // the force laws are opaque code
      declareTransitionLaw: false, // incompatible with opaque-native by design
      deterministicReplay: false,
    },
    determinism: {
      classification: 'conditionally-deterministic',
      controlledInputs: ['injected-rng', 'clock'],
      uncontrolledInputs: ['host-geometry', 'body-ordering'],
      requirements: ['injected rng', 'dt===1 for cross-run equivalence'],
    },

    initialize(request): DynamicsResult<FieldState, DynamicsEvidence> {
      const declared = request.declaration as World;
      const { host, tick } = headlessHost(construction.hostWidth, construction.hostHeight);
      const field = createField(undefined as never, { host, render: 'none', rng: construction.makeRng(), now: construction.makeNow() });
      declared.entities.forEach((e, i) => {
        const rect = construction.placement(i);
        const p = e.params;
        field.addBody({
          identity: { id: e.identity.id },
          tokens: [...e.tokens],
          ...(typeof p.strength === 'number' ? { strength: p.strength } : {}),
          ...(typeof p.range === 'number' ? { range: p.range } : {}),
          rect: () => rect,
        });
      });
      return {
        ok: true,
        value: { field, tick, step: 0, envelope: declared.envelope },
        evidence: evidence({ declaredInputs: [record('init', 'declaration', 0, { entities: declared.entities.length })] }),
      };
    },

    advance(state, input, context): DynamicsResult<Transition<FieldState, FieldAdvanceOutput>, DynamicsEvidence> {
      const steps = input.steps ?? 1;
      for (let i = 0; i < steps; i++) state.tick();
      const nextStep = state.step + steps;
      return {
        ok: true,
        value: {
          state: { field: state.field, tick: state.tick, step: nextStep, envelope: state.envelope },
          output: { steps },
        },
        evidence: evidence({
          declaredInputs: [record('advance-input', 'steps', context.step, { steps })],
          substrateResponses: [record('advance-response', 'ticked', nextStep, { step: nextStep })],
          executionTrace: [{ id: `t-${nextStep}`, step: nextStep, source: SOURCE, summary: `advanced ${steps} step(s)` }],
          unresolvedInterpretations: [
            { id: 'behavior', claim: 'field motion interpreted as participant behavior', authority: 'empirical', status: 'unresolved' },
          ],
        }),
      };
    },

    snapshot(state, _context): DynamicsResult<DynamicsSnapshot, DynamicsEvidence> {
      const snap = state.field.snapshot() as FieldSnapshot;
      const entities: EntityStateReading[] = snap.bodies.map((b) => ({
        id: b.id,
        ...(b.position ? { position: { x: b.position.x, y: b.position.y, z: b.position.z } } : {}),
        metrics: { ...b.metrics },
      }));
      const reading: WorldStateSnapshot = {
        envelope: state.envelope,
        step: state.step,
        entities,
        metrics: {
          particles: snap.metrics.particles ?? 0,
          bodies: snap.metrics.bodies ?? 0,
          meanDensity: snap.metrics.meanDensity ?? 0,
        },
      };
      return {
        ok: true,
        value: { reading, restorable: false }, // lossy: no payload, cannot restore
        evidence: evidence({ substrateResponses: [record('snapshot', 'field-snapshot', state.step, { bodies: reading.metrics.bodies })] }),
      };
    },
    // no `restore` — capabilities.restore is false (a lossy snapshot cannot reconstruct State).
  };
}
