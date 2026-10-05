import Foundation
import Testing
@testable import FundamentalVanilla
import FundamentalCore

// #1177 — `absorbR` had no path through `BodySpec` on any plane, so a consumer holding a BodyHandle
// was stuck at the `Body` default. That radius *is* the behaviour for `sink` (the horizon it absorbs
// within) and for `warp` (the throat it transports through), so a programmatic body could not express
// what markup could. This mirrors the JS and Kotlin additions; the defaults are deliberately untouched.

@Suite("absorbR through BodySpec")
struct AbsorbRSpecTests {
    private func box() -> Box { Box(center: Vec3(400, 300, 0), halfExtents: Vec3(20, 20, 0)) }

    @Test("a spec value reaches the backing body")
    func specValueReachesBody() {
        let field = FieldField(host: HeadlessFieldHost())
        let h = field.addBody(BodySpec(tokens: ["sink"], absorbR: 90, rect: { self.box() }))
        #expect((h.bodyRef() as? Body)?.absorbR == 90)
        field.destroy()
    }

    @Test("omitting it leaves the body default alone")
    func omissionKeepsDefault() {
        let field = FieldField(host: HeadlessFieldHost())
        let a = field.addBody(BodySpec(tokens: ["sink"], rect: { self.box() }))
        // The `Body` default (Types.swift) — this addition is strictly additive and must not move it.
        #expect((a.bodyRef() as? Body)?.absorbR == 10)
        field.destroy()
    }
}
