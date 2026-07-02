import Foundation
import Testing
#if canImport(simd)
import simd
#endif
@testable import FundamentalVanilla
import FundamentalCore

// Cross-plane substrate parity — the four shipped JS-core features mirrored to Swift
// (#884 identity, #888 minimal host + capabilities, #892 policy, #894 agent permissions).

/// A MinimalFieldHost that declares only FieldHost conformance and relies on the graceful-degradation
/// defaults for every optional capability (scroll / reduced-motion / hidden / events) — proving a host
/// can run the full sim headlessly from the minimal core alone.
final class MinimalHost: FieldHost {
    var volume: FieldVolume { FieldVolume(width: 300, height: 300, depth: 0) }
    var projection: any HostProjection { FlatProjection() }
    private var cb: ((TimeInterval) -> Void)?
    func scheduleFrame(_ callback: @escaping (TimeInterval) -> Void) -> AnyObject { cb = callback; return NSObject() }
    func cancelFrame(_ token: AnyObject) { cb = nil }
    func fire(at t: TimeInterval) { cb?(t) }
    func scanBodies() -> [Body] { [] }
    func worldBox(of view: AnyObject) -> Box? { nil }
}

@Suite("Substrate parity")
struct SubstrateParityTests {

    // MARK: - #884 FieldBodyIdentity

    @Test("a programmatic body derives a deterministic body-N identity")
    func derivedIdentity() {
        let field = FieldField(host: HeadlessFieldHost())
        let h = field.addBody(BodySpec(tokens: ["attract"], rect: { Box(center: Vec3(10, 10, 0), halfExtents: Vec3(5, 5, 0)) }))
        let body = h.bodyRef() as? Body
        #expect(body?.identity?.id == "body-0")
        field.destroy()
    }

    @Test("a supplied identity wins and its id is the stable key")
    func suppliedIdentity() {
        let field = FieldField(host: HeadlessFieldHost())
        let ident = FieldBodyIdentity(id: "hero", namespace: "app", kind: "card")
        let h = field.addBody(BodySpec(tokens: ["attract"], identity: ident,
                                       rect: { Box(center: .zero, halfExtents: Vec3(5, 5, 0)) }))
        let body = h.bodyRef() as? Body
        #expect(body?.identity?.id == "hero")
        #expect(body?.identity?.namespace == "app")
        field.destroy()
    }

    @Test("body-N ids increment deterministically and never repeat")
    func monotonicIds() {
        let field = FieldField(host: HeadlessFieldHost())
        let a = field.addBody(BodySpec(tokens: ["attract"], rect: { Box(center: .zero, halfExtents: Vec3(1, 1, 0)) }))
        let b = field.addBody(BodySpec(tokens: ["attract"], rect: { Box(center: .zero, halfExtents: Vec3(1, 1, 0)) }))
        #expect((a.bodyRef() as? Body)?.identity?.id == "body-0")
        #expect((b.bodyRef() as? Body)?.identity?.id == "body-1")
        field.destroy()
    }

    // MARK: - #888 MinimalFieldHost + capabilities

    @Test("a minimal host runs the full sim headlessly")
    func minimalHostRuns() {
        let field = FieldField(host: MinimalHost())
        #expect(field.particleCount() == 130) // base pool builds with only geometry + time
        field.destroy()
    }

    @Test("hostCapabilities reports a full historical host as backing every lane")
    func fullHostCapabilities() {
        let caps = hostCapabilities(HeadlessFieldHost())
        #expect(caps.geometry && caps.time && caps.scroll && caps.reducedMotion && caps.visibility && caps.events)
    }

    // MARK: - #892 FieldPolicy + budgets

    @Test("policy defaults to empty and round-trips through setPolicy")
    func policyRoundTrip() {
        let field = FieldField(host: HeadlessFieldHost())
        #expect(field.policy == FieldPolicy())
        let p = FieldPolicy(maxMotionBudget: 0.5, budgets: FieldBudgets(motion: 0.25))
        field.setPolicy(p)
        #expect(field.policy.maxMotionBudget == 0.5)
        #expect(field.policy.budgets?.motion == 0.25)
        field.destroy()
    }

    @Test("allowMotionProjection:false freezes the field (motion pinned to 0)")
    func motionPinnedOff() {
        let host = HeadlessFieldHost()
        let field = FieldField(host: host, options: .init(policy: FieldPolicy(allowMotionProjection: false)))
        let before = field.energy()
        host.fire(at: 0.016)
        host.fire(at: 0.032)
        let after = field.energy()
        // frozen: no kinetic energy is injected by the loop when motion is pinned off.
        #expect(after.kinetic <= before.kinetic + 0.0001)
        field.destroy()
    }

    // MARK: - #894 Agent permissions

    @Test("an agent view with no relationship cap strips the edge graph")
    func agentScopesRelationships() {
        let field = FieldField(host: HeadlessFieldHost())
        let a = field.addBody(BodySpec(tokens: ["attract"], rect: { Box(center: Vec3(10, 10, 0), halfExtents: Vec3(5, 5, 0)) }))
        let b = field.addBody(BodySpec(tokens: ["attract"], rect: { Box(center: Vec3(40, 40, 0), halfExtents: Vec3(5, 5, 0)) }))
        _ = field.addEdge(a, b, type: "relates", strength: 0.5, direction: .fromTo)

        let denied = field.forAgent(AgentViewOptions(capabilities: []))
        #expect(denied.readEdges().isEmpty) // no read:relationships → stripped

        let granted = field.forAgent(AgentViewOptions(capabilities: [.relationships]))
        #expect(granted.readEdges().count == 1) // granted → visible

        // shape (particle count) is always readable regardless of caps.
        #expect(denied.particleCount() == field.particleCount())
        field.destroy()
    }

    @Test("agentRead budget 0 closes the surface even with the cap granted")
    func agentReadBudgetClosed() {
        let field = FieldField(host: HeadlessFieldHost())
        field.setPolicy(FieldPolicy(budgets: FieldBudgets(agentRead: 0)))
        let a = field.addBody(BodySpec(tokens: ["attract"], rect: { Box(center: .zero, halfExtents: Vec3(5, 5, 0)) }))
        let b = field.addBody(BodySpec(tokens: ["attract"], rect: { Box(center: Vec3(40, 40, 0), halfExtents: Vec3(5, 5, 0)) }))
        _ = field.addEdge(a, b, type: "relates", strength: 0.5, direction: .fromTo)
        let view = field.forAgent(AgentViewOptions(capabilities: [.relationships]))
        #expect(view.readEdges().isEmpty) // budget pins the read surface shut
        field.destroy()
    }

    // MARK: - #816 sample() force-probe

    @Test("sample() reports the net force toward a nearby attractor and ~zero far away")
    func sampleForceProbe() {
        let field = FieldField(host: HeadlessFieldHost())
        // an attractor at (100, 100) with ample range
        _ = field.addBody(BodySpec(tokens: ["attract"], strength: 2, range: 400,
                                   rect: { Box(center: Vec3(100, 100, 0), halfExtents: Vec3(4, 4, 0)) }))
        field.scan() // sample the body rect into its box

        // probe a point below-right of the body — the force should pull back toward it (up-left)
        let f = field.sample(x: 140, y: 140)
        #expect(f.x < 0) // pulled toward the body (which sits at lower x)
        #expect(f.y < 0) // pulled toward the body (which sits at lower y)
        #expect(simd_length(f) > 0)

        // a point far outside range feels ~nothing
        let far = field.sample(x: 900, y: 900)
        #expect(simd_length(far) == 0)
        field.destroy()
    }

    // MARK: - #837 Field Query (substrate READ API — critical-path 02)

    @Test("a global query returns every body with ids + metrics and field metrics")
    func globalQuery() {
        let field = FieldField(host: HeadlessFieldHost())
        let hero = FieldBodyIdentity(id: "hero", namespace: "app", kind: "card")
        _ = field.addBody(BodySpec(tokens: ["attract"], identity: hero,
                                   rect: { Box(center: Vec3(10, 10, 0), halfExtents: Vec3(5, 5, 0)) }))
        _ = field.addBody(BodySpec(tokens: ["gravity"],
                                   rect: { Box(center: Vec3(200, 200, 0), halfExtents: Vec3(8, 8, 0)) }))

        let res = field.query() // nil ⇒ global, default include set

        #expect(res.region == nil)                    // global query has no resolved region
        #expect(res.bodies.count == 2)
        // ids are the resolved first-class identity ids; a supplied identity wins.
        let ids = Set(res.bodies.map { $0.id })
        #expect(ids.contains("hero"))
        #expect(ids == Set(res.bodies.map { $0.identity.id })) // top-level id equals identity.id
        // each body carries its measured metrics (density/count/engaged) + its box + tokens.
        if let heroReading = res.bodies.first(where: { $0.id == "hero" }) {
            #expect(heroReading.metrics["density"] != nil)
            #expect(heroReading.metrics["count"] != nil)
            #expect(heroReading.metrics["engaged"] != nil)
            #expect(heroReading.tokens == ["attract"])
            #expect(heroReading.rect != nil)
            #expect(heroReading.authority == "anchored")     // JS default until a body-authority lane lands
            #expect(heroReading.activeFormations == ["ambient"])
            #expect(heroReading.dimensions.isEmpty)           // empty-for-now, JS field name kept
        } else {
            Issue.record("expected a 'hero' body reading")
        }
        // field-level metrics: particle pool size + body count + mean density.
        #expect(res.metrics["particles"] == Float(field.particleCount()))
        #expect(res.metrics["bodies"] == 2)
        #expect(res.metrics["meanDensity"] != nil)
        // present-but-empty lanes keep the JS shape identical across planes.
        #expect(res.influences.isEmpty)
        #expect(res.projections.isEmpty)
        #expect(res.lens == nil)
        field.destroy()
    }

    @Test("a point query scopes bodies + resolves a region, and default includes influences")
    func pointQueryScopes() {
        let field = FieldField(host: HeadlessFieldHost())
        _ = field.addBody(BodySpec(tokens: ["attract"], identity: FieldBodyIdentity(id: "near"),
                                   rect: { Box(center: Vec3(50, 50, 0), halfExtents: Vec3(5, 5, 0)) }))
        _ = field.addBody(BodySpec(tokens: ["attract"], identity: FieldBodyIdentity(id: "far"),
                                   rect: { Box(center: Vec3(400, 400, 0), halfExtents: Vec3(5, 5, 0)) }))

        // A tight point query around (50,50): only the near body falls inside the radius.
        let res = field.query(FieldQuery(at: .point(x: 50, y: 50, radius: 60)))

        #expect(res.region == FieldRect(x: -10, y: -10, width: 120, height: 120)) // point → centred rect
        #expect(res.bodies.map { $0.id } == ["near"])   // far body is outside the radius
        #expect(res.metrics["bodies"] == 1)             // metric counts only matched bodies
        // a local (point/rect) query's default include set adds `influences` (empty in this port).
        #expect(res.influences.isEmpty)
        field.destroy()
    }

    @Test("a rect query filters bodies to the region and honors the include filter")
    func rectQueryAndInclude() {
        let field = FieldField(host: HeadlessFieldHost())
        _ = field.addBody(BodySpec(tokens: ["attract"], identity: FieldBodyIdentity(id: "inside"),
                                   rect: { Box(center: Vec3(20, 20, 0), halfExtents: Vec3(5, 5, 0)) }))
        _ = field.addBody(BodySpec(tokens: ["attract"], identity: FieldBodyIdentity(id: "outside"),
                                   rect: { Box(center: Vec3(250, 250, 0), halfExtents: Vec3(5, 5, 0)) }))

        // include: bodies only ⇒ metrics/relationships are not computed.
        let res = field.query(FieldQuery(at: .rect(x: 0, y: 0, width: 100, height: 100),
                                         include: [.bodies]))

        #expect(res.region == FieldRect(x: 0, y: 0, width: 100, height: 100))
        #expect(res.bodies.map { $0.id } == ["inside"]) // only the body whose centre is in the rect
        #expect(res.metrics.isEmpty)                    // metrics not requested
        #expect(res.relationships.isEmpty)              // relationships not requested
        field.destroy()
    }

    @Test("relationships report identity-keyed endpoints and honor setFormation")
    func relationshipsAndFormation() {
        let field = FieldField(host: HeadlessFieldHost())
        field.setFormation("lanes")
        let a = field.addBody(BodySpec(tokens: ["attract"], identity: FieldBodyIdentity(id: "a"),
                                       rect: { Box(center: Vec3(10, 10, 0), halfExtents: Vec3(5, 5, 0)) }))
        let b = field.addBody(BodySpec(tokens: ["attract"], identity: FieldBodyIdentity(id: "b"),
                                       rect: { Box(center: Vec3(40, 40, 0), halfExtents: Vec3(5, 5, 0)) }))
        _ = field.addEdge(a, b, type: "relates", strength: 0.5, direction: .fromTo)

        let res = field.query() // global
        #expect(res.relationships.count == 1)
        let edge = res.relationships[0]
        #expect(edge.from == "a")        // endpoints are the bodies' first-class identity ids
        #expect(edge.to == "b")
        #expect(edge.type == "relates")
        #expect(edge.causal == edge.active) // causal today mirrors active
        // the active formation flows into each body's activeFormations.
        #expect(res.bodies.allSatisfy { $0.activeFormations == ["lanes"] })
        field.destroy()
    }

    // MARK: - Field Snapshot (substrate READ API — critical-path 03)

    @Test("a snapshot captures ids, frame, version, formation, bodies + metrics")
    func snapshotShape() {
        let field = FieldField(host: HeadlessFieldHost())
        field.setFormation("wells")
        let hero = FieldBodyIdentity(id: "hero", namespace: "app", kind: "card")
        _ = field.addBody(BodySpec(tokens: ["attract"], identity: hero,
                                   rect: { Box(center: Vec3(10, 10, 0), halfExtents: Vec3(5, 5, 0)) }))
        _ = field.addBody(BodySpec(tokens: ["gravity"], identity: FieldBodyIdentity(id: "sun"),
                                   rect: { Box(center: Vec3(200, 200, 0), halfExtents: Vec3(8, 8, 0)) }))

        let snap = field.snapshot() // nil ⇒ default options

        // id format: `snap-<frame>-<seq>`; createdAt is the field clock; version is non-empty.
        #expect(snap.id == "snap-\(snap.frame)-0")
        #expect(snap.id.hasPrefix("snap-"))
        #expect(snap.createdAt == 0)                       // field clock at capture (no ticks yet)
        #expect(!snap.version.isEmpty)
        #expect(snap.version == FIELD_VERSION)             // stamps the engine version (lockstep: #923)
        #expect(snap.formations == ["wells"])              // active formation id(s)

        // bodies carry ids + identity + metrics + position/rect + tokens.
        #expect(snap.bodies.count == 2)
        let ids = Set(snap.bodies.map { $0.id })
        #expect(ids == ["hero", "sun"])
        #expect(ids == Set(snap.bodies.map { $0.identity.id })) // top-level id equals identity.id
        if let heroSnap = snap.bodies.first(where: { $0.id == "hero" }) {
            #expect(heroSnap.metrics["density"] != nil)
            #expect(heroSnap.metrics["count"] != nil)
            #expect(heroSnap.metrics["engaged"] != nil)
            #expect(heroSnap.tokens == ["attract"])
            #expect(heroSnap.rect != nil)
            #expect(heroSnap.position != nil)
            #expect(heroSnap.authority == "anchored")       // JS default until a body-authority lane lands
            #expect(heroSnap.dimensions.isEmpty)             // empty-for-now, JS field name kept
        } else {
            Issue.record("expected a 'hero' body snapshot")
        }

        // field-level metrics mirror query(): particle pool size + body count + mean density.
        #expect(snap.metrics["particles"] == Float(field.particleCount()))
        #expect(snap.metrics["bodies"] == 2)
        #expect(snap.metrics["meanDensity"] != nil)
        // present-but-empty lanes keep the JS shape identical across planes.
        #expect(snap.influences.isEmpty)
        #expect(snap.projections.isEmpty)
        field.destroy()
    }

    @Test("snapshot ids increment per capture and relationships default in")
    func snapshotSequenceAndRelationships() {
        let field = FieldField(host: HeadlessFieldHost())
        let a = field.addBody(BodySpec(tokens: ["attract"], identity: FieldBodyIdentity(id: "a"),
                                       rect: { Box(center: Vec3(10, 10, 0), halfExtents: Vec3(5, 5, 0)) }))
        let b = field.addBody(BodySpec(tokens: ["attract"], identity: FieldBodyIdentity(id: "b"),
                                       rect: { Box(center: Vec3(40, 40, 0), halfExtents: Vec3(5, 5, 0)) }))
        _ = field.addEdge(a, b, type: "relates", strength: 0.5, direction: .fromTo)

        let first = field.snapshot()
        let second = field.snapshot()
        #expect(first.id == "snap-0-0")
        #expect(second.id == "snap-0-1")            // per-field sequence increments

        // relationships default in (identity-keyed endpoints).
        #expect(first.relationships.count == 1)
        #expect(first.relationships[0].from == "a")
        #expect(first.relationships[0].to == "b")

        // includeRelationships: false strips them.
        let noRel = field.snapshot(FieldSnapshotOptions(includeRelationships: false))
        #expect(noRel.relationships.isEmpty)
        field.destroy()
    }

    @Test("body data is withheld by default and included only on explicit opt-in")
    func snapshotDataOptIn() {
        let field = FieldField(host: HeadlessFieldHost())
        _ = field.addBody(BodySpec(tokens: ["attract"], data: "secret",
                                   identity: FieldBodyIdentity(id: "carrier"),
                                   rect: { Box(center: Vec3(10, 10, 0), halfExtents: Vec3(5, 5, 0)) }))

        // default: data withheld (privacy-preserving).
        let defaultSnap = field.snapshot()
        #expect(defaultSnap.bodies.first?.data == nil)

        // explicit includeData: true ⇒ present (no policy denial in force).
        let opted = field.snapshot(FieldSnapshotOptions(includeData: true))
        #expect(opted.bodies.first?.data as? String == "secret")
        field.destroy()
    }

    @Test("a public profile strips body data even against an explicit includeData:true (TIGHTEST-wins)")
    func snapshotPublicProfileStrips() {
        let field = FieldField(host: HeadlessFieldHost())
        _ = field.addBody(BodySpec(tokens: ["attract"], data: "secret",
                                   identity: FieldBodyIdentity(id: "carrier"),
                                   rect: { Box(center: Vec3(10, 10, 0), halfExtents: Vec3(5, 5, 0)) }))

        // TIGHTEST wins: the public profile denies data (and relationships) regardless of includeData:true.
        let snap = field.snapshot(FieldSnapshotOptions(includeData: true, profile: .public_))
        #expect(snap.bodies.first?.data == nil)          // profile strips data
        #expect(snap.relationships.isEmpty)              // public strips relationships too
        field.destroy()
    }

    @Test("policy allowBodyDataInSnapshots:false vetoes data even with includeData:true")
    func snapshotPolicyVetoesData() {
        let field = FieldField(host: HeadlessFieldHost(),
                               options: .init(policy: FieldPolicy(allowBodyDataInSnapshots: false)))
        _ = field.addBody(BodySpec(tokens: ["attract"], data: "secret",
                                   identity: FieldBodyIdentity(id: "carrier"),
                                   rect: { Box(center: Vec3(10, 10, 0), halfExtents: Vec3(5, 5, 0)) }))

        // The runtime policy is the second half of the gate: it withholds data even on explicit opt-in.
        let snap = field.snapshot(FieldSnapshotOptions(includeData: true))
        #expect(snap.bodies.first?.data == nil)
        field.destroy()
    }

    // MARK: - Field Snapshot diff (JS critical-path 03)

    /// A hand-built snapshot — the standalone `diffFieldSnapshots` needs no live field, so the relationship
    /// and body-metric lanes can be exercised deterministically. Mirrors the Kotlin `FieldDiffTests`.
    private func makeSnapshot(id: String, formations: [String] = ["ambient"],
                              bodies: [FieldBodySnapshot] = [],
                              relationships: [FieldRelationshipReading] = [],
                              metrics: [String: Float] = [:]) -> FieldSnapshot {
        FieldSnapshot(id: id, createdAt: 0, frame: 0, version: "test", formations: formations,
                      bodies: bodies, relationships: relationships, metrics: metrics)
    }

    private func rel(_ from: String, _ to: String, strength: Float, active: Bool) -> FieldRelationshipReading {
        FieldRelationshipReading(from: from, to: to, type: "attract", strength: strength,
                                 memory: 0, active: active, causal: active)
    }

    private func body(_ id: String, metrics: [String: Float]) -> FieldBodySnapshot {
        FieldBodySnapshot(id: id, identity: FieldBodyIdentity(id: id, kind: "element"),
                          authority: "anchored", rect: nil, position: nil, tokens: [],
                          metrics: metrics, dimensions: [:])
    }

    @Test("diff reports body removal, field-metric deltas, and a formation change (integration)")
    func diffReportsRemovalAndFormationChange() {
        let host = HeadlessFieldHost()
        let field = FieldField(host: host)
        _ = field.addBody(BodySpec(tokens: ["attract"], identity: FieldBodyIdentity(id: "attract"),
                                   rect: { Box(center: Vec3(200, 300, 0), halfExtents: Vec3(5, 5, 0)) }))
        let gravity = field.addBody(BodySpec(tokens: ["gravity"], identity: FieldBodyIdentity(id: "gravity"),
                                             rect: { Box(center: Vec3(600, 300, 0), halfExtents: Vec3(8, 8, 0)) }))
        var t = 0.0
        for _ in 0..<10 { t += 0.016; host.fire(at: t) }
        let a = field.snapshot()
        #expect(a.bodies.count == 2)

        // Mutate the field between captures: remove one body + change the active formation, then run on.
        gravity.remove()
        field.setFormation("wells")
        for _ in 0..<20 { t += 0.016; host.fire(at: t) }
        let b = field.snapshot()

        let d = field.diff(a, b)

        // from/to carry the two snapshot ids (PURE — the free function reads only the two snapshots).
        #expect(d.from == a.id)
        #expect(d.to == b.id)

        // bodies: the gravity body was removed; the attract body remains (not reported added/removed).
        let removed = d.bodyChanges.filter { $0.kind == "removed" }
        #expect(removed.count == 1)
        #expect(removed.first?.id == "gravity")
        #expect(!d.bodyChanges.contains { $0.kind == "added" })

        // field-level metrics: the `bodies` count 2 -> 1 is reported as a MetricChange.
        let bodiesMetric = d.metricChanges.first { $0.key == "bodies" }
        #expect(bodiesMetric != nil)
        #expect(bodiesMetric?.from == 2)
        #expect(bodiesMetric?.to == 1)

        // formations: default "ambient" deactivated, "wells" activated (set difference).
        #expect(d.formationChanges.contains { $0.id == "wells" && $0.kind == "activated" })
        #expect(d.formationChanges.contains { $0.id == "ambient" && $0.kind == "deactivated" })

        field.destroy()
    }

    @Test("diff reports a body addition")
    func diffReportsBodyAddition() {
        let host = HeadlessFieldHost()
        let field = FieldField(host: host)
        _ = field.addBody(BodySpec(tokens: ["attract"], identity: FieldBodyIdentity(id: "attract"),
                                   rect: { Box(center: Vec3(200, 300, 0), halfExtents: Vec3(5, 5, 0)) }))
        var t = 0.0
        for _ in 0..<3 { t += 0.016; host.fire(at: t) }
        let a = field.snapshot()

        _ = field.addBody(BodySpec(tokens: ["charge"], identity: FieldBodyIdentity(id: "charge"),
                                   rect: { Box(center: Vec3(400, 400, 0), halfExtents: Vec3(5, 5, 0)) }))
        for _ in 0..<3 { t += 0.016; host.fire(at: t) }
        let b = field.snapshot()

        let d = field.diff(a, b)
        let added = d.bodyChanges.filter { $0.kind == "added" }
        #expect(added.count == 1)
        #expect(added.first?.id == "charge")
        #expect(!d.bodyChanges.contains { $0.kind == "removed" })
        field.destroy()
    }

    @Test("diff of a snapshot against itself is empty by lane (pure + deterministic)")
    func diffOfIdenticalSnapshotIsEmpty() {
        let host = HeadlessFieldHost()
        let field = FieldField(host: host)
        _ = field.addBody(BodySpec(tokens: ["attract"], identity: FieldBodyIdentity(id: "a"),
                                   rect: { Box(center: Vec3(10, 10, 0), halfExtents: Vec3(5, 5, 0)) }))
        var t = 0.0
        for _ in 0..<5 { t += 0.016; host.fire(at: t) }
        let a = field.snapshot()

        let d = field.diff(a, a)
        #expect(d.from == a.id)
        #expect(d.to == a.id)
        #expect(d.bodyChanges.isEmpty)
        #expect(d.relationshipChanges.isEmpty)
        #expect(d.metricChanges.isEmpty)
        #expect(d.formationChanges.isEmpty)
        field.destroy()
    }

    @Test("diff reports relationships added / removed / changed by the from+to+type key (pure)")
    func diffReportsRelationshipChanges() {
        let a = makeSnapshot(id: "a", relationships: [rel("x", "y", strength: 0.5, active: true),
                                                      rel("p", "q", strength: 0.2, active: false)])
        // b: x->y strength changed + went idle; p->q removed; m->n added.
        let b = makeSnapshot(id: "b", relationships: [rel("x", "y", strength: 0.9, active: false),
                                                      rel("m", "n", strength: 0.3, active: true)])

        let d = diffFieldSnapshots(a, b)

        let removed = d.relationshipChanges.first { $0.kind == "removed" }
        #expect(removed?.from == "p")
        #expect(removed?.to == "q")

        let added = d.relationshipChanges.first { $0.kind == "added" }
        #expect(added?.from == "m")
        #expect(added?.to == "n")

        let changed = d.relationshipChanges.first { $0.kind == "changed" }
        #expect(changed?.from == "x")
        #expect(changed?.to == "y")
        #expect(changed?.strength == MetricDelta(from: 0.5, to: 0.9))
        #expect(changed?.active == BoolDelta(from: true, to: false))
    }

    @Test("diff reports body metrics added / removed / changed by id, only the differing metrics (pure)")
    func diffBodyMetricsPure() {
        let a = makeSnapshot(id: "a", formations: [],
                             bodies: [body("keep", metrics: ["density": 1, "count": 3]),
                                      body("gone", metrics: ["density": 2])])
        let b = makeSnapshot(id: "b", formations: [],
                             bodies: [body("keep", metrics: ["density": 5, "count": 3]),
                                      body("new", metrics: ["density": 1])])

        let d = diffFieldSnapshots(a, b)

        #expect(d.bodyChanges.contains { $0.id == "gone" && $0.kind == "removed" })
        #expect(d.bodyChanges.contains { $0.id == "new" && $0.kind == "added" })

        let changed = d.bodyChanges.first { $0.id == "keep" && $0.kind == "changed" }
        #expect(changed != nil)
        // only density changed (1 -> 5); count unchanged so it is NOT reported.
        #expect(changed?.metrics?.keys.sorted() == ["density"])
        #expect(changed?.metrics?["density"] == MetricDelta(from: 1, to: 5))
        #expect(changed?.metrics?["count"] == nil)
    }

    @Test("field-level metrics diff over the key union, missing treated as 0 (pure)")
    func diffFieldMetricsUnionMissingZero() {
        let a = makeSnapshot(id: "a", formations: [], metrics: ["particles": 100, "bodies": 2])
        // b drops `bodies` (missing → 0) and gains `meanDensity`; particles unchanged (not reported).
        let b = makeSnapshot(id: "b", formations: [], metrics: ["particles": 100, "meanDensity": 0.4])

        let d = diffFieldSnapshots(a, b)

        #expect(!d.metricChanges.contains { $0.key == "particles" }) // unchanged → no entry
        let bodiesM = d.metricChanges.first { $0.key == "bodies" }
        #expect(bodiesM?.from == 2)
        #expect(bodiesM?.to == 0)                                    // missing in b → 0
        let meanM = d.metricChanges.first { $0.key == "meanDensity" }
        #expect(meanM?.from == 0)                                    // missing in a → 0
        #expect(meanM?.to == 0.4)
    }

    // MARK: - Causal Replay (JS critical-path 03 phase 2)

    @Test("replay narrates a mutation sequence in canonical lane order (formations → relationships → bodies → metrics)")
    func replayCanonicalLaneOrder() {
        // Three snapshots across a mutation sequence, hand-built so every lane is exercised deterministically.
        // a → b: a formation flips, an edge changes, a body's metric moves, a field metric moves, a body leaves.
        let a = makeSnapshot(id: "a", formations: ["ambient"],
                             bodies: [body("hero", metrics: ["density": 1]),
                                      body("gone", metrics: ["density": 2])],
                             relationships: [rel("hero", "gone", strength: 0.4, active: false)],
                             metrics: ["bodies": 2])
        let b = makeSnapshot(id: "b", formations: ["wells"],
                             bodies: [body("hero", metrics: ["density": 3])],
                             relationships: [rel("hero", "gone", strength: 0.8, active: true)],
                             metrics: ["bodies": 1])

        let replay = replayFieldSnapshots(a, b)

        #expect(replay.from == "a")
        #expect(replay.to == "b")
        #expect(replay.focus == nil)

        // Canonical lane order: formations first, then relationships, then bodies (measurements/metrics),
        // then forces. Assert the ORDER of the lanes as they appear.
        let causes = replay.steps.map { $0.cause }
        let firstFormation = causes.firstIndex(of: .formation)
        let firstRelationship = causes.firstIndex(of: .relationship)
        let firstBodyLane = causes.firstIndex { $0 == .measurement || $0 == .metric }
        #expect(firstFormation != nil)
        #expect(firstRelationship != nil)
        #expect(firstBodyLane != nil)
        #expect(firstFormation! < firstRelationship!)
        #expect(firstRelationship! < firstBodyLane!)

        // Formation lane: "wells" activated, "ambient" deactivated — both narrated.
        #expect(replay.steps.contains { $0.cause == .formation && $0.description == "Formation 'wells' activated" })
        #expect(replay.steps.contains { $0.cause == .formation && $0.description == "Formation 'ambient' deactivated" })

        // Relationship lane: became active + strengthened, with the before/after in `contribution`.
        let relStep = replay.steps.first { $0.cause == .relationship }
        #expect(relStep?.source == "hero")
        #expect(relStep?.target == "gone")
        #expect(relStep?.description == "Relationship hero→gone (attract) became active, strengthened 0.4→0.8")
        #expect(relStep?.contribution == MetricDelta(from: 0.4, to: 0.8))

        // Measurement lane: the `gone` body left the field.
        #expect(replay.steps.contains {
            $0.cause == .measurement && $0.source == "gone" && $0.description == "Body gone left the field"
        })

        // Metric lane: hero density rose 1→3, contribution carries the delta.
        let metricStep = replay.steps.first { $0.cause == .metric && $0.source == "hero" }
        #expect(metricStep?.description == "Body hero density rose 1.0→3.0")
        #expect(metricStep?.contribution == MetricDelta(from: 1, to: 3))

        // Every step is stamped with b's frame/time.
        #expect(replay.steps.allSatisfy { $0.frame == b.frame && $0.time == b.createdAt })

        // A field-metric move (bodies 2→1) is a diff MetricChange, NOT a replay step lane — replay's `.metric`
        // lane is per-BODY. So no `.metric` step should be sourced from a field metric key.
        #expect(!replay.steps.contains { $0.cause == .metric && $0.description.contains("bodies") })
    }

    @Test("replay entered/left narration across a live three-snapshot sequence")
    func replayThreeSnapshotLiveSequence() {
        let host = HeadlessFieldHost()
        let field = FieldField(host: host)
        _ = field.addBody(BodySpec(tokens: ["attract"], identity: FieldBodyIdentity(id: "attract"),
                                   rect: { Box(center: Vec3(200, 300, 0), halfExtents: Vec3(5, 5, 0)) }))
        var t = 0.0
        for _ in 0..<5 { t += 0.016; host.fire(at: t) }
        let s1 = field.snapshot()

        // s1 → s2: add a body.
        let charge = field.addBody(BodySpec(tokens: ["charge"], identity: FieldBodyIdentity(id: "charge"),
                                            rect: { Box(center: Vec3(400, 400, 0), halfExtents: Vec3(5, 5, 0)) }))
        for _ in 0..<5 { t += 0.016; host.fire(at: t) }
        let s2 = field.snapshot()

        // s2 → s3: remove it.
        charge.remove()
        for _ in 0..<5 { t += 0.016; host.fire(at: t) }
        let s3 = field.snapshot()

        let entered = field.replay(s1, s2)
        #expect(entered.steps.contains {
            $0.cause == .measurement && $0.source == "charge" && $0.description == "Body charge entered the field"
        })

        let left = field.replay(s2, s3)
        #expect(left.steps.contains {
            $0.cause == .measurement && $0.source == "charge" && $0.description == "Body charge left the field"
        })
        field.destroy()
    }

    @Test("replay focus scopes steps to the one body id (its metrics + its relationships)")
    func replayFocusScopesToBody() {
        let a = makeSnapshot(id: "a", formations: ["ambient"],
                             bodies: [body("hero", metrics: ["density": 1]),
                                      body("other", metrics: ["density": 5])],
                             relationships: [rel("hero", "other", strength: 0.2, active: false)],
                             metrics: [:])
        let b = makeSnapshot(id: "b", formations: ["ambient"],
                             bodies: [body("hero", metrics: ["density": 4]),
                                      body("other", metrics: ["density": 9])],
                             relationships: [rel("hero", "other", strength: 0.6, active: true)],
                             metrics: [:])

        let full = replayFieldSnapshots(a, b)
        let focused = replayFieldSnapshots(a, b, ReplayOptions(focus: "hero"))

        #expect(focused.focus == "hero")
        // Every focused step touches "hero" as source or target.
        #expect(focused.steps.allSatisfy { $0.source == "hero" || $0.target == "hero" })
        // The "other" body's own metric move is present in the full replay but dropped by the focus.
        #expect(full.steps.contains { $0.source == "other" })
        #expect(!focused.steps.contains { $0.source == "other" && $0.target != "hero" })
        // The hero→other relationship IS kept (source == hero), and hero's own metric move is kept.
        #expect(focused.steps.contains { $0.cause == .relationship && $0.source == "hero" })
        #expect(focused.steps.contains { $0.cause == .metric && $0.source == "hero" })
    }

    @Test("replay force lane is empty-for-now (no impulse accumulator in this port)")
    func replayForceLaneEmptyForNow() {
        // Even with influences requested, the port captures none (no accumulator), so replay yields no
        // `.force` steps — the shape is present, the lane is dormant, mirroring JS/Kotlin.
        let host = HeadlessFieldHost()
        let field = FieldField(host: host)
        _ = field.addBody(BodySpec(tokens: ["attract"], identity: FieldBodyIdentity(id: "attract"),
                                   rect: { Box(center: Vec3(200, 300, 0), halfExtents: Vec3(5, 5, 0)) }))
        var t = 0.0
        for _ in 0..<3 { t += 0.016; host.fire(at: t) }
        let a = field.snapshot(FieldSnapshotOptions(includeInfluences: true))
        for _ in 0..<10 { t += 0.016; host.fire(at: t) }
        let b = field.snapshot(FieldSnapshotOptions(includeInfluences: true))

        #expect(a.influences.isEmpty)
        #expect(b.influences.isEmpty)
        let replay = field.replay(a, b)
        #expect(!replay.steps.contains { $0.cause == .force })
        field.destroy()
    }
}

// MARK: - Projection Registry (substrate READ API — critical-path 05)

/// Cross-plane projection-registry parity — mirror of the Kotlin `ProjectionRegistryTests` (#936) and the
/// JS `projection-registry.test.ts` + `projection-autoapply.test.ts`. A PROJECTION maps field STATE into an
/// output surface and NEVER mutates the field. This port implements the portable surfaces (`agent-json` +
/// a generic host `callback`); the web surfaces (css / dom-attribute / svg) are declared for metadata parity
/// but are web-first. `list()` feeds `query()` / `snapshot()` `projections`.
@Suite("Projection registry parity")
struct ProjectionRegistryParityTests {

    // A visual projection whose `apply` writes to a sink — used to prove apply never touches the field.
    private func densityOutline(_ sink: @escaping ([String: Float]) -> Void) -> FieldProjection {
        FieldProjection(
            id: "density-outline",
            label: "Density Outline",
            channels: ["density"],
            surfaces: [.css, .annotation],
            reducedMotionEquivalent: "outline and label",
            accessibilityEquivalent: "semantic emphasis and explanation",
            apply: { reading, _ in sink(reading) }
        )
    }

    // A capture target that records every reading it receives (the callback surface's sink under test).
    private final class Recorder: FieldProjectionTarget {
        var readings: [[String: Float]] = []
        func receive(_ reading: [String: Float]) { readings.append(reading) }
    }

    @Test("register / get / list / unregister round-trips with serializable metadata")
    func registerGetListUnregister() {
        let field = FieldField(host: HeadlessFieldHost())
        let proj = densityOutline { _ in }
        let off = field.projections.register(proj)

        // get returns the full projection (incl. apply); list returns serializable metadata.
        #expect(field.projections.get("density-outline") != nil)
        let info = field.projections.list()
        #expect(info.count == 1)
        #expect(info[0].id == "density-outline")
        #expect(info[0].label == "Density Outline")
        #expect(info[0].channels == ["density"])
        #expect(info[0].surfaces == [.css, .annotation])
        #expect(info[0].reducedMotionEquivalent == "outline and label")
        #expect(info[0].accessibilityEquivalent == "semantic emphasis and explanation")

        // the returned unregister fn removes it.
        off()
        #expect(field.projections.list().isEmpty)
        #expect(field.projections.get("density-outline") == nil)
        field.destroy()
    }

    @Test("registering under an existing id replaces it — newer metadata wins")
    func registerReplacesSameId() {
        let field = FieldField(host: HeadlessFieldHost())
        field.projections.register(agentJsonProjection(id: "p", channels: ["density"], label: "First"))
        let off2 = field.projections.register(agentJsonProjection(id: "p", channels: ["count"], label: "Second"))
        #expect(field.projections.list().count == 1)
        #expect(field.projections.list()[0].label == "Second")
        #expect(field.projections.list()[0].channels == ["count"])
        off2()
        #expect(field.projections.list().isEmpty)
        field.destroy()
    }

    @Test("apply writes the reading to the target and never mutates the field")
    func applyWritesToTargetAndNeverMutatesTheField() {
        // Baseline: run a field 10 frames with NO projection and record particle count.
        let baseHost = HeadlessFieldHost()
        let baseField = FieldField(host: baseHost)
        var t = 0.0
        for _ in 0..<10 { t += 0.016; baseHost.fire(at: t) }
        let baseline = baseField.particleCount()
        baseField.destroy()

        // Same field + frames, but with a projection registered AND applied — count must be identical.
        let host = HeadlessFieldHost()
        let field = FieldField(host: host)
        var received: [String: Float]?
        field.projections.register(densityOutline { received = $0 })
        var t2 = 0.0
        for _ in 0..<10 { t2 += 0.016; host.fire(at: t2) }
        let target = Recorder()
        field.projections.apply("density-outline", ["density": 0.72], target)

        #expect(received == ["density": 0.72]) // apply wrote the reading to the target surface
        #expect(field.particleCount() == baseline) // applying a projection does not change field state

        // an unknown id is a no-op (no crash).
        field.projections.apply("nope", ["density": 1], Recorder())
        field.destroy()
    }

    @Test("query() and snapshot() report the registered projections")
    func queryAndSnapshotReportRegisteredProjections() {
        let field = FieldField(host: HeadlessFieldHost())
        _ = field.addBody(BodySpec(tokens: ["attract"], identity: FieldBodyIdentity(id: "hero"),
                                   rect: { Box(center: Vec3(200, 150, 0), halfExtents: Vec3(5, 5, 0)) }))
        field.projections.register(densityOutline { _ in })

        // query().projections is populated from the registry.
        let q = field.query()
        #expect(q.projections.count == 1)
        #expect(q.projections[0].id == "density-outline")

        // snapshot().projections captures the same metadata.
        let snap = field.snapshot()
        #expect(snap.projections.count == 1)
        #expect(snap.projections[0].label == "Density Outline")
        #expect(snap.projections[0].surfaces == [.css, .annotation])
        field.destroy()
    }

    @Test("agentJsonTarget captures by value and serializes with JS whole-float parity")
    func agentJsonTargetCapturesAndSerializes() {
        let tgt = agentJsonTarget()
        #expect(tgt.value() == nil) // null before the first write
        #expect(tgt.json() == "null")

        tgt.receive(["density": 0.4, "attention": 0.9])
        #expect(tgt.value() == ["density": 0.4, "attention": 0.9])
        // whole numbers serialize without a trailing .0 (JS JSON.stringify parity).
        tgt.receive(["k": 1])
        #expect(tgt.json() == "{\"k\":1}")

        // captured BY VALUE — mutating a source dict afterward does not change what was received.
        var src: [String: Float] = ["density": 1]
        tgt.receive(src)
        src["density"] = 99
        #expect(tgt.value()?["density"] == 1) // stored a copy, not a reference
    }

    @Test("an agent-json projection writes through apply into its target")
    func agentJsonProjectionWritesThroughApplyIntoTarget() {
        let field = FieldField(host: HeadlessFieldHost())
        let tgt = agentJsonTarget()
        field.projections.register(agentJsonProjection(id: "agent", channels: ["density"], label: "Agent view"))
        field.projections.apply("agent", ["density": 0.5], tgt)
        #expect(tgt.value() == ["density": 0.5])
        field.destroy()
    }

    @Test("bind auto-applies each write phase; unbind stops further writes")
    func bindAutoAppliesEachWritePhaseUnbindStops() {
        let host = HeadlessFieldHost()
        let field = FieldField(host: host)
        let tgt = agentJsonTarget()
        var n: Float = 0
        field.projections.register(agentJsonProjection(id: "live", channels: ["k"]))
        let unbind = field.projections.bind("live", tgt) { n += 1; return ["k": n] }

        #expect(tgt.value() == nil) // no write before the first frame
        var t = 0.0
        t += 0.016; host.fire(at: t)
        let afterOne = tgt.value()?["k"]
        #expect(afterOne != nil && afterOne! >= 1) // applied on the write phase
        t += 0.016; host.fire(at: t)
        #expect((tgt.value()?["k"] ?? 0) > (afterOne ?? 0)) // applied again on the next frame

        let stoppedAt = tgt.value()?["k"]
        unbind()
        t += 0.016; host.fire(at: t)
        #expect(tgt.value()?["k"] == stoppedAt) // no further writes after unbind
        field.destroy()
    }

    @Test("a bound projection never perturbs the simulation over N frames")
    func boundProjectionNeverPerturbsTheSimulation() {
        // Baseline: 10 frames, no binding.
        let baseHost = HeadlessFieldHost()
        let baseField = FieldField(host: baseHost)
        var t = 0.0
        for _ in 0..<10 { t += 0.016; baseHost.fire(at: t) }
        let baseline = baseField.particleCount()
        baseField.destroy()

        // Same, with a projection bound and auto-applying every write phase.
        let host = HeadlessFieldHost()
        let field = FieldField(host: host)
        field.projections.register(agentJsonProjection(id: "p", channels: ["density"]))
        field.projections.bind("p", agentJsonTarget()) { ["density": 1] }
        var t2 = 0.0
        for _ in 0..<10 { t2 += 0.016; host.fire(at: t2) }
        #expect(field.particleCount() == baseline) // particle count identical with a projection bound
        field.destroy()
    }

    @Test("binding an unregistered id is inert — its target is never called")
    func bindingAnUnregisteredIdIsInert() {
        let host = HeadlessFieldHost()
        let field = FieldField(host: host)
        // A recorder whose reading list must stay empty: binding an unknown id must never invoke it.
        let exploding = Recorder()
        field.projections.bind("nope", exploding) { ["x": 1] }
        host.fire(at: 0.016) // must not call the target
        #expect(exploding.readings.isEmpty)
        field.destroy()
    }

    @Test("the callback surface forwards each reading to the host sink")
    func callbackTargetForwardsReadingsToHostSink() {
        let host = HeadlessFieldHost()
        let field = FieldField(host: host)
        var seen: [[String: Float]] = []
        let tgt = callbackTarget { seen.append($0) }
        field.projections.register(callbackProjection(id: "native-label", channels: ["density"], label: "Native label"))
        let unbind = field.projections.bind("native-label", tgt) { ["density": 0.3] }

        var t = 0.0
        t += 0.016; host.fire(at: t)
        t += 0.016; host.fire(at: t)
        #expect(seen.count == 2) // the host sink received one reading per write phase
        #expect(seen.last == ["density": 0.3])

        // callback surface reported in the metadata.
        #expect(field.projections.list()[0].surfaces == [.callback])

        unbind()
        t += 0.016; host.fire(at: t)
        #expect(seen.count == 2) // no further writes after unbind
        field.destroy()
    }

    @Test("a field with nothing registered reports empty (not nil) projections on both reads")
    func defaultFieldHasNoProjections() {
        let host = HeadlessFieldHost()
        let field = FieldField(host: host)
        var t = 0.0
        for _ in 0..<3 { t += 0.016; host.fire(at: t) }
        #expect(field.projections.list().isEmpty)
        #expect(field.query().projections.isEmpty)
        #expect(field.snapshot().projections.isEmpty)
        field.destroy()
    }
}
