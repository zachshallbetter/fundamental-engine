# @forces-ui/vanilla (deprecated alias)

A thin compatibility alias of [`@field-ui/vanilla`](../vanilla). It re-exports the package
unchanged so existing imports keep working during the migration:

```ts
import { ForcesField, mountField } from '@forces-ui/vanilla'; // still works
import { ForcesField, mountField } from '@field-ui/vanilla';  // preferred
```

Install `@field-ui/vanilla` for new code. This alias keeps working behavior-identically through `0.x`
and is removal-gated: see the `forces-*` → `field-*` alias window in
[API stability](../../docs/canonical/field-ui-api-stability.md).
