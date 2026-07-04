package com.fundamental.core.config

// Canonical force colors (forces.config.ts FORCES catalog) — ported verbatim from
// swift/Sources/FundamentalCore/Engine/ForceColors.swift. The nine designed forces each carry a
// canon color (chips, spark tints, lab swatches); the natural and extended sets have none.
val CANONICAL_FORCE_COLORS: Map<String, String> = mapOf(
    "attract" to "#4da3ff",
    "jet" to "#a78bfa",
    "tether" to "#86e57f",
    "wall" to "#c4b5fd",
    "stream" to "#7dd3fc",
    "repel" to "#ff9d5c",
    "viscosity" to "#8da2c0",
    "swirl" to "#2dd4bf",
    "sink" to "#ff6e9c",
)

/** The canon color for a force token, or null for tokens outside the canonical nine. */
fun canonicalForceColor(token: String): String? = CANONICAL_FORCE_COLORS[token]
