# @field-ui/platform

**The platform layer for [field-ui](../core)** — the native browser primitives the engine wishes
existed, built on the ones it has. The core is renderer-agnostic; this package owns DOM participation:
it supplies the browser host, the six registries that let the engine treat the DOM as a connected,
measurable, semantic environment, the frame scheduler that keeps reads and writes from thrashing, and
the runtime that runs recipes and binds data.

→ Live at **[field-ui.com](https://field-ui.com)**.

## Install

```sh
npm i @field-ui/platform
```

The public surface is frozen for `0.x` (see
[API stability](../../docs/canonical/field-ui-api-stability.md)).

## The browser host

The core's `createField` is renderer-agnostic and requires a `FieldHost`. `browserHost()` is the
canonical DOM implementation, and `createBrowserField()` is the host-bundled shortcut:

```ts
import { createField } from '@field-ui/core';
import { browserHost, createBrowserField } from '@field-ui/platform';

const canvas = document.querySelector('canvas')!;
const field = createField(canvas, { host: browserHost() });
// or, equivalently:
const same = createBrowserField(canvas, {});
```

## The platform

`createFieldPlatform(root)` wires the six native-first registries on a root element and a frame
scheduler that runs them in order: **discover → read → compute → state → write → render**.

| Registry | Role |
|---|---|
| `MeasurementRegistry` | frame-stable geometry snapshots (read-phase only) |
| `StateRegistry` | typed numeric / boolean / vector2 element state (not ARIA) |
| `FeedbackRegistry` | write-phase CSS vars + thresholded, debounced events |
| `RelationshipRegistry` | normalize native links (`href#id`, `aria-controls`, `for`, …) into one graph |
| `VisualBindingRegistry` | bind a Canvas / SVG / WebGL visual layer to its semantic source |
| `OverlayRegistry` | relationship / field-line / debug render layers |

```ts
import { createFieldPlatform } from '@field-ui/platform';

const platform = createFieldPlatform(document.documentElement);
platform.measure.register(card, { role: 'body' });
platform.state.set(card, 'density', 0.72);
platform.feedback.bind(card, { density: '--field-density' });
platform.feedback.threshold(card, 'field:lit', { metric: 'density', enter: 0.7, exit: 0.45 });
platform.tick(); // run one frame through the scheduler
```

`createFieldPlatform` returns a `FieldPlatform` — the surface the inspector and tools read.

## Recipes and data

The platform runs recipes and binds application data to the field. `compileRecipe()` (the pure
compiler) lives in [the core](../core); application lives here:

```ts
import { applyRecipe, bindData } from '@field-ui/platform';
import { recipeById } from '@field-ui/core';

// Run a recipe over a region; inspect the live run; tear it down.
const applied = applyRecipe(root, recipeById('reading-field')!);
applied.inspect(); // { frame, measurements, relationships, lint }

// Bind records → bodies. Updates diff by id; removed records decay out.
const binding = bindData(listEl, tasks, (t) => ({
  id: t.id,
  body: { tokens: ['attract'], strength: 0.4 + t.priority },
  metrics: { priority: t.priority },
  label: t.title,
}), { recipe: 'priority-well' });
binding.update(nextTasks);
```

`computeMetrics()` (pure) turns measurements and relationships into the metric values recipes track.

## Lint

`lintPlatform(platform)` runs pure rules over the live registries (missing relationship targets,
unregistered state, overlays without links, off-phase measurement, orphan visuals, …) and returns
structured diagnostics. The inspector reads it each frame.

## Dependency direction

Strict and one-way: **`platform → core`**. The core stays renderer-agnostic and never imports this
package. During the migration window, writes mirror `--field-*` to `--forces-*` and `field:*` events to
`forces:*`. See [`docs/canonical/field-ui-platform-architecture.md`](../../docs/canonical/field-ui-platform-architecture.md).

## Related

[`field-ui`](../core) · [`@field-ui/elements`](../elements) · [`@field-ui/react`](../react) ·
[`@field-ui/vanilla`](../vanilla) · the [documentation map](../../docs/README.md).

## License

MIT © Zach Shallbetter
