# @forces-ui/vanilla (deprecated alias)

A thin compatibility alias of [`@field-ui/vanilla`](../vanilla). It re-exports the package
unchanged so existing imports keep working during the migration:

```ts
import { ForcesField, mountField } from '@forces-ui/vanilla'; // still works
import { ForcesField, mountField } from '@field-ui/vanilla';  // preferred
```

Install `@field-ui/vanilla` for new code. This alias will be removed in a future major release.
