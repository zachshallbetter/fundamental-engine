/**
 * Record / replay (BACKLOG tooling, #692) — capture a field run frame-by-frame and reproduce it
 * deterministically for debugging and regression tests.
 *
 * The foundation rests on two existing seams:
 *   - the injectable randomness (`FieldOptions.rng` / #371) + wall clock (`now`), so a *seeded* run
 *     is fully reproducible — same seed, same stream, same trajectory;
 *   - the render-agnostic swarm read-out (`FieldHandle.readParticles`, stride {@link PARTICLE_STRIDE},
 *     wire version {@link PARTICLE_WIRE_VERSION}), the compact `[x, y, z, heat, size]` packing a
 *     renderer already consumes — so a recording is just that wire buffer captured every frame.
 *
 * A run is driven on a {@link headlessHost} (no DOM, manual `tick()`), so this is pure and headless —
 * it runs in a test or a Node service with no browser. The recorder captures per-frame particle state
 * into ONE flat `Float32Array` (frames laid end to end), plus the metadata needed to reproduce the run.
 * The replayer takes that metadata, re-runs the same config + seed, and yields identical frames;
 * {@link verifyReplay} proves it.
 *
 * Scope of this foundational slice (and what is deferred):
 *   - CAPTURED: per-frame particle positions, heat, and size via the readParticles wire format, plus
 *     the env seed (rng) and the deterministic field config. (Velocities are NOT stored — the wire
 *     format is position-based; positions are the verified invariant, and velocity is recoverable as a
 *     per-frame position delta.)
 *   - DEFERRED: an input timeline (burst/flowTo/setFormation calls interleaved with frames),
 *     programmatic bodies (`addBody`) in the recorded config, and an on-disk serialization format.
 *     The metadata + buffer here are the substrate those build on. See the module's `RecordedRun`.
 */
import { createField } from '../core/field.ts';
import { headlessHost } from '../core/host-headless.ts';
import { PARTICLE_STRIDE, PARTICLE_WIRE_VERSION } from '../core/types.ts';
import type { FieldOptions } from '../core/types.ts';
import { seededRng } from './rng.ts';

/**
 * The deterministic subset of {@link FieldOptions} a run can be recorded from. The recorder owns the
 * host, canvas, rng, and clock (the non-deterministic / environment-bound inputs), so they are omitted
 * here; everything left is pure configuration that, paired with a `seed`, fully determines the run.
 */
export type RecordableFieldOptions = Omit<
  FieldOptions,
  'host' | 'rng' | 'now' | 'overlayCanvas' | 'overlayBackend' | 'feedbackSink'
>;

/** What to record: the field config, the field's coordinate space, the seed, and how many frames. */
export interface RecordConfig {
  /** the field's coordinate-space width (the headless "volume"). */
  width: number;
  /** the field's coordinate-space height. */
  height: number;
  /** 32-bit integer seed for the deterministic rng — the same seed reproduces the run. Default 0. */
  seed?: number;
  /** how many frames to capture (each is one `headlessHost.tick()`). */
  frames: number;
  /** the deterministic field configuration (density, forces via recipes, depth, …). `render` is
   *  forced to `'none'` (headless signals-only) regardless of what is passed here. */
  options?: RecordableFieldOptions;
}

/**
 * A captured run: the metadata needed to reproduce it, plus the packed per-frame particle buffer.
 * Compact by construction — one `Float32Array`, no per-frame object allocation.
 */
export interface RecordedRun {
  /** the wire-format version the buffer was captured under ({@link PARTICLE_WIRE_VERSION}). A replay
   *  on a build with a different wire version must not silently compare — {@link verifyReplay} checks it. */
  wireVersion: number;
  /** elements per particle in the buffer ({@link PARTICLE_STRIDE}). */
  stride: number;
  /** the exact config that produced this run — feed it back to {@link replayRun} to reproduce. */
  config: RecordConfig;
  /** number of frames captured (= `config.frames`). */
  frames: number;
  /** live particle count at each frame (length === `frames`). Lets a consumer slice the flat buffer
   *  per frame even when the count drifts (mortal/spawned matter). */
  counts: number[];
  /** the maximum particle count across all frames — the per-frame slot width in `particles`. */
  maxCount: number;
  /** ALL frames packed end to end: frame `f` occupies `[f*maxCount*stride, …)`, particle `i` of that
   *  frame at offset `(f*maxCount + i)*stride`, laid out `[x, y, z, heat, size]`. Slots beyond a
   *  frame's `counts[f]` are 0. One contiguous allocation. */
  particles: Float32Array;
}

/** Build the deterministic field for a config on a fresh headless host + seeded rng. Shared by record
 *  and replay so both drive byte-identical inputs. Returns the handle, the host, and a particle buffer
 *  big enough for the pool. */
function openRun(config: RecordConfig): {
  field: ReturnType<typeof createField>;
  host: ReturnType<typeof headlessHost>;
  scratch: Float32Array;
} {
  const host = headlessHost({ width: config.width, height: config.height });
  const rng = seededRng(config.seed ?? 0);
  // a deterministic wall clock that advances in lockstep with the headless tick (~1/60 s a frame), so
  // wall-time-gated behaviour (the input-idle → ambient switch) is reproducible too — without it,
  // `performance.now` would make two replays of the same config diverge once they cross an idle
  // threshold at different real times. Starts at 0; the host's tick() drives the simulation clock,
  // this drives the wall clock, and the seeded rng drives randomness — the three inputs a run needs.
  let wall = 0;
  const FRAME_MS = 1000 / 60;
  const now = (): number => wall;
  const field = createField(undefined as unknown as HTMLCanvasElement, {
    ...config.options,
    host,
    rng,
    now,
    render: 'none',
  });
  // expose the clock advance through the host's tick so callers drive both clocks with one call.
  const baseTick = host.tick.bind(host);
  host.tick = (t?: number): void => {
    wall += FRAME_MS;
    baseTick(t);
  };
  // size the scratch buffer to the live pool (it never grows mid-run beyond the seeded ceiling; a
  // generous headroom covers source-spawned matter). readParticles writes min(count, capacity).
  const cap = Math.max(field.particleCount() * 4, 1024);
  return { field, host, scratch: new Float32Array(cap * PARTICLE_STRIDE) };
}

/**
 * Record a deterministic field run: build the field, tick it `frames` times on a headless host, and
 * capture each frame's particle state via `readParticles`. Pure given the config (seeded rng + manual
 * clock). Returns a compact {@link RecordedRun}.
 */
export function recordRun(config: RecordConfig): RecordedRun {
  const { field, host, scratch } = openRun(config);
  try {
    const counts: number[] = [];
    const perFrame: Float32Array[] = [];
    let maxCount = 0;
    for (let f = 0; f < config.frames; f++) {
      host.tick();
      const n = field.readParticles(scratch);
      counts.push(n);
      if (n > maxCount) maxCount = n;
      perFrame.push(scratch.slice(0, n * PARTICLE_STRIDE));
    }
    // pack the per-frame slices into one contiguous buffer with a uniform per-frame slot width.
    const slot = maxCount * PARTICLE_STRIDE;
    const particles = new Float32Array(config.frames * slot);
    for (let f = 0; f < config.frames; f++) {
      particles.set(perFrame[f]!, f * slot);
    }
    return {
      wireVersion: PARTICLE_WIRE_VERSION,
      stride: PARTICLE_STRIDE,
      config,
      frames: config.frames,
      counts,
      maxCount,
      particles,
    };
  } finally {
    field.destroy();
  }
}

/**
 * Replay a recorded run: re-run the SAME config + seed and reproduce the per-frame particle state. The
 * result is a fresh {@link RecordedRun} — deterministically identical to the original on the same build.
 * Pass the original's `config` (or the whole `RecordedRun`); only the config drives the simulation.
 */
export function replayRun(run: RecordedRun | RecordConfig): RecordedRun {
  const config = 'particles' in run ? run.config : run;
  return recordRun(config);
}

/** Per-frame divergence between two runs: the first frame index that differs and a sample of the gap. */
export interface ReplayMismatch {
  /** the first frame whose particle state differs (or where the counts differ). */
  frame: number;
  /** the particle index within that frame at the first differing value (−1 if the counts differ). */
  particle: number;
  /** human-readable reason (count mismatch, wire-version mismatch, or value gap). */
  reason: string;
}

/** Result of {@link verifyReplay}: `ok` when every frame matches within `tol`. */
export interface ReplayVerdict {
  ok: boolean;
  /** the first mismatch, or null when `ok`. */
  mismatch: ReplayMismatch | null;
  /** the largest absolute per-value difference seen across all compared frames. */
  maxDelta: number;
}

/**
 * Verify a replay reproduces a recording: compare every captured value frame by frame. Deterministic
 * replay on the same build should be bit-identical (default `tol` 0); a small `tol` absorbs
 * cross-platform float drift if a consumer compares runs from different machines.
 */
export function verifyReplay(expected: RecordedRun, actual: RecordedRun, tol = 0): ReplayVerdict {
  if (expected.wireVersion !== actual.wireVersion) {
    return {
      ok: false,
      maxDelta: Infinity,
      mismatch: { frame: 0, particle: -1, reason: `wire version ${expected.wireVersion} → ${actual.wireVersion}` },
    };
  }
  if (expected.frames !== actual.frames) {
    return {
      ok: false,
      maxDelta: Infinity,
      mismatch: { frame: Math.min(expected.frames, actual.frames), particle: -1, reason: `frame count ${expected.frames} → ${actual.frames}` },
    };
  }
  const stride = expected.stride;
  let maxDelta = 0;
  for (let f = 0; f < expected.frames; f++) {
    const ec = expected.counts[f] ?? 0;
    const ac = actual.counts[f] ?? 0;
    if (ec !== ac) {
      return { ok: false, maxDelta, mismatch: { frame: f, particle: -1, reason: `particle count ${ec} → ${ac}` } };
    }
    const eSlot = f * expected.maxCount * stride;
    const aSlot = f * actual.maxCount * stride;
    for (let i = 0; i < ec; i++) {
      for (let k = 0; k < stride; k++) {
        const ev = expected.particles[eSlot + i * stride + k]!;
        const av = actual.particles[aSlot + i * stride + k]!;
        const d = Math.abs(ev - av);
        if (d > maxDelta) maxDelta = d;
        if (d > tol) {
          return {
            ok: false,
            maxDelta,
            mismatch: { frame: f, particle: i, reason: `value gap ${d} at channel ${k} (${ev} vs ${av})` },
          };
        }
      }
    }
  }
  return { ok: true, maxDelta, mismatch: null };
}

/**
 * Read one frame's particle state back out of a {@link RecordedRun} as a view onto the packed buffer —
 * a `subarray` of length `counts[frame] * stride`, laid out `[x, y, z, heat, size]`. Zero-copy; do not
 * mutate. Out-of-range frames return an empty view.
 */
export function frameAt(run: RecordedRun, frame: number): Float32Array {
  if (frame < 0 || frame >= run.frames) return new Float32Array(0);
  const slot = run.maxCount * run.stride;
  const start = frame * slot;
  return run.particles.subarray(start, start + (run.counts[frame] ?? 0) * run.stride);
}
