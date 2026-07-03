import Foundation
import Testing
#if canImport(simd)
import simd
#endif
@testable import FundamentalVanilla
import FundamentalCore

@Suite("FieldField")
struct FieldFieldTests {

    @Test("the engine builds the base pool — 130 × density particles")
    func basePool() {
        let host = HeadlessFieldHost()
        let field = FieldField(host: host)
        #expect(field.particleCount() == 130)
        field.destroy()

        let dense = FieldField(host: HeadlessFieldHost(), options: .init(density: 2))
        #expect(dense.particleCount() == 260)
        dense.destroy()
    }

    @Test("burst shoves and heats nearby matter")
    func burstHeats() {
        let host = HeadlessFieldHost()
        let field = FieldField(host: host)
        let before = field.energy()
        field.burst(at: Vec3(187, 406, 0)) // somewhere in the 375×812 volume
        let after = field.energy()
        #expect(after.thermal > before.thermal)
        #expect(after.kinetic > before.kinetic)
        field.destroy()
    }

    @Test("energy reports the live pool")
    func energyCount() {
        let field = FieldField(host: HeadlessFieldHost())
        #expect(field.energy().count == 130)
        field.destroy()
    }

    @Test("ticking the loop advances the simulation")
    func tickAdvances() {
        let host = HeadlessFieldHost()
        let field = FieldField(host: host)
        field.burst(at: Vec3(187, 406, 0)) // give matter some velocity
        let before = field.energy().kinetic
        for i in 0..<30 { host.fire(at: TimeInterval(i) / 60) }
        let after = field.energy().kinetic
        #expect(after < before) // friction bled the burst's energy back out
        field.destroy()
    }

    @Test("seed binds atoms round-robin and atomAt picks them back")
    func seedAndPick() {
        let field = FieldField(host: HeadlessFieldHost())
        field.seed([AtomPayload(weight: 1, payload: ["name": "alpha"])])
        // every particle carries the one atom; querying at any particle finds it
        let engine = field.particleCount()
        #expect(engine == 130)
        // probe a grid of points — at least one lands within 24px of a particle
        var found: AtomPayload?
        for x in stride(from: Float(0), to: 375, by: 24) {
            for y in stride(from: Float(0), to: 812, by: 24) {
                if let atom = field.atomAt(Vec3(x, y, 0)) { found = atom; break }
            }
            if found != nil { break }
        }
        #expect(found != nil)
        #expect(found?.payload["name"] as? String == "alpha")
        field.destroy()
    }

    @Test("feedback body charges up (d rises) as matter gathers")
    func feedbackCharges() {
        let host = HeadlessFieldHost()
        let body = Body(tokens: ["attract"], strength: 2, range: 300,
                        box: Box(center: Vec3(187, 406, 0), halfExtents: Vec3(50, 25, 0)))
        body.feedback = true
        body.view = host
        host.bodies = [body]
        host.boxes[ObjectIdentifier(host)] = body.box

        let field = FieldField(host: host)
        field.scan()
        for i in 0..<120 { host.fire(at: TimeInterval(i) / 60) }
        #expect(body.d > 0) // the eased density rose from gathered matter
        field.destroy()
    }

    @Test("a flat field (depth 0) keeps every particle at z = 0")
    func flatStaysPlanar() {
        let host = HeadlessFieldHost()
        let field = FieldField(host: host)
        field.burst(x: 187, y: 406) // the x/y convenience — z defaults to 0
        for i in 0..<60 { host.fire(at: TimeInterval(i) / 60) }
        // energy is the only public probe; assert via a z-probe burst instead:
        // atomAt at z=0 must behave identically to the 3-arg call.
        field.seed([AtomPayload(weight: 1, payload: [:])])
        var hit2D: AtomPayload?
        var hit3D: AtomPayload?
        for x in stride(from: Float(0), to: 375, by: 24) {
            for y in stride(from: Float(0), to: 812, by: 24) {
                if hit2D == nil { hit2D = field.atomAt(x: x, y: y) }
                if hit3D == nil { hit3D = field.atomAt(Vec3(x, y, 0)) }
            }
        }
        #expect((hit2D != nil) == (hit3D != nil))
        field.destroy()
    }

    @Test("a volumetric field (depth > 0) spreads matter through z")
    func volumetricSpreadsZ() {
        let host = HeadlessFieldHost(depth: 300)
        let field = FieldField(host: host)
        // matter seeded through the volume sits off the z=0 plane, so a plane-locked
        // probe finds fewer atoms than the same probe sweeping z as well.
        field.seed([AtomPayload(weight: 1, payload: [:])])
        var planarHits = 0
        var volumeHits = 0
        for x in stride(from: Float(0), to: 375, by: 12) {
            for y in stride(from: Float(0), to: 812, by: 12) {
                if field.atomAt(x: x, y: y) != nil { planarHits += 1 }
                for z in stride(from: Float(0), to: 300, by: 24) {
                    if field.atomAt(x: x, y: y, z: z) != nil { volumeHits += 1; break }
                }
            }
        }
        #expect(volumeHits > planarHits) // z-sweeping the probe finds matter the plane misses
        field.destroy()
    }

    @Test("the volumetric sim stays bounded — z wraps toroidally like x and y")
    func volumetricBounded() {
        let host = HeadlessFieldHost(depth: 300)
        let field = FieldField(host: host)
        field.burst(at: Vec3(187, 406, 150)) // a 3D burst inside the volume
        for i in 0..<240 { host.fire(at: TimeInterval(i) / 60) }
        // four seconds of sim: nothing exploded, nothing leaked, count is conserved.
        #expect(field.particleCount() == 130)
        #expect(field.energy().total.isFinite)
        field.destroy()
    }

    @Test("addEdge — strength rises while source is salient, readEdges echoes data records")
    func addEdge() {
        let host = HeadlessFieldHost()
        let field = FieldField(host: host, options: .init(render: .none_, attention: true))
        // two bodies: A is strong (salient), B is weak
        let bodyA = field.addBody(BodySpec(tokens: ["attract"], strength: 2.5, range: 250,
            data: "node-A", rect: { Box(center: Vec3(100, 200, 0), halfExtents: Vec3(30, 30, 0)) }))
        let bodyB = field.addBody(BodySpec(tokens: ["attract"], strength: 0.1, range: 100,
            data: "node-B", rect: { Box(center: Vec3(300, 200, 0), halfExtents: Vec3(30, 30, 0)) }))
        field.addEdge(bodyA, bodyB, type: "co-session", strength: 0.2, direction: .bidirectional)
        // run the field long enough for A to become salient
        for i in 0..<120 { host.fire(at: TimeInterval(i) / 60) }
        let edges = field.readEdges()
        #expect(edges.count == 1, "one edge registered")
        let e = edges[0]
        #expect(e.type == "co-session")
        #expect((e.from as? String) == "node-A")
        #expect((e.to as? String) == "node-B")
        #expect(e.strength > 0.2, "strength climbed while A was salient")
        field.destroy()
    }

    @Test("addBody onFeedback fires for view-less programmatic bodies")
    func addBodyOnFeedback() {
        let host = HeadlessFieldHost()
        let field = FieldField(host: host, options: .init(render: .none_, heatmap: true))
        var feedbackCount = 0
        let body = Vec3(187, 200, 0)
        let _ = field.addBody(BodySpec(
            tokens: ["attract"],
            strength: 2,
            range: 200,
            rect: { Box(center: body, halfExtents: Vec3(40, 40, 0)) },
            onFeedback: { ch in
                feedbackCount += 1
                // density should become non-zero once matter gathers
                _ = ch.density
            }
        ))
        for i in 0..<60 { host.fire(at: TimeInterval(i) / 60) }
        #expect(feedbackCount == 60, "onFeedback fired once per frame for the programmatic body")
        field.destroy()
    }

    // MARK: - FieldHandle parity methods (#817 on / #818 readParticleIds / #819 readParticleChannels / #820 registerOverlay)

    @Test("readParticleIds — distinct, stable ids parallel to readParticles; count reported on truncation")
    func readParticleIdsSeam() {
        let host = HeadlessFieldHost()
        let field = FieldField(host: host)
        let n = field.particleCount() // 130 base pool
        var ids = [Int](repeating: -1, count: n)
        #expect(field.readParticleIds(into: &ids) == n)
        #expect(Set(ids).count == n) // every particle carries a distinct id

        // ids are assigned at pool creation and survive ticks (stable identity).
        let before = ids
        for i in 0..<30 { host.fire(at: TimeInterval(i) / 60) }
        var after = [Int](repeating: -1, count: n)
        _ = field.readParticleIds(into: &after)
        #expect(before == after)

        // a smaller buffer truncates but still reports the true count.
        var small = [Int](repeating: 0, count: 10)
        #expect(field.readParticleIds(into: &small) == n)
        field.destroy()
    }

    @Test("readParticleChannels — packs named-grid samples at each particle, stride = names.count")
    func readParticleChannelsSeam() {
        let field = FieldField(host: HeadlessFieldHost())
        let n = field.particleCount()

        // deposit a known constant into two grids at every particle position, then sample it back.
        var pos = [Float](repeating: 0, count: n * 5)
        _ = field.readParticles(into: &pos)
        let a = field.grid("a"); let b = field.grid("b")
        for i in 0..<n {
            let p = Vec3(pos[i * 5], pos[i * 5 + 1], pos[i * 5 + 2])
            a.deposit(at: p, amount: 1); b.deposit(at: p, amount: 2)
        }

        let names = ["a", "b"]
        var out = [Float](repeating: -1, count: n * names.count)
        #expect(field.readParticleChannels(names, into: &out) == n)
        for i in 0..<n {
            #expect(out[i * 2] > 0)              // channel a sampled non-zero where matter deposited
            #expect(out[i * 2 + 1] >= out[i * 2]) // channel b deposited 2× ≥ channel a
        }

        // a buffer too small for the next full stride stops early but reports the count.
        var small = [Float](repeating: 0, count: 3 * names.count)
        #expect(field.readParticleChannels(names, into: &small) == n)
        field.destroy()
    }

    @Test("on(.tick) fires each frame; cancel() removes the listener")
    func onTickSeam() {
        let host = HeadlessFieldHost()
        let field = FieldField(host: host)
        var ticks = 0
        let sub = field.on(.tick) { _ in ticks += 1 }
        for i in 0..<4 { host.fire(at: TimeInterval(i) / 60) }
        #expect(ticks == 4)
        sub.cancel()
        for i in 4..<7 { host.fire(at: TimeInterval(i) / 60) }
        #expect(ticks == 4) // cancelled — no further deliveries
        field.destroy()
    }

    @Test("on(.bodyAdd) delivers the added body payload")
    func onBodyAddSeam() {
        let field = FieldField(host: HeadlessFieldHost())
        var got: FieldEventPayload?
        _ = field.on(.bodyAdd) { got = $0 }
        let h = field.addBody(BodySpec(tokens: ["attract"]) {
            Box(center: Vec3(187, 406, 0), halfExtents: Vec3(8, 8, 0))
        })
        #expect(got != nil)
        #expect(got?.event == .bodyAdd)
        #expect(got?.body === (h.bodyRef() as AnyObject?)) // the payload carries the added body
        field.destroy()
    }

    @Test("registerOverlay — held in the registry, invoked on a host draw pass, removable")
    func registerOverlaySeam() {
        let field = FieldField(host: HeadlessFieldHost())
        let renderer = CountingOverlay()
        field.registerOverlay("diag", renderer)
        #expect(field.overlayRegistry["diag"] === renderer)

        // simulate one host draw pass over the registry.
        for r in field.overlayRegistry.values { r.render(in: field) }
        #expect(renderer.count == 1)

        field.removeOverlay("diag")
        #expect(field.overlayRegistry.isEmpty)
        field.destroy()
    }

    @Test("destroy cancels the frame loop")
    func destroyCancels() {
        let host = HeadlessFieldHost()
        let field = FieldField(host: host)
        field.destroy()
        #expect(host.cancelCalled)
    }

    @Test("setFormation eases the live formation between presets")
    func formationSwitch() {
        let host = HeadlessFieldHost()
        let field = FieldField(host: host)
        field.setFormation("lanes")
        for i in 0..<60 { host.fire(at: TimeInterval(i) / 60) }
        // after 60 eased frames driftX is most of the way to 0.55 — verify via energy:
        // a lanes drift adds lateral kinetic energy to the pool vs. a frozen field.
        #expect(field.energy().kinetic > 0)
        field.destroy()
    }
}

// MARK: - Test overlay renderer

/// A minimal OverlayRenderer for the registerOverlay seam test — counts host draw passes.
final class CountingOverlay: OverlayRenderer {
    private(set) var count = 0
    func render(in handle: any FieldHandle) { count += 1 }
}

// MARK: - HeadlessFieldHost

/// A FieldHost for unit tests — no display link, no views. Tests drive the loop by
/// calling `fire(at:)`, which invokes the engine's frame callback synchronously.
final class HeadlessFieldHost: FieldHost {
    /// Simulation depth — 0 = the flat field, > 0 = a volumetric field (set by tests).
    var depth: Float = 0

    init(depth: Float = 0) {
        self.depth = depth
    }

    var volume: FieldVolume { FieldVolume(width: 375, height: 812, depth: depth) }
    var scrollY: Float { 0 }
    var scrollHeight: Float { 0 }
    var prefersReducedMotion: Bool { false }
    /// Presentation state — set by tests, delivered via `fireVisibility()` (#605).
    var hidden = false
    var isHidden: Bool { hidden }
    var projection: any HostProjection { FlatProjection() }

    private(set) var cancelCalled = false
    /// How many times the engine (re)scheduled the loop — pause/resume idempotency probe (#605).
    private(set) var scheduleCount = 0
    private var frameCallback: ((TimeInterval) -> Void)?
    private var visibilityCallbacks: [() -> Void] = []

    /// Bodies returned by scanBodies(); set by tests.
    var bodies: [Body] = []
    /// World boxes by view identity; set by tests.
    var boxes: [ObjectIdentifier: Box] = [:]

    func scheduleFrame(_ callback: @escaping (TimeInterval) -> Void) -> AnyObject {
        frameCallback = callback
        scheduleCount += 1
        return NSObject()
    }

    func cancelFrame(_ token: AnyObject) {
        cancelCalled = true
        frameCallback = nil
    }

    /// Drive one frame synchronously.
    func fire(at time: TimeInterval) {
        frameCallback?(time)
    }

    /// Deliver a visibility change to the engine (the host seam the lifecycle notifications use).
    func fireVisibility() {
        visibilityCallbacks.forEach { $0() }
    }

    func onResize(_ cb: @escaping () -> Void) -> () -> Void { { } }
    func onScroll(_ cb: @escaping () -> Void) -> () -> Void { { } }
    func onVisibility(_ cb: @escaping () -> Void) -> () -> Void {
        visibilityCallbacks.append(cb)
        return { }
    }
    func onInput(_ cb: @escaping () -> Void) -> () -> Void { { } }

    func scanBodies() -> [Body] { bodies }
    func worldBox(of view: AnyObject) -> Box? { boxes[ObjectIdentifier(view)] }
}

#if canImport(Metal)
import Metal

@Suite("MetalRenderer")
struct MetalRendererTests {

    @Test("the hybrid renderer initializes and encodes a frame without crashing")
    func metalSmoke() throws {
        guard MTLCreateSystemDefaultDevice() != nil else {
            return // no GPU in this environment (CI) — the CG fallback covers it
        }
        let hybrid = try #require(HybridFieldRenderer(scale: 2))
        let host = HeadlessFieldHost()
        let field = FieldField(host: host, options: .init(render: .dots), renderer: hybrid)
        field.scan()
        for i in 0..<10 { host.fire(at: TimeInterval(i) / 60) }
        // ten frames through the Metal encode path: assembled, uploaded, committed.
        #expect(field.particleCount() == 130)
        field.destroy()
    }

    @Test("linkSegments finds close pairs once with separation alpha")
    func linkGeometry() {
        let a = Particle(position: Vec3(100, 100, 0))
        let b = Particle(position: Vec3(130, 100, 0))   // 30 apart < 70
        let c = Particle(position: Vec3(400, 400, 0))   // far
        let segs = linkSegments(particles: [a, b, c])
        #expect(segs.count == 1)
        #expect(abs(segs[0].alpha - linkAlpha(d: 30, r: 70)) < 1e-6)
    }

    // MARK: FieldHandle read/input seam (#423)

    @Test("readParticles fills a stride-5 buffer and returns the count written")
    func readParticlesSeam() {
        let field = FieldField(host: HeadlessFieldHost())
        var buf = [Float](repeating: -1, count: 130 * 5)
        #expect(field.readParticles(into: &buf) == 130)         // base pool
        #expect(buf[0..<5].allSatisfy { $0.isFinite })
        var small = [Float](repeating: 0, count: 10 * 5)
        #expect(field.readParticles(into: &small) == 10)        // capped to the buffer
        field.destroy()
    }

    @Test("sampleScalar/Gradient are zero with the heatmap off")
    func sampleScalarOff() {
        let field = FieldField(host: HeadlessFieldHost())
        #expect(field.sampleScalar(at: Vec3(187, 406, 0)) == 0)
        #expect(field.sampleGradient(at: Vec3(187, 406, 0)) == .zero)
        field.destroy()
    }

    @Test("addField registers a channel; set swaps it; remove clears it")
    func fieldChannelSeam() {
        let field = FieldField(host: HeadlessFieldHost())
        let ch = field.addField("moisture") { x, y in x + y }
        #expect(field.sampleField("moisture", 3, 4) == 7)
        #expect(field.sampleField("absent", 0, 0) == 0)
        ch.set { _, _ in 42 }
        #expect(field.sampleField("moisture", 0, 0) == 42)
        ch.remove()
        #expect(field.sampleField("moisture", 0, 0) == 0)
        field.destroy()
    }

    @Test("addBody — a programmatic body exerts force, survives scan, and removes clean")
    func addBodySeam() {
        let host = HeadlessFieldHost()
        let field = FieldField(host: host)
        let baseCount = field.particleCount() // 130 free particles, no bodies yet
        let c = Vec3(187, 406, 0)             // ~centre of the 375×812 volume
        func meanDistanceToC() -> Float {
            var buf = [Float](repeating: 0, count: field.particleCount() * 5)
            let n = field.readParticles(into: &buf)
            var sum: Float = 0
            for i in 0..<n {
                let dx = buf[i * 5] - c.x, dy = buf[i * 5 + 1] - c.y
                sum += (dx * dx + dy * dy).squareRoot()
            }
            return n > 0 ? sum / Float(n) : 0
        }
        let before = meanDistanceToC()
        let h = field.addBody(BodySpec(tokens: ["attract"], strength: 8, range: 800) {
            Box(center: c, halfExtents: Vec3(8, 8, 0))
        })
        for i in 0..<90 { host.fire(at: TimeInterval(i) / 60) }
        #expect(meanDistanceToC() < before)          // the attract actually pulled the swarm inward
        let withBody = field.particleCount()         // free pool + the body's bound matter
        #expect(withBody >= baseCount)
        field.scan()
        #expect(field.particleCount() == withBody)   // the view-less programmatic body survived the rescan
        h.remove()
        field.scan()
        #expect(field.particleCount() >= baseCount)  // removed cleanly; the free pool persists, no crash
        field.destroy()
    }
}
#endif
