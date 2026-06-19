# @fundamental-engine/kit

**The whole [Fundamental](https://fundamental-engine.com) suite in one install.** `@fundamental-engine/kit` is a
meta-package: it has no code of its own — it just depends on every published `@fundamental-engine/*` package, so
a single install pulls the entire stack. Import from the specific package you need.

## Install

```sh
npm i @fundamental-engine/kit
```

That brings in all five:

| Package | Use it for |
|---|---|
| [`@fundamental-engine/core`](https://www.npmjs.com/package/@fundamental-engine/core) | the renderer-agnostic engine (you own the canvas/host) |
| [`@fundamental-engine/dom`](https://www.npmjs.com/package/@fundamental-engine/dom) | the DOM host, registries, and frame scheduler |
| [`@fundamental-engine/elements`](https://www.npmjs.com/package/@fundamental-engine/elements) | the `<field-root>` / `<field-cell>` web components (any stack or plain HTML) |
| [`@fundamental-engine/react`](https://www.npmjs.com/package/@fundamental-engine/react) | the `<FieldField>` component + `useFieldField()` hook (React is a peer dependency) |
| [`@fundamental-engine/vanilla`](https://www.npmjs.com/package/@fundamental-engine/vanilla) | the framework-free `FieldField` class + `mountField()` |

## Use

`@fundamental-engine/kit` has no entry point of its own — import from the package that matches your stack:

```ts
// plain HTML / any framework: register the web component
import '@fundamental-engine/elements';

// React
import { FieldField } from '@fundamental-engine/react';

// framework-free TypeScript
import { FieldField } from '@fundamental-engine/vanilla';

// own the canvas yourself
import { createField } from '@fundamental-engine/core';
import { browserHost } from '@fundamental-engine/dom';
```

Prefer installing only the packages you use? Skip the kit and `npm i @fundamental-engine/core` (and whichever
adapter you need) directly.

→ Live manual, Lab, and design system at **[fundamental-engine.com](https://fundamental-engine.com)**.
