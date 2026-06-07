# @field-ui/platform

The **platform-adjacent layer** for [field-ui](../core) — the native browser primitives field-ui
wishes existed, built on the ones it has. Six native-first, dependency-light registries that let the
field engine treat the DOM as a connected, measurable, semantic environment:

| Registry | Role |
|---|---|
| `MeasurementRegistry` | frame-stable geometry snapshots (read-phase only) |
| `StateRegistry` | typed numeric / boolean / vector2 element state (not ARIA) |
| `FeedbackRegistry` | write-phase CSS vars + thresholded, debounced events |
| `RelationshipRegistry` | normalize native links into one relationship graph *(PR-B)* |
| `VisualBindingRegistry` | bind a Canvas/SVG visual layer to its semantic source *(PR-B)* |
| `OverlayRegistry` | relationship / field-line / debug render layers *(PR-B)* |

```ts
import { createFieldPlatform } from '@field-ui/platform';

const field = createFieldPlatform(document.documentElement);
field.measure.register(card, { role: 'body' });
field.state.set(card, 'density', 0.72);
field.feedback.bind(card, { density: '--field-density' });
field.feedback.threshold(card, 'field:lit', { metric: 'density', enter: 0.7, exit: 0.45, exitEvent: 'field:dim' });
field.tick(); // read → state → write
```

**Dependency direction is strict:** `platform → core`. `@field-ui/core` stays renderer-agnostic and
never imports this package. Writes mirror `--field-*` to `--forces-*` and `field:*` events to
`forces:*` during the migration window.
