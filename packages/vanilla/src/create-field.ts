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
 */

import { createField as coreCreateField, type FieldHandle, type FieldOptions } from '@fundamental-engine/core';
import { browserHost, containerHost } from '@fundamental-engine/dom';

export interface CreateFieldOptions extends FieldOptions {
  /** render a CONTAINED field scoped to this element instead of the window (#540): bodies are scanned
   *  within `bounds` and positions live in its local coordinate space. Ignored when `host` is given. */
  bounds?: HTMLElement;
}

/** Start the engine on a canvas you own, resolving the host from `opts.host` → `bounds` → browser. */
export function createField(canvas: HTMLCanvasElement, opts: CreateFieldOptions = {}): FieldHandle {
  const { host, bounds, ...rest } = opts;
  const resolved = host ?? (bounds ? containerHost(bounds) : browserHost());
  return coreCreateField(canvas, { ...rest, host: resolved });
}
