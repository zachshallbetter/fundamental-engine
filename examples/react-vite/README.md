# Fundamental — React + Vite example

A minimal [Vite](https://vite.dev) + React + TypeScript app that mounts a live
[Fundamental](https://fundamental-engine.com) field with the
[`@fundamental-engine/react`](https://www.npmjs.com/package/@fundamental-engine/react)
adapter and the published packages from npm — no workspace wiring.

## What it shows

- `<FieldField>` — one component that mounts a fixed, full-viewport canvas and
  runs the reciprocal DOM-physics engine on it.
- `[data-body]` elements (the `<h1>`, the links, the button) become *bodies*
  that bend the invisible field; the field's density bends them back.
- `onReady` hands you the live `FieldHandle` to drive the field imperatively
  (`scan()`, `burst()`, …).
- `render="dots"` opts into drawing — the default render mode is `'none'`
  (signals-first: the field runs and writes feedback even when it draws nothing).

This is the canonical React usage straight from the `@fundamental-engine/react`
README, in a real buildable app.

## Run

```sh
npm install
npm run dev      # http://localhost:5173
```

## Build

```sh
npm run build    # type-checks, then emits dist/
npm run preview  # serve the built output
```

Because this example depends on the published `@fundamental-engine/react`
(`^0.9.0`) rather than the workspace, a successful `npm run build` proves the
real published packages work end to end in a Vite app.

## Smoke test

`smoke.mjs` serves the built `dist/` and uses headless Chromium (Playwright) to
assert a live field booted — `window.field.particleCount() > 0`. The
`onReady` callback in `src/App.tsx` stashes the `FieldHandle` on `window.field`
so the test can read it.

```sh
npm run build
node smoke.mjs        # SMOKE PASS: field booted, particleCount() = N
```

Playwright is not a dependency of this example; install it (or run the test from
the monorepo, pointing `PLAYWRIGHT_PKG` at an existing `@playwright/test`):

```sh
npm i -D @playwright/test && npx playwright install chromium
node smoke.mjs
```
