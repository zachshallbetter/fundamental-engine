# @fundamental-engine/kit

> **Retired in 0.7.0 — not published.** Install the specific `@fundamental-engine/*` package you need
> (e.g. `@fundamental-engine/vanilla`, `@fundamental-engine/elements`, `@fundamental-engine/react`).

**The whole [Fundamental](https://fundamental-engine.com) suite in one install.** `@fundamental-engine/kit` was a
meta-package: it had no code of its own — it just depended on every `@fundamental-engine/*` package, so
a single install pulled the entire stack. Import from the specific package you need.

## Install

The umbrella package is no longer published. Install the packages you need directly:

```sh
npm i @fundamental-engine/vanilla   # or /elements, /react, /core + /dom
```

The full suite:

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
