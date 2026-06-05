# Publishing

The three packages are publish-ready (metadata, `README`, `LICENSE`, `files`,
`publishConfig.access: public`). The steps below are **manual** — they change public
state, so they're left to a human.

## Order

`forces-ui` (core) must publish first; `@forces-ui/elements` and `@forces-ui/react`
depend on it.

## Steps

```sh
# 1. clean build + green tests
pnpm -r build
pnpm --filter forces-ui test

# 2. log in (once)
npm login

# 3. publish — pnpm rewrites `workspace:*` to the real version automatically.
#    (Use pnpm, not `npm publish`, or the workspace: protocol leaks into the tarball.)
pnpm publish --filter forces-ui --access public
pnpm publish --filter @forces-ui/elements --access public
pnpm publish --filter @forces-ui/react --access public
```

The scoped packages (`@forces-ui/*`) carry `publishConfig.access: public`, so they
publish publicly despite the scope.

## Repo visibility

The GitHub repository (`zachshallbetter/forces-ui`) is currently **private**. Making
it public is a separate, deliberate action in the repo settings — do it when you're
ready for the source to be public alongside the packages.

## Versioning

All three packages are at `0.1.0`. Bump them together for a coordinated release
(e.g. `pnpm -r exec npm version patch`), then re-run the publish steps.
