/**
 * Record / replay (#692) — a foundational, pure, headless capture/reproduce seam for the field.
 *
 * `recordRun(config)` drives a deterministic (seeded-rng) field on a headless host and captures each
 * frame's particle state via the readParticles wire format into one compact buffer; `replayRun` re-runs
 * the same config to reproduce it; `verifyReplay` proves a replay matches a recording. `seededRng` is
 * the small deterministic generator the seam stands on (the engine's injectable `rng`).
 *
 * See `record.ts` for the captured-vs-deferred scope (input timeline + on-disk serialization deferred).
 */
export * from './rng.ts';
export * from './record.ts';
