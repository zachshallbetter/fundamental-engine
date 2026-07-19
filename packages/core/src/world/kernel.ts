/**
 * The world kernel host (A′, F1.1c). Hosts a declared {@link World} with a {@link DynamicsContract}
 * and executes the contract — WITHOUT understanding the dynamics and WITHOUT holding any
 * substrate-specific reference. This is the OS/VM position: the kernel defines the contracts under
 * which execution substrates run; it does not encode any one substrate's instruction set.
 *
 * EXPERIMENTAL, field-free (enforced by `world/architecture.test.ts`).
 */
import type { World, WorldInvariant, WorldStateSnapshot } from './world.ts';
import type { DynamicsContract, DynamicsStepInput } from './dynamics.ts';

export interface InvariantResult {
  readonly invariant: WorldInvariant;
  readonly held: boolean;
  readonly detail: string;
}

export interface KernelHost {
  readonly world: World;
  readonly dynamics: DynamicsContract;
  /** Execute the contract for N steps. The kernel does not know what a step does. */
  advance(steps?: number): void;
  /** The current read-only state, as the contract exposes it. */
  state(): WorldStateSnapshot;
  /** Check declared invariants generically against the current snapshot. */
  checkInvariants(): InvariantResult[];
  dispose(): void;
}

export function hostWorld(world: World, dynamics: DynamicsContract): KernelHost {
  return {
    world,
    dynamics,
    advance(steps = 1) {
      const input: DynamicsStepInput = { steps };
      dynamics.step(input);
    },
    state() {
      return dynamics.snapshot();
    },
    checkInvariants() {
      return checkInvariantsAgainst(world, dynamics.snapshot());
    },
    dispose() {
      dynamics.dispose?.();
    },
  };
}

/** Generic invariant checking over a snapshot — NO substrate knowledge. */
export function checkInvariantsAgainst(world: World, state: WorldStateSnapshot): InvariantResult[] {
  return world.invariants.map((invariant) => {
    if (invariant.kind === 'count') {
      const metric = String(invariant.spec.metric ?? 'entities');
      const expected = Number(invariant.spec.value);
      const actual = metric === 'entities' ? state.entities.length : (state.metrics[metric] ?? Number.NaN);
      return { invariant, held: actual === expected, detail: `${metric}=${actual}, expected ${expected}` };
    }
    if (invariant.kind === 'range') {
      const metric = String(invariant.spec.metric);
      const value = state.metrics[metric] ?? Number.NaN;
      const min = Number(invariant.spec.min);
      const max = Number(invariant.spec.max);
      return { invariant, held: value >= min && value <= max, detail: `${metric}=${value} in [${min},${max}]` };
    }
    return { invariant, held: true, detail: `unchecked kind "${invariant.kind}"` };
  });
}
