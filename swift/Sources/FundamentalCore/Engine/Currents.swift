import Foundation
#if canImport(simd)
import simd
#endif

// MARK: - Currents — the carrier waves (§24, §2.3) — currents.ts
//
// Five layered standing waveforms that form the resting structure of the field: they
// carry **bound** particles (shimmer) and impart a flow on the **free** ones. Pure data
// + math here; rendering and the bound/free reservoir live in the engine loop.

public struct Wave {
    /// Vertical anchor as a fraction of viewport height.
    public var baseFrac: Float
    public var amp: Float
    public var freq: Float
    public var phase: Float
    public var speed: Float
    public var color: RGB
    /// 0 (back) … 1 (front) — drives opacity and parallax.
    public var depth: Float
    /// Travel direction (±1).
    public var dir: Float
    /// Scroll-parallax offset, eased.
    public var offsetY: Float
}

/// A particle riding a wave line (the shimmer).
public struct BoundParticle {
    /// Index into the wave array.
    public var wi: Int
    /// Position along the wave, 0…1.
    public var progress: Float
    /// Vertical jitter offset.
    public var phase: Float
    public var size: Float
    public var glow: Bool
    /// Drift speed along the wave (±).
    public var speed: Float
}

let WAVE_LAYERS = 5
let WAVE_BASE: [Float] = [0.24, 0.4, 0.55, 0.7, 0.85]

/// Build the five wave layers, coloring them from the palette (§24.4).
public func buildWaves(palette: [RGB]) -> [Wave] {
    var waves: [Wave] = []
    for i in 0..<WAVE_LAYERS {
        let fi = Float(i)
        let baseFrac: Float = WAVE_BASE.indices.contains(i) ? WAVE_BASE[i] : 0.5
        let amp: Float = 22 + fi * 15
        let freq: Float = 0.0012 + fi * 0.0008
        let phase: Float = (fi * 1.7).truncatingRemainder(dividingBy: 6.28) // deterministic spread
        let speed: Float = 0.00013 + fi * 0.00009
        let color: RGB = palette.isEmpty ? DEFAULT_ACCENT : palette[i % palette.count]
        let depth: Float = fi / Float(WAVE_LAYERS - 1)
        let dir: Float = i % 2 == 1 ? -1 : 1
        waves.append(Wave(baseFrac: baseFrac, amp: amp, freq: freq, phase: phase,
                          speed: speed, color: color, depth: depth, dir: dir, offsetY: 0))
    }
    return waves
}

/// Build the bound shimmer pool: `round(16·density)` riders per wave (§2.5).
public func buildBound(waveCount: Int, density: Float, rand: () -> Float) -> [BoundParticle] {
    let per = Int((16 * density).rounded())
    var bound: [BoundParticle] = []
    for wi in 0..<waveCount {
        for _ in 0..<per {
            bound.append(BoundParticle(
                wi: wi,
                progress: rand(),
                phase: (rand() - 0.5) * 0.22 * .pi,
                size: 0.7 + rand() * 1.5,
                glow: rand() < 0.3,
                speed: (0.00035 + rand() * 0.0009) * (rand() < 0.5 ? 1 : -1)
            ))
        }
    }
    return bound
}

/// An engaged element the lines bend toward — the "spine" (§24).
public struct WavePull {
    public var x: Float
    public var y: Float
    /// Strength 0…1 (eased as the element engages/releases).
    public var k: Float

    public init(x: Float, y: Float, k: Float) {
        self.x = x
        self.y = y
        self.k = k
    }
}

/// The wave's y at horizontal position `x` and `time` seconds (§2.3).
public func waveYat(_ w: Wave, x: Float, time: Float, H: Float,
                    waveSpeed: Float = 1, amplitude: Float = 1, pull: WavePull? = nil) -> Float {
    var y = w.baseFrac * H + w.offsetY
        + sin(x * w.freq + w.phase + time * w.speed * 1000 * waveSpeed) * w.amp * amplitude
    // the engaged element bends the lines locally toward it (Gaussian falloff).
    if let pull, pull.k > 0.001 {
        let dx = x - pull.x
        let s: Float = 260
        let fall = exp(-(dx * dx) / (2 * s * s))
        y += (pull.y - y) * 0.42 * fall * pull.k * (0.45 + w.depth * 0.55)
    }
    return y
}

/// The wave's slope at `x` — the derivative the free particles drift along.
public func waveSlope(_ w: Wave, x: Float, time: Float,
                      waveSpeed: Float = 1, amplitude: Float = 1) -> Float {
    cos(x * w.freq + w.phase + time * w.speed * 1000 * waveSpeed) * w.amp * w.freq * amplitude
}
