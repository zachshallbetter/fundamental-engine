# Workflow — branches, PRs, landing, recovery

Verified 2026-10-16. Re-check branch protection before relying on it; it has changed before.

## Branch protection on `main`

`gh api repos/zachshallbetter/fundamental-engine/branches/main/protection` (2026-10-16):

- Required checks: **`conclusion`** (from `ci.yml`) and **`conclusion-pr`** (from `pr-checks.yml`).
- `enforce_admins: true` — `--admin` does **not** bypass a missing or red required check.
- `strict: false` — a branch does **not** have to be up to date with `main` to merge. (It used to be
  `true`; earlier notes describing full serialization are stale. If it flips back, every merge makes
  the other open PRs `BEHIND` and each needs `gh pr update-branch <n>` plus a full CI re-run.)
- No required reviews; force-pushes to `main` are disallowed.

Everything else — Swift, Android, Rust, webkit/mobile e2e, `Perf (hardware)` on the titan GPU runner,
the clean-consumer job — is **informational**: visible on the PR, not blocking. See
[gates-and-ci.md](gates-and-ci.md) for what each one means when it is red.

## Opening a PR

- Always target `main`. A PR whose base is another feature branch never triggers `ci.yml` /
  `pr-checks.yml` (they run `on: pull_request: branches: [main]`), so its required checks are never
  produced and it sits `BLOCKED` forever — even after GitHub auto-retargets it to `main`. If you need
  stacked work, open both against `main` and say "merge #A first" in the description; the combined diff
  shrinks once the lower PR lands.
- Any change under `packages/**` needs a `CHANGELOG.md` `[Unreleased]` line (the
  "CHANGELOG entry for package changes" job reads the diff, not the PR body).
- Description structure that reviewers here expect (use the sections that apply):
  **Purpose · Motivation/Why · Change · Evidence (what you ran, what failed on `main`, what passes now)
  · Limitations / not verified · Gates · Repo impact · Release impact · Merge deps.**
  Evidence means commands and outcomes, not adjectives.
- No attribution lines (`Co-Authored-By`, "Generated with …") in commits or PR bodies.

## Bot comments on PRs

`vercel[bot]` (preview deployed), `socket-security[bot]` (dependency diff / "low adoption" of our own
packages) and `chatgpt-codex-connector[bot]` post automatically. None of them requests a change by
itself. Codex reviews have caught real bugs before — read its findings when it actually reviews; when it
reports a usage limit, there was no review.

## Landing several PRs

- Merge in dependency order; after each merge re-check the next PR's `mergeable` (it is `UNKNOWN` for a
  few seconds while GitHub recomputes).
- `CHANGELOG.md` `[Unreleased]` is the usual conflict. Resolve **keep-both** when two PRs each add their
  own bullet. Exception: if both sides are drafts of the *same* entry (same issue number, same opening
  bold phrase), keep the later, richer one after checking it says everything the earlier did.
- Two PRs that each bump a public count (forces, presets, atoms) collide *semantically* even when the
  text merges cleanly. Never hand-merge a count: rebase, re-run the generators (`gen:atoms`,
  `gen:force-catalog`, `gen:parity-matrix`) and let `check:atoms` / `check:readme` / `check:docs` confirm.
- A plain "re-run" of a PR's CI re-uses the merge commit it was first built on. To test a PR against a
  `main` that has moved, merge `origin/main` into the branch (a new commit), don't just re-run.

## Recovering from a history rewrite

The earlier recovery record reports a bulk branch/tag rewrite around 2026-10-14. That record does
**not** establish the current ancestry of a branch. On 2026-10-19, GitHub comparisons of all 17 open
PR heads against `main` at `9fdea89b` found a shared merge base; 14 PRs nevertheless reported merge
conflicts. The implementation branches (including #1175, #1208 and #1219) share `8f6861d3`; the
paper and snapshot branches have different shared bases. See convergence epic #1274.

Inspect each current branch before choosing recovery:

1. Fetch current refs and record base/head SHAs. Use `git merge-base origin/main <head>` and inspect
   `git diff <merge-base> <head>` plus the current-main changes in overlapping files.
2. With shared ancestry, resolve the actual conflicts on an owned worktree/branch, preserving both
   the intended change and newer fixes. A merge conflict alone is not evidence of unrelated history.
3. If ancestry is genuinely unrelated, or a reviewed net change is easier to recover independently,
   create a fresh recovery branch from current `main`, apply only that change, test it, and open a
   linked replacement PR. Keep the original branch until the replacement is reviewed.
4. Re-run relevant gates on the recovered base. Historical green runs are not current-main evidence.

Rebuilding an existing branch is optional, not the default. It needs the branch owner's / maintainer's
OK because it rewrites that branch; use an exact lease and inspect the intended net diff first:

```sh
git fetch origin
git switch -C rebuild-<n> origin/main
git diff <base-tree-commit> <reviewed-head> | git apply --index   # the PR's net diff
git commit -F <message-file>                                     # same message, no attribution lines
test "$(git rev-parse HEAD^{tree})" = "$(git rev-parse <reviewed-head>^{tree})"   # when base == main
git push --force-with-lease=<branch>:<current-remote-sha> origin rebuild-<n>:<branch>
```

Then confirm the PR's file list is exactly the intended change. The re-pushed tags re-triggered
`release.yml`; those runs failed at the gate and published nothing — but any future bulk tag push
should be watched until each triggered release run is resolved.

## Worktrees

- One worktree per task: `git worktree add -b <branch> <scratch-dir> origin/main`. Never `git checkout`
  in a checkout another agent or person is using.
- `git stash` is **shared across all worktrees of a repo**. Stash with a message
  (`git stash push -m <tag>`) and pop by finding that entry, or don't stash at all.
- Remove a worktree only when its work is pushed and its PR confirmed. A "finished" notification from
  an agent means it stopped a turn, not that it is done.
- Old worktrees created before the repo rename can carry a stale `gitdir` pointer to a dead path;
  rewrite the `.git` file or `git worktree prune`.
