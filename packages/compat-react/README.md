# @forces-ui/react (deprecated alias)

A thin compatibility alias of [`@field-ui/react`](../react). It re-exports the package unchanged
so existing imports keep working during the migration:

```tsx
import { ForcesField, useForcesField } from '@forces-ui/react'; // still works
import { ForcesField, useForcesField } from '@field-ui/react';  // preferred
```

Install `@field-ui/react` for new code. This alias keeps working behavior-identically through `0.x`
and is removal-gated: see the `forces-*` → `field-*` alias window in
[API stability](../../docs/canonical/field-ui-api-stability.md).
