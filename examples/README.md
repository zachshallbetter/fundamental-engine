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
open `index.html`.

## Bundler examples (Track E — no-SSR)

Full npm projects with TypeScript, bundlers, and hot reload. CI builds each one
against the published packages on every `examples/**` PR.

| Example | Path | Framework | Package |
|---|---|---|---|
| **vanilla-vite** | [`vanilla-vite/`](./vanilla-vite) | Vite + TS | `@fundamental-engine/vanilla` |
| **react-vite** | [`react-vite/`](./react-vite) | Vite + React + TS | `@fundamental-engine/react` |
| **three** | [`three/`](./three) | Vite + Three.js | `@fundamental-engine/three` |

## SSR / framework examples

Shows the correct client-only integration pattern for SSR frameworks — each
avoids touching the engine during server rendering.

| Example | Path | Framework | Pattern |
|---|---|---|---|
| **nextjs** | [`nextjs/`](./nextjs) | Next.js 15 (App Router) | `'use client'` + `dynamic(…, { ssr: false })` |
| **astro** | [`astro/`](./astro) | Astro 5 | `<script>` tag (always client-only in Astro) |
| **sveltekit** | [`sveltekit/`](./sveltekit) | SvelteKit 2 + Svelte 5 | `onMount` + dynamic import |
| **nuxt** | [`nuxt/`](./nuxt) | Nuxt 3 | `onMounted` + dynamic import |

All SSR examples use `@fundamental-engine/vanilla` (or `react`) at `^0.9.0` and
produce a static build that CI verifies. The README in each example explains the
SSR pattern in detail.
