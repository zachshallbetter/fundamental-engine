/**
 * FieldRuntime adapter (A′, F1.1c) — the ONE-WAY bridge, and the ONLY file in `world/` permitted to
 * import the field runtime. Direction is strictly:
 *
 *     CompiledPattern  →(worldFromCompiledPattern)→  generic World declarations
 *     World            →(fieldRuntimeDynamics)→      DynamicsContract over an OPAQUE field substrate
 *
 * The field runtime is wrapped as an opaque execution substrate: `declarative: false`, and NO claim of
 * declarative equivalence — lawful evolution stays executable force code inside the field (the F1.1
 * finding). The kernel never sees anything below `DynamicsContract` / `WorldStateSnapshot`.
 */
import { createField } from '../../engine/field.ts';
import { FIELD_VERSION } from '../../version.ts';
import type { CompiledPattern } from '../../recipes/compile.ts';
import type { FieldHost } from '../../engine/host.ts';
import type { FieldSnapshot } from '../../engine/types.ts';
import { createWorldEnvelope } from '../envelope.ts';
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
import type { DynamicsContract, DynamicsStepInput } from '../dynamics.ts';

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

/**
 * A DynamicsContract backed by the OPAQUE Fundamental field runtime. Instantiates a headless field,
 * runs the world's entities through it, and exposes only a generic read-only snapshot. Deterministic
 * placement + injected rng keep runs reproducible. This is a wrapper, explicitly labeled opaque; it
 * does not — and must not — claim the field's evolution is declarative.
 */
export function fieldRuntimeDynamics(world: World): DynamicsContract {
  const { host, tick } = headlessHost(400, 300);
  let seed = 1;
  const field = createField(undefined as never, { host, render: 'none', rng: () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff });
  world.entities.forEach((e, i) => {
    const left = 50 + (i % 5) * 60;
    const top = 50 + Math.floor(i / 5) * 60;
    const p = e.params;
    field.addBody({
      identity: { id: e.identity.id },
      tokens: [...e.tokens],
      ...(typeof p.strength === 'number' ? { strength: p.strength } : {}),
      ...(typeof p.range === 'number' ? { range: p.range } : {}),
      rect: () => ({ left, top, width: 40, height: 40 }),
    });
  });
  let step = 0;

  function toStateSnapshot(): WorldStateSnapshot {
    const snap = field.snapshot() as FieldSnapshot;
    const entities: EntityStateReading[] = snap.bodies.map((b) => ({
      id: b.id,
      ...(b.position ? { position: { x: b.position.x, y: b.position.y, z: b.position.z } } : {}),
      metrics: { ...b.metrics },
    }));
    return {
      envelope: world.envelope,
      step,
      entities,
      metrics: {
        particles: snap.metrics.particles ?? 0,
        bodies: snap.metrics.bodies ?? 0,
        meanDensity: snap.metrics.meanDensity ?? 0,
      },
    };
  }

  return {
    id: `field-runtime:${world.envelope.worldInstance}`,
    substrate: `field-runtime@${FIELD_VERSION}`,
    declarative: false, // OPAQUE — evolution is executable force code, not data (F1.1 finding).
    step(input?: DynamicsStepInput) {
      const n = input?.steps ?? 1;
      for (let i = 0; i < n; i++) {
        tick();
        step++;
      }
    },
    snapshot() {
      return toStateSnapshot();
    },
    dispose() {
      field.destroy();
    },
  };
}
