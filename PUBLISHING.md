# Publishing

The **five** packages are publish-ready (metadata, `README`, `LICENSE`, `files`,
`publishConfig.access: public`). The steps below are **manual** — they change public
state, so they're left to a human.

> The public surface these packages expose is frozen for `0.x` — see
> [API stability](docs/canonical/field-ui-api-stability.md). `pnpm check:api` (run in CI)
> fails if a frozen symbol changes, so a release can't break the contract by accident.

## Order

Publish in dependency order — a package must be published before any package that depends
on it:

1. `field-ui` (core) — no workspace deps.
2. `@field-ui/platform` — depends on core. Provides `browserHost()` / `createBrowserField()`,
   so every adapter below needs it published first.
3. `@field-ui/vanilla` — depends on core + platform.
4. `@field-ui/react` — depends on core + platform.
5. `@field-ui/elements` — depends on core + platform + **vanilla**, so it goes last.

## Steps

```sh
# 1. clean build + green tests + dist & API-surface checks
pnpm -r build
pnpm -r test
pnpm check:dist   # every package's entry points resolve and import cleanly
pnpm check:api    # the frozen 0.x public surface is intact

# 2. log in (once)
npm login

# 3. publish — pnpm rewrites `workspace:*` to the real version automatically.
#    (Use pnpm, not `npm publish`, or the workspace: protocol leaks into the tarball.)
pnpm publish --filter field-ui --access public
pnpm publish --filter @field-ui/platform --access public
pnpm publish --filter @field-ui/vanilla --access public
pnpm publish --filter @field-ui/react --access public
pnpm publish --filter @field-ui/elements --access public
```

The scoped packages (`@field-ui/*`) carry `publishConfig.access: public`, so they
publish publicly despite the scope.

## Repo visibility

The GitHub repository (`zachshallbetter/field-ui`) is currently **private**. Making
it public is a separate, deliberate action in the repo settings — do it when you're
ready for the source to be public alongside the packages.

## Versioning

All five packages are at `0.2.0`. Bump them together for a coordinated release
(e.g. `pnpm --filter "./packages/*" exec npm version patch`, which skips the private
site/starter apps), then re-run the publish steps. Per the `0.x` rules in
[API stability](docs/canonical/field-ui-api-stability.md), a breaking change to a frozen
symbol is a **minor** bump (`0.2 → 0.3`); additive and fix-only changes are patches.
