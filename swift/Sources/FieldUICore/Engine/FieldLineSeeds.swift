#if canImport(simd)
import simd
#endif

// MARK: - Field-line seeds (apps/site field-probe `traceDipole`, made multi-body)
//
// Where to start tracing so the diagram is the CORRECT structure, not arbitrary rings.
// A field line is seeded by the body's actual field geometry:
//
//   · DIPOLE bodies (magnetism): seed along the perpendicular bisector of the heading
//     axis — the centre plus ring offsets either side. Each offset lies on a distinct
//     nested field line, so tracing both directions closes one clean N→S loop per seed:
//     the bar-magnet diagram.
//   · MONOPOLE bodies (charge, gravity): a tight ring around the core → radial spokes
//     (out of +, into −; inward for gravity).
//   · bodies with NO field-bearing token: no seeds — they radiate nothing, so seeding
//     them only traces a NEIGHBOUR's field and crowds the diagram (the Mass starburst).
//
// The seeds feed `traceFieldLines` over the NET field, so lines between two magnets link
// them — the geometry between bodies emerges, never drawn by hand. Pure: the one source
// of this algorithm, shared by every renderer.

/// The forces that define a `field()` hook — only these bodies radiate structure.
public let FIELD_BEARING_TOKENS: Set<String> = ["magnetism", "charge", "gravity"]

/// Seed points for the field-line diagram of a set of bodies (visible, field-bearing only).
public func fieldLineSeeds(bodies: [Body], dipoleRings: Int = 8) -> [Vec3] {
    var seeds: [Vec3] = []
    for b in bodies where b.isVisible && !b.tokens.isEmpty {
        if b.tokens.contains("magnetism") {
            seeds.append(contentsOf: dipoleSeeds(b, rings: dipoleRings))
        } else if b.tokens.contains("charge") || b.tokens.contains("gravity") {
            seeds.append(contentsOf: monopoleSeeds(b))
        }
        // no field-bearing token ⇒ no seeds (an attract/sink/… body radiates nothing)
    }
    return seeds
}

/// Dipole seeds: centre + `rings` offsets either side of the heading's perpendicular
/// bisector. Uses the same synthesized-pole fallback the field math (`bodyDipole`) uses,
/// so a near-point body still reads as a full dipole.
public func dipoleSeeds(_ b: Body, rings: Int = 8) -> [Vec3] {
    var (pA, pB) = polePair(AxisBox(box: b.box, heading: b.heading, spin: b.spin))
    var sep = simd_distance(pA.position, pB.position)
    if sep < max(b.range * 0.06, 8) {
        let half = max(b.range * 0.18, 60)
        pA = Pole(position: b.center + b.heading * half, charge: b.spin < 0 ? -1 : 1)
        pB = Pole(position: b.center - b.heading * half, charge: b.spin < 0 ? 1 : -1)
        sep = simd_distance(pA.position, pB.position)
    }
    // the unit perpendicular to the heading, in the page plane
    let perp = simd_normalize(simd_cross(Vec3(0, 0, 1), b.heading))
    let spacing = max(sep * 0.13, 18)
    var seeds: [Vec3] = [b.center] // the central axial line through both poles
    for i in 1...rings {
        let off = Float(i) * spacing
        seeds.append(b.center + perp * off)
        seeds.append(b.center - perp * off)
    }
    return seeds
}

/// Monopole seeds: a tight ring close to the core → radial spokes.
public func monopoleSeeds(_ b: Body, count: Int = 18) -> [Vec3] {
    let r0 = max(min(b.box.hw, b.box.hh) * 0.8, 24)
    return (0..<count).map { k in
        let a = Float(k) / Float(count) * 2 * .pi
        return b.center + Vec3(cos(a) * r0, sin(a) * r0, 0)
    }
}
