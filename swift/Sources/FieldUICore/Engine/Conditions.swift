import Foundation
import simd

// MARK: - Built-in `when` gate predicates (§5) — conditions.ts
//
// Selective gates read each particle; `active` reads the body; `scrolling` reads the
// shared frame state (`env.scrollV`), so it acts only while actually scrolling.

public func builtinConditions() -> ConditionRegistry {
    [
        "active":    { b, _, _ in b.isEngaged },
        "fast":      { _, p, _ in simd_length_squared(p.velocity) > 0.9 },
        "slow":      { _, p, _ in simd_length_squared(p.velocity) < 0.22 },
        "hot":       { _, p, _ in p.heat > 0.3 },
        "cool":      { _, p, _ in p.heat < 0.08 },
        "scrolling": { _, _, env in (env?.scrollV ?? 0) > 0.25 },
    ]
}

/// Does body `b`'s gate pass for particle `p`? Empty gate always passes.
public func passes(_ reg: ConditionRegistry, _ b: Body, _ p: Particle, _ env: Env? = nil) -> Bool {
    guard !b.when.isEmpty else { return true }
    guard let fn = reg[b.when] else { return true }
    return fn(b, p, env)
}
