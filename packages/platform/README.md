# @fundamental-engine/platform — deprecated

**Renamed to [`@fundamental-engine/dom`](https://www.npmjs.com/package/@fundamental-engine/dom).**

This package is now a thin alias that re-exports `@fundamental-engine/dom` so existing installs keep
working. The layer it names is the DOM binding for the engine — `browserHost()`, the six registries
(measurement / state / feedback / relationships / visual-bindings / overlays), the frame scheduler,
`lintPlatform`, and `bindData` — so the honest name is `dom`.

Switch your imports:

```diff
- import { browserHost } from '@fundamental-engine/platform';
+ import { browserHost } from '@fundamental-engine/dom';
```

The alias will be removed in a future major release.
