# Security Policy

## Reporting a vulnerability

If you find a security issue in Fundamental, please report it privately rather than
opening a public issue. Email **hi@zachshallbetter.com** with:

- a description of the issue and its impact,
- steps to reproduce (a minimal example is ideal),
- the affected package and version.

You can expect an acknowledgement within a few days. Please give a reasonable window to
ship a fix before any public disclosure.

## Scope

Fundamental is a client-side rendering library with **zero runtime dependencies** in its
core. It does not handle authentication, network requests, or persistent storage. The
most relevant surface is DOM input: the engine reads `data-*` attributes and element
geometry from the host page. It treats that input as data and never evaluates it as
code. Reports about DOM-injection, prototype-pollution, or ReDoS-style issues in the
attribute parsing are in scope.

## Dependency & supply-chain posture

The **published packages carry no external runtime dependencies.** `@fundamental-engine/core`,
`dom`, `elements`, `react`, and `vanilla` depend only on each other; `three` takes `three` as a
**peer** dependency (your copy, never bundled). A consumer installing Fundamental therefore pulls in
**no third-party runtime code**, and advisories in this project's own build/dev tooling do **not** reach
consumers.

`pnpm audit` reports advisories only in the **site/docs build chain** (`apps/site` → `astro`, `mermaid`),
which is never published. Those are tracked and cleared via tested major upgrades on their own cadence;
they are outside the consumer attack surface.

Releases publish from CI **with provenance** (Sigstore / SLSA build attestation), so any published
version's supply chain can be verified on npm. No secrets are committed to the repository or printed in
CI logs.

## Supported versions

While pre-1.0, only the latest tagged release receives fixes. From 1.0, the versioning, deprecation,
and security-response policy are published in `SUPPORT.md`.
