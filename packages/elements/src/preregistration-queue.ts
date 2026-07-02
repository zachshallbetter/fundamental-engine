/**
 * SSR pre-registration queue for shadow hosts (docs/engine-reference/shadow-dom.md §31.10).
 *
 * ## The timing problem
 *
 * Custom elements dispatch composed `field:register-body` events (via {@link FieldController}) from
 * their `connectedCallback`. The singleton `<field-root>` field only listens for those events *after*
 * it boots — `start()` → `createBrowserField` → `host.onBodyEvent(REGISTER_BODY, …)` on `document`.
 *
 * On a **server-rendered** page the custom elements already exist in the DOM at hydration, and they
 * upgrade in document order. A body element earlier in the document than `<field-root>` (or whose
 * definition loads first) fires `connectedCallback` — and its registration event — **before** the
 * field has wired its listeners. A one-shot `dispatchEvent` with no listener is simply lost, so the
 * body never joins the field: it renders as inert HTML.
 *
 * ## The queue (§31.10)
 *
 * Importing `@fundamental-engine/elements` installs a **capturing** document listener at module load
 * (this file is part of the package's side-effecting entry, so any SSR/hydration bundle that pulls in
 * the custom elements installs the queue at exactly the right moment — before any element upgrades).
 * While no field is live it **buffers** each register / unregister / update event, keyed by element
 * (dedupe per §31.10 — last write wins, so an `unregister` supersedes a pending `register` and no
 * stale body is replayed). When a field boots it calls {@link flushPreRegistrationQueue}, which
 * **replays** the buffered events on their source elements; they bubble (composed) to `document`,
 * where the field's now-wired, idempotent listeners register them. Component mount order no longer
 * has to be perfect.
 *
 * ## Why replay rather than a private body set
 *
 * Replaying the original events reuses the entire existing registration path (the field's
 * `onRegister`/`onUnregister`/`onUpdate` handlers, the idempotent element-keyed `ShadowRegistry`,
 * the coalesced rescan) with zero duplicated logic and no new public surface — it is pure lifecycle
 * plumbing. Registration is idempotent (element-keyed), so a client-only page whose field boots
 * before any element (the common case: nothing is ever buffered) behaves exactly as before, and the
 * live path is untouched: once a field is active, events flow straight through and are never buffered.
 *
 * SSR-safe: no bare `document` / `window` access at module load. The install is guarded and becomes a
 * no-op under Node (no `document`), so importing this on the server never throws.
 */
import { REGISTER_BODY, UNREGISTER_BODY, UPDATE_BODY, type RegisterBodyDetail } from '@fundamental-engine/core';

/** The body registration event names the queue intercepts (all three `composed` shadow events). */
const QUEUED_EVENTS = [REGISTER_BODY, UNREGISTER_BODY, UPDATE_BODY] as const;

/**
 * Buffered registration events, keyed by their source element so a burst per element collapses to its
 * latest intent (register → update → unregister). Dedupe by element per §31.10: replaying only the
 * last event avoids re-registering a body a later `unregister` already retired.
 */
const pending = new Map<HTMLElement, { type: string; detail: RegisterBodyDetail }>();

/**
 * How many fields are currently live. While zero, early registration events are buffered; once a
 * field is active the events reach it directly, so the queue stops buffering (and, during a flush's
 * replay, does not re-buffer the events it just dispatched — the field is active by then).
 */
let activeFields = 0;

/** Installed once, lazily, on the first `<field-root>`/`<field-field>` construction (guarded for SSR). */
let installed = false;

/** Capture an early registration event into the queue (only while no field is live). */
function capture(e: Event): void {
  if (activeFields > 0) return; // a field is live — it takes the event directly; don't buffer.
  const detail = (e as CustomEvent<RegisterBodyDetail>).detail;
  if (!detail?.element) return;
  // last write wins: a later unregister/update for the same element supersedes an earlier register.
  pending.set(detail.element, { type: e.type, detail });
}

/**
 * Install the capturing document listeners — idempotent, SSR-guarded. Called from the custom
 * element's constructor so it runs on the client before the element upgrades its peers, and never on
 * the server (no `document`). Capturing (`{ capture: true }`) so the queue sees the event on the way
 * down, independent of any later-added bubble-phase field listener.
 */
export function installPreRegistrationQueue(): void {
  if (installed || typeof document === 'undefined') return;
  installed = true;
  for (const type of QUEUED_EVENTS) {
    document.addEventListener(type, capture, { capture: true });
  }
}

/**
 * Mark that a field has become live. The first live field is what makes subsequent registration
 * events skip the queue and reach the field directly. Paired with {@link markFieldInactive}.
 */
export function markFieldActive(): void {
  activeFields++;
}

/**
 * Mark that a live field has torn down. When the last field goes away the queue resumes buffering, so
 * an element that (re)connects during a field-less window is captured for the next field that boots.
 */
export function markFieldInactive(): void {
  if (activeFields > 0) activeFields--;
}

/**
 * Replay every buffered registration event on its source element, then clear the buffer. Called by a
 * field immediately after it wires its body-event listeners, so the events bubble (composed) to the
 * document and the field registers them through its normal, idempotent path. Safe to call with an
 * empty queue (the common client-only case) — it does nothing.
 */
export function flushPreRegistrationQueue(): void {
  if (!pending.size) return;
  // snapshot + clear first: dispatching runs the field's synchronous handlers, and clearing up front
  // means a re-entrant register during that dispatch buffers cleanly for the next flush.
  const queued = [...pending.values()];
  pending.clear();
  for (const { type, detail } of queued) {
    // only replay for an element still in the document — an element that connected and disconnected
    // during the field-less window (unregister superseded register) is already gone; and a stale
    // register whose element never made it into the DOM must not resurrect a body.
    if (!detail.element.isConnected) continue;
    detail.element.dispatchEvent(new CustomEvent(type, { bubbles: true, composed: true, detail }));
  }
}

/** Test-only: the number of events currently buffered (0 once drained). */
export function pendingRegistrationCount(): number {
  return pending.size;
}

/** Test-only: reset all module state (queue, active-field count, install flag) between tests. */
export function resetPreRegistrationQueue(): void {
  pending.clear();
  activeFields = 0;
  if (installed && typeof document !== 'undefined') {
    for (const type of QUEUED_EVENTS) document.removeEventListener(type, capture, { capture: true });
  }
  installed = false;
}

/** Whether the queue is currently buffering (no field live). Test/introspection helper. */
export function isBuffering(): boolean {
  return activeFields === 0;
}
