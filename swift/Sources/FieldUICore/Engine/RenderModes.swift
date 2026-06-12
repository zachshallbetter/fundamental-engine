import Foundation
#if canImport(simd)
import simd
#endif

// MARK: - Render-mode geometry (render-modes.ts, §20.6)
//
// The pure geometry behind the links / metaballs / voronoi render modes — extracted so
// it can be golden-tested apart from any drawing surface.

/// Opacity of a particle↔particle link by separation (§20.6 links mode).
public func linkAlpha(d: Float, r: Float, maxAlpha: Float = 0.12) -> Float {
    if d >= r { return 0 }
    return (1 - d / r) * maxAlpha
}

// ── Metaballs — marching squares over a particle density field ──────────────────

/// A line segment in cell-local coordinates ([0,1]², origin top-left, +y down).
public struct IsoSeg: Equatable {
    public var x1: Float, y1: Float, x2: Float, y2: Float
}

/// The fractional crossing of the iso level between two corner values a → b.
/// Linear interpolation t = (iso − a)/(b − a), clamped to [0,1]; 0.5 if flat.
public func isoCross(_ a: Float, _ b: Float, iso: Float) -> Float {
    if a == b { return 0.5 }
    return clamp((iso - a) / (b - a), 0, 1)
}

/// Marching-squares contour for one cell (§20.6 metaballs). Given the densities at the
/// four corners — tl, tr, br, bl (clockwise from top-left) — and the iso level, return
/// the 0–2 segments where the contour crosses the cell's edges, in cell-local [0,1]².
/// The two ambiguous saddle cases (5, 10) are resolved the conventional way.
public func marchingCell(tl: Float, tr: Float, br: Float, bl: Float, level: Float) -> [IsoSeg] {
    // edge crossing points (only the ones a case uses are read)
    let T = SIMD2<Float>(isoCross(tl, tr, iso: level), 0)  // top edge tl→tr
    let R = SIMD2<Float>(1, isoCross(tr, br, iso: level))  // right edge tr→br
    let B = SIMD2<Float>(isoCross(bl, br, iso: level), 1)  // bottom edge bl→br
    let L = SIMD2<Float>(0, isoCross(tl, bl, iso: level))  // left edge tl→bl
    func seg(_ a: SIMD2<Float>, _ b: SIMD2<Float>) -> IsoSeg {
        IsoSeg(x1: a.x, y1: a.y, x2: b.x, y2: b.y)
    }
    // case index: one bit per corner above the level (tl=8, tr=4, br=2, bl=1)
    let c = (tl > level ? 8 : 0) | (tr > level ? 4 : 0) | (br > level ? 2 : 0) | (bl > level ? 1 : 0)
    switch c {
    case 0, 15:  return []
    case 1, 14:  return [seg(L, B)]
    case 2, 13:  return [seg(B, R)]
    case 3, 12:  return [seg(L, R)]
    case 4, 11:  return [seg(T, R)]
    case 6, 9:   return [seg(T, B)]
    case 7, 8:   return [seg(L, T)]
    case 5:      return [seg(L, T), seg(B, R)] // tr & bl above — saddle
    case 10:     return [seg(L, B), seg(T, R)] // tl & br above — saddle
    default:     return []
    }
}

/// Splat one particle's smooth density kernel onto a scalar grid (additive). `grid` is a
/// row-major cols × rows array of node densities at world (gx·step, gy·step); each
/// particle contributes (1 − d/radius)² to every node within radius. Pure — no rendering.
public func splatDensity(
    grid: inout [Float], cols: Int, rows: Int, step: Float,
    px: Float, py: Float, radius: Float, weight: Float = 1
) {
    if radius <= 0 { return }
    let gx0 = max(0, Int(((px - radius) / step).rounded(.down)))
    let gx1 = min(cols - 1, Int(((px + radius) / step).rounded(.up)))
    let gy0 = max(0, Int(((py - radius) / step).rounded(.down)))
    let gy1 = min(rows - 1, Int(((py + radius) / step).rounded(.up)))
    if gx0 > gx1 || gy0 > gy1 { return }
    let r2 = radius * radius
    for gy in gy0...gy1 {
        for gx in gx0...gx1 {
            let dx = Float(gx) * step - px
            let dy = Float(gy) * step - py
            let d2 = dx * dx + dy * dy
            if d2 >= r2 { continue }
            let f = 1 - sqrt(d2) / radius
            grid[gy * cols + gx] += weight * f * f
        }
    }
}

// ── Voronoi — nearest-site cells over the particle field ────────────────────────

/// Index of the nearest site to a point, or -1 if `sites` is empty.
public func nearestSite(_ x: Float, _ y: Float, sites: [SIMD2<Float>]) -> Int {
    var best = -1
    var bestD2 = Float.infinity
    for (i, s) in sites.enumerated() {
        let d2 = simd_length_squared(s - SIMD2<Float>(x, y))
        if d2 < bestD2 {
            bestD2 = d2
            best = i
        }
    }
    return best
}

/// A wall segment between two Voronoi cells, in grid-node units (×step at draw time).
public struct GridSeg: Equatable {
    public var x1: Float, y1: Float, x2: Float, y2: Float
}

/// The Voronoi cell walls of an owner grid (row-major cols × rows of site indices). A
/// wall sits on the shared edge between any two orthogonally-adjacent nodes whose owners
/// differ (an unowned node is -1); the vertical wall between columns gx and gx+1 lies at
/// x = gx + 0.5.
public func voronoiWalls(owners: [Int], cols: Int, rows: Int) -> [GridSeg] {
    var walls: [GridSeg] = []
    for gy in 0..<rows {
        for gx in 0..<cols {
            let o = owners[gy * cols + gx]
            if gx + 1 < cols && owners[gy * cols + gx + 1] != o {
                walls.append(GridSeg(x1: Float(gx) + 0.5, y1: Float(gy) - 0.5,
                                     x2: Float(gx) + 0.5, y2: Float(gy) + 0.5))
            }
            if gy + 1 < rows && owners[(gy + 1) * cols + gx] != o {
                walls.append(GridSeg(x1: Float(gx) - 0.5, y1: Float(gy) + 0.5,
                                     x2: Float(gx) + 0.5, y2: Float(gy) + 0.5))
            }
        }
    }
    return walls
}

/// One constellation link: endpoints + the separation alpha.
public struct LinkSegment {
    public let a: Vec3
    public let b: Vec3
    public let alpha: Float
}

/// The links-mode segment set: every close pair once, alpha by separation, found via a
/// cell grid of the link radius (O(n·k), never all-pairs). Pure geometry shared by the
/// render backends — CoreGraphics strokes them, Metal uploads them as line vertices.
public func linkSegments(particles: [Particle], radius r: Float = 70) -> [LinkSegment] {
    @inline(__always) func key(_ cx: Int32, _ cy: Int32) -> Int64 {
        (Int64(cx) << 32) | (Int64(cy) & 0xFFFF_FFFF)
    }
    var buckets: [Int64: [Int]] = [:]
    buckets.reserveCapacity(particles.count)
    for (i, p) in particles.enumerated() {
        buckets[key(Int32(p.position.x / r), Int32(p.position.y / r)), default: []].append(i)
    }
    var out: [LinkSegment] = []
    for (i, p) in particles.enumerated() {
        let cx = Int32(p.position.x / r)
        let cy = Int32(p.position.y / r)
        for dx: Int32 in -1...1 {
            for dy: Int32 in -1...1 {
                guard let bin = buckets[key(cx + dx, cy + dy)] else { continue }
                for j in bin where j > i { // each undirected pair once
                    let q = particles[j]
                    let a = linkAlpha(d: simd_distance(p.position, q.position), r: r)
                    if a > 0 {
                        out.append(LinkSegment(a: p.position, b: q.position, alpha: a))
                    }
                }
            }
        }
    }
    return out
}
