# Support & stability commitment

> The maintenance policy a **solo maintainer can actually keep** (gate spec §0.2 — closes #317). It is
> deliberately conservative: it promises only what one person can sustain, and is explicit where support
> is **best-effort**. Overcommitting (e.g. a security SLA) would be a lie; this document avoids that.

## Versioning (SemVer)

Fundamental follows [Semantic Versioning](https://semver.org). The contract is the **Stable surface**
declared in [`docs/planning/1.0-surface.md`](docs/planning/1.0-surface.md) (Tier 1 + Tier 2).

- **Patch (`1.0.x`)** — bug fixes, no surface change.
- **Minor (`1.x.0`)** — **additive only**: new options, methods, exports, render modes. Never breaks the
  Stable surface. The Experimental tier (Tier 3) may change in a minor.
- **Major (`2.0.0`)** — the only release that may break the Stable surface, and only after the
  deprecation window below.

The `0.x` line was already frozen-and-additive; `1.0` formalizes that promise.

## Deprecation window

- A Stable symbol is **deprecated** (kept working, marked in docs + a dev-only `console.warn` where it's
  a runtime call) for **at least one minor release** before it may be removed.
- Removal happens **only in the next major**. So anything deprecated in `1.x` survives until `2.0` at the
  earliest — never a surprise break within a major line.

## Security response

**Best-effort, no SLA.** This is a solo-maintained project; there is no guaranteed response time.

- Report privately via **GitHub Security Advisories** ("Report a vulnerability" on the repo), not a
  public issue.
- Acknowledged when the maintainer is next active; fixes prioritized by severity, on a best-effort basis.
- The published packages have **zero runtime dependencies** (core) or peer deps only (three), so the
  runtime attack surface is minimal; most advisories live in dev/build tooling and don't reach consumers.
- Releases are published from CI **with provenance** (Sigstore/SLSA attestation) — verify the supply
  chain on any published version.

## What "supported" means here

- **Supported:** the current minor of `1.x`. Fixes land on `main` and ship in the next minor/patch.
- **Best-effort:** older `1.x` minors — no backports guaranteed; upgrade to the latest `1.x` (additive,
  non-breaking) for fixes.
- **Browsers:** evergreen Chrome / Firefox / Safari / Edge. Reduced-motion is a first-class fallback
  (the field's *meaning* survives without animation). SSR-safe (no DOM at import).

This policy can be revised in a minor release; revisions are additive to support (never a reduction
without a major-version note).
