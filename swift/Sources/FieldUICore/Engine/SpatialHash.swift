#if canImport(simd)
import simd
#endif

/// A uniform-grid spatial hash for neighbour queries — the index that makes
/// particle↔particle forces (§20.1 class [B]) O(n·k) instead of O(n²).
///
/// 3D-native: bins are cubes. On 2D platforms every particle sits in the z=0
/// cell layer and the structure degenerates to the JS 2D grid with no overhead
/// beyond one extra loop iteration.
///
/// Rebuilt each frame from the live particle pool; query with `near(_:r:)`.
public final class SpatialHash {
    private let cell: Float
    private var bins: [Int64: [Particle]] = [:]

    public init(cellSize: Float = 64) {
        self.cell = cellSize > 0 ? cellSize : 64
    }

    @inline(__always)
    private func key(_ cx: Int64, _ cy: Int64, _ cz: Int64) -> Int64 {
        // pack three signed cell coords (21 bits each, offset to non-negative).
        ((cx &+ 0xF_FFFF) << 42) | ((cy &+ 0xF_FFFF) << 21) | (cz &+ 0xF_FFFF)
    }

    public func clear() {
        bins.removeAll(keepingCapacity: true)
    }

    public func insert(_ item: Particle) {
        let p = item.position
        let k = key(Int64((p.x / cell).rounded(.down)),
                    Int64((p.y / cell).rounded(.down)),
                    Int64((p.z / cell).rounded(.down)))
        bins[k, default: []].append(item)
    }

    public func rebuild(_ items: [Particle]) {
        clear()
        for it in items { insert(it) }
    }

    /// Items within radius `r` of `p`, filtered by true distance.
    public func near(_ p: Vec3, r: Float) -> [Particle] {
        var out: [Particle] = []
        let r2 = r * r
        let minC = SIMD3<Int64>(Int64(((p.x - r) / cell).rounded(.down)),
                                Int64(((p.y - r) / cell).rounded(.down)),
                                Int64(((p.z - r) / cell).rounded(.down)))
        let maxC = SIMD3<Int64>(Int64(((p.x + r) / cell).rounded(.down)),
                                Int64(((p.y + r) / cell).rounded(.down)),
                                Int64(((p.z + r) / cell).rounded(.down)))
        var cx = minC.x
        while cx <= maxC.x {
            var cy = minC.y
            while cy <= maxC.y {
                var cz = minC.z
                while cz <= maxC.z {
                    if let bin = bins[key(cx, cy, cz)] {
                        for it in bin where simd_length_squared(it.position - p) <= r2 {
                            out.append(it)
                        }
                    }
                    cz += 1
                }
                cy += 1
            }
            cx += 1
        }
        return out
    }
}
