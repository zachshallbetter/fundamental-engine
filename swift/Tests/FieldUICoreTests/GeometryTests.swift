import Testing
#if canImport(simd)
import simd
#else
import Foundation
#endif
@testable import FieldUICore

@Suite("Geometry")
struct GeometryTests {

    // MARK: nearestOnBox

    @Test("nearestOnBox — point outside returns clamped boundary point")
    func nearestOutside() {
        let b = Box(center: Vec3(0, 0, 0), halfExtents: Vec3(10, 10, 10))
        let p = Vec3(20, 0, 0)
        let n = nearestOnBox(p, b)
        #expect(n == Vec3(10, 0, 0))
    }

    @Test("nearestOnBox — point inside returns the point itself")
    func nearestInside() {
        let b = Box(center: Vec3(0, 0, 0), halfExtents: Vec3(10, 10, 10))
        let p = Vec3(3, -4, 5)
        let n = nearestOnBox(p, b)
        #expect(n == p)
    }

    @Test("nearestOnBox — 2D flat box (hd=0) degenerates correctly")
    func nearestFlat() {
        let b = Box(center: Vec3(50, 50, 0), halfExtents: Vec3(20, 10, 0))
        let p = Vec3(100, 50, 0)
        let n = nearestOnBox(p, b)
        #expect(n == Vec3(70, 50, 0))
    }

    // MARK: sdfBox

    @Test("sdfBox — outside returns positive distance")
    func sdfOutside() {
        let b = Box(center: .zero, halfExtents: Vec3(10, 10, 10))
        let d = sdfBox(Vec3(20, 0, 0), b)
        #expect(abs(d - 10) < 0.001)
    }

    @Test("sdfBox — inside returns negative distance")
    func sdfInside() {
        let b = Box(center: .zero, halfExtents: Vec3(10, 10, 10))
        let d = sdfBox(Vec3(0, 0, 0), b)
        #expect(d < 0)
    }

    @Test("sdfBox — on the surface returns ~0")
    func sdfSurface() {
        let b = Box(center: .zero, halfExtents: Vec3(10, 10, 10))
        let d = sdfBox(Vec3(10, 0, 0), b)
        #expect(abs(d) < 0.001)
    }

    // MARK: dipoleField

    @Test("dipoleField — opposite poles produce nonzero field between them")
    func dipoleBetweenPoles() {
        let poles = [
            Pole(position: Vec3(-10, 0, 0), charge:  1),
            Pole(position: Vec3( 10, 0, 0), charge: -1),
        ]
        let f = dipoleField(poles: poles, at: .zero)
        // Between a + and − pole the field points from + toward −: + pole at -10, − pole at +10 → field points right
        #expect(f.x > 0)
        #expect(abs(f.y) < 0.001)
        #expect(abs(f.z) < 0.001)
    }

    @Test("dipoleField — zero poles returns zero")
    func dipoleEmpty() {
        let f = dipoleField(poles: [], at: Vec3(5, 5, 5))
        #expect(f == .zero)
    }
}

@Suite("Math")
struct MathTests {

    @Test("clamp — below lo")
    func clampLow()  { #expect(clamp(-1, 0, 1) == 0) }

    @Test("clamp — above hi")
    func clampHigh() { #expect(clamp(2, 0, 1)  == 1) }

    @Test("clamp — within range")
    func clampMid()  { #expect(clamp(0.5, 0, 1) == 0.5) }

    @Test("lerp — endpoints")
    func lerpEnds() {
        #expect(lerp(0, 10, 0) == 0)
        #expect(lerp(0, 10, 1) == 10)
    }

    @Test("hexToRgb — full 6-digit")
    func hexFull() {
        let c = hexToRgb("#4da3ff")
        #expect(abs(c.x - 77) < 1)
        #expect(abs(c.y - 163) < 1)
        #expect(abs(c.z - 255) < 1)
    }

    @Test("hexToRgb — 3-digit expands correctly")
    func hexShort() {
        let c = hexToRgb("#fff")
        #expect(c.x == 255 && c.y == 255 && c.z == 255)
    }

    @Test("hexToRgb — invalid falls back to default accent")
    func hexInvalid() {
        let c = hexToRgb("nope")
        #expect(c == DEFAULT_ACCENT)
    }

    @Test("screenFactor — zero range returns 1 (inert)")
    func screenZeroRange() {
        #expect(screenFactor(d: 0, range: 0, strength: 1) == 1)
    }

    @Test("screenFactor — at centre with full strength returns 0 (full cancellation)")
    func screenFullCancel() {
        let f = screenFactor(d: 0, range: 100, strength: 1, min: 0)
        #expect(f == 0)
    }

    @Test("screenFactor — beyond range returns 1")
    func screenBeyondRange() {
        let f = screenFactor(d: 200, range: 100, strength: 1)
        #expect(f == 1)
    }
}
