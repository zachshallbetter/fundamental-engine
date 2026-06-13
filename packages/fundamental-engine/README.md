# fundamental-engine

**An alias for [`@fundamental-engine/kit`](https://www.npmjs.com/package/@fundamental-engine/kit).** The bare `field-ui`
name on npm belongs to an unrelated project, so the field-ui suite lives under the `@field-ui` scope.
This package exists only so that `fundamental-engine` resolves to the whole suite for anyone who
reaches for it by name.

## Install

```sh
npm i fundamental-engine
```

This pulls in [`@fundamental-engine/kit`](https://www.npmjs.com/package/@fundamental-engine/kit), which depends on every
`@fundamental-engine/*` package. Then import from the specific package you need (see the
[kit README](https://www.npmjs.com/package/@fundamental-engine/kit)).

**Prefer the direct names:**

- The engine is **[`@fundamental-engine/core`](https://www.npmjs.com/package/@fundamental-engine/core)**.
- The whole suite is **[`@fundamental-engine/kit`](https://www.npmjs.com/package/@fundamental-engine/kit)**.
- Or install just the adapter you need: `@fundamental-engine/elements`, `@fundamental-engine/react`, `@fundamental-engine/vanilla`.

→ **[field-ui.com](https://field-ui.com)**
