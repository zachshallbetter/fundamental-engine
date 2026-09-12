import Foundation
#if canImport(simd)
import simd
#endif

// MARK: - Streamlines / vector-field probes (streamlines.ts, §20.6 diagnostic)
//
// Instead of the matter, measure the *forces themselves*. At a probe point we measure the
// net push a still test particle would feel — so the invisible field a layout creates
// becomes visible. `forceAt` mirrors the integrator's body-force loop (same range cull),
// minus the per-particle modifier pass — a faithful-enough probe.
//
// PURITY (#1162, the Swift half of JS #1155). A probe is an INSTRUMENT, not matter: it may read
// the field and must never write to it. That contract used to be incidental rather than structural
// — the loop ran each body's real `apply()` against the CALLER'S LIVE ENV, so `sink` advanced a
// real body's accretion budget and could fire the live `supernova` from a drawing, `diffuse` /
// `memory` wore the real scalar grids, `wall` threw sparks into the live field, and every sample
// advanced the simulation's seeded rng (so the same point read a different vector depending on what
// had been drawn before it). Now every sample runs under its own ``makeProbeEnv(mirroring:)``,
// whose writing services are inert.
//
// Swift's exposure was WORSE than the JS engine's, not merely equal. JS shares one module-level
// probe particle whose `cap` was never cleared, so after the first sample inside any sink's
// `absorbR` that body's own `if (p.cap || …) return` guard short-circuited for the life of the
// process: the body was over-accreted exactly ONCE, self-limiting by accident. Swift builds a
// FRESH `Particle` per call (below), so `p.cap` is always nil and that guard never fires — every
// probe point inside `absorbR` accreted, on every sample of every frame. A 12-frame streamlines
// walk over one capacity-4 sink accreted 420 times and fired `supernova` 417 times.
//
// An inert env alone cannot close it: `sink` writes `b.accreted` DIRECTLY, through no service at
// all. Hence the ``Env/isProbe`` marker the probe env carries and `sink` checks. One writer, one
// reader. The drawn vectors are unchanged for every non-mutating force — `sink` contributes no
// velocity either way — so the cross-plane conformance golden is byte-identical.

/// The probe's own noise seed (the golden-ratio constant JS's `streamlines.ts` uses). Reseeded at
/// the top of every sample, so a stochastic force (`jet`'s nozzle cone, `thermal`'s Langevin kick,
/// `morph`'s jitter) reads the same at the same point however many samples came before it — and a
/// seeded run a host is recording is never advanced by drawing a diagnostic.
let PROBE_SEED: UInt32 = 0x9e37_79b9

/// A read-through, write-DROPPING view of a live scalar grid: `diffuse` / `memory` still read the
/// real field (an honest diagnostic reading), but their deposits never wear it.
final class ProbeGrid: ScalarGrid {
    private let live: any ScalarGrid
    init(_ live: any ScalarGrid) { self.live = live }
    func sample(at p: Vec3) -> Float { live.sample(at: p) }
    func gradient(at p: Vec3) -> Vec3 { live.gradient(at: p) }
    func deposit(at p: Vec3, amount: Float) {} // a reading never wears the field
}

/// The env one probe sample runs under. Its per-frame SCALARS mirror the caller's live env (so the
/// reading is of the field as it is right now); every service that WRITES is inert —
/// `spark`/`supernova`/`spawn` keep `Env`'s no-op defaults, grids drop their deposits, `rng` is the
/// probe's own freshly seeded stream. `isProbe` tells a force that writes engine state outside the
/// probe particle (today only `sink`'s accretion) that this pass is a reading, not a capture.
///
/// Built per sample rather than cached in a module-level singleton as the JS port does: this target
/// is compiled under strict concurrency and holds no global mutable state, and `forceAt` already
/// allocates a fresh `Particle` per call.
func makeProbeEnv(mirroring env: Env) -> Env {
    let pe = Env()
    // read-only per-frame state, mirrored so the reading is current. `form` is a struct — copied,
    // never aliased, so no force can write through it back into the live env.
    pe.form = env.form
    pe.volume = env.volume
    pe.t = env.t
    pe.frameN = env.frameN
    pe.dt = env.dt
    pe.c = env.c
    pe.G = env.G
    pe.scrollV = env.scrollV
    pe.integrator = env.integrator
    pe.fieldAt = env.fieldAt // a pure read (netField over the live bodies)
    pe.isProbe = true
    pe.rng = seededRng(PROBE_SEED)
    pe.neighbors = { [live = env] p, r in live.neighbors(p, r) }
    pe.grid = { [live = env] name in ProbeGrid(live.grid(name)) }
    // spark / supernova / spawn are left at `Env`'s defaults, which are already no-ops — the live
    // services are never handed to a probe pass.
    return pe
}

/// Net force a zero-velocity test particle would feel at a point — the field vector.
/// A force that defines a `field()` (its visual/structure field) contributes that instead
/// of its `apply`, so velocity- and charge-dependent forces (magnetism, charge) appear
/// here even though they no-op on a still, neutral probe.
///
/// READ-ONLY: `env` supplies the per-frame reading only — the forces run against a probe env, so
/// this never writes to the simulation (#1162).
public func forceAt(bodies: [Body], forces: ForceRegistry, env: Env, at point: Vec3) -> Vec3 {
    let probe = Particle(position: point)
    let pe = makeProbeEnv(mirroring: env)
    var fieldSum = Vec3.zero // field() contributions, accumulated apart from the apply probe
    for b in bodies {
        if !b.isVisible || b.tokens.isEmpty { continue }
        // mirror the integrator's shaped reference (Stage C): a shaped body warps the field from the
        // nearest point on its BOX, not its centre — so the grid / streamlines bend around an element's
        // whole outline (a button, a wide headline), not a single point. Inside the box delta=0 → no pull.
        let delta = b.shaped ? (nearestOnBox(point, b.box) - point) : (b.center - point)
        let d2 = simd_length_squared(delta)
        if b.range > 0 && d2 >= b.range * b.range * 2.56 { continue } // same cull as the integrator
        let d = sqrt(d2)
        pe.vector = delta
        pe.dist = d < 1 ? 1 : d
        for tok in b.tokens {
            guard let f = forces[tok], !f.hasModify else { continue }
            if let v = f.field(body: b, at: point) {
                fieldSum += v
            } else {
                f.apply(body: b, particle: probe, env: pe)
            }
        }
    }
    return probe.velocity + fieldSum
}

/// The net *structure* field at a point: the superposition of every visible body's
/// `field()` contribution (the dipoles and monopoles only — no apply-probe), with the same
/// range cull as the integrator. This is the field the streamlines view draws and the
/// vector matter follows under `fieldflow`. Pure: no env mutation, safe mid-integration.
public func netField(bodies: [Body], forces: ForceRegistry, at point: Vec3) -> Vec3 {
    var f = Vec3.zero
    for b in bodies {
        if !b.isVisible || b.tokens.isEmpty { continue }
        if b.range > 0 {
            let delta = b.center - point
            if simd_length_squared(delta) >= b.range * b.range * 2.56 { continue }
        }
        for tok in b.tokens {
            if let v = forces[tok]?.field(body: b, at: point) { f += v }
        }
    }
    return f
}

// MARK: - Field-line tracing (fieldlines.ts, Stage B2)
//
// A field line is a streamline of a vector field: start at a seed and step along the
// normalized field direction, tracing the curve a compass needle would follow. Pure and
// engine-agnostic: it takes a sampler, so it works over one force's field(), a sum, or
// any vector field at all.

/// A point sampler for the vector field being traced.
public typealias FieldSampler = (Vec3) -> Vec3

public struct FieldLineOpts {
    /// px advanced per integration step.
    public var step: Float = 6
    /// Max steps in each direction from the seed.
    public var maxSteps: Int = 400
    /// Stop when the field magnitude drops below this. Near-zero by design: field
    /// magnitudes span orders of magnitude across forces, so this stops only true dead
    /// zones (saddles) and NaN, not weak-but-live field.
    public var minStrength: Float = 1e-9
    /// Viewport; stop when the line leaves it by more than a step. Nil for unbounded.
    public var bounds: (w: Float, h: Float)? = nil
    /// Stop when the line returns within this of its seed (a closed loop).
    public var loopDist: Float = 6
    /// Turning budget, in full revolutions: stop once the line's cumulative heading
    /// change exceeds this. A line orbiting a pole that never passes back through its
    /// seed (so loopDist can't close it) otherwise winds the same circle for the whole
    /// step budget — thousands of overlapping segments that explode an antialiasing
    /// renderer's intersection pass. `.infinity` (the default) preserves the unbounded
    /// behavior; renderers pass ~1.5 (one closed loop plus slack).
    public var maxTurns: Float = .infinity

    public init() {}
}

/// Trace one direction (+1 downstream, −1 upstream) from a seed.
private func traceOne(_ sample: FieldSampler, seed: Vec3, dir: Float, o: FieldLineOpts) -> [Vec3] {
    var pts: [Vec3] = [seed]
    var p = seed
    let m = o.step // out-of-bounds margin
    var prevDir = Vec3.zero
    var turned: Float = 0
    let turnBudget = o.maxTurns * 2 * .pi
    for i in 0..<o.maxSteps {
        let f = sample(p)
        let mag = simd_length(f)
        if !(mag >= o.minStrength) { break } // below threshold or NaN → the line ends
        let u = (f / mag) * dir
        if turnBudget.isFinite {
            if prevDir != .zero {
                let dot = clamp(simd_dot(u, prevDir), -1, 1)
                turned += acos(dot)
                if turned > turnBudget { break } // wound past the budget → an orbit, stop
            }
            prevDir = u
        }
        p += u * o.step
        if let b = o.bounds, p.x < -m || p.y < -m || p.x > b.w + m || p.y > b.h + m { break }
        if i > 4 && simd_distance(p, seed) < o.loopDist {
            pts.append(p) // closed loop → snap shut and stop
            break
        }
        pts.append(p)
    }
    return pts
}

/// Trace a full field line through a seed: upstream reversed, then downstream, so the
/// seed sits mid-line. A degenerate (zero-field) seed yields a single point.
public func traceFieldLine(_ sample: FieldSampler, seed: Vec3, opts: FieldLineOpts = FieldLineOpts()) -> [Vec3] {
    var back = traceOne(sample, seed: seed, dir: -1, o: opts)
    let fwd = traceOne(sample, seed: seed, dir: 1, o: opts)
    back.reverse()
    back.removeLast() // drop the duplicated seed shared with fwd[0]
    return back + fwd
}

/// Trace a field line from each seed point. Empty/degenerate lines are dropped.
public func traceFieldLines(_ sample: FieldSampler, seeds: [Vec3], opts: FieldLineOpts = FieldLineOpts()) -> [[Vec3]] {
    seeds.map { traceFieldLine(sample, seed: $0, opts: opts) }.filter { $0.count > 1 }
}
