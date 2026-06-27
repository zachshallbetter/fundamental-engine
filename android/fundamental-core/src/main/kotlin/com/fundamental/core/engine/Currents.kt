package com.fundamental.core.engine

import com.fundamental.core.math.Vec3
import com.fundamental.core.math.roundHalfAway
import kotlin.math.abs
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.exp
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sin
import kotlin.math.sqrt

// Currents — the carrier waves (§24, §2.3) — the Kotlin port of
// swift/Sources/FundamentalCore/Engine/Currents.swift (currents.ts).
//
// Five layered standing waveforms that form the resting structure of the field: they
// carry **bound** particles (shimmer) and impart a flow on the **free** ones. Pure data
// + math here; rendering and the bound/free reservoir live in the engine loop.
//
// `RGB` in the Kotlin port is `Vec3` ([0,255] channels), exactly as Swift aliases
// `RGB = SIMD3<Float>`.

data class Wave(
    /** Vertical anchor as a fraction of viewport height. */
    var baseFrac: Float,
    var amp: Float,
    var freq: Float,
    var phase: Float,
    var speed: Float,
    var color: Vec3,
    /** 0 (back) … 1 (front) — drives opacity and parallax. */
    var depth: Float,
    /** Travel direction (±1). */
    var dir: Float,
    /** Scroll-parallax offset, eased. */
    var offsetY: Float,
)

/**
 * An engaged element the lines bend toward — the "spine" (§24). Port of Swift `WavePull`;
 * required by [waveYat] and [waveDistance].
 */
data class WavePull(
    var x: Float,
    var y: Float,
    /** Strength 0…1 (eased as the element engages/releases). */
    var k: Float,
)

/**
 * The wave's y at horizontal position [x] and [time] seconds (§2.3).
 *
 * Mirrors Swift `waveYat(_:x:time:H:waveSpeed:amplitude:pull:)` with the same defaults
 * (waveSpeed = 1, amplitude = 1, pull = null).
 */
fun waveYat(
    w: Wave,
    x: Float,
    time: Float,
    H: Float,
    waveSpeed: Float = 1f,
    amplitude: Float = 1f,
    pull: WavePull? = null,
): Float {
    var y = w.baseFrac * H + w.offsetY +
        sin(x * w.freq + w.phase + time * w.speed * 1000f * waveSpeed) * w.amp * amplitude
    // the engaged element bends the lines locally toward it (Gaussian falloff).
    if (pull != null && pull.k > 0.001f) {
        val dx = x - pull.x
        val s = 260f
        val fall = exp(-(dx * dx) / (2f * s * s))
        y += (pull.y - y) * 0.42f * fall * pull.k * (0.45f + w.depth * 0.55f)
    }
    return y
}

/**
 * The wave's slope at [x] — the derivative the free particles drift along.
 *
 * Mirrors Swift `waveSlope(_:x:time:waveSpeed:amplitude:)`.
 */
fun waveSlope(
    w: Wave,
    x: Float,
    time: Float,
    waveSpeed: Float = 1f,
    amplitude: Float = 1f,
): Float =
    cos(x * w.freq + w.phase + time * w.speed * 1000f * waveSpeed) * w.amp * w.freq * amplitude

/** The circular wave's undulating radius at angle [theta] (radians) and [time] seconds. */
fun waveRAt(
    w: Wave,
    theta: Float,
    time: Float,
    maxRadius: Float,
    waveSpeed: Float = 1f,
    amplitude: Float = 1f,
): Float {
    val baseR = w.baseFrac * maxRadius + w.offsetY
    val N = max(1, roundHalfAway(w.freq * 2500f).toInt())
    return baseR + sin(N.toFloat() * theta + w.phase + time * w.speed * 1000f * waveSpeed) * w.amp * amplitude
}

/**
 * Result of [waveDistance]. Field order matches the Swift `WaveDistanceResult` struct:
 * dist, rWave, r, theta.
 */
data class WaveDistanceResult(
    var dist: Float,
    var rWave: Float,
    var r: Float,
    var theta: Float,
)

/**
 * Calculate shortest distance and coordinates from a particle ([px], [py]) to a wave.
 *
 * Mirrors Swift `waveDistance(_:px:py:time:W:H:style:center:waveSpeed:amplitude:pull:)`.
 */
fun waveDistance(
    w: Wave,
    px: Float,
    py: Float,
    time: Float,
    W: Float,
    H: Float,
    style: WaveStyle,
    center: Vec3,
    waveSpeed: Float = 1f,
    amplitude: Float = 1f,
    pull: WavePull? = null,
): WaveDistanceResult {
    if (style == WaveStyle.CIRCULAR) {
        val dx = px - center.x
        val dy = py - center.y
        val r = if (sqrt(dx * dx + dy * dy) == 0f) 1e-3f else sqrt(dx * dx + dy * dy)
        val theta = atan2(dy, dx)
        val maxRadius = min(W, H) * 0.48f
        val rWave = waveRAt(w, theta = theta, time = time, maxRadius = maxRadius, waveSpeed = waveSpeed, amplitude = amplitude)
        return WaveDistanceResult(dist = abs(r - rWave), rWave = rWave, r = r, theta = theta)
    } else {
        val yWave = waveYat(w, x = px, time = time, H = H, waveSpeed = waveSpeed, amplitude = amplitude, pull = pull)
        return WaveDistanceResult(dist = abs(py - yWave), rWave = yWave, r = py, theta = 0f)
    }
}
