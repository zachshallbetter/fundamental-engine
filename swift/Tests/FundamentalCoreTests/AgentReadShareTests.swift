import Foundation
import Testing
@testable import FundamentalCore

// #915 — the fractional `budgets.agentRead` gate.
//
// The digest that picks WHICH bodies a partial read admits must be bit-identical on every plane, or
// the same policy over the same field admits different bodies depending on where it runs — a parity
// break that nothing else in the suite would catch. These vectors are generated from the JS engine's
// `idCoord` and are duplicated verbatim in the Kotlin and JS tests.

@Suite("agentRead share digest")
struct AgentReadShareTests {
    /// (body id, the coordinate the JS engine produces)
    static let vectors: [(String, Double)] = [
        ("body-0", 0.65820098831318319),
        ("body-1", 0.39754880708642304),
        ("body-2", 0.90072084194980562),
        ("a", 0.10352621669881046),
        ("hero", 0.83324211370199919),
        ("b00", 0.28318144241347909),
        ("b63", 0.07492343452759087),
        ("card-42", 0.51497967774048448),
        ("", 0.66892218845896423),
        ("ünïcode", 0.78291085967794061),
    ]

    @Test("the digest matches the JS engine bit for bit")
    func crossPlaneDigest() {
        for (id, expected) in Self.vectors {
            let got = AgentReadShare.coordinate(id)
            #expect(abs(got - expected) < 1e-15, "coordinate(\(id)) = \(got), JS says \(expected)")
        }
    }

    @Test("the boundaries are the documented ones")
    func boundaries() {
        // share >= 1 admits everything, including ids whose coordinate is near the top of the range.
        #expect(AgentReadShare.admits("body-2", share: 1))
        #expect(AgentReadShare.admits("body-2", share: 2))
        // a share below a body's coordinate withholds it; above admits it.
        #expect(!AgentReadShare.admits("hero", share: 0.5))
        #expect(AgentReadShare.admits("hero", share: 0.9))
    }

    @Test("the share is roughly uniform over realistic ids")
    func uniformity() {
        // The property a weak digest destroys: `body-N` ids are near-identical short strings.
        let ids = (0..<512).map { "body-\($0)" }
        for share in [0.1, 0.25, 0.5, 0.75] as [Float] {
            let admitted = ids.filter { AgentReadShare.admits($0, share: share) }.count
            let expected = Double(share) * 512
            #expect(abs(Double(admitted) - expected) < 512 * 0.06,
                    "share \(share) admitted \(admitted)/512, expected about \(expected)")
        }
    }
}
