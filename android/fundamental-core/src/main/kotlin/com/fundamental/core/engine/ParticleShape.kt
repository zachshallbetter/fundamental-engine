package com.fundamental.core.engine

import com.fundamental.core.math.Vec3
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sin

// ParticleShape (particle-shape.ts) — the Kotlin port of
// swift/Sources/FundamentalCore/Engine/ParticleShape.swift. How a particle is drawn: a unit vector
// shape the renderer stamps at each particle's position, scaled by its (physics-driven) size + heat,
// so a hot particle is a bigger, brighter star. Renderer-agnostic data — the core only carries the
// vertices; each host's renderer transforms them. `dot` keeps the fast batched-circle path.
//
// Vertices are origin-centred in [-1, 1]. 2D shapes carried as `Vec3` with z = 0 (the engine is
// 3D-native; particle stamps are planar).

data class ParticleShape(val vertices: List<Vec3>?) {
    /** Whether this is the fast built-in circle (no polygon path). */
    val isDot: Boolean get() = vertices == null

    companion object {
        /** The default soft circle — the fast batched path. */
        val DOT = ParticleShape(null)

        /** An N-pointed star. `innerRatio` ∈ (0,1] sets the waist depth (0.5 = a classic 5-point star). */
        fun star(points: Int = 5, innerRatio: Float = 0.5f): ParticleShape {
            val n = max(2, points)
            val inner = min(max(innerRatio, 0.01f), 1f)
            val v = ArrayList<Vec3>(n * 2)
            for (i in 0 until n * 2) {
                val r = if (i % 2 == 0) 1f else inner
                val a = i.toFloat() * PI.toFloat() / n - PI.toFloat() / 2f // first point straight up
                v.add(Vec3(cos(a) * r, sin(a) * r, 0f))
            }
            return ParticleShape(v)
        }

        /** A regular polygon — triangle (3), square (4), hexagon (6)… `rotation` in degrees. */
        fun polygon(sides: Int, rotation: Float = 0f): ParticleShape {
            val n = max(3, sides)
            val rot = rotation * PI.toFloat() / 180f
            val v = ArrayList<Vec3>(n)
            for (i in 0 until n) {
                val a = i.toFloat() * 2f * PI.toFloat() / n - PI.toFloat() / 2f + rot
                v.add(Vec3(cos(a), sin(a), 0f))
            }
            return ParticleShape(v)
        }

        /** Any custom vector shape — your own unit vertices in [-1,1] (origin-centred), filled in order. */
        fun custom(vertices: List<Vec3>): ParticleShape = ParticleShape(vertices)
    }
}
