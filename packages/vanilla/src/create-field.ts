/**
 * `createField` — the one imperative door to the reciprocal field for plain TypeScript.
 *
 * Core is renderer-agnostic: its `createField` REQUIRES a `host`. This vanilla entry bundles the
 * host so the framework-free path stays a one-liner, while still letting you reach the contained
 * and custom-host modes without knowing the lower-level wiring (`createBrowserField`, `containerHost`).
 *
 * Host resolution, in order:
 *   1. explicit `opts.host` — drive any renderer-agnostic `FieldHost` you supply;
 *   2. `containerHost(opts.bounds)` — a CONTAINED field scoped to that element's local space (#540);
 *   3. `browserHost()` — the default, window-scoped field.
 *
 * The frozen contract holds: `createField(canvas)` with no host still auto-supplies `browserHost()`.
 * `bounds` and `host` are additive options.
 *
 * ```ts
 * createField(canvas);                  // window-scoped (default)
 * createField(canvas, { bounds: card }); // contained to an element
 * createField(canvas, { host: myHost }); // a custom host (3D, native, headless)
 * ```
 *
 * A contained field PAUSES while its box is off-screen (#672 lane S2): N cards on a page are
 * otherwise N always-running rAF loops, each simulating and writing feedback for a card nobody can
 * see. Pass `runOffscreen: true` to keep one running.
 */

import { createField as coreCreateField, type FieldHandle, type FieldOptions } from '@fundamental-engine/core';
import { browserHost, containerHost } from '@fundamental-engine/dom';

export interface CreateFieldOptions extends FieldOptions {
  /** render a CONTAINED field scoped to this element instead of the window (#540): bodies are scanned
   *  within `bounds` and positions live in its local coordinate space. Ignored when `host` is given. */
  bounds?: HTMLElement;
  /** keep a CONTAINED field's frame loop running while its `bounds` box is off-screen (default
   *  `false` — an off-screen card pauses entirely, #672 lane S2). Set `true` when the card's field
   *  feeds a read-out the reader can still see, or a `snapshot()` that must have no gap. Ignored
   *  without `bounds` (a window-scoped field has no box to scroll away), and ignored when `host` is
   *  given — `containerHost(el, { pauseOffscreen })` is the lower-level door. */
  runOffscreen?: boolean;
}

/** Start the engine on a canvas you own, resolving the host from `opts.host` → `bounds` → browser. */
export function createField(canvas: HTMLCanvasElement, opts: CreateFieldOptions = {}): FieldHandle {
  const { host, bounds, runOffscreen, ...rest } = opts;
  const resolved = host ?? (bounds ? containerHost(bounds, { pauseOffscreen: !runOffscreen }) : browserHost());
  return coreCreateField(canvas, { ...rest, host: resolved });
}
