/**
 * Agent-read SAMPLE RATE (#915) — the enforcement behind the fractional `budgets.agentRead` band.
 *
 * `FieldBudgets.agentRead` is a `0..1` cap on how much field state an agent reader may consume per
 * reading. `0` closes the agent surface (ids + shape only) and `≥ 1` / unset is the full reading; in
 * between, `0 < b < 1` is a SAMPLE RATE: each reading through an agent view carries exactly
 * `floor(b · n)` of the `n` bodies (and `floor(b · m)` of the `m` relationships) the capability-scoped
 * reading would otherwise contain, chosen DETERMINISTICALLY and emitted in the original order.
 *
 * Selection is a hash, not a draw: every entity is scored by `fnv1a32(viewSeed, frame, key)` and the
 * `k` lowest scores win. `viewSeed` is ONE value drawn lazily from the engine's injected rng the first
 * time a view actually reads under a fractional budget — so a seeded run replays the same subset, and a
 * run that never uses a fractional budget consumes zero extra rng values (byte-identical to before).
 * Keying on `(viewSeed, frame, key)` makes a reading stable within a frame (query / snapshot /
 * focusState agree on which bodies are in) and re-rolls it every frame (a rate, not a fixed window).
 *
 * The hash is spelled out here so the Kotlin (`AgentSampling.kt`) and Swift (`AgentSampling.swift`)
 * mirrors can match it bit for bit given the same seed:
 *   h = 0x811c9dc5 ^ seed
 *   for each of the 4 little-endian bytes of frame (int32), then each UTF-8 byte of key:
 *     h ^= byte; h = (h * 16777619) mod 2^32
 * The score is `h` (compared as a uint32; `h / 2^32` is the same ordering in `[0, 1)`).
 *
 * Internal — not re-exported from the package index. Pure functions; no engine state.
 */
import type { FieldPolicy } from './types.ts';

/** The size of the per-view seed space: one 32-bit draw from the engine rng (`floor(rng() · 2^32)`). */
export const AGENT_VIEW_SEED_SPACE = 4294967296;

/** FNV-1a offset basis (32-bit). */
const FNV_OFFSET = 0x811c9dc5;
/** FNV-1a prime (32-bit). */
const FNV_PRIME = 16777619;

/**
 * The effective agent-read fraction `0..1` for a policy: `1` when no `budgets.agentRead` is set (full
 * reading), `0` for any budget that is not `> 0` (including `NaN` — a malformed budget closes, never
 * opens), otherwise the budget clamped to `[0, 1]`.
 */
export function agentReadFraction(policy: FieldPolicy | undefined): number {
  const b = policy?.budgets?.agentRead;
  if (b == null) return 1;
  if (!(b > 0)) return 0; // ≤ 0 and NaN both close the surface (matches the pre-#915 `b > 0` test)
  return b >= 1 ? 1 : b;
}

/**
 * The deterministic per-entity score: 32-bit FNV-1a over `seed`, the 4 little-endian bytes of `frame`,
 * then the UTF-8 bytes of `key`. Returns a uint32. Pure; the cross-plane known-answer vectors live in
 * `agent-sampling.test.ts`.
 */
export function fnv1a32(seed: number, frame: number, key: string): number {
  let h = (FNV_OFFSET ^ (seed >>> 0)) >>> 0;
  const f = frame | 0;
  for (let i = 0; i < 4; i++) {
    h = (h ^ ((f >>> (i * 8)) & 0xff)) >>> 0;
    h = Math.imul(h, FNV_PRIME) >>> 0;
  }
  for (const ch of key) {
    // hand-rolled UTF-8 so the byte stream is identical on every plane (no TextEncoder dependency).
    const cp = ch.codePointAt(0) as number;
    if (cp < 0x80) {
      h = mix(h, cp);
    } else if (cp < 0x800) {
      h = mix(h, 0xc0 | (cp >> 6));
      h = mix(h, 0x80 | (cp & 0x3f));
    } else if (cp < 0x10000) {
      h = mix(h, 0xe0 | (cp >> 12));
      h = mix(h, 0x80 | ((cp >> 6) & 0x3f));
      h = mix(h, 0x80 | (cp & 0x3f));
    } else {
      h = mix(h, 0xf0 | (cp >> 18));
      h = mix(h, 0x80 | ((cp >> 12) & 0x3f));
      h = mix(h, 0x80 | ((cp >> 6) & 0x3f));
      h = mix(h, 0x80 | (cp & 0x3f));
    }
  }
  return h;
}

function mix(h: number, byte: number): number {
  return Math.imul((h ^ byte) >>> 0, FNV_PRIME) >>> 0;
}

/** How many of `n` items a fraction admits: `floor(fraction · n)`, clamped to `[0, n]`. */
export function sampleCount(n: number, fraction: number): number {
  if (!(fraction > 0)) return 0;
  if (fraction >= 1) return n;
  return Math.min(n, Math.max(0, Math.floor(fraction * n)));
}

/**
 * Deterministically keep `floor(fraction · items.length)` of `items` — the ones with the lowest
 * `fnv1a32(seed, frame, keyOf(item))` score (ties broken by original index) — returned IN THE ORIGINAL
 * ORDER. `fraction ≥ 1` returns a copy of everything; `fraction ≤ 0` returns `[]`. Pure.
 */
export function sampleFraction<T>(
  items: readonly T[],
  keyOf: (item: T) => string,
  fraction: number,
  seed: number,
  frame: number,
): T[] {
  const n = items.length;
  const k = sampleCount(n, fraction);
  if (k >= n) return items.slice();
  if (k === 0) return [];
  const order: number[] = [];
  const scores = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    scores[i] = fnv1a32(seed, frame, keyOf(items[i] as T));
    order.push(i);
  }
  order.sort((a, b) => (scores[a] as number) - (scores[b] as number) || a - b);
  const keep = order.slice(0, k).sort((a, b) => a - b);
  return keep.map((i) => items[i] as T);
}
