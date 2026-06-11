#if canImport(QuartzCore)
import Foundation
import QuartzCore
import simd
import FieldUICore

// MARK: - FieldSurfaceLayer

/// The render surface — a CALayer the engine draws each frame, the analogue of the
/// managed full-viewport `<canvas>`. Decorative: hit-testing is disabled and the layer
/// never animates implicitly (the engine repaints at display cadence).
public final class FieldSurfaceLayer: CALayer {
    var frameData: RenderFrame?

    public override init() {
        super.init()
        isOpaque = false
        actions = ["contents": NSNull(), "bounds": NSNull(), "position": NSNull()]
    }

    public override init(layer: Any) {
        super.init(layer: layer)
    }

    required init?(coder: NSCoder) {
        super.init(coder: coder)
    }

    public override func draw(in ctx: CGContext) {
        guard let frame = frameData else { return }
        drawDots(frame, in: ctx)
    }

    /// The `dots` render mode (§20.6) — the default underlay: each particle is a soft disc,
    /// colored cool→warm by distance from the field centre and blended toward the accent by
    /// heat (§20.8), exactly the particleRGB ramp.
    private func drawDots(_ frame: RenderFrame, in ctx: CGContext) {
        let vol = frame.volume
        let cx = vol.width / 2
        let cy = vol.height / 2
        let maxR2 = cx * cx + cy * cy
        for p in frame.particles {
            let (x, y) = frame.projection.project(p.position)
            let dx = x - cx
            let dy = y - cy
            let rs = clamp((dx * dx + dy * dy) / maxR2, 0, 1) // normalized dist² (§20.8)
            let rgb = particleRGB(rs: rs, heat: p.heat, accent: p.color.map(hexToRgb) ?? frame.accent)
            let depth = frame.projection.depthHint(p.position)
            let radius = CGFloat(p.size * (1 + p.heat * 0.8) * (1 - depth * 0.5))
            let alpha = CGFloat(clamp(0.55 + p.heat * 0.4, 0, 1) * (1 - depth * 0.6))
            ctx.setFillColor(CGColor(
                red: CGFloat(rgb.x / 255), green: CGFloat(rgb.y / 255),
                blue: CGFloat(rgb.z / 255), alpha: alpha
            ))
            ctx.fillEllipse(in: CGRect(
                x: CGFloat(x) - radius, y: CGFloat(y) - radius,
                width: radius * 2, height: radius * 2
            ))
        }
    }
}

// MARK: - CoreGraphicsFieldRenderer

/// The CALayer-backed render backend for iOS and macOS — receives each frame from the
/// engine and repaints the surface layer.
public final class CoreGraphicsFieldRenderer: FieldRenderer {
    public let surface: FieldSurfaceLayer

    public init(scale: CGFloat) {
        self.surface = FieldSurfaceLayer()
        surface.contentsScale = scale
    }

    public func render(frame: RenderFrame) {
        surface.frameData = frame
        let size = CGSize(width: CGFloat(frame.volume.width), height: CGFloat(frame.volume.height))
        if surface.bounds.size != size {
            surface.frame = CGRect(origin: .zero, size: size)
        }
        surface.setNeedsDisplay()
    }
}
#endif
