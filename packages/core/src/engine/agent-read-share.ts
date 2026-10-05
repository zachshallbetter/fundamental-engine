/**
 * #915 — the fractional `budgets.agentRead` gate.
 *
 * `budgets.agentRead` is a conservation law on the agent surface: `b` is the SHARE of the field's
 * readable body population one agent view may consume. `undefined` or `b >= 1` is the whole field,
 * `b <= 0` closes the surface entirely, and `0 < b < 1` grants a partial read.
 *
 * Selection is **deterministic**, **stable per body id**, and **not positional**. Each property is
 * load-bearing, and the obvious implementations each fail one:
 *  - deterministic, because a random draw makes an agent read unreplayable, and record/replay is a
 *    contract this engine keeps everywhere else (it threads a seeded `rng` for exactly this reason);
 *  - stable, because a subset RESAMPLED per call leaks the whole field to a patient reader — the union
 *    of enough independent 10% samples is 100%. A budget you can defeat by calling `query()` in a loop
 *    is not a budget. This is the security core of the gate;
 *  - not positional, because "take the first ceil(n·b)" leaks scan order, hands every agent the same
 *    prefix, and makes the withheld tail identical for everyone.
 *
 * Internal to the package: not re-exported from the entry point, so it is not public API surface.
 * **The digest must stay bit-identical to the Swift (`AgentReadShare`) and Kotlin (`AgentReadShare`)
 * implementations** — all three pin the same vector in their tests.
 */

/**
 * FNV-1a over the id's UTF-16 code units, then a murmur3 `fmix32` avalanche, read as a fixed
 * coordinate in [0,1).
 *
 * The finalizer is **not** optional. Real body ids are near-identical short strings (`body-0`,
 * `body-1`, …), and raw FNV-1a barely mixes its HIGH bits across such inputs — which is the entire
 * signal once the digest is read as `h / 2^32`. Measured over 64 ids without it: `b=0.1` admitted 0
 * bodies, `b=0.25` and `b=0.5` both admitted 24, and `b=0.75` admitted all 64.
 */
export function idCoordinate(id: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b) >>> 0;
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35) >>> 0;
  h ^= h >>> 16;
  return (h >>> 0) / 0x100000000;
}

/** Whether a partial read at `share` admits the body with this id. */
export function admits(id: string, share: number): boolean {
  if (!(share < 1)) return true;
  return idCoordinate(id) < share;
}
