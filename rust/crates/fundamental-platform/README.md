# fundamental-platform

The host / binding layer for the [Fundamental](https://fundamental-engine.com) field engine's Rust
plane: the environment seam, the six-phase frame scheduler, and data-record binding.

`fundamental-core` is the physics and knows nothing about where it runs. This crate is where an
environment plugs in. It is **headless-first**: the default host binds *data records* — rows, documents,
content items — rather than a DOM, because that is what a server, a CMS or a batch analysis actually has.

```text
fundamental-core  ←  fundamental-platform  ←  {surfaces}
```

The arrow only points one way. The core never depends on the platform.
