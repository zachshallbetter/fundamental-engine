import Foundation
#if canImport(simd)
import simd
#endif

// MARK: - Flow control (flow.ts)
//
// A *flow focus* is a movable point the field bends toward: it pulls free matter in,
// curves the visible streamlines / wave spine, and can be retargeted every frame
// (follow the pointer, track an element, animate a path). It is not a body — it is a
// transient field influence, exposed through `flowTo()` / `clearFlow()`.

public struct FlowFocus {
    public var position: Vec3
    /// Pull magnitude multiplier (≈ [0, 2]); 1 is a firm, legible pull.
    public var strength: Float
    /// Reach in px — past this the focus has no effect.
    public var radius: Float
}

public let FLOW_DEFAULT_STRENGTH: Float = 1
public let FLOW_DEFAULT_RADIUS: Float = 360

/// Build a FlowFocus from a target point + options, applying the defaults. Pure.
public func makeFlowFocus(at position: Vec3, strength: Float? = nil, radius: Float? = nil) -> FlowFocus {
    FlowFocus(
        position: position,
        strength: strength ?? FLOW_DEFAULT_STRENGTH,
        radius: (radius ?? 0) > 0 ? radius! : FLOW_DEFAULT_RADIUS
    )
}

/// The vector a flow focus contributes at a point: a unit pull toward the focus scaled
/// by `strength`, falling off linearly to zero at `radius`. The engine uses this both to
/// nudge particle velocity (gain ≈ 0.6) and to bend the streamline grid. Pure.
public func flowBias(at point: Vec3, focus f: FlowFocus, gain: Float = 0.6) -> Vec3 {
    let d3 = f.position - point
    let d = simd_length(d3)
    if d == 0 || d >= f.radius { return .zero }
    let fall = (1 - d / f.radius) * f.strength * gain
    return (d3 / d) * fall
}
