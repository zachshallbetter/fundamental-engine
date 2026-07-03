import Testing
@testable import FundamentalCore

// Signals-first defaults (#979 / doc-06 Step 0, JS #538 + #979 parity): a bare field draws
// nothing and builds no carrier waves — both surfaces are explicit opt-ins.
@Suite("SignalsFirstDefaults")
struct WavesDefaultTests {

    @Test("FieldOptions defaults: waves off, render none — the bare field (#979)")
    func bareDefaults() {
        let o = FieldOptions()
        #expect(o.waves == false, "the Currents are opt-in — a bare field has no carrier waves")
        #expect(o.render == .none_, "signals-first: a bare field runs the sim + feedback but draws nothing")
    }

    @Test("opting in is explicit and unchanged")
    func optIn() {
        let o = FieldOptions(waves: true, render: .dots)
        #expect(o.waves == true)
        #expect(o.render == .dots)
    }
}
