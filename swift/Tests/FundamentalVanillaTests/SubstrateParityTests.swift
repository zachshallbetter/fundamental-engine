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
}
