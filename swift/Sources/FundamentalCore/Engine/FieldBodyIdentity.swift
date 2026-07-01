import Foundation

// MARK: - FieldBodyIdentity (substrate critical path — JS #884)

/// First-class body identity — the stable primary key every body resolves to, mirroring the JS
/// `FieldBodyIdentity`. Identity is NOT the body's display text, NOT necessarily a platform view id,
/// and NOT an object reference (references don't survive a rescan or a serialize/replay round-trip).
/// Snapshots, diffs, and relationships key on ``id``.
///
/// When a body carries no supplied identity, the engine DERIVES a stable one deterministically (a
/// platform id when the host resolver offers one, else a monotonic `body-N` counter — never a random
/// value, which is banned on the reproducible paths), so identity is always present and stable for the
/// body's life. See `packages/core/src/core/types.ts` `FieldBodyIdentity` for the JS source of truth.
public struct FieldBodyIdentity: Hashable, Sendable {
    /// The stable primary key — unique within the field, constant for the body's life. Equals the
    /// reading's top-level `id` (back-compat). Snapshot/diff/replay/relationships key on this.
    public var id: String
    /// Optional grouping namespace (e.g. an app/module the body belongs to). Free-form; opaque to the engine.
    public var namespace: String?
    /// Optional kind/type tag (e.g. `"card"`, `"heading"`, `"agent"`). Free-form; opaque to the engine.
    public var kind: String?
    /// Optional host/owner tag (e.g. a renderer or view that owns the body's rendered object). Free-form.
    public var host: String?

    public init(id: String, namespace: String? = nil, kind: String? = nil, host: String? = nil) {
        self.id = id
        self.namespace = namespace
        self.kind = kind
        self.host = host
    }
}
