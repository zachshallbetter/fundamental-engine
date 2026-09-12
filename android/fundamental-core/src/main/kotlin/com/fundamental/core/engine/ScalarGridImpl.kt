package com.fundamental.core.engine

import com.fundamental.core.math.Vec3
import kotlin.math.ceil
import kotlin.math.floor
import kotlin.math.roundToInt

// MARK: - ScalarGridImpl (scalar-grid.ts)
//
// A scalar field on a uniform grid — the backing store for field-buffer forces
// (§20.1 class [C]): `diffuse` (heat/concentration, ∂φ/∂t = D∇²φ) and `propagate`
// (a travelling wave, ∂²φ/∂t² = c²∇²φ). Particles `deposit` into it and read its
// `gradient`; the engine advances it once per frame with `step()`.
//
// The lattice is 2D over the x/y plane, exactly as the JS — field buffers are a
// surface phenomenon; z is ignored on sample/deposit and the gradient's z is 0.

/**
 * A grid's stepping scheme. [HELD] is NOT a dynamical scheme: it is a raster the engine writes and
 * then leaves alone — `step()` is a no-op, so a held grid never blurs, decays or advances. It is the
 * backing store for a DECLARED POTENTIAL (#443): a host `addField` channel rasterised once per
 * invalidation and read as -grad(Phi) by `relief`. Filled only through [ScalarGridImpl.fillFrom].
 */
enum class GridMode { DIFFUSE, WAVE, MEMORY, HELD }

/** Clamp a Float to [lo, hi]. */
private fun clamp(v: Float, lo: Float, hi: Float): Float =
    if (v < lo) lo else if (v > hi) hi else v

class ScalarGridImpl(
    width: Float,
    height: Float,
    val mode: GridMode = GridMode.DIFFUSE,
    val cell: Float = 32f,
) : ScalarGrid {
    private var W: Float = width
    private var H: Float = height
    private var cols: Int = maxOf(2, ceil(width / cell).toInt() + 1)
    private var rows: Int = maxOf(2, ceil(height / cell).toInt() + 1)
    private var cur: FloatArray
    private var nxt: FloatArray
    private var prev: FloatArray // previous frame, for the wave scheme

    init {
        val n = cols * rows
        cur = FloatArray(n)
        nxt = FloatArray(n)
        prev = FloatArray(n)
    }

    private fun clampCol(ix: Int): Int = if (ix < 0) 0 else if (ix >= cols) cols - 1 else ix
    private fun clampRow(iy: Int): Int = if (iy < 0) 0 else if (iy >= rows) rows - 1 else iy

    /** The current value at a clamped (Neumann boundary) cell. */
    private fun at(ix: Int, iy: Int): Float =
        cur[clampRow(iy) * cols + clampCol(ix)]

    /** Bilinear sample of the field in pixel space. */
    override fun sample(at: Vec3): Float {
        val gx = at.x / cell
        val gy = at.y / cell
        val ix = floor(gx).toInt()
        val iy = floor(gy).toInt()
        val fx = gx - ix.toFloat()
        val fy = gy - iy.toFloat()
        val top = at(ix, iy) * (1 - fx) + at(ix + 1, iy) * fx
        val bot = at(ix, iy + 1) * (1 - fx) + at(ix + 1, iy + 1) * fx
        return top * (1 - fy) + bot * fy
    }

    /** Add `amount` to the nearest cell. */
    override fun deposit(at: Vec3, amount: Float) {
        val ix = clampCol((at.x / cell).roundToInt())
        val iy = clampRow((at.y / cell).roundToInt())
        cur[iy * cols + ix] += amount
    }

    /** The current peak value across the field — for normalizing a heatmap to [0, 1]. */
    fun max(): Float {
        var m = 0f
        for (v in cur) if (v > m) m = v
        return m
    }

    /** Central-difference gradient ∇φ in pixel space (points up-slope). Planar: z = 0. */
    override fun gradient(at: Vec3): Vec3 {
        val h = cell
        return Vec3(
            (sample(at + Vec3(h, 0f, 0f)) - sample(at - Vec3(h, 0f, 0f))) / (2 * h),
            (sample(at + Vec3(0f, h, 0f)) - sample(at - Vec3(0f, h, 0f))) / (2 * h),
            0f,
        )
    }

    /** Advance one frame in the grid's mode. */
    fun step() {
        when (mode) {
            // The declared-potential raster (#443): stepping would blur and decay a terrain the host
            // declared. Every other arm is untouched, so no existing grid moves by a bit.
            GridMode.HELD -> return
            GridMode.WAVE -> stepWave()
            GridMode.MEMORY -> stepDiffuse(D = 0.03f, decay = 0.004f) // barely blur, fade slowly
            GridMode.DIFFUSE -> stepDiffuse()
        }
    }

    /**
     * RASTERISE a sampler into this grid — the write API a [GridMode.HELD] potential needs (#443).
     *
     * Each cell (ix, iy) is filled from `sampler(ix*cell, iy*cell)` — the exact pixel coordinates
     * [sample] interpolates between — so a bilinear read at a cell centre returns the sampler's own
     * value and [gradient] is the true central difference of the sampled surface.
     *
     * NON-FINITE IS CLAMPED AT THE BOUNDARY: a host sampler returning NaN or infinity writes 0. A NaN
     * velocity slips a `speed > c` guard entirely (the comparison is false), so the check belongs
     * where the untrusted value enters the engine.
     */
    fun fillFrom(sampler: (Float, Float) -> Float) {
        for (iy in 0 until rows) {
            for (ix in 0 until cols) {
                val v = sampler(ix * cell, iy * cell)
                cur[iy * cols + ix] = if (v.isFinite()) v else 0f
            }
        }
    }

    /** Explicit heat equation φ' = (φ + D·∇²φ)·(1 − decay) (§20.10). */
    fun stepDiffuse(D: Float = 0.18f, decay: Float = 0.01f) {
        val Dc = clamp(D, 0f, 0.24f) // forward-scheme stability
        val keep = 1 - decay
        for (iy in 0 until rows) {
            for (ix in 0 until cols) {
                val i = iy * cols + ix
                val lap = at(ix - 1, iy) + at(ix + 1, iy) + at(ix, iy - 1) + at(ix, iy + 1) - 4 * cur[i]
                nxt[i] = (cur[i] + Dc * lap) * keep
            }
        }
        val tmp = cur; cur = nxt; nxt = tmp
    }

    /** Leapfrog wave φ' = 2φ − φ_prev + c²·∇²φ, lightly damped (§20.10). */
    fun stepWave(c2: Float = 0.25f, damping: Float = 0.002f) {
        val cc = clamp(c2, 0f, 0.5f) // CFL limit
        val keep = 1 - damping
        for (iy in 0 until rows) {
            for (ix in 0 until cols) {
                val i = iy * cols + ix
                val lap = at(ix - 1, iy) + at(ix + 1, iy) + at(ix, iy - 1) + at(ix, iy + 1) - 4 * cur[i]
                nxt[i] = (2 * cur[i] - prev[i] + cc * lap) * keep
            }
        }
        // rotate buffers: prev ← cur, cur ← nxt, reuse old prev as next scratch
        val oldPrev = prev
        prev = cur
        cur = nxt
        nxt = oldPrev
    }

    /** Resize to a new viewport, preserving nothing (rebuilds the buffers). */
    fun resize(width: Float, height: Float) {
        if (width == W && height == H) return
        W = width
        H = height
        cols = maxOf(2, ceil(width / cell).toInt() + 1)
        rows = maxOf(2, ceil(height / cell).toInt() + 1)
        val n = cols * rows
        cur = FloatArray(n)
        nxt = FloatArray(n)
        prev = FloatArray(n)
    }
}
