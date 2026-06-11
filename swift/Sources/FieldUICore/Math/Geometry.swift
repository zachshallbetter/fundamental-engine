#if canImport(simd)
import simd
#endif

// MARK: - Box (3D axis-aligned)

/// Axis-aligned box: centre + half-extents. The 3D counterpart of the JS `Rect`.
/// On 2D platforms `hz = 0` (infinitely flat); visionOS uses full depth.
public struct Box {
    public var center: Vec3
    public var halfExtents: Vec3   // (hw, hh, hd)

    public init(center: Vec3, halfExtents: Vec3) {
        self.center = center
        self.halfExtents = halfExtents
    }

    /// Half-width (x), half-height (y), half-depth (z).
    public var hw: Float { halfExtents.x }
    public var hh: Float { halfExtents.y }
    public var hd: Float { halfExtents.z }
}

/// Box + heading (unit Vec3) + polarity spin.
public struct AxisBox {
    public var box: Box
    /// Unit heading direction (the dipole axis).
    public var heading: Vec3
    /// Polarity sign: which end carries the + / N pole.
    public var spin: Float

    public init(box: Box, heading: Vec3, spin: Float) {
        self.box = box
        self.heading = heading
        self.spin = spin
    }
}

/// One pole of a dipole: a 3D position and signed charge (±1).
public struct Pole {
    public var position: Vec3
    public var charge: Float

    public init(position: Vec3, charge: Float) {
        self.position = position
        self.charge = charge
    }
}

// MARK: - Guard against divide-by-zero at a pole (1 unit, sub-pixel).
public let EPS: Float = 1

// MARK: - Geometry helpers

/// The nearest point of the filled box to `p`.
/// Outside the box this is the closest boundary point; inside, `p` itself.
public func nearestOnBox(_ p: Vec3, _ b: Box) -> Vec3 {
    simd_clamp(p, b.center - b.halfExtents, b.center + b.halfExtents)
}

/// Signed distance from `p` to the box: negative inside, zero on the edge, positive outside.
/// The 3D box SDF — forces reference the element's surface, not an arbitrary centre distance.
public func sdfBox(_ p: Vec3, _ b: Box) -> Float {
    let q = simd_abs(p - b.center) - b.halfExtents
    let outside = simd_length(simd_max(q, .zero))
    let inside  = min(q.max(), 0)
    return outside + inside
}

/// The two poles of the body's dipole, laid on its heading axis at the box edge.
/// The `+` (N) pole sits at `+heading`; `spin < 0` swaps them.
/// Returns a reach proportional to the box extent along the heading, so a wide element
/// makes a long magnet.
public func polePair(_ b: AxisBox) -> (Pole, Pole) {
    let he = b.box.halfExtents
    let h  = b.heading

    // Ray-box exit distance from centre along heading.
    let tx = h.x != 0 ? he.x / abs(h.x) : Float.infinity
    let ty = h.y != 0 ? he.y / abs(h.y) : Float.infinity
    let tz = h.z != 0 ? he.z / abs(h.z) : Float.infinity
    let reach = min(tx, min(ty, tz))

    let axis = h * reach
    let s: Float = b.spin < 0 ? -1 : 1
    return (
        Pole(position: b.box.center + axis, charge:  s),
        Pole(position: b.box.center - axis, charge: -s)
    )
}

/// Superposition of a set of poles' radial `q/d²` fields at `p`.
/// For a dipole pair this is the classic bar-magnet / electric-dipole field.
public func dipoleField(poles: [Pole], at p: Vec3) -> Vec3 {
    var f = Vec3.zero
    for pole in poles {
        let d  = p - pole.position
        let dn = max(EPS, simd_length(d))
        let k  = pole.charge / (dn * dn)
        f += (d / dn) * k
    }
    return f
}
