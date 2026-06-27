package com.fundamental.core.engine

// Built-in `when` gate predicates (§5) — the Kotlin port of
// swift/Sources/FundamentalCore/Engine/Conditions.swift (conditions.ts).
//
// Selective gates read each particle; `active` reads the body; `scrolling` reads the
// shared frame state (`env.scrollV`), so it acts only while actually scrolling.

/** A gate predicate — the Swift `Condition` typealias. */
typealias Condition = (body: Body, particle: Particle, env: Env?) -> Boolean

/** `name → Condition` — the Swift `ConditionRegistry` typealias. */
typealias ConditionRegistry = Map<String, Condition>

fun builtinConditions(): ConditionRegistry = mapOf(
    "active" to { b, _, _ -> b.isEngaged },
    "fast" to { _, p, _ -> p.velocity.lengthSquared() > 0.9f },
    "slow" to { _, p, _ -> p.velocity.lengthSquared() < 0.22f },
    "hot" to { _, p, _ -> p.heat > 0.3f },
    "cool" to { _, p, _ -> p.heat < 0.08f },
    "scrolling" to { _, _, env -> (env?.scrollV ?: 0f) > 0.25f },
)

/** Does body `b`'s gate pass for particle `p`? Empty gate always passes. */
fun passes(reg: ConditionRegistry, b: Body, p: Particle, env: Env? = null): Boolean {
    if (b.`when`.isEmpty()) return true
    val fn = reg[b.`when`] ?: return true
    return fn(b, p, env)
}
