# @field-ui/field-ui

**An alias for [`@field-ui/kit`](https://www.npmjs.com/package/@field-ui/kit).** The bare `field-ui`
name on npm belongs to an unrelated project, so the field-ui suite lives under the `@field-ui` scope.
This package exists only so that `@field-ui/field-ui` resolves to the whole suite for anyone who
reaches for it by name.

## Install

```sh
npm i @field-ui/field-ui
```

This pulls in [`@field-ui/kit`](https://www.npmjs.com/package/@field-ui/kit), which depends on every
`@field-ui/*` package. Then import from the specific package you need (see the
[kit README](https://www.npmjs.com/package/@field-ui/kit)).

**Prefer the direct names:**

- The engine is **[`@field-ui/core`](https://www.npmjs.com/package/@field-ui/core)**.
- The whole suite is **[`@field-ui/kit`](https://www.npmjs.com/package/@field-ui/kit)**.
- Or install just the adapter you need: `@field-ui/elements`, `@field-ui/react`, `@field-ui/vanilla`.

→ **[field-ui.com](https://field-ui.com)**
