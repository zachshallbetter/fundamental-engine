package com.fundamental.core.engine

import com.fundamental.core.math.Vec3

// Flow control (flow.ts) — the Kotlin port of swift/Sources/FundamentalCore/Engine/Flow.swift.
//
// A *flow focus* is a movable point the field bends toward: it pulls free matter in and can be
// retargeted every frame (follow the pointer, track an element, animate a path). It is not a body —
// it is a transient field influence, exposed through `flowTo()` / `clearFlow()`.

const val FLOW_DEFAULT_STRENGTH: Float = 1f
const val FLOW_DEFAULT_RADIUS: Float = 360f

/** A transient pull point: a position, a strength (≈[0,2], 1 = firm), and a px reach. */
data class FlowFocus(val position: Vec3, val strength: Float, val radius: Float)

/** Build a FlowFocus from a target + options, applying the defaults. Pure. */
fun makeFlowFocus(at: Vec3, strength: Float? = null, radius: Float? = null): FlowFocus =
    FlowFocus(
        position = at,
        strength = strength ?: FLOW_DEFAULT_STRENGTH,
        radius = if ((radius ?: 0f) > 0f) radius!! else FLOW_DEFAULT_RADIUS,
    )

/**
 * The vector a flow focus contributes at a point: a unit pull toward the focus scaled by `strength`,
 * falling off linearly to zero at `radius`. Gain ≈ 0.6 nudges particle velocity. Pure.
 */
fun flowBias(point: Vec3, focus: FlowFocus, gain: Float = 0.6f): Vec3 {
    val d3 = focus.position - point
    val d = d3.length()
    if (d == 0f || d >= focus.radius) return Vec3.ZERO
    val fall = (1f - d / focus.radius) * focus.strength * gain
    return (d3 / d) * fall
}
