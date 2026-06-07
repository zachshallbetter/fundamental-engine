# Security Policy

## Reporting a vulnerability

If you find a security issue in field-ui, please report it privately rather than
opening a public issue. Email **hi@zachshallbetter.com** with:

- a description of the issue and its impact,
- steps to reproduce (a minimal example is ideal),
- the affected package and version.

You can expect an acknowledgement within a few days. Please give a reasonable window to
ship a fix before any public disclosure.

## Scope

field-ui is a client-side rendering library with **zero runtime dependencies** in its
core. It does not handle authentication, network requests, or persistent storage. The
most relevant surface is DOM input: the engine reads `data-*` attributes and element
geometry from the host page. It treats that input as data and never evaluates it as
code. Reports about DOM-injection, prototype-pollution, or ReDoS-style issues in the
attribute parsing are in scope.

## Supported versions

While pre-1.0, only the latest tagged release receives fixes.
