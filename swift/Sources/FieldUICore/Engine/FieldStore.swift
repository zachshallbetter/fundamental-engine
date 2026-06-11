#if canImport(simd)
import simd
#endif

/// FieldStore — owns the particle pool and the spatial index (§20.1 foundation).
///
/// The single home for "all the matter": add/remove particles, rebuild the
/// neighbour index once per frame, and answer `neighbors(_:r:)`. Count is the
/// conserved quantity (§2.4) — `size` is the live total.
public final class FieldStore {
    public private(set) var particles: [Particle] = []
    private let hash: SpatialHash

    public init(cellSize: Float = 64) {
        self.hash = SpatialHash(cellSize: cellSize)
    }

    public var size: Int { particles.count }

    @discardableResult
    public func add(_ p: Particle) -> Particle {
        particles.append(p)
        return p
    }

    /// Swap-remove a particle (O(1) after the scan, order not preserved).
    public func remove(_ p: Particle) {
        guard let i = particles.firstIndex(where: { $0 === p }) else { return }
        let last = particles.removeLast()
        if i < particles.count { particles[i] = last }
    }

    public func clear() {
        particles.removeAll()
        hash.clear()
    }

    /// Rebuild the neighbour index from the current pool (once per frame).
    public func reindex() {
        hash.rebuild(particles)
    }

    /// Neighbours within `r` of `p`, excluding `p` itself.
    public func neighbors(_ p: Particle, r: Float) -> [Particle] {
        hash.near(p.position, r: r).filter { $0 !== p }
    }

    /// Particles within `r` of an arbitrary point — for grid sampling, where the
    /// query origin is not itself a particle.
    public func near(_ point: Vec3, r: Float) -> [Particle] {
        hash.near(point, r: r)
    }
}

// MARK: - Energy diagnostics

/// Snapshot of kinetic, thermal, and total energy for the current pool.
/// The Swift port of `energyReport` from @field-ui/core/diagnostics/energy.
public func energyReport(_ particles: [Particle]) -> EnergyReport {
    var kinetic: Float = 0
    var thermal: Float = 0
    for p in particles {
        kinetic += 0.5 * p.mass * simd_length_squared(p.velocity)
        thermal += p.heat
    }
    return EnergyReport(kinetic: kinetic, thermal: thermal, total: kinetic + thermal, count: particles.count)
}
