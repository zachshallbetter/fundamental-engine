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
    var projection: any FieldProjection { FlatProjection() }
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
        #expect(snap.version == "0.9.2")                   // FIELD_VERSION mirror
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
}
