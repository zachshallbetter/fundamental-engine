package com.fundamental.core.engine

import com.fundamental.core.math.Vec3

/**
 * FieldStore — owns the particle pool and the spatial index (§20.1). The single home for "all the
 * matter": add/remove particles, rebuild the neighbour index once per frame, and answer
 * `neighbors(p, r)`. Count is the conserved quantity (§2.4); `size` is the live total.
 * Kotlin port of swift/Sources/FundamentalCore/Engine/FieldStore.swift.
 */
class FieldStore(cellSize: Float = 64f) {
    private val _particles = ArrayList<Particle>()
    val particles: List<Particle> get() = _particles
    private val hash = SpatialHash(cellSize)

    val size: Int get() = _particles.size

    fun add(p: Particle): Particle {
        _particles.add(p)
        return p
    }

    /** Swap-remove a particle (O(1) after the scan, order not preserved). */
    fun remove(p: Particle) {
        val i = _particles.indexOfFirst { it === p }
        if (i < 0) return
        val last = _particles.removeAt(_particles.size - 1)
        if (i < _particles.size) _particles[i] = last
    }

    fun clear() {
        _particles.clear()
        hash.clear()
    }

    /** Rebuild the neighbour index from the current pool (once per frame). */
    fun reindex() = hash.rebuild(_particles)

    /** Neighbours within [r] of [p], excluding [p] itself. */
    fun neighbors(p: Particle, r: Float): List<Particle> =
        hash.near(p.position, r).filter { it !== p }

    /** Particles within [r] of an arbitrary point (grid sampling, where the origin isn't a particle). */
    fun near(point: Vec3, r: Float): List<Particle> = hash.near(point, r)
}

/** Snapshot of kinetic, thermal, and total energy for the current pool. */
data class EnergyReport(val kinetic: Float, val thermal: Float, val total: Float, val count: Int)

/** The Kotlin port of `energyReport` (core/diagnostics/energy). */
fun energyReport(particles: List<Particle>): EnergyReport {
    var kinetic = 0f
    var thermal = 0f
    for (p in particles) {
        kinetic += 0.5f * p.mass * p.velocity.lengthSquared()
        thermal += p.heat
    }
    return EnergyReport(kinetic, thermal, kinetic + thermal, particles.size)
}
