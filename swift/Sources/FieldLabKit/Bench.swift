#if canImport(QuartzCore) && os(macOS)
import Foundation
import CoreGraphics
import QuartzCore
import simd
import FieldUICore
import FieldUIVanilla

// MARK: - Bench
//
// Where does a frame go? Times the two halves of the loop separately:
//   sim  — host.fire(at:) (the engine tick; in headless runs the renderer only stores
//          the frame, so this is pure simulation + bookkeeping)
//   draw — surface.render(in:) into a retina-scale bitmap (exactly the CG work the live
//          app does on the main thread each display pass)
// One row per configuration. ms are per-frame averages over the run; `worst` is the
// single slowest draw (the frame that visibly hitches).

public enum Bench {

    public struct Row {
        public let label: String
        public let simMs: Double
        public let drawMs: Double
        public let worstDrawMs: Double
        public var totalMs: Double { simMs + drawMs }
        public var fps: Double { 1000 / max(totalMs, 0.001) }
    }

    public static func run(
        scene: LabScene,
        label: String,
        width: Float = 1280, height: Float = 800,
        scale: CGFloat = 2,
        frames: Int = 240
    ) -> Row {
        let bodies = scene.makeBodies(width: width, height: height)
        let host = ManualFieldHost(width: width, height: height,
                                   depth: scene.depth, scale: Float(scale), bodies: bodies)
        let renderer = CoreGraphicsFieldRenderer(scale: scale)
        let field = FieldField(host: host, options: scene.options(), renderer: renderer)
        field.scan()
        field.setFormation(scene.formation)

        let ctx = CGContext(
            data: nil,
            width: Int(CGFloat(width) * scale), height: Int(CGFloat(height) * scale),
            bitsPerComponent: 8, bytesPerRow: 0,
            space: CGColorSpace(name: CGColorSpace.sRGB)!,
            bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
        )!
        ctx.scaleBy(x: scale, y: scale)

        // warm up (pool settles, grids allocate, caches fill)
        for i in 0..<60 { host.fire(at: TimeInterval(i) / 60) }

        var simTotal = 0.0
        var drawTotal = 0.0
        var worstDraw = 0.0
        for i in 0..<frames {
            let t = TimeInterval(60 + i) / 60
            let s0 = DispatchTime.now()
            host.fire(at: t)
            let s1 = DispatchTime.now()
            renderer.surface.render(in: ctx)
            let s2 = DispatchTime.now()
            let sim = Double(s1.uptimeNanoseconds - s0.uptimeNanoseconds) / 1e6
            let draw = Double(s2.uptimeNanoseconds - s1.uptimeNanoseconds) / 1e6
            simTotal += sim
            drawTotal += draw
            worstDraw = max(worstDraw, draw)
        }
        field.destroy()
        return Row(label: label,
                   simMs: simTotal / Double(frames),
                   drawMs: drawTotal / Double(frames),
                   worstDrawMs: worstDraw)
    }

    /// The standard sweep: every tour scene as configured, then the mass scene through
    /// every matter mode and every overlay reading in isolation.
    public static func standardSweep(frames: Int = 240) -> [Row] {
        var rows: [Row] = []
        for scene in LabScenes.tour {
            rows.append(run(scene: scene, label: "scene: \(scene.id)", frames: frames))
        }
        for mode in [RenderMode.dots, .trails, .links, .metaballs, .voronoi, .streamlines] {
            var s = LabScenes.mass
            s.render = mode
            rows.append(run(scene: s, label: "matter: \(mode.rawValue)", frames: frames))
        }
        let readings: [FieldUICore.OverlayMode] = [.streamlines, .forceVectors, .fieldLines,
                                                   .grid, .temperature, .energy, .path, .data]
        for reading in readings {
            var s = LabScenes.mass
            s.overlay = [reading]
            rows.append(run(scene: s, label: "reading: \(reading.rawValue)", frames: frames))
        }
        return rows
    }

    public static func table(_ rows: [Row]) -> String {
        var out = String(format: "%-26s %8s %8s %8s %8s %6s\n",
                         ("configuration" as NSString).utf8String!,
                         ("sim ms" as NSString).utf8String!,
                         ("draw ms" as NSString).utf8String!,
                         ("worst" as NSString).utf8String!,
                         ("total" as NSString).utf8String!,
                         ("fps" as NSString).utf8String!)
        for r in rows {
            out += String(format: "%-26s %8.2f %8.2f %8.2f %8.2f %6.0f\n",
                          (r.label as NSString).utf8String!,
                          r.simMs, r.drawMs, r.worstDrawMs, r.totalMs, r.fps)
        }
        return out
    }
}
#endif
