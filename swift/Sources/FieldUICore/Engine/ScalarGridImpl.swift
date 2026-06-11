import Foundation
import simd

// MARK: - ScalarGridImpl (scalar-grid.ts)
//
// A scalar field on a uniform grid — the backing store for field-buffer forces
// (§20.1 class [C]): `diffuse` (heat/concentration, ∂φ/∂t = D∇²φ) and `propagate`
// (a travelling wave, ∂²φ/∂t² = c²∇²φ). Particles `deposit` into it and read its
// `gradient`; the engine advances it once per frame with `step()`.
//
// The lattice is 2D over the x/y plane, exactly as the JS — field buffers are a
// surface phenomenon; z is ignored on sample/deposit and the gradient's z is 0.

public enum GridMode: Sendable {
    case diffuse, wave, memory
}

public final class ScalarGridImpl: ScalarGrid {
    public let mode: GridMode
    public let cell: Float
    private var W: Float
    private var H: Float
    private var cols: Int
    private var rows: Int
    private var cur: [Float]
    private var nxt: [Float]
    private var prev: [Float] // previous frame, for the wave scheme

    public init(width: Float, height: Float, mode: GridMode = .diffuse, cell: Float = 32) {
        self.W = width
        self.H = height
        self.mode = mode
        self.cell = cell
        self.cols = Swift.max(2, Int((width / cell).rounded(.up)) + 1)
        self.rows = Swift.max(2, Int((height / cell).rounded(.up)) + 1)
        let n = cols * rows
        self.cur = [Float](repeating: 0, count: n)
        self.nxt = [Float](repeating: 0, count: n)
        self.prev = [Float](repeating: 0, count: n)
    }

    @inline(__always) private func clampCol(_ ix: Int) -> Int { ix < 0 ? 0 : ix >= cols ? cols - 1 : ix }
    @inline(__always) private func clampRow(_ iy: Int) -> Int { iy < 0 ? 0 : iy >= rows ? rows - 1 : iy }
    /// The current value at a clamped (Neumann boundary) cell.
    @inline(__always) private func at(_ ix: Int, _ iy: Int) -> Float {
        cur[clampRow(iy) * cols + clampCol(ix)]
    }

    /// Bilinear sample of the field in pixel space.
    public func sample(at p: Vec3) -> Float {
        let gx = p.x / cell
        let gy = p.y / cell
        let ix = Int(gx.rounded(.down))
        let iy = Int(gy.rounded(.down))
        let fx = gx - Float(ix)
        let fy = gy - Float(iy)
        let top = at(ix, iy) * (1 - fx) + at(ix + 1, iy) * fx
        let bot = at(ix, iy + 1) * (1 - fx) + at(ix + 1, iy + 1) * fx
        return top * (1 - fy) + bot * fy
    }

    /// Add `amount` to the nearest cell.
    public func deposit(at p: Vec3, amount: Float) {
        let ix = clampCol(Int((p.x / cell).rounded()))
        let iy = clampRow(Int((p.y / cell).rounded()))
        cur[iy * cols + ix] += amount
    }

    /// The current peak value across the field — for normalizing a heatmap to [0, 1].
    public func max() -> Float {
        cur.reduce(0) { Swift.max($0, $1) }
    }

    /// Central-difference gradient ∇φ in pixel space (points up-slope). Planar: z = 0.
    public func gradient(at p: Vec3) -> Vec3 {
        let h = cell
        return Vec3(
            (sample(at: p + Vec3(h, 0, 0)) - sample(at: p - Vec3(h, 0, 0))) / (2 * h),
            (sample(at: p + Vec3(0, h, 0)) - sample(at: p - Vec3(0, h, 0))) / (2 * h),
            0
        )
    }

    /// Advance one frame in the grid's mode.
    public func step() {
        switch mode {
        case .wave:   stepWave()
        case .memory: stepDiffuse(D: 0.03, decay: 0.004) // barely blur, fade slowly
        case .diffuse: stepDiffuse()
        }
    }

    /// Explicit heat equation φ' = (φ + D·∇²φ)·(1 − decay) (§20.10).
    public func stepDiffuse(D: Float = 0.18, decay: Float = 0.01) {
        let Dc = clamp(D, 0, 0.24) // forward-scheme stability
        let keep = 1 - decay
        for iy in 0..<rows {
            for ix in 0..<cols {
                let i = iy * cols + ix
                let lap = at(ix - 1, iy) + at(ix + 1, iy) + at(ix, iy - 1) + at(ix, iy + 1) - 4 * cur[i]
                nxt[i] = (cur[i] + Dc * lap) * keep
            }
        }
        swap(&cur, &nxt)
    }

    /// Leapfrog wave φ' = 2φ − φ_prev + c²·∇²φ, lightly damped (§20.10).
    public func stepWave(c2: Float = 0.25, damping: Float = 0.002) {
        let cc = clamp(c2, 0, 0.5) // CFL limit
        let keep = 1 - damping
        for iy in 0..<rows {
            for ix in 0..<cols {
                let i = iy * cols + ix
                let lap = at(ix - 1, iy) + at(ix + 1, iy) + at(ix, iy - 1) + at(ix, iy + 1) - 4 * cur[i]
                nxt[i] = (2 * cur[i] - prev[i] + cc * lap) * keep
            }
        }
        // rotate buffers: prev ← cur, cur ← nxt, reuse old prev as next scratch
        let oldPrev = prev
        prev = cur
        cur = nxt
        nxt = oldPrev
    }

    /// Resize to a new viewport, preserving nothing (rebuilds the buffers).
    public func resize(width: Float, height: Float) {
        if width == W && height == H { return }
        W = width
        H = height
        cols = Swift.max(2, Int((width / cell).rounded(.up)) + 1)
        rows = Swift.max(2, Int((height / cell).rounded(.up)) + 1)
        let n = cols * rows
        cur = [Float](repeating: 0, count: n)
        nxt = [Float](repeating: 0, count: n)
        prev = [Float](repeating: 0, count: n)
    }
}
