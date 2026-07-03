// A small seeded PRNG for reproducible runs — the Swift mirror of the JS `seededRng`
// (packages/core/src/record/rng.ts): mulberry32, a well-known 32-bit generator. Tiny, fast, pure
// integer math — the same seed always produces the same stream, on any machine. Pass the returned
// closure as `FieldOptions.rng` (or assign it to `Env.rng` in a fixture) and a run becomes fully
// reproducible: every engine random draw — particle seeding, the integrator's brownian wander,
// force jitter (thermal / jet / morph / spawn), spark counts + directions, supernova release
// angles — flows through that one source (the determinism seam, #974).
//
// This is NOT a cryptographic generator; it exists purely for reproducible simulation. The integer
// state stream is bit-identical to the JS mulberry32; the [0, 1) mapping keeps the top 24 bits so
// the value is exact in `Float` and strictly < 1 (the JS side divides all 32 bits into a `Double`).

/// Create a seeded `() -> Float` (uniform in `[0, 1)`) from a 32-bit seed. Same seed → same stream.
public func seededRng(_ seed: UInt32) -> () -> Float {
    var a: UInt32 = seed
    return {
        a = a &+ 0x6d2b_79f5
        var t = (a ^ (a >> 15)) &* (a | 1)
        t = (t &+ ((t ^ (t >> 7)) &* (t | 61))) ^ t
        let r = t ^ (t >> 14)
        return Float(r >> 8) * (1.0 / 16_777_216.0) // top 24 bits → exact in Float, ∈ [0, 1)
    }
}
