# AGENTS.md — working on Fundamental

The entry point for any agent or person picking up work in this repository — Claude, another model, or a
human. It is tool-agnostic: plain markdown, plain shell. Read this file first, then the runbook or
knowledge file for the job in front of you. Everything here was verified against the code and the live
infrastructure on the date in each file; when this guide and the code disagree, **the code wins** — fix
the guide in the same PR.

## What this repository is

Fundamental is a reciprocal field runtime for interfaces: elements are bodies in a particle field, the
field computes density and influence, and the result is written back to the host (CSS variables on the
web, native properties on Swift/Kotlin, plain records headlessly). One core, many hosts:

| Plane | Where | Ships as |
|---|---|---|
| JS core + web hosts | `packages/{core,dom,vanilla,react,elements,three,create}` | npm `@fundamental-engine/*` (7 packages, lockstep version) |
| Swift | `swift/`, `Package.swift` | SwiftPM (the same `vX.Y.Z` git tag) |
| Kotlin / Android | `android/` | Maven (published from `android.yml` on the release tag) |
| Rust (experimental, headless) | `rust/` | not yet on crates.io |
| Docs + demo site | `apps/site` → fundamental-engine.com | Vercel, on merge to `main` |

`FIELD_VERSION` is hand-maintained per plane and lockstep-tested against `packages/core/package.json`.
Canonical design docs: `docs/canonical/`. Engineering practices: `docs/engineering-practices.md`.
Release policy: `docs/meta/releasing.md`. Current, verified engine facts (the things that are easy to get
wrong): [`knowledge/engine-facts.md`](knowledge/engine-facts.md).

## Non-negotiables

1. **No inflation.** A doc, README, site or PR claim the code does not back is a defect. Verify every
   count, API name and behaviour against source (or by running it) before you write it. Prefer the
   honest smaller claim. Subagent and reviewer findings are leads, not facts — re-check them.
2. **Never publish, tag or release unless the maintainer explicitly asks** for that release. Additive
   work lands on `main` under `CHANGELOG.md` `[Unreleased]`; releases are deliberate.
   → [`runbooks/release.md`](runbooks/release.md)
3. **Never arm auto-merge** (`gh pr merge --auto`) and never merge on someone's behalf unless they ask
   for that specific merge. Get PRs green and hand them over.
4. **Never force-push `main` or rewrite shared history.** Never rewrite a branch someone else is using.
5. **Generated artefacts are regenerated, never hand-edited**: force catalogs, atoms, parity matrix,
   the conformance golden, perf budgets, `custom-elements.json`, `data/recipes.json`. Counts in prose
   are derived or gated (`check:readme`, `catalog-counts-doc.test.ts`).
6. **Work in your own git worktree** off `origin/main`. Parallel agents sharing one checkout overwrite
   each other's branches and sweep up each other's files.

## The working loop

1. Branch in a worktree: `git worktree add -b <type>/<slug> <dir> origin/main`, then
   `pnpm install --frozen-lockfile`.
2. Reproduce first. A bug report is a hypothesis until you have a failing test or a repro script.
3. Fix, with a regression test that **fails on `main`** and passes with the fix (prove both).
4. `CHANGELOG.md` `[Unreleased]` entry for anything under `packages/` (CI enforces it).
5. Run the gates → [`runbooks/gates-and-ci.md`](runbooks/gates-and-ci.md). Re-run the build after any
   late edit — a gate run is void once you edit after it.
6. Commit (conventional style: `fix(core): …`, `docs: …`, `site: …`), push the branch, open a PR
   against `main` with the description structure in [`runbooks/workflow.md`](runbooks/workflow.md).
7. Report what is verified and what is not, plainly.

## Map of this directory

| File | Read it when |
|---|---|
| [`runbooks/workflow.md`](runbooks/workflow.md) | opening, updating, landing or rebuilding PRs; branch protection; CHANGELOG conflicts |
| [`runbooks/gates-and-ci.md`](runbooks/gates-and-ci.md) | running checks; reading a red CI run; environment-only failures; perf flakes |
| [`runbooks/release.md`](runbooks/release.md) | the maintainer asked for a release |
| [`runbooks/verification.md`](runbooks/verification.md) | proving a change in a real browser, on real hardware, or from the real registry |
| [`runbooks/sites.md`](runbooks/sites.md) | fundamental-engine.com (`apps/site`) and the zachshallbetter.com integration |
| [`knowledge/engine-facts.md`](knowledge/engine-facts.md) | before writing any claim about forces, patterns, render modes, query/snapshot/replay, reduced motion, conformance, ports |
| [`knowledge/pitfalls.md`](knowledge/pitfalls.md) | the defect classes this codebase has actually had, and how each was found |
| [`knowledge/open-work.md`](knowledge/open-work.md) | what is open, in flight, or deliberately left, with evidence and next steps |

Audits and dated reports live in `docs/analysis/` — the most recent full engine audit is
[`docs/analysis/engine-audit-2026-10-14.md`](../docs/analysis/engine-audit-2026-10-14.md).

## Keeping this current

This directory is maintained like code. When you learn something the next person would otherwise have
to rediscover — a trap, a flake signature, a changed policy, a fact that contradicts a doc — add it to
the right file in the same PR as the work, dated. Delete what stops being true. `pnpm check:links`
validates the links here.

`tools/gen-llms.py` writes a large generated corpus (`.agents/llms*.txt`) next to these files; that
corpus is ignored by git and regenerated on demand (`pnpm gen:llms`).
