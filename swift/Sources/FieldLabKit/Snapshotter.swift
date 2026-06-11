#if canImport(QuartzCore) && os(macOS)
import Foundation
import CoreGraphics
import QuartzCore
import ImageIO
import UniformTypeIdentifiers
import simd
import FieldUICore
import FieldUIVanilla

// MARK: - Snapshotter
//
// Runs a scene headlessly for N frames through the real engine + the real CoreGraphics
// renderer, then rasterizes the render surface to a PNG. No window, no display link —
// proof that what the app shows is what the engine computes.

public enum Snapshotter {

    public struct Options {
        public var width: Float = 1280
        public var height: Float = 800
        public var frames: Int = 360
        public var scale: CGFloat = 2
        /// Normalized burst points fired at one-third and two-thirds of the run —
        /// heat + pigment make the snapshot tell the motion story a still can't.
        public var bursts: [(Float, Float)] = []
        public var background: (r: CGFloat, g: CGFloat, b: CGFloat) = (0.043, 0.055, 0.078) // #0b0e14

        public init() {}
    }

    @discardableResult
    public static func render(scene: LabScene, options: Options = Options(), to url: URL) throws -> URL {
        let opts = options
        let bodies = scene.makeBodies(width: opts.width, height: opts.height)
        let host = ManualFieldHost(width: opts.width, height: opts.height,
                                   depth: scene.depth, scale: Float(opts.scale), bodies: bodies)
        let renderer = CoreGraphicsFieldRenderer(scale: opts.scale)
        let field = FieldField(host: host, options: scene.options(), renderer: renderer)
        field.scan()
        field.setFormation(scene.formation)

        for i in 0..<opts.frames {
            let t = TimeInterval(i) / 60
            if !opts.bursts.isEmpty {
                if i == opts.frames / 3 {
                    let (bx, by) = opts.bursts[0]
                    field.burst(at: Vec3(bx * opts.width, by * opts.height, 0))
                }
                if i == opts.frames * 2 / 3, opts.bursts.count > 1 {
                    let (bx, by) = opts.bursts[1]
                    field.burst(at: Vec3(bx * opts.width, by * opts.height, 0), color: "#ff9d5c")
                }
            }
            host.fire(at: t)
        }

        // rasterize the live surface
        let pxW = Int(CGFloat(opts.width) * opts.scale)
        let pxH = Int(CGFloat(opts.height) * opts.scale)
        guard let ctx = CGContext(
            data: nil, width: pxW, height: pxH, bitsPerComponent: 8, bytesPerRow: 0,
            space: CGColorSpace(name: CGColorSpace.sRGB)!,
            bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
        ) else {
            throw NSError(domain: "FieldLab", code: 1,
                          userInfo: [NSLocalizedDescriptionKey: "could not create bitmap context"])
        }

        // dark field background, then the layer (flipped: CALayer is y-down, CG is y-up)
        ctx.setFillColor(CGColor(red: opts.background.r, green: opts.background.g,
                                 blue: opts.background.b, alpha: 1))
        ctx.fill(CGRect(x: 0, y: 0, width: pxW, height: pxH))
        ctx.translateBy(x: 0, y: CGFloat(pxH))
        ctx.scaleBy(x: opts.scale, y: -opts.scale)
        renderer.surface.render(in: ctx)

        guard let image = ctx.makeImage() else {
            throw NSError(domain: "FieldLab", code: 2,
                          userInfo: [NSLocalizedDescriptionKey: "could not rasterize"])
        }
        guard let dest = CGImageDestinationCreateWithURL(url as CFURL, UTType.png.identifier as CFString, 1, nil) else {
            throw NSError(domain: "FieldLab", code: 3,
                          userInfo: [NSLocalizedDescriptionKey: "could not open \(url.path)"])
        }
        CGImageDestinationAddImage(dest, image, nil)
        CGImageDestinationFinalize(dest)

        field.destroy()
        return url
    }
}
#endif
