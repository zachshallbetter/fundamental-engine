package com.fundamental.core.engine

import com.fundamental.core.math.clamp
import kotlin.math.max

// Conserved attention (attention.ts, §2.4 + Concept 2) — the Kotlin port of
// swift/Sources/FundamentalCore/Engine/Attention.swift. One finite strength budget for the whole
// field: engaging a body pulls allocation off every other body, so the field cannot emphasise two
// things at once. Rest-neutral (all 1 when nothing is engaged) and total-strength-conserving.

data class AttnInput(val strength: Float, val on: Boolean)

class AttnOpts(val beta: Float = 2f, val lo: Float = 0.25f, val hi: Float = 3f)

/** Per-body effective-strength multipliers for one frame, index-aligned with `bodies`. */
fun attentionMuls(bodies: List<AttnInput>, opts: AttnOpts = AttnOpts()): FloatArray {
    val n = bodies.size
    val out = FloatArray(n) { 1f }
    if (n == 0) return out
    var sumS = 0f
    var sumM = 0f
    for (b in bodies) {
        val s = max(b.strength, 0f)
        sumS += s
        sumM += s * (1f + if (b.on) opts.beta else 0f)
    }
    if (sumS <= 0f || sumM <= 0f) return out // nothing to allocate → neutral
    val k = sumS / sumM // demand normaliser; exactly 1 when nothing is engaged
    for (i in 0 until n) {
        val demand = 1f + if (bodies[i].on) opts.beta else 0f
        out[i] = clamp(demand * k, opts.lo, opts.hi)
    }
    return out
}

// ── Conserved allocation (water-filling) ──────────────────────────────────────────────────────────

data class AttnAllocItem(val urgency: Float, val pinned: Boolean = false)

/**
 * Distribute `budget` across items proportional to urgency, capping each weight at `cap` and re-flowing
 * capped excess over the rest (water-filling). Pinned items take exactly `cap` off the top.
 * Invariant: Σ(returned) == budget (±ε) when budget ≤ n·cap and unpinned items carry positive urgency.
 */
fun allocateAttention(items: List<AttnAllocItem>, budget: Float, cap: Float = 1f): FloatArray {
    val n = items.size
    val w = FloatArray(n)
    if (n == 0 || !(cap > 0f)) return w

    val u = FloatArray(n)
    var free = ArrayList<Int>()
    var pinnedCount = 0
    items.forEachIndexed { i, it ->
        if (it.pinned) { w[i] = cap; pinnedCount++ } else {
            u[i] = if (it.urgency.isFinite() && it.urgency > 0f) it.urgency else 0f
            free.add(i)
        }
    }

    var rem = max(0f, budget - pinnedCount * cap)
    var pass = 0
    while (pass < n && free.isNotEmpty() && rem > 0f) {
        pass++
        val sum = free.sumOf { u[it].toDouble() }.toFloat()
        val k = rem / (if (sum == 0f) 1f else sum)
        val still = ArrayList<Int>()
        var capped = 0
        for (i in free) {
            if (u[i] * k >= cap) { w[i] = cap; capped++ } else still.add(i)
        }
        if (capped == 0) {
            for (i in still) w[i] = u[i] * k
            break
        }
        rem -= capped * cap
        free = still
    }
    return w
}
