#if canImport(QuartzCore) && os(macOS)
import Foundation
import CoreGraphics
import QuartzCore
import ImageIO
import UniformTypeIdentifiers
import simd
import FundamentalCore
import FundamentalVanilla

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

    // MARK: - Perceptual signature (the visual snapshot model, #417/#392 verification)

    /// A coarse perceptual fingerprint of a rendered frame: a downsampled luminance grid plus the lit
    /// fraction and the centroid of the lit mass. Deliberately *coarse* — the engine's wander is
    /// unseeded and CoreGraphics rasterization differs across machines, so exact pixels flake; the
    /// aggregate of hundreds of particles over a coarse grid is stable. This gates STRUCTURE (does a
    /// mode draw coherent content, in the right place, of the right density) rather than exact pixels.
    public struct Signature: Equatable {
        public let cols: Int
        public let rows: Int
        public let lum: [Float]        // cols*rows, average luminance 0..1 per cell
        public let litFraction: Float  // share of pixels brighter than the dark background
        /// Share of pixels above the CORE brightness threshold (bg + 0.24) — solid-disc-level
        /// light. The soft-glow treatment (#417) fades matter toward the field edge and wraps
        /// every core in a dim bloom shell, so most LIT pixels sit BELOW this:
        /// `litFraction − brightFraction` reads the glow.
        public let brightFraction: Float
        public let centroidX: Float    // 0..1, x of the lit mass
        public let centroidY: Float    // 0..1, y of the lit mass

        /// Largest per-cell luminance difference against another signature of the same shape.
        public func maxCellDelta(to other: Signature) -> Float {
            guard cols == other.cols, rows == other.rows else { return .infinity }
            var m: Float = 0
            for i in lum.indices { m = max(m, abs(lum[i] - other.lum[i])) }
            return m
        }
    }

    /// Render a scene headlessly (steady state — no bursts) and reduce it to a `Signature`.
    public static func signature(scene: LabScene, options: Options = Options(),
                                 cols: Int = 16, rows: Int = 10) throws -> Signature {
        var opts = options
        opts.bursts = []
        let bodies = scene.makeBodies(width: opts.width, height: opts.height)
        let host = ManualFieldHost(width: opts.width, height: opts.height,
                                   depth: scene.depth, scale: Float(opts.scale), bodies: bodies)
        let renderer = CoreGraphicsFieldRenderer(scale: opts.scale)
        let field = FieldField(host: host, options: scene.options(), renderer: renderer)
        field.scan()
        field.setFormation(scene.formation)
        for i in 0..<opts.frames { host.fire(at: TimeInterval(i) / 60) }

        let pxW = Int(CGFloat(opts.width) * opts.scale)
        let pxH = Int(CGFloat(opts.height) * opts.scale)
        guard let ctx = CGContext(
            data: nil, width: pxW, height: pxH, bitsPerComponent: 8, bytesPerRow: 0,
            space: CGColorSpace(name: CGColorSpace.sRGB)!,
            bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
        ) else { throw NSError(domain: "FieldLab", code: 1) }
        ctx.setFillColor(CGColor(red: opts.background.r, green: opts.background.g,
                                 blue: opts.background.b, alpha: 1))
        ctx.fill(CGRect(x: 0, y: 0, width: pxW, height: pxH))
        ctx.translateBy(x: 0, y: CGFloat(pxH))
        ctx.scaleBy(x: opts.scale, y: -opts.scale)
        renderer.surface.render(in: ctx)
        field.destroy()

        guard let raw = ctx.data else { throw NSError(domain: "FieldLab", code: 2) }
        let ptr = raw.bindMemory(to: UInt8.self, capacity: ctx.bytesPerRow * pxH)
        let bpr = ctx.bytesPerRow
        let bg = Float(0.299 * opts.background.r + 0.587 * opts.background.g + 0.114 * opts.background.b)
        let litThreshold = bg + 0.06 // a touch above the dark background
        let brightThreshold = bg + 0.24 // solid-core light — the glow's faded shell/edge matter stays below

        var lum = [Float](repeating: 0, count: cols * rows)
        var cnt = [Int](repeating: 0, count: cols * rows)
        var lit = 0
        var bright = 0
        var sx: Float = 0, sy: Float = 0, mass: Float = 0
        for y in 0..<pxH {
            let row = y * bpr
            let cy = min(y * rows / pxH, rows - 1)
            for x in 0..<pxW {
                let o = row + x * 4
                let l = (0.299 * Float(ptr[o]) + 0.587 * Float(ptr[o + 1]) + 0.114 * Float(ptr[o + 2])) / 255
                let cx = min(x * cols / pxW, cols - 1)
                lum[cy * cols + cx] += l
                cnt[cy * cols + cx] += 1
                if l > litThreshold { lit += 1; sx += Float(x); sy += Float(y); mass += 1 }
                if l > brightThreshold { bright += 1 }
            }
        }
        for i in lum.indices { lum[i] /= Float(max(cnt[i], 1)) }
        return Signature(
            cols: cols, rows: rows, lum: lum,
            litFraction: Float(lit) / Float(pxW * pxH),
            brightFraction: Float(bright) / Float(pxW * pxH),
            centroidX: mass > 0 ? sx / mass / Float(pxW) : 0.5,
            centroidY: mass > 0 ? sy / mass / Float(pxH) : 0.5
        )
    }
}
#endif
