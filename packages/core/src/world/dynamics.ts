/**
 * DynamicsContract (A′, F1.1c) — the abstraction for lawful evolution.
 *
 * The kernel EXECUTES a declared contract; it never understands the dynamics behind it. One
 * implementation today wraps the opaque Fundamental field runtime (labeled `declarative: false`);
 * tomorrow another could be discrete-workflow, graph-propagation, constraint-solver, or a future
 * declarative Field IR. The kernel stays independent of all of them.
 *
 *     World  →  DynamicsContract  →  ExecutionSubstrate (FieldRuntime is the first)
 *
 * EXPERIMENTAL, field-free (enforced by `world/architecture.test.ts`).
 */
import type { WorldStateSnapshot } from './world.ts';

export interface DynamicsStepInput {
  /** Advance this many steps (default 1). */
  readonly steps?: number;
}

export interface DynamicsContract {
  readonly id: string;
  /** The execution substrate behind this contract, e.g. `field-runtime@0.9.4`. */
  readonly substrate: string;
  /**
   * True ONLY when lawful evolution is represented as inspectable data. Opaque substrates (the field
   * runtime, an external engine) MUST set this false — they may not claim declarative equivalence.
   */
  readonly declarative: boolean;
  /** Advance the world's lawful evolution. Opaque implementations do this internally. */
  step(input?: DynamicsStepInput): void;
  /** Read-only, serializable state — the kernel's only window into an opaque substrate. */
  snapshot(): WorldStateSnapshot;
  /** Release any substrate resources. */
  dispose?(): void;
}
