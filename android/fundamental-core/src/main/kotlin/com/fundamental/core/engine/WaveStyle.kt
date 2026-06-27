package com.fundamental.core.engine

// Wave current layout style — the Kotlin port of the `WaveStyle` enum in
// swift/Sources/FundamentalCore/Engine/FieldHandle.swift.
//
// Swift declares `public enum WaveStyle: String { case linear, circular }`, whose String
// raw values are "linear" and "circular". Kotlin has no raw-value enums; the cases below map
// to those Swift raw values one-for-one (LINEAR → "linear", CIRCULAR → "circular").
enum class WaveStyle { LINEAR, CIRCULAR }
