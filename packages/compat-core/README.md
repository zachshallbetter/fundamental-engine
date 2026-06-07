# forces-ui (deprecated alias)

`forces-ui` is now a thin compatibility alias of [`field-ui`](../core). It re-exports the
entire `field-ui` core so existing imports keep working during the migration:

```ts
import { createField } from 'forces-ui'; // still works
import { createField } from 'field-ui';  // preferred
```

Install `field-ui` for new code. This alias will be removed in a future major release.
See `docs/field-ui-migration-plan.md`.
