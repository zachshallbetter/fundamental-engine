// The `agent-json` projection surface (substrate doc 05): a field projection whose output is a plain,
// serializable reading object rather than a visual/DOM write — the surface an agent or tool consumes.
// `agentJsonProjection` is the projection; `agentJsonTarget` is the sink it writes into. Pair them and
// `bind` them on the registry to get a live, JSON-serializable view of any field channels. Read-only
// w.r.t. the field — like every projection, this never changes how matter moves. EXPERIMENTAL.

import type { AgentJsonTarget, FieldProjection } from './types.ts';

/** Create an {@link AgentJsonTarget} — the sink an `agent-json` projection writes into. It captures the
 *  last reading as a plain object and serializes it on demand. */
export function agentJsonTarget(): AgentJsonTarget {
  let last: Record<string, number> | null = null;
  return {
    receive(reading) {
      last = { ...reading };
    },
    value() {
      return last;
    },
    json() {
      return JSON.stringify(last);
    },
  };
}

/** Create a projection that targets the `agent-json` surface: its `apply` hands the reading to an
 *  {@link AgentJsonTarget} (via `receive`). Pass `accessibilityEquivalent` if this projection IS the
 *  alternate surface for a visual one (it usually is — agent-json is inherently non-visual). */
export function agentJsonProjection(
  id: string,
  channels: string[],
  opts: { label?: string; accessibilityEquivalent?: string } = {},
): FieldProjection {
  return {
    id,
    label: opts.label ?? id,
    channels: channels.slice(),
    surfaces: ['agent-json'],
    ...(opts.accessibilityEquivalent !== undefined ? { accessibilityEquivalent: opts.accessibilityEquivalent } : {}),
    apply(reading, target) {
      (target as Partial<AgentJsonTarget>).receive?.(reading);
    },
  };
}
