import Foundation
#if canImport(simd)
import simd
#endif

// MARK: - Heatmap (heatmap.ts, field-systems H1)
//
// A scalar field buffer that reveals where field state accumulates, rendered as a
// diagnostic/ambient layer and sampled back to bodies. NOT a force: it measures, it
// does not push. Each frame every particle deposits into a coarse grid that decays and
// lightly blurs; values are normalized to [0, 1] by an eased running peak.

let HEATMAP_CELL: Float = 24  // grid resolution in px — coarse, so the per-frame work is cheap
let HEATMAP_DECAY: Float = 0.12 // per-frame fade: tracks the CURRENT density
let HEATMAP_BLUR: Float = 0.22  // light diffusion, for a smooth glow rather than blocky cells

public final class Heatmap {
    private let grid: ScalarGridImpl
    /// Eased running peak, for flicker-free normalization.
    private var peak: Float = 1e-3
    /// Grid resolution in px (the render samples on this lattice).
    public let cell: Float = HEATMAP_CELL

    public init(width: Float, height: Float) {
        grid = ScalarGridImpl(width: max(1, width), height: max(1, height), mode: .diffuse, cell: HEATMAP_CELL)
    }

    public func resize(width: Float, height: Float) {
        grid.resize(width: width, height: height)
    }

    /// Deposit the current particle field, decay + blur, and track the peak. Once a frame.
    public func update(particles: [Particle]) {
        for p in particles { grid.deposit(at: p.position, amount: 1) }
        grid.stepDiffuse(D: HEATMAP_BLUR, decay: HEATMAP_DECAY)
        let m = grid.max()
        // ease the peak up fast (a sudden spike normalizes promptly) and down slowly
        // (the map doesn't flare as the field empties); floored against divide-by-zero.
        let k: Float = m > peak ? 0.25 : 0.03
        peak += (Swift.max(m, 1e-3) - peak) * k
    }

    /// Normalized density ∈ [0, 1] at a point — for the glow render and body write-back.
    public func norm(at p: Vec3) -> Float {
        clamp(grid.sample(at: p) / peak, 0, 1)
    }

    /// Gradient of the normalized density field at a point — points up-slope (toward denser matter);
    /// `.zero` before any matter accumulates. `norm` is `sample / peak`, so its gradient is the raw
    /// grid gradient scaled by `1 / peak`.
    public func gradient(at p: Vec3) -> Vec3 {
        peak > 0 ? grid.gradient(at: p) / peak : .zero
    }
}
