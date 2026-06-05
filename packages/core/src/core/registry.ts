/**
 * The force + condition registry (§4). The engine owns the loop; forces and
 * conditions register here. Built-in conditions (§5) are seeded automatically.
 */

import type { Condition, ConditionRegistry, Force, ForceRegistry } from './types.ts';
import { conditions as builtinConditions } from './conditions.ts';

export interface Registry {
  readonly forces: ForceRegistry;
  readonly conditions: ConditionRegistry;
  force(f: Force): void;
  condition(id: string, fn: Condition): void;
}

export function createRegistry(): Registry {
  const forces: ForceRegistry = {};
  const conditions: ConditionRegistry = { ...builtinConditions };
  return {
    forces,
    conditions,
    force(f) {
      forces[f.token] = f;
    },
    condition(id, fn) {
      conditions[id] = fn;
    },
  };
}
