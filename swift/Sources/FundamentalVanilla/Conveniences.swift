import Foundation
import simd
import FundamentalCore
#if canImport(CoreGraphics)
import CoreGraphics
#endif

// MARK: - Coordinate conveniences
//
// The engine is 3D-native; these overloads keep flat-platform call sites as terse as the
// JS API (`field.burst(x, y)`). `z` always defaults to 0 — the flat plane — so omitting
// it is byte-identical to the JS call. Pure sugar over the Vec3 surface: nothing here
// touches core behavior.

public extension FieldHandle {

    /// `burst(x, y[, z][, color])` — the JS-shaped call (§11).
    func burst(x: Float, y: Float, z: Float = 0, color: String? = nil) {
        burst(at: Vec3(x, y, z), color: color)
    }

    /// `flowTo(x, y[, z][, strength])` — place or move the flow focus.
    func flowTo(x: Float, y: Float, z: Float = 0, strength: Float? = nil) {
        flowTo(Vec3(x, y, z), strength: strength)
    }

    /// `atomAt(x, y[, z])` — the seeded record near a point, or nil.
    func atomAt(x: Float, y: Float, z: Float = 0) -> AtomPayload? {
        atomAt(Vec3(x, y, z))
    }

    /// `focusAt(x, y[, z])` — focus the nearest seeded particle near a point.
    func focusAt(x: Float, y: Float, z: Float = 0) -> AtomPayload? {
        focusAt(Vec3(x, y, z))
    }
}

#if canImport(CoreGraphics)
public extension FieldHandle {

    /// Burst at a CGPoint — for gesture-recognizer call sites (`burst(at: tap.location(in: view))`).
    func burst(at point: CGPoint, color: String? = nil) {
        burst(at: Vec3(Float(point.x), Float(point.y), 0), color: color)
    }

    /// Flow focus at a CGPoint.
    func flowTo(_ point: CGPoint, strength: Float? = nil) {
        flowTo(Vec3(Float(point.x), Float(point.y), 0), strength: strength)
    }

    /// The seeded record near a CGPoint, or nil.
    func atomAt(_ point: CGPoint) -> AtomPayload? {
        atomAt(Vec3(Float(point.x), Float(point.y), 0))
    }

    /// Focus the nearest seeded particle near a CGPoint.
    func focusAt(_ point: CGPoint) -> AtomPayload? {
        focusAt(Vec3(Float(point.x), Float(point.y), 0))
    }
}
#endif
