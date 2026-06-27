# examples/

Standalone, consumer-proof apps. Each one depends on the **published** npm
packages (`@fundamental-engine/*@^0.9.0`), **not** `workspace:*` — so they prove
the real published packages work for an outside developer.

`examples/` is intentionally **outside** the pnpm workspace (it is not listed in
`pnpm-workspace.yaml`). Each app installs and runs on its own. None of these are
published packages, so they get no CHANGELOG entry.

## The HTML trio

Three tiny, no-build, plain-HTML apps — copy one and start from it:

| Example | Path | Shows |
|---|---|---|
| **vanilla-cdn** | [`vanilla-cdn/`](./vanilla-cdn) | `createField` imported from esm.sh — zero install, zero build. |
| **single-file** | [`single-file/`](./single-file) | The pre-bundled `standalone.global.js` IIFE (`window.Fundamental`) via a plain `<script>` tag. |
| **web-component** | [`web-component/`](./web-component) | `<field-root>` from `@fundamental-engine/elements`, the plain-HTML web-component path. |

All three are static HTML — serve the directory (`python3 -m http.server`) and
open `index.html`. The two CDN examples need a network connection the first time
so esm.sh can serve the modules; `single-file` needs nothing but the local file.

Each was smoke-tested with headless Chromium: a live field boots and
`particleCount() > 0` on every one.
