/**
 * `<field-root continuity="session">` — the host half of cross-document continuity (#679).
 *
 * Core packs the pool into a versioned wire blob (`encodeParticlePool` / `decodeParticlePool`) and
 * writes one back in place (`FieldHandle.restoreParticles`); this module decides WHERE the blob lives
 * between documents and WHEN it is captured:
 *
 *   - capture on `pagehide` — the last reliable beat before a hard navigation (reload, an external
 *     link, cross-document back/forward). A `pagehide` with `persisted: true` is the bfcache: the
 *     document is kept alive, so nothing is written and nothing is restored on `pageshow`;
 *   - store in `sessionStorage` under ONE path-agnostic key — continuity is per tab, per session, and
 *     the next document to boot a continuity field, whatever its route, is the one that inherits;
 *   - restore ONCE, at boot, after the fresh pool is built: the key is consumed (removed) before the
 *     restore, so a rebuild in the same document (a density/waves/mass attribute change) or a second
 *     field never restores it again.
 *
 * Progressive enhancement, every step feature-detected and guarded: no `window` (SSR), no
 * `sessionStorage` (blocked / private mode throws on access), no `addEventListener`, a quota error, or
 * a blob this build does not recognize all degrade to the default — the fresh pool. Same-document
 * navigation (a client router with a persisted element) never fires `pagehide`, so it is untouched.
 * Reduced motion needs no special case: the restore sets positions and the frozen integrator (dt = 0)
 * adds no motion to them.
 */
import { decodeParticlePool, encodeParticlePool, CONTINUITY_MAX_BYTES } from '@fundamental-engine/core';
import type { FieldHandle } from '@fundamental-engine/core';

/** The one sessionStorage key continuity uses — path-agnostic on purpose (see the module doc). */
export const CONTINUITY_STORAGE_KEY = 'fe:continuity';

/** The slice of `Storage` continuity needs (so a test can hand in a Map-backed stub). */
export interface ContinuityStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** The slice of `Window` continuity needs. `sessionStorage` is read through a getter that may throw
 *  (a blocked-storage SecurityError) — that is the feature detection. */
export interface ContinuityWindow {
  readonly sessionStorage?: ContinuityStorage | null;
  readonly innerWidth: number;
  readonly innerHeight: number;
  addEventListener(type: 'pagehide', listener: (e: { persisted?: boolean }) => void): void;
  removeEventListener(type: 'pagehide', listener: (e: { persisted?: boolean }) => void): void;
}

export interface SessionContinuityOptions {
  /** the storage key; default {@link CONTINUITY_STORAGE_KEY}. */
  key?: string;
  /** cap on the blob payload; default `CONTINUITY_MAX_BYTES` (64 KiB). */
  maxBytes?: number;
  /** the clock stamped into the blob; default `Date.now`. */
  now?: () => number;
}

/** What {@link installSessionContinuity} did at boot — surfaced for tests and diagnostics. */
export interface SessionContinuity {
  /** particles restored from a stored blob at install time (`0` when there was none, or it was rejected). */
  readonly restored: number;
  /** remove the `pagehide` listener. Idempotent. Nothing is written on teardown. */
  teardown(): void;
}

const NOOP: SessionContinuity = { restored: 0, teardown: () => {} };

/**
 * Wire session continuity onto a live field: consume + restore any stored pool once, then capture the
 * pool on every non-bfcache `pagehide`. Returns the teardown (and the restored count). A no-op — the
 * same `NOOP` result — wherever the platform lacks the pieces.
 */
export function installSessionContinuity(
  field: Pick<FieldHandle, 'readParticles' | 'particleCount' | 'restoreParticles'>,
  win: ContinuityWindow | undefined,
  opts: SessionContinuityOptions = {},
): SessionContinuity {
  if (!win || typeof win.addEventListener !== 'function' || typeof win.removeEventListener !== 'function') return NOOP;
  let storage: ContinuityStorage | null | undefined;
  try {
    storage = win.sessionStorage; // the accessor itself throws when storage is blocked
  } catch {
    return NOOP;
  }
  if (!storage || typeof storage.getItem !== 'function' || typeof storage.setItem !== 'function') return NOOP;
  const key = opts.key ?? CONTINUITY_STORAGE_KEY;
  const maxBytes = opts.maxBytes ?? CONTINUITY_MAX_BYTES;
  const now = opts.now ?? Date.now;

  // one-shot restore: consume the key FIRST so nothing in this document can restore it twice.
  let restored = 0;
  try {
    const raw = storage.getItem(key);
    if (raw != null) {
      storage.removeItem(key);
      const pool = decodeParticlePool(raw, { maxBytes });
      if (pool) restored = field.restoreParticles(pool.buf, pool.n, { fromWidth: pool.W, fromHeight: pool.H });
    }
  } catch {
    /* storage read/remove failed (private mode, a revoked origin): boot the fresh pool */
  }

  const onPageHide = (e: { persisted?: boolean }): void => {
    if (e?.persisted) return; // bfcache: this document survives; the running pool IS the continuity
    try {
      const blob = encodeParticlePool(field, { width: win.innerWidth, height: win.innerHeight, at: now(), maxBytes });
      if (blob) storage!.setItem(key, JSON.stringify(blob));
    } catch {
      /* quota / storage unavailable: nothing to inherit, the next document boots fresh */
    }
  };
  win.addEventListener('pagehide', onPageHide);
  let torn = false;
  return {
    restored,
    teardown: () => {
      if (torn) return;
      torn = true;
      win.removeEventListener('pagehide', onPageHide);
    },
  };
}
