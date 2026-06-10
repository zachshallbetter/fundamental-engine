import Foundation
import FieldUICore

// MARK: - FieldMeasurement

/// An immutable geometry snapshot for one body — the 3D counterpart of JS's `FieldMeasurement`.
public struct FieldMeasurement {
    public let body: Body
    public let box: Box
    /// Fraction of the body's volume visible within the host volume ∈ [0,1].
    public let visibilityRatio: Float
    public var isVisible: Bool { visibilityRatio > 0 }
    public let timestamp: TimeInterval
}

// MARK: - MeasurementRegistry

/// Frame-stable geometry. Reads every registered body's world box once per frame and
/// hands back an immutable snapshot, so the rest of the system works from one consistent
/// set of boxes instead of each force measuring whenever it likes (layout thrash).
///
/// Strict read-phase: `measure()` only reads. Feedback (writes) happens separately.
public final class MeasurementRegistry {
    private var entries: [ObjectIdentifier: Body] = [:]
    private(set) var snapshot: [FieldMeasurement] = []
    private var guard_: ((String) -> Void)?

    public init() {}

    // MARK: Phase guard

    /// Install a phase guard (FrameScheduler supplies one via `readGuard()`).
    public func setPhaseGuard(_ guard_: ((String) -> Void)?) {
        self.guard_ = guard_
    }

    // MARK: Registration

    public func register(_ body: Body) {
        entries[ObjectIdentifier(body)] = body
    }

    public func unregister(_ body: Body) {
        entries.removeValue(forKey: ObjectIdentifier(body))
    }

    public func has(_ body: Body) -> Bool {
        entries[ObjectIdentifier(body)] != nil
    }

    public var count: Int { entries.count }

    // MARK: Measurement

    /// Read every registered body's geometry once. Call only from the `read` phase.
    @discardableResult
    public func measure(
        now: TimeInterval = 0,
        volume: FieldVolume,
        host: any FieldHost
    ) -> [FieldMeasurement] {
        guard_?("measure")

        var out: [FieldMeasurement] = []
        var toRemove: [ObjectIdentifier] = []

        for (id, body) in entries {
            guard let view = body.view else {
                toRemove.append(id)
                continue
            }
            guard let box = host.worldBox(of: view) else {
                toRemove.append(id)
                continue
            }
            body.box = box
            let ratio = visibilityRatio(box: box, volume: volume)
            out.append(FieldMeasurement(body: body, box: box, visibilityRatio: ratio, timestamp: now))
        }

        for id in toRemove { entries.removeValue(forKey: id) }
        snapshot = out
        return out
    }

    public func measurement(for body: Body) -> FieldMeasurement? {
        snapshot.first { $0.body === body }
    }
}

// MARK: - Visibility

/// Overlap fraction of a box within the host volume ∈ [0,1].
private func visibilityRatio(box: Box, volume: FieldVolume) -> Float {
    // Volume of box
    let bMin = box.center - box.halfExtents
    let bMax = box.center + box.halfExtents
    let vMax = Vec3(volume.width, volume.height, max(volume.depth, 1))

    let ox = max(0, min(bMax.x, vMax.x) - max(bMin.x, 0))
    let oy = max(0, min(bMax.y, vMax.y) - max(bMin.y, 0))
    let oz = max(0, min(bMax.z, vMax.z) - max(bMin.z, 0))

    let boxVol  = (bMax.x - bMin.x) * (bMax.y - bMin.y) * max(bMax.z - bMin.z, 1)
    let overlap = ox * oy * oz

    guard boxVol > 0 else { return 0 }
    return min(1, overlap / boxVol)
}
