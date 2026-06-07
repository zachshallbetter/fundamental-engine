# @field-ui/react

The React adapter for [field-ui](../core) — a reciprocal DOM-physics field as a React
component. Elements you mark with `data-body` become forces; the single background field
reacts to them, and its density reacts back.

→ Live at **[field-ui.com](https://field-ui.com)**.

> **Pre-release: not yet on npm.** Consume from the repository for now (see
> [`RELEASING.md`](../../RELEASING.md)).

React is a **peer dependency** (the core engine stays zero-dependency).

```tsx
import { FieldField } from '@field-ui/react';

export function App() {
  return (
    <>
      <FieldField accent="#4da3ff" />
      <a data-body="attract" data-strength="0.9" data-range="320" data-feedback>
        pull me
      </a>
    </>
  );
}
```

`<FieldField>` mounts a fixed, full-viewport canvas behind your app and runs the
engine on it — the same field the `<forces-field>` custom element and `mountField()`
wrap. It accepts every `FieldOptions` prop (`accent`, `density`, `waves`, `render`,
`palette`, `mass`, `attention`, `causality`) plus `className`/`style`, and an
`onReady` callback that hands you the live `FieldHandle`:

```tsx
<FieldField onReady={(field) => field.scan()} />   // rescan after adding bodies
```

For full control of the canvas element yourself, use the hook:

```tsx
const { canvasRef, fieldRef } = useFieldField({ accent: '#4da3ff' });
return <canvas ref={canvasRef} className="my-field" />;
```

The field reacts to `[data-body]` elements anywhere on the page (the field-reacts
law) — after rendering new bodies, call `field.scan()` (e.g. from `onReady`) so the
engine picks them up.
