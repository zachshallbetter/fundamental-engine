package com.fundamental.core

import com.fundamental.core.engine.ScalarGrid
import com.fundamental.core.math.Vec3
import kotlin.math.abs
import kotlin.test.assertTrue

/** Float comparison within tolerance — the shared assertion for the force test suites. */
internal fun assertClose(expected: Float, actual: Float, tol: Float = 1e-3f, msg: String = "") {
    assertTrue(abs(expected - actual) <= tol, "$msg expected≈$expected actual=$actual (tol=$tol)")
}

/** A test double for the scalar grid: returns a fixed gradient/sample and records deposits. */
internal class StubGrid(
    private val grad: Vec3 = Vec3.ZERO,
    private val sampleValue: Float = 0f,
) : ScalarGrid {
    val deposits = mutableListOf<Pair<Vec3, Float>>()
    override fun sample(at: Vec3): Float = sampleValue
    override fun deposit(at: Vec3, amount: Float) { deposits.add(at to amount) }
    override fun gradient(at: Vec3): Vec3 = grad
}
