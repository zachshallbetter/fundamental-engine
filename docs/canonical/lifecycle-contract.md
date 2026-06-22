# Lifecycle contract — register · measure · unmount

> **Status: shipped.** The create→register→measure→unmount contract is identical across the three
> authoring surfaces because all three create the **same** core `FieldHandle` (vanilla `createField` /
> `<field-root>` / React `<FieldField>`). This document is the RC-3 contract record (closes #320); the
> per-surface tests below pin it.

Every surface follows the same four-beat life:

| Beat | What happens | Who triggers it |
|---|---|---|
| **create** | a `FieldHandle` is built on a canvas (`createField` / `createBrowserField`) | the surface, on mount |
| **register** | the field discovers `[data-body]` elements (the *field-reacts* law) via `scan()` | automatic on create; re-run with `scan()`/`rescan()` after DOM changes |
| **measure** | bodies are re-measured on a cadence (every 6th frame) and feedback vars written | the rAF loop, automatically |
| **unmount** | `destroy()` cancels the rAF, removes listeners, releases the canvas/overlay | the surface, on teardown |

`destroy()` is **idempotent** — calling it twice is a no-op, never a throw (core invariant, pinned by
`vanilla/field.test.ts`). After `destroy()` the handle holds no rAF, no pointer listeners, and no
IntersectionObserver; a field created with `render:'none'` never acquired a 2D context, and `destroy()`
must not need one either.

## Per surface

### Vanilla — `createField` / `new FieldField` (`@fundamental-engine/vanilla`)
- **create:** `createField(canvas, opts)` resolves host → bounds → `browserHost` (#537). `mountField()`
  appends a managed, click-through canvas; `new FieldField({ bounds })` scopes the field to a container.
- **register / measure:** automatic. Call `scan()` after you add bodies; `rescan()` forces a re-measure.
- **unmount:** **you call `destroy()`.** If `mountField`/`FieldField` created the canvas, `destroy()`
  removes it; if you passed your own canvas, `destroy()` leaves it in the DOM.
- *Pinned by:* `vanilla/field.test.ts` (create/destroy, idempotent destroy, managed-canvas append+remove,
  no-context-on-`render:'none'`, destroy-without-context).

### Web component — `<field-root>` (`@fundamental-engine/elements`)
- **create:** `connectedCallback` → `start()` builds the field from the current attributes and starts an
  `IntersectionObserver` (so a `display:none` field keeps simulating but skips draw).
- **register / measure:** automatic; live attribute changes route through `attributeChangedCallback`
  (color/render/toggle attrs through setters, construction-time `density`/`waves`/`mass` rebuild).
- **unmount:** **`disconnectedCallback` does it for you** — disconnects the observer, `field.destroy()`,
  removes the owned overlay canvas, `platformRuntime.destroy()`, and clears every handle to `undefined`.
- *Pinned by:* `elements/lifecycle.test.ts` (the disconnect/unmount contract) + `option-attrs.test.ts`.

### React — `<FieldField>` / `useFieldField` (`@fundamental-engine/react`)
- **create:** a `useEffect` creates the field via `createBrowserField` once the canvas ref is set, and
  lazily creates the overlay canvas when an `overlay` mode is requested. `onReady(field)` hands you the
  handle.
- **register / measure:** automatic. Call `field.scan()` from `onReady` after rendering new bodies.
- **unmount:** **the effect's cleanup does it for you** — `field.destroy()`, then removes and nulls the
  overlay canvas the component owns. The field is **re-created** only when a declarative engine option in
  the dep list actually changes; the determinism seams (`rng`/`now`/`feedbackSink`/`overlayBackend`) are
  config-set-once and deliberately kept out of the dep list so an inline value passed each render doesn't
  thrash the field. **This is the resolution of the historical register/unmount ambiguity: cleanup is the
  effect return, re-create is dep-list-gated.**
- *Pinned by:* `react/field.test.ts` (the create→destroy→overlay-removal unmount contract; the full
  option set constructs and the handle carries the full surface).

## The one rule for consumers

**You own `destroy()` only on the vanilla surface.** The web component (`disconnectedCallback`) and React
(`useEffect` cleanup) call it for you on unmount — never call `destroy()` on a field a framework manages.
