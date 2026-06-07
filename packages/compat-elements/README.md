# @forces-ui/elements (deprecated alias)

A thin compatibility alias of [`@field-ui/elements`](../elements). Importing it registers the
same custom elements and re-exports the same API, so existing usage keeps working during the
migration:

```ts
import '@forces-ui/elements'; // still works — registers forces-field, forces-cell, field-*
import '@field-ui/elements';  // preferred
```

Install `@field-ui/elements` for new code. This alias keeps working behavior-identically through `0.x`
and is removal-gated: see the `forces-*` → `field-*` alias window in
[API stability](../../docs/canonical/field-ui-api-stability.md).
