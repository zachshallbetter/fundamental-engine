/**
 * Cross-document continuity (#679) — serialize the particle pool so the NEXT document can pick it up.
 *
 * Same-document navigation already keeps one engine alive (a client router + a persisted `<field-root>`
 * is one continuous medium); a HARD navigation — reload, an external entry, cross-document back/forward
 * — tears the document down and the next one boots a fresh random pool. This module is the pure,
 * DOM-free half of closing that gap: it packs the pool into a small versioned blob (the same
 * `readParticles` wire format a renderer consumes, {@link PARTICLE_WIRE_VERSION} / {@link PARTICLE_STRIDE},
 * base64 over little-endian Float32) and decodes one back, refusing anything it does not recognize.
 * The other half — WHERE the blob lives between documents (sessionStorage) and WHEN it is captured
 * (`pagehide`) — is a host concern and lives in `@fundamental-engine/elements` (`<field-root continuity>`);
 * core imports zero DOM and never touches storage.
 *
 * What a blob carries: positions (x, y, z), heat and size per free particle — exactly what the wire
 * format carries. Velocities are NOT stored (the wire format is position-based, as in record/replay
 * #692), so the restored pool keeps the fresh pool's small initial drift; bound/wave state is not
 * captured either (waves are opt-in, #979). The restore is applied IN PLACE onto the already-built pool
 * (`FieldHandle.restoreParticles`), so the default path — every rng draw of `build()` — is untouched.
 *
 * This is a plain wire capture, not a receipt or a replay: no rng seed, no config, no frame history.
 */
import { PARTICLE_STRIDE, PARTICLE_WIRE_VERSION } from './types.ts';
import type { FieldHandle } from './types.ts';

/** The serialized particle pool — JSON-safe, versioned by the wire format it was captured under. */
export interface ParticlePoolBlob {
  /** wire-format version of the packed buffer ({@link PARTICLE_WIRE_VERSION}). A decoder on a build with a
   *  different version refuses the blob rather than misreading lanes. */
  v: number;
  /** elements per particle ({@link PARTICLE_STRIDE}). */
  stride: number;
  /** particles packed. */
  n: number;
  /** the field's coordinate-space width at capture — the restore rescales into the new field. */
  W: number;
  /** the field's coordinate-space height at capture. */
  H: number;
  /** capture time in ms (a caller-supplied clock; `0` when unknown) — for a consumer that ages blobs out. */
  at: number;
  /** the `readParticles` buffer: `n × stride` little-endian Float32 values, base64 (unpadded-safe). */
  data: string;
}

/** A decoded blob, ready for {@link FieldHandle.restoreParticles}. */
export interface DecodedParticlePool {
  /** the unpacked wire buffer (`n × stride` floats). */
  buf: Float32Array;
  /** particles in `buf`. */
  n: number;
  /** capture-time coordinate space — pass as `fromWidth` / `fromHeight` to rescale on restore. */
  W: number;
  H: number;
  /** capture time (ms), as recorded. */
  at: number;
}

/** Default size cap for the base64 payload (characters ≈ bytes) — ~2,400 particles at stride 5. Keeps
 *  a blob well inside any sessionStorage budget; a bigger pool is truncated in pool order. */
export const CONTINUITY_MAX_BYTES = 64 * 1024;

export interface EncodeParticlePoolOptions {
  /** the field's coordinate-space width now (e.g. the host viewport width). */
  width: number;
  /** the field's coordinate-space height now. */
  height: number;
  /** capture time (ms) to record; default `0` (unknown). */
  at?: number;
  /** cap on the base64 payload length; default {@link CONTINUITY_MAX_BYTES}. The particle count is
   *  truncated to fit (first `n` in pool order). */
  maxBytes?: number;
}

export interface DecodeParticlePoolOptions {
  /** refuse a payload longer than this many characters; default {@link CONTINUITY_MAX_BYTES}. */
  maxBytes?: number;
}

/** Particles that fit under a base64 budget: base64 spends 4 chars per 3 bytes; a particle is `stride × 4` bytes. */
export function maxParticlesForBytes(maxBytes: number, stride: number = PARTICLE_STRIDE): number {
  if (!(maxBytes > 0)) return 0;
  return Math.floor((maxBytes * 3) / 4 / (stride * 4));
}

/**
 * Capture the live pool into a {@link ParticlePoolBlob}. Reads through `readParticles` (so agents are
 * excluded exactly as a renderer sees the swarm) and never mutates the field. Returns `null` when there
 * is nothing to capture (an empty pool, or a zero budget).
 */
export function encodeParticlePool(
  field: Pick<FieldHandle, 'readParticles' | 'particleCount'>,
  opts: EncodeParticlePoolOptions,
): ParticlePoolBlob | null {
  const maxBytes = opts.maxBytes ?? CONTINUITY_MAX_BYTES;
  const cap = Math.min(field.particleCount(), maxParticlesForBytes(maxBytes));
  if (cap <= 0) return null;
  const buf = new Float32Array(cap * PARTICLE_STRIDE);
  const n = field.readParticles(buf);
  if (n <= 0) return null;
  return {
    v: PARTICLE_WIRE_VERSION,
    stride: PARTICLE_STRIDE,
    n,
    W: opts.width,
    H: opts.height,
    at: opts.at ?? 0,
    data: bytesToBase64(floatsToBytes(buf.subarray(0, n * PARTICLE_STRIDE))),
  };
}

/**
 * Decode a blob (an object, or its JSON string) back into a wire buffer. Returns `null` — never throws —
 * for anything it cannot vouch for: malformed JSON, a wire version or stride other than this build's,
 * a payload over the size cap, a byte length that does not match `n × stride`, a non-finite lane, or a
 * non-positive capture size. A rejected blob simply means "boot the fresh pool", the default.
 */
export function decodeParticlePool(blob: unknown, opts: DecodeParticlePoolOptions = {}): DecodedParticlePool | null {
  const maxBytes = opts.maxBytes ?? CONTINUITY_MAX_BYTES;
  let b: unknown = blob;
  if (typeof b === 'string') {
    if (b.length > maxBytes + 256) return null; // the JSON envelope is small; refuse before parsing a huge string
    try {
      b = JSON.parse(b);
    } catch {
      return null;
    }
  }
  if (b === null || typeof b !== 'object') return null;
  const o = b as Record<string, unknown>;
  if (o.v !== PARTICLE_WIRE_VERSION || o.stride !== PARTICLE_STRIDE) return null;
  const n = o.n;
  if (typeof n !== 'number' || !Number.isInteger(n) || n <= 0) return null;
  const W = o.W;
  const H = o.H;
  if (typeof W !== 'number' || typeof H !== 'number' || !(W > 0) || !(H > 0) || !Number.isFinite(W) || !Number.isFinite(H)) return null;
  const at = typeof o.at === 'number' && Number.isFinite(o.at) ? o.at : 0;
  const data = o.data;
  if (typeof data !== 'string' || data.length > maxBytes) return null;
  const bytes = base64ToBytes(data);
  if (!bytes || bytes.length !== n * PARTICLE_STRIDE * 4) return null;
  const buf = bytesToFloats(bytes);
  for (let i = 0; i < buf.length; i++) if (!Number.isFinite(buf[i]!)) return null;
  return { buf, n, W, H, at };
}

// ── byte packing (explicit little-endian, so a blob is portable across hosts) ─────────────────────

function floatsToBytes(f: Float32Array): Uint8Array {
  const out = new Uint8Array(f.length * 4);
  const view = new DataView(out.buffer);
  for (let i = 0; i < f.length; i++) view.setFloat32(i * 4, f[i]!, true);
  return out;
}

function bytesToFloats(bytes: Uint8Array): Float32Array {
  const n = Math.floor(bytes.length / 4);
  const out = new Float32Array(n);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let i = 0; i < n; i++) out[i] = view.getFloat32(i * 4, true);
  return out;
}

// ── base64 (hand-rolled: pure, no `btoa`/`atob` globals, no Latin-1 detour, one codec on every host) ──

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const B64_REV: Int16Array = (() => {
  const rev = new Int16Array(128).fill(-1);
  for (let i = 0; i < B64.length; i++) rev[B64.charCodeAt(i)] = i;
  return rev;
})();

function bytesToBase64(bytes: Uint8Array): string {
  let out = '';
  let i = 0;
  for (; i + 2 < bytes.length; i += 3) {
    const t = (bytes[i]! << 16) | (bytes[i + 1]! << 8) | bytes[i + 2]!;
    out += B64[(t >> 18) & 63]! + B64[(t >> 12) & 63]! + B64[(t >> 6) & 63]! + B64[t & 63]!;
  }
  const rest = bytes.length - i;
  if (rest === 1) {
    const t = bytes[i]! << 16;
    out += B64[(t >> 18) & 63]! + B64[(t >> 12) & 63]! + '==';
  } else if (rest === 2) {
    const t = (bytes[i]! << 16) | (bytes[i + 1]! << 8);
    out += B64[(t >> 18) & 63]! + B64[(t >> 12) & 63]! + B64[(t >> 6) & 63]! + '=';
  }
  return out;
}

/** Strict decode: returns `null` on any character outside the alphabet or a malformed length. */
function base64ToBytes(s: string): Uint8Array | null {
  let len = s.length;
  while (len > 0 && s.charCodeAt(len - 1) === 61 /* '=' */) len--;
  const pad = s.length - len;
  if (pad > 2 || s.length % 4 !== 0) return null;
  const outLen = Math.floor((len * 3) / 4);
  const out = new Uint8Array(outLen);
  let o = 0;
  let acc = 0;
  let bits = 0;
  for (let i = 0; i < len; i++) {
    const c = s.charCodeAt(i);
    const v = c < 128 ? B64_REV[c]! : -1;
    if (v < 0) return null;
    acc = (acc << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[o++] = (acc >> bits) & 255;
    }
  }
  return o === outLen ? out : null;
}
