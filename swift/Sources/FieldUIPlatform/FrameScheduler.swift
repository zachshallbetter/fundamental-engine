import Foundation
import FieldUICore

// MARK: - Phases

/// The six-phase frame loop — discover→read→compute→state→write→render.
/// Phase order is a hard invariant: handlers always run in this sequence.
public enum Phase: Int, CaseIterable, CustomStringConvertible, Sendable {
    case discover, read, compute, state, write, render

    public var description: String {
        switch self {
        case .discover: "discover"
        case .read:     "read"
        case .compute:  "compute"
        case .state:    "state"
        case .write:    "write"
        case .render:   "render"
        }
    }
}

/// Phases in which reading geometry is legal.
public let readPhases: Set<Phase> = [.discover, .read]

// MARK: - Frame context

public struct FrameContext {
    public let now: TimeInterval
    public let volume: FieldVolume
    public let phase: Phase
    public let frame: Int
}

public typealias PhaseHandler = (FrameContext) -> Void

// MARK: - Violations

public struct PhaseViolation {
    public let phase: Phase
    public let op: String
    public let allowed: [Phase]
    public let frame: Int
    public var message: String {
        "\"\(op)\" ran in the \(phase) phase; allowed only in: \(allowed.map(\.description).joined(separator: ", "))"
    }
}

public struct FrameReport {
    public let frame: Int
    public let now: TimeInterval
    public let ran: [Phase]
    public let violations: [PhaseViolation]
}

// MARK: - FrameScheduler

/// One shared loop with explicit, ordered phases so the registries never fight each other.
///
/// Every frame walks the same six phases in the same order:
///   discover → read → compute → state → write → render
///
/// The scheduler enforces the discipline: a geometry read requested during the write phase
/// is a violation. In strict mode it throws; otherwise it records and continues.
public final class FrameScheduler {
    /// A registered handler tagged with a stable token, so an unsubscribe identifies the original
    /// handler even after earlier removals shift the array (a captured index would go stale).
    private struct Subscription { let id: Int; let handler: PhaseHandler }
    private var handlers: [Phase: [Subscription]] = {
        var d = [Phase: [Subscription]]()
        for p in Phase.allCases { d[p] = [] }
        return d
    }()
    private var nextToken = 0

    private let strict: Bool
    private var recorded: [PhaseViolation] = []
    private(set) var current: Phase? = nil
    private(set) var frame: Int = 0

    public init(strict: Bool = false) {
        self.strict = strict
    }

    // MARK: Registration

    /// Register a handler for a phase. Returns an unsubscribe closure.
    @discardableResult
    public func on(_ phase: Phase, _ handler: @escaping PhaseHandler) -> () -> Void {
        let id = nextToken
        nextToken += 1
        handlers[phase]!.append(Subscription(id: id, handler: handler))
        return { [weak self] in
            self?.handlers[phase]?.removeAll { $0.id == id }
        }
    }

    // MARK: Phase guard

    /// Called by registries before reading geometry. Off-phase reads are violations.
    public func assertReadPhase(op: String) {
        guard let phase = current else { return } // outside a frame — allowed
        guard readPhases.contains(phase) else {
            let v = PhaseViolation(phase: phase, op: op, allowed: Array(readPhases), frame: frame)
            if strict { fatalError("[FieldUI/Platform] \(v.message)") }
            recorded.append(v)
            return
        }
    }

    public func readGuard() -> (String) -> Void {
        { [weak self] op in self?.assertReadPhase(op: op) }
    }

    // MARK: Violations

    public func violations() -> [PhaseViolation] { recorded }
    public func clearViolations() { recorded.removeAll() }

    // MARK: Frame execution

    /// Run one full six-phase frame. Returns the per-frame report.
    @discardableResult
    public func runFrame(now: TimeInterval = 0, volume: FieldVolume = FieldVolume(width: 0, height: 0)) -> FrameReport {
        let startViolations = recorded.count
        var ran: [Phase] = []

        for phase in Phase.allCases {
            let list = handlers[phase] ?? []
            guard !list.isEmpty else { continue }
            current = phase
            ran.append(phase)
            let ctx = FrameContext(now: now, volume: volume, phase: phase, frame: frame)
            for sub in list { sub.handler(ctx) }
        }

        current = nil
        let report = FrameReport(
            frame: frame,
            now: now,
            ran: ran,
            violations: Array(recorded[startViolations...])
        )
        frame += 1
        return report
    }
}
