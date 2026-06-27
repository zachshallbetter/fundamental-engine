package com.fundamental.core.engine

import com.fundamental.core.forces.coreForces
import com.fundamental.core.forces.extendedForces
import com.fundamental.core.forces.naturalForces

/**
 * The standard registry — `token → Force`. Mirror of
 * swift/Sources/FundamentalCore/Engine/Registry.swift's `standard().forces`: the canonical nine, the
 * natural primitives, and the designed extended set — the full force surface (36 tokens).
 * Later registrations replace earlier ones, as in the JS.
 */
object Registry {
    fun standardForces(): Map<String, Force> =
        (coreForces() + naturalForces() + extendedForces()).associateBy { it.token }
}
