# @field-ui/kit

**The whole [field-ui](https://field-ui.com) suite in one install.** `@field-ui/kit` is a
meta-package: it has no code of its own — it just depends on every published `@field-ui/*` package, so
a single install pulls the entire stack. Import from the specific package you need.

## Install

```sh
npm i @field-ui/kit
```

That brings in all five:

| Package | Use it for |
|---|---|
| [`@field-ui/core`](https://www.npmjs.com/package/@field-ui/core) | the renderer-agnostic engine (you own the canvas/host) |
| [`@field-ui/platform`](https://www.npmjs.com/package/@field-ui/platform) | the DOM host, registries, and frame scheduler |
| [`@field-ui/elements`](https://www.npmjs.com/package/@field-ui/elements) | the `<field-root>` / `<field-cell>` web components (any stack or plain HTML) |
| [`@field-ui/react`](https://www.npmjs.com/package/@field-ui/react) | the `<FieldField>` component + `useFieldField()` hook (React is a peer dependency) |
| [`@field-ui/vanilla`](https://www.npmjs.com/package/@field-ui/vanilla) | the framework-free `FieldField` class + `mountField()` |

## Use

`@field-ui/kit` has no entry point of its own — import from the package that matches your stack:

```ts
// plain HTML / any framework: register the web component
import '@field-ui/elements';

// React
import { FieldField } from '@field-ui/react';

// framework-free TypeScript
import { FieldField } from '@field-ui/vanilla';

// own the canvas yourself
import { createField } from '@field-ui/core';
import { browserHost } from '@field-ui/platform';
```

Prefer installing only the packages you use? Skip the kit and `npm i @field-ui/core` (and whichever
adapter you need) directly.

→ Live manual, Lab, and design system at **[field-ui.com](https://field-ui.com)**.
