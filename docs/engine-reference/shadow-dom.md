> **Status: as-built force-engine reference.**
> Accurate for force formulas, catalogs, and engine behavior. It does NOT define the full current Fundamental platform architecture — for that see [../canonical/platform-architecture.md](../canonical/platform-architecture.md) and [../canonical/system-contracts.md](../canonical/system-contracts.md).

# Shadow DOM Participation Model for Fundamental

> **Status: core model implemented.** The host-first, event-driven registration model
> (§§1–7, 10, 11, 15, 16) now ships: the field listens for the composed `field:register-body`
> / `field:unregister-body` / `field:update-body` events, registers the **host** without
> inspecting the shadow tree, measures it by `getBoundingClientRect` or an optional `getRect`,
> and writes `--d` / `--field-density` back to the host (or a `writeTarget`). A
> `FieldController` helper (§31.1) removes the event boilerplate. Engine pieces:
> `core/shadow.ts` (`FieldController`, `ShadowRegistry`), `core/scanner.ts` (`bodyFromElement`,
> rect-provider measurement), and the event wiring in `core/field.ts`; covered by
> `core/shadow.test.ts`. The production-hardening additions in §31 (portals, scopes, the
> registration handshake, SSR queue, throttled field events, local-cell budgets) remain
> **proposed**. Summary in [`field-concept.md`](../planning-archive/field-concept.md) §24–26.

> **Phase D note (platform runtime).** Shadow-DOM host registration is now handled by
> `@fundamental-engine/platform`: the platform owns DOM participation, so a registered host's `getRect`
> flows into the `MeasurementRegistry` and feedback writes are issued through the
> `FeedbackRegistry`. The legacy `core/shadow.ts` path remains and behaves as documented below,
> but on a default `<field-root>` the platform runtime is what binds these bodies to the field
> (opt back to pure-legacy with `experimental-platform="off"` / `usePlatformRuntime(false)`).

## 1. Definition

Shadow DOM support in Fundamental means that encapsulated components can participate in the same reciprocal field as normal DOM elements without exposing their internal markup.

A component may hide its structure, styles, and rendering details inside a shadow root, but if it participates in the field, it must expose a public physical body to the field engine.

The engine does not need to inspect the shadow tree.

It needs only:

1. a registered element,
2. a viewport-relative rectangle,
3. force attributes or equivalent registration data,
4. a write-back target for field state.

By default, the registered body is the custom element host.

## 2. Core Principle

Presentation can be private.

Physics must be public.

Shadow DOM encapsulates rendering, styling, and internal component structure. It does not hide physical participation from the field.

A component can be internally private while still publicly saying:

```txt
I am a body. Here is my rectangle. Here are my forces. Write my field state here.
```

## 3. Purpose

The Shadow DOM participation model allows Fundamental to work across:

- plain HTML elements,
- custom elements,
- Web Components,
- encapsulated design-system components,
- framework-rendered components,
- local simulation cells,
- documentation examples,
- Lab experiments,
- interactive cards,
- typography components,
- marks and symbols.

The goal is to make physical participation independent from rendering implementation.

The field should not care whether a body comes from light DOM, Shadow DOM, React, Vue, Svelte, a custom element, or a generated data record.

If it registers a body, it participates.

## 4. Two Supported Modes

Shadow DOM support has two modes.

### 4.1 Global Participant

A global participant joins the shared page-wide field.

It does not create its own canvas.

It does not create its own particle pool.

It registers a body with the root field engine and participates in the same simulation as the rest of the page.

Use this for:

- <forces-text>
- <forces-card>
- <forces-button>
- <forces-link>
- <forces-body>
- <forces-mark>
- navigation items
- capability cards
- call-to-action elements
- structured content components

Example:

```html
<forces-text
data-body="attract"
data-strength="0.9"
data-range="320"
data-feedback >
mass </forces-text>
```

The root field tracks the <forces-text> host as a body.

### 4.2 Local Simulation Cell

A local simulation cell owns an isolated field.

It creates its own canvas, particle pool, registry, coordinate system, and lifecycle.

It does not affect the root field unless explicitly bridged.

Use this for:

- documentation demos,
- Storybook examples,
- Lab experiments,
- force playgrounds,
- conformance visualizations,
- embedded article demos.

Example:

```html
<field-cell mode="local" formation="wells" density="0.8">
<forces-body data-body="attract" data-strength="1"></forces-body>
<forces-body data-body="repel" data-strength="1"></forces-body> </field-cell>
```

A local cell is explicit. Components should not create a private canvas by default.

## 5. Default Body Target

The default registered body is the custom element host.

Example:

```html
<forces-card data-body="tether attract" data-feedback>
<h3>Architecture</h3> </forces-card>
```

The engine registers:

```txt
<forces-card>
```

not:

```txt
forces-card.shadowRoot.querySelector(...)
```

This keeps the system compatible with:

- open shadow roots,
- closed shadow roots,
- slotted content,
- framework wrappers,
- server-rendered custom elements,
- partially upgraded custom elements.

## 6. Host-Based Registration

A participating custom element should register itself from connectedCallback().

```ts
connectedCallback() {
this.dispatchEvent(new CustomEvent("field:register-body", {
bubbles: true,
composed: true,
detail: {
element: this
}
})); }
```

It should unregister from disconnectedCallback().

```ts
disconnectedCallback() {
this.dispatchEvent(new CustomEvent("field:unregister-body", {
bubbles: true,
composed: true,
detail: {
element: this
}
})); }
```

It should dispatch an update when force-relevant attributes change.

```ts
attributeChangedCallback() {
this.dispatchEvent(new CustomEvent("field:update-body", {
bubbles: true,
composed: true,
detail: {
element: this
}
})); }
```

The composed: true flag is required. It allows the event to cross the shadow boundary.

## 7. Registration Event Contract

The registration event payload may provide only an element, or it may provide additional metadata. The shipped type is `RegisterBodyDetail` (`core/shadow.ts`):

```ts
interface RegisterBodyDetail {
element: HTMLElement;
getRect?: () => DOMRect;
attrs?: Record<string, string>;
writeTarget?: HTMLElement; };
```

### element

The public physical element.

Usually the custom element host.

### getRect

An optional rectangle provider.

Use this when the physical body is not the same as the host box.

### attrs

Optional explicit body attributes, keyed by the suffix after `data-`
(e.g. `{ body: "attract", strength: "0.9" }`).

If omitted, the engine reads attributes from element.

### writeTarget

Optional element that receives CSS variable write-back.

Default:

```txt
element
```

## 8. Supported Body Attributes

A host may expose force behavior with the same attributes used by plain HTML bodies.

```html
<forces-body
data-body="attract"
data-strength="1"
data-range="300"
data-angle="0"
data-spin="1"
data-when="active"
data-feedback
data-color="#4da3ff" ></forces-body>
```

Core attributes:

```txt
data-body data-strength data-range data-angle data-spin data-when data-feedback data-color data-absorb data-max data-pair data-scope data-field
```

Shadow DOM does not require a separate force API. It uses the same body contract as the rest of the system.

## 9. Attribute Reflection

Custom elements that expose force attributes should observe them.

```ts
static observedAttributes = [
"data-body",
"data-strength",
"data-range",
"data-angle",
"data-spin",
"data-when",
"data-feedback",
"data-color",
"data-absorb",
"data-max",
"data-pair",
"data-scope",
"data-field" ];
```

When an observed attribute changes, the component should notify the field engine.

```ts
attributeChangedCallback() {
this.dispatchEvent(new CustomEvent("field:update-body", {
bubbles: true,
composed: true,
detail: {
element: this
}
})); }
```

This avoids requiring the root engine to inspect shadow internals.

## 10. Coordinate Contract

The engine measures the registered element using getBoundingClientRect().

This works for:

- light DOM elements,
- custom element hosts,
- elements inside open shadow roots,
- elements inside closed shadow roots when exposed through getRect.

Canonical conversion (as built in `measureBodies`, `core/scanner.ts`): the rect is
read viewport-relative, with no canvas-rect subtraction and no DPR scaling.

```ts
const r = body.rect ? body.rect() : body.el.getBoundingClientRect();
b.cx = r.left + r.width / 2;
b.cy = r.top + r.height / 2;
b.hw = r.width / 2;
b.hh = r.height / 2;
```

The provided `getRect` is attached to the body as `body.rect` at registration
(`ShadowRegistry.bodies`), so closed roots and internal cores feed their own box
through the same path.

## 11. Density Write-Back Contract

The field writes state back to the registered element or write target using CSS custom properties.

`--field-density` is the primary density variable (with `--d` and `--forces-density` as legacy/compat
aliases). The platform `FeedbackRegistry` also auto-mirrors `--field-*` to `--forces-*`.

Minimum variables:

```css
--field-density --field-accent
```

Explicit variables:

```css
--field-density --field-accent --field-heat --field-entropy --field-coherence --field-accreted
```

Engine write example:

```ts
const target = body.writeTarget ?? body.element;
target.style.setProperty("--d", String(body.d)); target.style.setProperty("--field-density", String(body.d)); target.style.setProperty("--accent", accent); target.style.setProperty("--field-accent", accent); target.style.setProperty("--field-heat", String(body.heat ?? 0)); target.style.setProperty("--field-entropy", String(body.entropy ?? 0)); target.style.setProperty("--field-coherence", String(body.coherence ?? 0)); target.style.setProperty("--field-accreted", String(body.accretedRatio ?? 0));
```

Shadow CSS consumes those variables internally.

```css
:host {
font-variation-settings:
"wght" calc(300 + var(--field-density, var(--d, 0)) * 500);
text-shadow:
0 0 calc(var(--field-density, var(--d, 0)) * 14px)
var(--field-accent, var(--accent)); }
```

The engine should not need to mutate internal shadow elements.

## 12. Closed Shadow DOM Support

Closed shadow roots must be supported.

The engine should not require:

```ts
element.shadowRoot
```

The engine should require only:

```ts
element.getBoundingClientRect() element.style.setProperty(...)
```

or an explicit getRect() callback.

Supported:

```txt
closed shadow root + host registration
```

Supported:

```txt
closed shadow root + custom getRect provider
```

Not supported by default:

```txt
closed shadow root + hidden internal body with no public registration
```

## 13. Internal Body Registration

Most components should register the host.

A component may register an internal body only when the internal physical body is materially different from the host.

Use cases:

- the host is large but the physical core is small,
- the component contains multiple independent force bodies,
- the body is a specific internal mark,
- the body is a media region,
- the host box does not match the visual body.

Closed-root-safe registration:

```ts
this.dispatchEvent(new CustomEvent("field:register-body", {
bubbles: true,
composed: true,
detail: {
element: this,
getRect: () => this.#core.getBoundingClientRect()
} }));
```

The host should remain the write-back target unless a separate writeTarget is provided.

## 14. Multiple Bodies in One Component

**As built:** the registry stores **one body per registered host element**. A registration
event contributes exactly one body, keyed by `detail.element`; re-registering the same element
updates that element's detail idempotently, and disconnected hosts are pruned. There is no
`bodies` array in the event detail and no `::core` / `::rim` virtual indexing.

> **Proposed (not implemented).** A component could expose multiple virtual bodies from one
> host, each with its own rect and attrs and a stable `hostId::bodyId` key:
>
> ```ts
> // PROPOSED — not in the shipped code.
> this.dispatchEvent(new CustomEvent("field:register-body", {
> bubbles: true,
> composed: true,
> detail: {
> element: this,
> bodies: [
> {
> id: "core",
> getRect: () => this.#core.getBoundingClientRect(),
> attrs: { body: "sink attract", strength: 0.8, range: 320 }
> },
> {
> id: "rim",
> getRect: () => this.#rim.getBoundingClientRect(),
> attrs: { body: "wall" }
> }
> ]
> } }));
> ```
>
> Stable IDs (`forces-card-17::core`, `forces-card-17::rim`, …) would matter for record/replay,
> conformance tests, debug overlays, URL serialization, and deterministic updates.

## 15. Registry Contract

**As built (`ShadowRegistry`, `core/shadow.ts`):** the registry is a `Map` keyed by the host
element, holding that host's registration detail. Each live host yields exactly one body.

```ts
const hosts = new Map<HTMLElement, RegisterBodyDetail>();
```

Registration is idempotent — `register(detail)` simply does `hosts.set(detail.element, detail)`,
so re-registering the same element overwrites (refreshes) its detail rather than creating a
duplicate.

The registry prunes disconnected hosts each time it builds bodies, rather than relying on
`disconnectedCallback()` alone:

```ts
for (const [el, detail] of hosts) {
if (!el.isConnected) { hosts.delete(el); continue; }
// build one body from el (or detail.attrs); attach detail.getRect / detail.writeTarget
}
```

## 16. Measurement Contract

Use registration events as the canonical body discovery mechanism.

Use scanning only as a compatibility fallback.

Recommended measurement tools:

```txt
ResizeObserver IntersectionObserver dirty-body queue periodic fallback measurement
```

Rules:

- ResizeObserver marks geometry dirty.
- IntersectionObserver marks visibility.
- dirty bodies are remeasured before simulation.
- offscreen bodies do not exert force.
- periodic fallback catches missed changes.

Measurement loop:

```ts
for (const body of bodies) {
if (body.dirty || frame % measureEvery === 0) {
const rect = body.getRect
? body.getRect()
: body.element.getBoundingClientRect();
updateGeometry(body, rect);
} }
```

## 17. Field Discovery

A body should register with the nearest appropriate field.

Resolution order:

```txt
1. explicit data-field target 2. nearest local field-cell 3. root field-root 4. no-op until a field is available
```

Example:

```html
<forces-body data-field="hero-field" data-body="attract"></forces-body>
```

Field target type:

```ts
type FieldTarget = "nearest" | "root" | string;
```

Default:

```txt
nearest
```

## 18. Field Scopes

A body may declare a field scope.

```html
<forces-body data-scope="global"></forces-body> <forces-body data-scope="local"></forces-body>
```

### global

Register with the root field.

### local

Register with the nearest local cell.

### nearest

Register with the nearest available field.

Recommended default:

```txt
nearest
```

## 19. Field Portals

Field portals allow a body to participate in a field outside its nearest DOM ancestry.

Use cases:

- modals affecting the root field,
- overlays participating in page physics,
- tooltips joining the global field,
- local demos intentionally joining the global canvas,
- app shells with multiple field roots.

Example:

```html
<forces-body
data-field="#global-field"
data-body="attract" ></forces-body>
```

The engine resolves the target field and registers the body there.

## 20. Styling and Parts

CSS custom properties are the primary write-back path.

::part() may expose controlled internal styling hooks.

Example:

```html
<forces-text>
#shadow-root
<span part="label"><slot></slot></span>
<span part="glow"></span> </forces-text>
```

External styling:

```css
forces-text::part(glow) {
opacity: var(--field-density, var(--d, 0)); }
```

Recommended standard parts:

| Component | Parts |
|---|---|
| forces-text | label, glow, mark |
| forces-card | surface, content, aura, meter |
| field-cell | canvas, overlay, controls |
| forces-body | body, icon, meter |

Use ::part() for stable styling hooks.

Do not expose fragile internal structure.

## 21. ElementInternals

Custom elements may use ElementInternals for internal state.

Examples:

```ts
this.internals.states.add("field-active"); this.internals.states.add("field-dense"); this.internals.states.add("field-hot");
```

Possible CSS:

```css
:host(:state(field-active)) {
outline: 1px solid var(--field-accent, var(--accent)); }
```

Use this for component-local semantics.

Do not use it as the main field write-back mechanism. CSS variables remain the primary contract.

## 22. Field-Caused Events

The field may dispatch behavior events on registered hosts.

Recommended events:

```txt
field:lit field:dim field:saturated field:supernova field:entered field:exited field:density-change field:captured field:released
```

Example:

```ts
body.element.dispatchEvent(new CustomEvent("field:lit", {
bubbles: true,
composed: true,
detail: {
density: body.d,
heat: body.heat,
entropy: body.entropy
} }));
```

These events let encapsulated components and app-level code respond to field state.

Events should be thresholded and debounced.

Do not dispatch on every frame unless explicitly requested.

## 23. Field Observer API

Advanced components may subscribe to body state.

```ts
const unsubscribe = field.observeBody(element, state => {
// density, heat, entropy, coherence, accreted });
```

Use cases:

- meters,
- custom internal animation,
- chart components,
- accessibility summaries,
- audio mappings,
- non-CSS reactions.

CSS variables remain the default path.

Observers are for advanced behavior only.

## 24. Accessibility

Shadow DOM components must expose field behavior accessibly.

Rules:

- do not announce every density change,
- respect reduced motion,
- preserve real text content,
- do not turn decorative particle behavior into semantic content,
- use aria-hidden for decorative local cells,
- label interactive simulations,
- map field state to ARIA only when it reflects real interaction state.

Decorative:

```html
<field-cell aria-hidden="true"></field-cell>
```

Interactive:

```html
<field-cell aria-label="Interactive force simulation"></field-cell>
```

Reduced motion behavior:

```txt
freeze or simplify motion preserve readable content use lit states instead of travel disable unnecessary sparks
```

## 25. SSR and Hydration

The system must degrade cleanly before custom elements upgrade.

Rules:

- content remains readable without JavaScript,
- light DOM scanning can register [data-body] before upgrade,
- custom elements register after connectedCallback,
- duplicate registration is idempotent,
- hydration does not create duplicate bodies,
- stable body IDs survive upgrade,
- unupgraded elements should not break layout.

Example fallback CSS:

```css
forces-text {
color: var(--field-accent, var(--accent, currentColor)); }
field-cell:not(:defined) {
display: block;
min-height: 240px; }
```

## 26. No-JS Fallback

The interface should remain useful if the field does not initialize.

Fallback requirements:

- text remains visible,
- links remain usable,
- layout does not depend on canvas,
- custom elements display content,
- density variables default safely,
- local cells reserve space or collapse intentionally.

Default variables:

```css
:root {
--d: 0;
--field-density: 0;
--field-heat: 0;
--field-entropy: 0;
--field-coherence: 1; }
```

## 27. Debugging

Debug overlays must understand Shadow DOM bodies.

Display:

- body rect,
- field target,
- scope,
- token list,
- density,
- heat,
- entropy,
- coherence,
- source of rectangle: host or custom getRect,
- write target,
- virtual body ID,
- visibility,
- registration state.

Closed shadow roots should still be visible in debug overlays through host registration.

## 28. Anti-Patterns

Do not crawl all shadow roots looking for [data-body].

Do not require all shadow roots to be open.

Do not create one canvas per component by default.

Do not hide the physical body inside a closed shadow root without a public getRect.

Do not write density only to internal shadow elements.

Do not register fragile internal spans unless necessary.

Do not make local simulation cells affect the root field by default.

Do not use Shadow DOM to fragment the original reciprocal field concept.

## 29. Required Tests

### Registration

```txt
host custom element registers successfully registration event crosses shadow boundary unregister removes body update event refreshes attrs disconnected host is pruned registration is idempotent
```

### Closed Shadow DOM

```txt
closed-root host registration works engine does not access shadowRoot CSS variables written to host are consumed internally custom getRect supports internal body geometry
```

### Geometry

```txt
host rect maps to root canvas local cell rect maps to local canvas canvas offset is handled scroll offset is handled DPR scaling is handled CSS transforms are reflected in rect
```

### Density Write-Back

```txt
--d is written to host --field-density is written to host --field-accent is written to host shadow CSS responds to density internal mutation is not required
```

### Local Cell Isolation

```txt
local cell owns its own canvas local cell body does not register with root field by default local particles do not affect root particles destroying cell cleans animation loop destroying cell unregisters bodies
```

### Multiple Bodies

```txt
component can register multiple virtual bodies virtual body IDs are stable unregister removes all owned bodies debug overlay shows each virtual body
```

### Field Portals

```txt
data-field targets a specific field data-scope global bypasses local cell data-scope local uses nearest cell nearest fallback works
```

## 30. Summary

Shadow DOM participation in Fundamental is a host-first, event-driven body registration model.

The root engine does not inspect component internals.

A component participates by exposing a public body, a rectangle, force attributes, and a CSS-variable write-back target.

The default body is the custom element host.

Closed shadow roots are supported.

Local canvases are explicit through <field-cell> only.

The shared reciprocal field remains the default.

Presentation can be private.

Physics must be registered, measurable, and testable.

---

## 31. Additional Ideas (production resilience)

The core model above is covered. These additions harden it for production — portals, SSR,
nested fields, design-system usage, and debugging. Except where marked **shipped**, they are
**proposed (not implemented)**.

> **Proposed (not implemented) — `scope` / `field` on the registration detail.** The shipped
> `RegisterBodyDetail` carries only `element`, `getRect`, `attrs`, and `writeTarget` (§7). Field
> selection and scope are future additions:
>
> ```ts
> // PROPOSED — not in the shipped type.
> scope?: "global" | "local"; // default "global"
> field?: "nearest" | "root" | string; // default "nearest"
> ```
>
> See §17–§19 for the broader (also proposed) field-discovery, scope, and portal model.

### 1. A FieldController helper for custom elements

**Shipped (`FieldController`, `core/shadow.ts`).** Instead of every custom element manually
dispatching registration events, the engine provides a tiny controller class. Construct it with
the host (and optional extra detail), then call `connect()` / `disconnect()` / `update()` from
the element's lifecycle callbacks; each emits the corresponding composed event with
`detail: { element: host, ...extra }`.

```ts
class FieldController {
  constructor(
    private host: HTMLElement,
    private detail: Omit<Partial<RegisterBodyDetail>, "element"> = {},
  ) {}
  connect() { this.emit("field:register-body"); }
  disconnect() { this.emit("field:unregister-body"); }
  update() { this.emit("field:update-body"); }
  private emit(type: string) {
    this.host.dispatchEvent(new CustomEvent(type, {
      bubbles: true,
      composed: true,
      detail: { element: this.host, ...this.detail },
    }));
  }
}
```

Then a component can do:

```ts
class ForcesText extends HTMLElement {
  #forces = new FieldController(this);
  connectedCallback() {
    this.#forces.connect();
  }
  disconnectedCallback() {
    this.#forces.disconnect();
  }
  attributeChangedCallback() {
    this.#forces.update();
  }
}
```

This prevents event boilerplate from spreading across every component.

### 2. Define a ForceParticipatingElement interface

Give custom elements a formal internal shape.

```ts
interface ForceParticipatingElement extends HTMLElement {
  forces?: {
    getRect?: () => DOMRect;
    getAttrs?: () => Partial<ForcesBodyAttributes>;
    getWriteTarget?: () => Element;
    getVirtualBodies?: () => ForcesVirtualBody[];
  };
}
```

The event can pass element, and the engine can read optional methods if present.

This gives advanced components a stable integration point without making the engine crawl internals.

### 3. Add lifecycle state protection

Custom elements can connect and disconnect quickly during hydration, routing, or framework reparenting.

Add lifecycle guards:

```ts
type BodyLifecycleState =
  | "pending"
  | "registered"
  | "dirty"
  | "hidden"
  | "disconnected"
  | "disposed";
```

This helps prevent:

* duplicate registration
* stale bodies
* dangling local simulation cells
* bodies that keep receiving density after removal
* unregister/register flicker during reparenting

### 4. Add data-forces-participate

Separate participation from force declaration.

Example:

```html
<forces-card data-forces-participate data-body="attract">
  ...
</forces-card>
```

This gives you a clear switch for components that expose force-related styling but should not always register.

Possible values:

data-forces-participate="auto"
data-forces-participate="on"
data-forces-participate="off"

Default for forces-* elements could be auto.

### 5. Add data-field-contain

Define what rectangle represents the body.

```html
<forces-card data-field-contain="host"></forces-card>
<forces-card data-field-contain="content"></forces-card>
<forces-card data-field-contain="visual"></forces-card>
<forces-card data-field-contain="custom"></forces-card>
```

Meanings:

| Value | Meaning |
|---|---|
| `host` | host element box |
| `content` | slotted content bounding box |
| `visual` | internal visual surface |
| `custom` | component-provided getRect() |

Default: host.

### 6. Add data-field-write

Define where reciprocal state is written.

```html
<forces-card data-field-write="host"></forces-card>
<forces-card data-field-write="surface"></forces-card>
<forces-card data-field-write="none"></forces-card>
```

Meanings:

| Value | Meaning |
|---|---|
| `host` | write CSS variables to host |
| `surface` | component-provided internal surface |
| `none` | participate physically but do not receive CSS write-back |

Default: host.

Useful for components where the physical body and visual response are different.

### 7. Add a body registration handshake

Instead of fire-and-forget registration, the engine can confirm registration.

Component dispatches:

field:register-body

Engine responds on the same element:

field:body-registered

With detail:

{
  bodyId: string;
  fieldId: string;
  scope: "global" | "local";
}

This is useful for:

* debug UI
* components that need to know whether they are live
* fallback behavior
* multiple field roots
* portal targeting

### 8. Add no-field fallback behavior

If no field engine exists, components should not break.

Suggested behavior:

If no field responds within one microtask or animation frame:
  remain readable
  keep default CSS variable values
  optionally set state: field-unavailable

With ElementInternals:

```ts
this.internals.states.add("field-unavailable");
```

Then:

:host(:state(field-unavailable)) {
  /* static fallback */
}

### 9. Add a field availability event

When a field mounts, it can announce itself:

```ts
document.dispatchEvent(new CustomEvent("field:field-ready", {
  bubbles: true,
  composed: true,
  detail: {
    fieldId: "root",
    scope: "global"
  }
}));
```

Components that connected before the field exists can retry registration.

### 10. Add a registration queue for early components

During SSR/hydration, elements may register before the root field is ready.

Use a lightweight queue:

```ts
const pendingBodies = new Set<RegisterBodyInput>();
```

When the field initializes:

* drain pending bodies
* dedupe by element/body ID
* resolve scope
* register

This avoids requiring component order to be perfect.

### 11. Add “shadow-safe scanner fallback”

Scanning should not crawl shadow roots, but it can still scan light DOM for custom element hosts.

```ts
document.querySelectorAll("[data-body], [data-forces-participate]");
```

This catches:

* plain HTML
* unupgraded custom elements
* SSR output
* failed registration events

For shadow internals, rely on events.

### 12. Add constructable stylesheet support

For Web Components, ship shared component CSS as a constructable stylesheet.

```ts
const forcesTextSheet = new CSSStyleSheet();
forcesTextSheet.replaceSync(`
  :host {
    --field-density: var(--field-density, var(--d, 0));
  }
`);
```

Then:

```ts
this.shadowRoot.adoptedStyleSheets = [forcesTextSheet];
```

This keeps component styles fast and consistent.

### 13. Add a forces-surface concept

For more complex components, the visual response target may be different from the physical host.

Example:

```html
<forces-card data-body="tether">
  #shadow-root
    <div part="surface" data-forces-surface></div>
</forces-card>
```

The host registers as the body, but --field-density is also mirrored to the surface.

This helps when:

* host is layout-only
* internal card surface needs glow
* density should not affect wrapper geometry
* component has several responsive surfaces

### 14. Add virtual body priority

If multiple bodies overlap inside a component, define priority.

```ts
type VirtualBody = {
  id: string;
  priority?: number;
  attrs: Partial<ForcesBodyAttributes>;
  getRect: () => DOMRect;
};
```

Use priority for:

* resolving debug labels
* event dispatch order
* density ownership
* local cell interactions

### 15. Add “body groups” for encapsulated components

A component with multiple bodies should expose them as a group.

```ts
type BodyGroup = {
  owner: Element;
  groupId: string;
  bodies: VirtualBody[];
};
```

Useful for:

* cards with core/rim/aura
* widgets with multiple hotspots
* complex components
* replay serialization

### 16. Add field:body-state event for debug and observers

Instead of every observer needing direct engine access, the engine can optionally dispatch throttled state events.

```ts
element.dispatchEvent(new CustomEvent("field:body-state", {
  bubbles: false,
  composed: false,
  detail: {
    density,
    heat,
    entropy,
    coherence,
    accreted
  }
}));
```

Keep it opt-in:

```html
<forces-card data-field-events="state"></forces-card>
```

### 17. Add event throttling modes

Field events can get noisy. Define event policies.

```html
<forces-card data-field-events="threshold"></forces-card>
<forces-card data-field-events="state:250"></forces-card>
<forces-card data-field-events="none"></forces-card>
```

Meanings:

| Value | Meaning |
|---|---|
| `none` | no field events |
| `threshold` | only lit/dim/saturated/etc. |
| `state:250` | state event every 250ms |
| `frame` | every frame, debug only |

Default: threshold.

### 18. Add reduced-motion behavior at component level

The field may be reduced, but components should also respond.

```css
@media (prefers-reduced-motion: reduce) {
  :host {
    transition: none;
    animation: none;
  }
}
```

Component state:

```html
<forces-text motion="reduced-safe"></forces-text>
```

Values:

motion="full"
motion="reduced-safe"
motion="static"

### 19. Add scoped local-cell budgets

Local cells need hard caps.

```html
<field-cell
  mode="local"
  density="0.5"
  max-particles="120"
  max-bodies="12"
  fps="30"
></field-cell>
```

This prevents docs pages from becoming expensive when many examples exist.

### 20. Add teardown guarantees for local cells

A local cell must clean up:

* animation frame loop
* ResizeObserver
* IntersectionObserver
* event listeners
* particles
* body registry
* adopted field handles
* debug overlays

Add a conformance/lifecycle test for this.

The strongest additions to include

For the standalone Shadow DOM definition, the priority additions are:

1. FieldController helper so custom elements do not duplicate event boilerplate. **(Shipped.)**
2. Handshake events so components know whether they are registered.
3. Field-ready / pending registration queue for SSR and hydration.
4. data-field-contain and data-field-write to clarify body geometry and write-back.
5. Event throttling policy to prevent noisy field-caused events.
6. Local cell budgets and teardown rules for performance safety.

The overall principle stays unchanged: Shadow DOM components should encapsulate presentation, but physical participation must remain registered, measurable, and testable.