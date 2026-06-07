# Publishing

The four packages are publish-ready (metadata, `README`, `LICENSE`, `files`,
`publishConfig.access: public`). The steps below are **manual** — they change public
state, so they're left to a human.

## Order

Publish in dependency order: `field-ui` (core) first, then `@field-ui/vanilla`, then
`@field-ui/elements` (which depends on **both** core and vanilla) and `@field-ui/react`.
A package must be published before any package that depends on it.

## Steps

```sh
# 1. clean build + green tests + dist smoke check
pnpm -r build
pnpm -r test
pnpm check:dist   # every package's entry points resolve and import cleanly

# 2. log in (once)
npm login

# 3. publish — pnpm rewrites `workspace:*` to the real version automatically.
#    (Use pnpm, not `npm publish`, or the workspace: protocol leaks into the tarball.)
pnpm publish --filter field-ui --access public
pnpm publish --filter @field-ui/vanilla --access public
pnpm publish --filter @field-ui/elements --access public
pnpm publish --filter @field-ui/react --access public
```

The scoped packages (`@field-ui/*`) carry `publishConfig.access: public`, so they
publish publicly despite the scope.

## Repo visibility

The GitHub repository (`zachshallbetter/field-ui`) is currently **private**. Making
it public is a separate, deliberate action in the repo settings — do it when you're
ready for the source to be public alongside the packages.

## Versioning

All four packages are at `0.2.0`. Bump them together for a coordinated release
(e.g. `pnpm --filter "./packages/*" exec npm version patch`, which skips the private
site app), then re-run the publish steps.
