# Homebrew formula for the Fundamental scaffolder

`fundamental.rb` is a [Homebrew](https://brew.sh) formula that installs the
`@fundamental-engine/create` CLI (the `create-fundamental-engine` binary) from
the npm registry tarball, so users can run:

```bash
brew tap zachshallbetter/tap
brew install zachshallbetter/tap/fundamental
```

The formula itself lives here in the engine repo so it stays version-controlled
alongside the package it installs. Homebrew, however, can only install it from a
**tap** — a separate public Git repo named `homebrew-<tap>`. The steps below are
the manual, owner-only work that cannot be automated from inside this repo.

## Remaining manual steps (owner only)

1. **Create the tap repository.** On GitHub, create a public repo named
   `homebrew-tap` under your account: `github.com/zachshallbetter/homebrew-tap`.
   (The `homebrew-` prefix is required; `brew tap zachshallbetter/tap` resolves
   to it.)

2. **Copy the formula into the tap.** Tap repos look for formulae in a
   `Formula/` subdirectory or at the repo root. Copy `fundamental.rb` into the
   tap (e.g. `homebrew-tap/Formula/fundamental.rb`). Keep this repo's copy as the
   source of truth and re-copy it on each update.

3. **Fill in the `sha256`.** The formula ships with a
   `sha256 "TODO_RUN_brew_fetch_TO_FILL"` placeholder. Compute the real digest of
   the tarball and replace the placeholder, using either:

   ```bash
   brew fetch --build-from-source Formula/fundamental.rb   # prints the sha256
   # or
   curl -sL https://registry.npmjs.org/@fundamental-engine/create/-/create-0.11.2.tgz | shasum -a 256
   ```

4. **Bump `url` + `sha256` on every release.** Each time a new
   `@fundamental-engine/create` version is published to npm, update the `url`
   (change the version in both the path's `-0.11.2.tgz` and the comment) and
   recompute the `sha256`. Commit the change to the tap repo.

5. **Test before announcing.** Verify the formula installs cleanly:

   ```bash
   brew install --build-from-source zachshallbetter/tap/fundamental
   create-fundamental-engine --help
   ```

   Fix any audit issues with `brew audit --strict --online zachshallbetter/tap/fundamental`.
