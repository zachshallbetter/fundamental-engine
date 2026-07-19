/**
 * The world kernel host (F1.3). Hosts a declared {@link World} with a {@link DynamicsContract} and
 * ORCHESTRATES its execution: it initializes the contract, threads the opaque `State` through
 * `advance`, and reads state through `snapshot` — WITHOUT understanding the dynamics and WITHOUT holding
 * any substrate-specific reference (the field instance, if any, lives inside `State`, which the substrate
 * created; the kernel treats `State` as opaque). OS/VM position: the kernel defines the contract under
 * which substrates run; it does not encode any substrate's instruction set.
 *
 * EXPERIMENTAL, field-free (enforced by `world/architecture.test.ts`).
 */
import type { World, WorldInvariant, WorldStateSnapshot } from './world.ts';
import type {
  DynamicsContract,
  DynamicsEvidence,
  DynamicsResult,
  DynamicsSnapshot,
} from './dynamics.ts';

export interface InvariantResult {
  readonly invariant: WorldInvariant;
  readonly held: boolean;
  readonly detail: string;
}

export interface KernelHost<State, Input, Output, Evidence = DynamicsEvidence> {
  readonly world: World;
  readonly dynamics: DynamicsContract<State, Input, Output, Evidence>;
  /** True once `initialize` succeeded. */
  readonly initialized: boolean;
  /** Execute the contract once. The kernel threads `State`; it does not inspect it. */
  advance(input: Input): DynamicsResult<Output, Evidence>;
  /** Read state via the contract's snapshot (if the substrate advertises the capability). */
  readState(): DynamicsResult<DynamicsSnapshot, Evidence> | { readonly ok: false; readonly reason: string };
  /** Generic invariant check over a readable projection — no substrate knowledge. */
  checkInvariants(reading: WorldStateSnapshot): InvariantResult[];
  dispose(): void;
}

export function hostWorld<State, Input, Output, Evidence = DynamicsEvidence>(
  world: World,
  dynamics: DynamicsContract<State, Input, Output, Evidence>,
): KernelHost<State, Input, Output, Evidence> {
  const init = dynamics.initialize({ declaration: world });
  let state: State | undefined = init.ok ? init.value : undefined;
  let step = 0;

  return {
    world,
    dynamics,
    get initialized() {
      return state !== undefined;
    },
    advance(input: Input): DynamicsResult<Output, Evidence> {
      if (state === undefined) {
        return { ok: false, error: { code: 'invalid-state', message: 'contract not initialized' }, evidence: init.evidence };
      }
      const result = dynamics.advance(state, input, { step });
      if (result.ok) {
        state = result.value.state;
        step += 1;
        return { ok: true, value: result.value.output, evidence: result.evidence };
      }
      return { ok: false, error: result.error, evidence: result.evidence };
    },
    readState() {
      if (state === undefined) return { ok: false, reason: 'contract not initialized' };
      if (!dynamics.capabilities.snapshot || !dynamics.snapshot) {
        return { ok: false, reason: 'substrate does not advertise snapshot' };
      }
      return dynamics.snapshot(state, { step });
    },
    checkInvariants(reading: WorldStateSnapshot): InvariantResult[] {
      return checkInvariantsAgainst(world, reading);
    },
    dispose() {
      state = undefined;
    },
  };
}

/** Generic invariant checking over a readable projection — NO substrate knowledge. */
export function checkInvariantsAgainst(world: World, reading: WorldStateSnapshot): InvariantResult[] {
  return world.invariants.map((invariant) => {
    if (invariant.kind === 'count') {
      const metric = String(invariant.spec.metric ?? 'entities');
      const expected = Number(invariant.spec.value);
      const actual = metric === 'entities' ? reading.entities.length : (reading.metrics[metric] ?? Number.NaN);
      return { invariant, held: actual === expected, detail: `${metric}=${actual}, expected ${expected}` };
    }
    if (invariant.kind === 'range') {
      const metric = String(invariant.spec.metric);
      const value = reading.metrics[metric] ?? Number.NaN;
      const min = Number(invariant.spec.min);
      const max = Number(invariant.spec.max);
      return { invariant, held: value >= min && value <= max, detail: `${metric}=${value} in [${min},${max}]` };
    }
    return { invariant, held: true, detail: `unchecked kind "${invariant.kind}"` };
  });
}
