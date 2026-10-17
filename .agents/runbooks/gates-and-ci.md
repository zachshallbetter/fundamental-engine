# Gates and CI — what to run, what red means

Verified 2026-10-16 against `package.json` and `.github/workflows/`.

## The local gate

Run from the repo root after `pnpm install --frozen-lockfile`. **Build first** — most checks import
`packages/*/dist`.

```sh
pnpm build                 # all packages (tsc) + the site; this is also the typecheck that CI relies on
pnpm typecheck
pnpm test                  # node:test across packages + scripts/**/*.test.mjs
pnpm check:api             # protected public surface still exported (guard against silent removal, not a freeze)
DOCS_GATE_ENFORCE=1 pnpm check:docs   # every option / data-* attr / <field-root> attr / handle method has a docs-api.ts row
pnpm check:readme          # README catalog counts and package names match the code
pnpm check:readme-code     # every ```ts/```tsx block in the READMEs typechecks against the built packages
pnpm check:recipes         # data/recipes.json matches the pattern catalog
pnpm check:packaging       # publint + attw
pnpm check:dist            # every package's entry points resolve and import
pnpm check:links           # relative markdown links (root *.md, docs/**, .agents/**, package READMEs)
pnpm check:force-catalog   # generated force catalogs (JSON, Swift, Kotlin) are current
pnpm check:atoms           # apps/site atoms.json is current
pnpm check:cem             # custom-elements.json is current
pnpm check:consumer        # npm create → install the PACKED tarballs → tsc → vite build (needs network, ~1 min)
```

Plane-specific, when you touch them: `cd rust && cargo test --locked`, `swift test` (macOS),
`cd android && ./gradlew test` (JDK 17+). Site e2e: `pnpm --filter @fundamental-engine/site test:e2e`.

A gate run is void the moment you edit source afterwards — re-run `pnpm build` at minimum. Generated
files (`apps/site/public/llms*.txt` timestamps, `custom-elements.json` after `gen:cem`) can show as
dirty after a build; restore or commit them deliberately, never sweep them into an unrelated commit.

### What a few of them are for

- **`check:docs`** fails when new public surface has no row in `apps/site/src/lib/docs-api.ts`. A new
  `FieldOptions` key usually needs two rows: `OPTIONS[]` and `FIELD_ROOT_ATTRS[]` (the element mirror).
  Strings there are single-quoted — an inner `'` breaks the site build, not the typecheck.
- **`check:readme-code`** compiles README examples. A fragment declares the context it assumes in an
  invisible `<!-- check:readme-code prelude: declare const el: HTMLElement; -->` line directly above its
  fence; `<!-- check:readme-code skip -->` is reserved for pseudo-code. It exists because the flagship
  headless example once passed `rect: { x, y }` to an API taking `{ left, top }` and silently built an
  empty field.
- **`check:consumer`** walks the path a new user takes, from the tarballs that would be published. It
  exists because `npm create @fundamental-engine` was a silent no-op for five releases and
  `<field-cell>` was tree-shaken out by every bundler — no other gate exercised either.
- **`catalog-counts-doc.test.ts`** (in `pnpm test`) fails any current-truth doc, package README or port
  README that states a total force count (`N forces`, `N-force`) other than the catalog's.

## Environment-only failures (not code defects)

| Symptom | Cause | What to do |
|---|---|---|
| `check:golden` diff in the last digit of a few `dv` values | Node ≠ 22: `Math` transcendentals differ by an ULP across V8 versions | Ignore locally; CI pins Node 22. `git checkout --` the two fixture files it rewrote. |
| `check:contract-gap`: "Executable doesn't exist … chrome-headless-shell" | Playwright browser not installed locally | `pnpm --filter @fundamental-engine/site exec playwright install chromium`, or rely on CI |
| `check:consumer` fails installing Vite/React | no network / registry hiccup | retry; it's informational in CI for this reason |
| `cargo fmt --check` fails on `rust/crates/fundamental-core/examples/cms.rs` | pre-existing formatting drift on `main` | not run in CI; fix separately if you're in that file |

## CI jobs

Required (block the merge): **`conclusion`** (aggregates `ci.yml`: detect changes · typecheck · test ·
build · checks · `e2e · chromium`) and **`conclusion-pr`** (`pr-checks.yml`: CHANGELOG entry for package
changes · internal doc links).

Informational: `e2e-extra · webkit` / `· mobile`, `clean consumer (packed tarballs)`,
`frozen-surface diff`, `silent-contract-gap diff (advisory)`, Swift (macOS / iOS / visionOS / Linux),
`build + test (JVM + Android)`, `cargo build + test (rust workspace)`, and **`Perf (hardware)`**
(`budgets on titan-gpu` → `conclusion-perf`).

### Perf (hardware) on the titan GPU runner

Self-hosted runner, GTX TITAN X, headless Chrome with hardware WebGL (`--use-angle=gl-egl`). Headless
rAF quantizes frame time to vsync steps (16.7 / 33.3 / 50 / 66.6 ms), so a row at the edge of its budget
flips between two steps from run to run. Observed flaky rows (2026-10): `snapshot()` (sub-ms
microbenchmark), `/docs/patterns` page frame time, `overlay=grid dprCap=2` compositing (mitigated by
#1243, which stopped re-rastering unchanged overlay frames), `render=trails dprCap=1 density=64`.

Policy:
1. Check whether the PR can plausibly affect the failing row. Compare the row's value on recent runs
   (`gh run list --workflow "Perf (hardware)"`, `gh run view <id> --log | grep '<row>'`).
2. If it's the runner, `gh run rerun <id> --failed` — once or twice, not in a loop.
3. **Never edit `docs/planning/perf-budgets.json` by hand.** A budget moves only with a new
   measurement: `workflow_dispatch` the perf workflow, download the `perf-measurements-*` artifact, run
   `scripts/perf/write-fact-sheet.mjs`, commit the regenerated sheet and budgets together.
4. A real regression on a row is fixed in the code (see #1243 for the pattern: find the work that scales
   with the failing parameter — there, DPR-proportional raster of an unchanged canvas).

If every GPU number suddenly looks like a software rasterizer, the host's NVIDIA userspace and kernel
module may be mismatched after an unattended upgrade (`nvidia-smi`: "Driver/library version mismatch");
the workflow's preflight reports it. That host needs a reboot, which is the maintainer's call.

### e2e (Playwright, `apps/site/e2e/`)

Field pages are heavy; a cold first hit can take 30–45 s on a runner, so tests use a 60 s timeout and one
retry. When adding a field-page test: navigate with `waitUntil: 'domcontentloaded'` for server-rendered
assertions; never assert on `locator.count()` directly (it doesn't wait) — use auto-retrying assertions;
anything the field runtime wires boots on a deferred/idle pass, so retry the action with
`expect(async () => { … }).toPass()`. The homepage `lintPlatform` warning budget is capped (see
`apps/site/e2e/lint.spec.ts`): a `[data-body][data-feedback]` element whose `--d` no CSS consumes is a
warning — either drop `data-feedback` or consume `var(--d)`.
