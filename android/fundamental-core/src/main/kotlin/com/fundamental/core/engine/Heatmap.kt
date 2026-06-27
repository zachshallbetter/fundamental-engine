package com.fundamental.core.engine

import com.fundamental.core.math.Vec3
import com.fundamental.core.math.clamp
import kotlin.math.max

// Heatmap (heatmap.ts, field-systems H1) — the Kotlin port of
// swift/Sources/FundamentalCore/Engine/Heatmap.swift. A scalar buffer revealing where matter pools,
// rendered as a glow underlay and sampled back to bodies. NOT a force — it measures, it does not push.

private const val HEATMAP_CELL: Float = 24f // grid resolution px — coarse, so per-frame work is cheap
private const val HEATMAP_DECAY: Float = 0.12f // per-frame fade: tracks the CURRENT density
private const val HEATMAP_BLUR: Float = 0.22f // light diffusion for a smooth glow

class Heatmap(width: Float, height: Float) {
    private val grid = ScalarGridImpl(max(1f, width), max(1f, height), GridMode.DIFFUSE, HEATMAP_CELL)
    private var peak = 1e-3f

    /** Grid resolution in px (the render samples on this lattice). */
    val cell: Float = HEATMAP_CELL

    fun resize(width: Float, height: Float) = grid.resize(width, height)

    /** Deposit the current particle field, decay + blur, and track the eased peak. Once a frame. */
    fun update(particles: List<Particle>) {
        for (p in particles) grid.deposit(p.position, 1f)
        grid.stepDiffuse(HEATMAP_BLUR, HEATMAP_DECAY)
        val m = grid.max()
        // ease the peak up fast, down slowly; floored against divide-by-zero.
        val k = if (m > peak) 0.25f else 0.03f
        peak += (max(m, 1e-3f) - peak) * k
    }

    /** Normalized density ∈ [0,1] at a point — for the glow render and body write-back. */
    fun norm(p: Vec3): Float = clamp(grid.sample(p) / peak, 0f, 1f)

    /** Gradient of the normalized density field (points up-slope toward denser matter). */
    fun gradient(p: Vec3): Vec3 = if (peak > 0f) grid.gradient(p) / peak else Vec3.ZERO
}
