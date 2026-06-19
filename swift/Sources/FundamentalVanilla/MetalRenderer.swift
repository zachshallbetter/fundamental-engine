#if canImport(Metal) && canImport(QuartzCore)
import Foundation
import Metal
import QuartzCore
import simd
import FundamentalCore

// MARK: - MetalFieldRenderer
//
// The GPU backend for the hot per-frame layers — matter (dots / trails / links), the
// carrier waves, the bound shimmer, and sparks. Soft-circle instances and line
// primitives, 4× MSAA, premultiplied-alpha blending; the whole frame is two pipelines
// and at most four draw calls. Diagnostic readings stay on the CoreGraphics layer above
// (they're line-art diagnostics, already cheap after the AA fixes) — see
// HybridFieldRenderer, which composes the two.
//
// The CPU cost of a Metal frame is buffer fills (a few hundred instances) + encoding:
// ~0.1 ms, versus 9–46 ms for the same layers rasterized by CPU CoreGraphics.

public final class MetalFieldRenderer: FieldRenderer {

    /// The render surface, added to the mount beneath the CG readings layer.
    public let metalLayer: CAMetalLayer

    private let device: MTLDevice
    private let queue: MTLCommandQueue
    private var circlePipeline: MTLRenderPipelineState!
    private var linePipeline: MTLRenderPipelineState!
    private var msaaTexture: MTLTexture?
    private var msaaSize: CGSize = .zero
    private let inflight = DispatchSemaphore(value: 2)
    private let scale: CGFloat

    // grow-on-demand shared buffers, reused across frames
    private var circleBuffer: MTLBuffer?
    private var lineBuffer: MTLBuffer?

    /// 8 floats per circle instance: x, y, radius, pad, r, g, b, a (premult-ready).
    private var circles: [Float] = []
    /// 8 floats per line vertex: x, y, pad, pad, r, g, b, a.
    private var lines: [Float] = []

    public init?(scale: CGFloat) {
        guard let device = MTLCreateSystemDefaultDevice(),
              let queue = device.makeCommandQueue() else { return nil }
        self.device = device
        self.queue = queue
        self.scale = scale
        self.metalLayer = CAMetalLayer()
        metalLayer.device = device
        metalLayer.pixelFormat = .bgra8Unorm
        metalLayer.isOpaque = false
        metalLayer.framebufferOnly = true
        metalLayer.contentsScale = scale
        metalLayer.actions = ["contents": NSNull(), "bounds": NSNull(), "position": NSNull()]
        do {
            try buildPipelines()
        } catch {
            return nil
        }
    }

    // MARK: shaders (runtime-compiled — SPM targets can't carry .metal files)

    private static let source = """
    #include <metal_stdlib>
    using namespace metal;

    struct Inst { float2 pos; float radius; float pad; float4 color; };
    struct LineV { float2 pos; float2 pad; float4 color; };
    struct VOut { float4 pos [[position]]; float2 local; float4 color; };

    vertex VOut circleVert(uint vid [[vertex_id]], uint iid [[instance_id]],
                           const device Inst* inst [[buffer(0)]],
                           constant float2& viewport [[buffer(1)]]) {
        const float2 corners[4] = { {-1,-1}, {1,-1}, {-1,1}, {1,1} };
        Inst c = inst[iid];
        float2 corner = corners[vid];
        float2 world = c.pos + corner * c.radius;
        float2 ndc = (world / viewport) * 2.0 - 1.0;
        ndc.y = -ndc.y;
        VOut o;
        o.pos = float4(ndc, 0.0, 1.0);
        o.local = corner;
        o.color = c.color;
        return o;
    }

    fragment float4 circleFrag(VOut in [[stage_in]]) {
        float d = length(in.local);
        float a = 1.0 - smoothstep(0.78, 1.0, d); // soft-edged disc
        if (a <= 0.001) discard_fragment();
        float alpha = in.color.a * a;
        return float4(in.color.rgb * alpha, alpha); // premultiplied
    }

    vertex VOut lineVert(uint vid [[vertex_id]],
                         const device LineV* verts [[buffer(0)]],
                         constant float2& viewport [[buffer(1)]]) {
        LineV v = verts[vid];
        float2 ndc = (v.pos / viewport) * 2.0 - 1.0;
        ndc.y = -ndc.y;
        VOut o;
        o.pos = float4(ndc, 0.0, 1.0);
        o.local = float2(0.0, 0.0);
        o.color = v.color;
        return o;
    }

    fragment float4 lineFrag(VOut in [[stage_in]]) {
        return float4(in.color.rgb * in.color.a, in.color.a); // premultiplied
    }
    """

    private func buildPipelines() throws {
        let lib = try device.makeLibrary(source: Self.source, options: nil)

        func pipeline(vertex: String, fragment: String) throws -> MTLRenderPipelineState {
            let desc = MTLRenderPipelineDescriptor()
            desc.vertexFunction = lib.makeFunction(name: vertex)
            desc.fragmentFunction = lib.makeFunction(name: fragment)
            desc.rasterSampleCount = 4
            let att = desc.colorAttachments[0]!
            att.pixelFormat = .bgra8Unorm
            att.isBlendingEnabled = true
            att.sourceRGBBlendFactor = .one              // premultiplied source
            att.sourceAlphaBlendFactor = .one
            att.destinationRGBBlendFactor = .oneMinusSourceAlpha
            att.destinationAlphaBlendFactor = .oneMinusSourceAlpha
            return try device.makeRenderPipelineState(descriptor: desc)
        }
        circlePipeline = try pipeline(vertex: "circleVert", fragment: "circleFrag")
        linePipeline = try pipeline(vertex: "lineVert", fragment: "lineFrag")
    }

    // MARK: geometry assembly (CPU — a few hundred instances, ~0.05 ms)

    @inline(__always)
    private func pushCircle(_ x: Float, _ y: Float, _ radius: Float, _ rgb: RGB, _ alpha: Float) {
        circles.append(contentsOf: [x, y, radius, 0,
                                    rgb.x / 255, rgb.y / 255, rgb.z / 255, clamp(alpha, 0, 1)])
    }

    @inline(__always)
    private func pushLine(_ x1: Float, _ y1: Float, _ x2: Float, _ y2: Float, _ rgb: RGB, _ alpha: Float) {
        let r = rgb.x / 255, g = rgb.y / 255, b = rgb.z / 255, a = clamp(alpha, 0, 1)
        lines.append(contentsOf: [x1, y1, 0, 0, r, g, b, a,
                                  x2, y2, 0, 0, r, g, b, a])
    }

    private func particleColor(_ p: Particle, _ frame: RenderFrame) -> RGB {
        let vol = frame.volume
        let cx = vol.width / 2
        let cy = vol.height / 2
        let dx = p.position.x - cx
        let dy = p.position.y - cy
        let rs = clamp((dx * dx + dy * dy) / (cx * cx + cy * cy), 0, 1)
        return particleRGB(rs: rs, heat: p.heat, accent: p.color.map(hexToRgb) ?? frame.accent)
    }

    private func assemble(_ frame: RenderFrame) {
        circles.removeAll(keepingCapacity: true)
        lines.removeAll(keepingCapacity: true)
        let W = frame.volume.width
        let H = frame.volume.height

        // carrier waves (§2.3) + the bound shimmer
        for w in frame.waves {
            let alpha = 0.05 + w.depth * 0.1
            var px: Float = 0
            var py = waveYat(w, x: 0, time: frame.time, H: H)
            var x: Float = 14
            while x <= W {
                let y = waveYat(w, x: x, time: frame.time, H: H)
                pushLine(px, py, x, y, w.color, alpha)
                px = x
                py = y
                x += 14
            }
        }
        for b in frame.bound {
            guard frame.waves.indices.contains(b.wi) else { continue }
            let w = frame.waves[b.wi]
            let x = b.progress * W
            let y = waveYat(w, x: x, time: frame.time, H: H) + b.phase * 32
            pushCircle(x, y, b.size, w.color, b.glow ? 0.5 : 0.25)
        }

        // matter
        switch frame.mode {
        case .dots, .metaballs, .voronoi, .streamlines, .none_:
            // dots is Metal's matter; the other modes keep their CG drawing (hybrid) and
            // Metal contributes only ambient layers for them.
            if frame.mode == .dots { pushDots(frame) }
        case .trails:
            for p in frame.particles {
                let (x, y) = frame.projection.project(p.position)
                let tail = p.position - p.velocity * 6
                let (tx, ty) = frame.projection.project(tail)
                pushLine(tx, ty, x, y, particleColor(p, frame), 0.4 + p.heat * 0.5)
            }
        case .links:
            for seg in linkSegments(particles: frame.particles) {
                let (x1, y1) = frame.projection.project(seg.a)
                let (x2, y2) = frame.projection.project(seg.b)
                pushLine(x1, y1, x2, y2, frame.accent, seg.alpha)
            }
            pushDots(frame)
        }

        // sparks (§23)
        for s in frame.sparks {
            let (x, y) = frame.projection.project(s.position)
            pushCircle(x, y, 0.8 + s.life * 1.6, s.color, s.life * 0.9)
        }
    }

    private func pushDots(_ frame: RenderFrame) {
        for p in frame.particles {
            let (x, y) = frame.projection.project(p.position)
            let depth = frame.projection.depthHint(p.position)
            let radius = p.size * (1 + p.heat * 0.8) * (1 - depth * 0.5)
            pushCircle(x, y, radius, particleColor(p, frame), (0.55 + p.heat * 0.4) * (1 - depth * 0.6))
        }
    }

    // MARK: render

    public func render(frame: RenderFrame) {
        let size = CGSize(width: CGFloat(frame.volume.width), height: CGFloat(frame.volume.height))
        guard size.width > 1, size.height > 1 else { return }
        if metalLayer.bounds.size != size {
            metalLayer.frame = CGRect(origin: .zero, size: size)
            metalLayer.drawableSize = CGSize(width: size.width * scale, height: size.height * scale)
        }

        assemble(frame)

        inflight.wait()
        guard let drawable = metalLayer.nextDrawable() else {
            inflight.signal()
            return
        }

        // (re)build the MSAA target when the drawable size changes
        if msaaTexture == nil || msaaSize != metalLayer.drawableSize {
            let d = MTLTextureDescriptor()
            d.textureType = .type2DMultisample
            d.pixelFormat = .bgra8Unorm
            d.width = Int(metalLayer.drawableSize.width)
            d.height = Int(metalLayer.drawableSize.height)
            d.sampleCount = 4
            d.usage = .renderTarget
            d.storageMode = .private
            msaaTexture = device.makeTexture(descriptor: d)
            msaaSize = metalLayer.drawableSize
        }

        let pass = MTLRenderPassDescriptor()
        pass.colorAttachments[0].texture = msaaTexture
        pass.colorAttachments[0].resolveTexture = drawable.texture
        pass.colorAttachments[0].loadAction = .clear
        pass.colorAttachments[0].storeAction = .multisampleResolve
        pass.colorAttachments[0].clearColor = MTLClearColor(red: 0, green: 0, blue: 0, alpha: 0)

        guard let cmd = queue.makeCommandBuffer(),
              let enc = cmd.makeRenderCommandEncoder(descriptor: pass) else {
            inflight.signal()
            return
        }

        var viewport = SIMD2<Float>(frame.volume.width, frame.volume.height)

        if !lines.isEmpty {
            upload(&lineBuffer, lines)
            enc.setRenderPipelineState(linePipeline)
            enc.setVertexBuffer(lineBuffer, offset: 0, index: 0)
            enc.setVertexBytes(&viewport, length: MemoryLayout<SIMD2<Float>>.size, index: 1)
            enc.drawPrimitives(type: .line, vertexStart: 0, vertexCount: lines.count / 8)
        }
        if !circles.isEmpty {
            upload(&circleBuffer, circles)
            enc.setRenderPipelineState(circlePipeline)
            enc.setVertexBuffer(circleBuffer, offset: 0, index: 0)
            enc.setVertexBytes(&viewport, length: MemoryLayout<SIMD2<Float>>.size, index: 1)
            enc.drawPrimitives(type: .triangleStrip, vertexStart: 0, vertexCount: 4,
                               instanceCount: circles.count / 8)
        }

        enc.endEncoding()
        cmd.present(drawable)
        cmd.addCompletedHandler { [inflight] _ in inflight.signal() }
        cmd.commit()
    }

    private func upload(_ buffer: inout MTLBuffer?, _ data: [Float]) {
        let bytes = data.count * MemoryLayout<Float>.size
        if buffer == nil || buffer!.length < bytes {
            buffer = device.makeBuffer(length: max(bytes, 16384), options: .storageModeShared)
        }
        data.withUnsafeBytes { src in
            buffer!.contents().copyMemory(from: src.baseAddress!, byteCount: bytes)
        }
    }
}

// MARK: - HybridFieldRenderer
//
// Metal underneath for the hot layers, CoreGraphics on top for the diagnostic readings
// (and for the matter modes Metal doesn't cover — metaballs / voronoi / streamlines stay
// CG). The CG layer's ambient/matter passes are switched off exactly when Metal covers
// them, so nothing draws twice.

public final class HybridFieldRenderer: FieldRenderer {
    public let metal: MetalFieldRenderer
    public let cg: CoreGraphicsFieldRenderer

    public init?(scale: CGFloat) {
        guard let metal = MetalFieldRenderer(scale: scale) else { return nil }
        self.metal = metal
        self.cg = CoreGraphicsFieldRenderer(scale: scale)
    }

    public func render(frame: RenderFrame) {
        let metalCoversMatter = frame.mode == .dots || frame.mode == .trails || frame.mode == .links
        cg.surface.skipAmbient = true              // waves/shimmer/sparks are always Metal's
        cg.surface.skipMatter = metalCoversMatter  // matter is Metal's in its three modes
        metal.render(frame: frame)
        cg.render(frame: frame)
    }
}
#endif
