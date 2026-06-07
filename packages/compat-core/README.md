# forces-ui (deprecated alias)

`forces-ui` is now a thin compatibility alias of [`field-ui`](../core). It re-exports the
entire `field-ui` core so existing imports keep working during the migration:

```ts
import { createField } from 'forces-ui'; // still works
import { createField } from 'field-ui';  // preferred
```

Install `field-ui` for new code. This alias keeps working behavior-identically through `0.x` and is
removal-gated: see the `forces-*` → `field-*` alias window in
[API stability](../../docs/canonical/field-ui-api-stability.md) and the [documentation map](../../docs/README.md).
