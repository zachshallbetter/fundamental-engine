# fundamental-core

The Rust core of **[Fundamental](https://github.com/zachshallbetter/fundamental-engine)** — a
reciprocal relational field engine. Bodies bend the field; the field's local density bends them back.

This crate is the **headless** plane of the fleet: the same engine that ships to the DOM as
[`@fundamental-engine/core`](https://www.npmjs.com/package/@fundamental-engine/core) and to iOS /
Android as the Swift and Kotlin ports, held to the same cross-plane conformance golden — but built for
servers, data pipelines, CMS runtimes, and analysis, where *a body is a data record, not a widget*.

- **f64 everywhere** — reproduces the JS f64 engine bit-for-bit (conformance tolerance ~1e-9).
- **Deterministic by construction** — fixed `dt`, seeded `Rng` bit-identical to the JS mulberry32
  stream, effects-as-data. Snapshot / replay is a thin layer, not a retrofit.
- **Zero runtime dependencies.**
- **Versioned in lockstep** with the npm packages: crate `x.y.z` is engine `FIELD_VERSION` `x.y.z`.

## Status

**Experimental.** 28 of the 36-force catalog (the canonical nine, natural, extended, neighbour, and
modifier forces), the `step()` loop, `FieldStore`, and the seeded rng. The remaining forces, the
platform crate, and the CMS-facing reading layer (scores / clusters / relations) are tracked under
[epic #1036](https://github.com/zachshallbetter/fundamental-engine/issues/1036). Pre-1.0: pin an
exact version.

## Use

```toml
[dependencies]
fundamental-core = "0.10"
```

```rust
use fundamental_core::{step, Body, Env, FieldStore, Registry, Vec3, FIELD_VERSION};
```

A runnable "rank content by field gravity" demo lives in the repo:
`cargo run --example ranking -p fundamental-core`.

## Documentation

- [Architecture](https://github.com/zachshallbetter/fundamental-engine/blob/main/rust/docs/architecture.md)
  · [Reference](https://github.com/zachshallbetter/fundamental-engine/blob/main/rust/docs/reference.md)
  · [Guide](https://github.com/zachshallbetter/fundamental-engine/blob/main/rust/docs/guide.md)
- [Publishing decision](https://github.com/zachshallbetter/fundamental-engine/blob/main/docs/planning/rust-publishing-decision.md)
  (naming, lockstep versioning, release path)
- The generated API docs: `cargo doc --no-deps --open`.

## License

MIT — see the repository [LICENSE](https://github.com/zachshallbetter/fundamental-engine/blob/main/LICENSE).
