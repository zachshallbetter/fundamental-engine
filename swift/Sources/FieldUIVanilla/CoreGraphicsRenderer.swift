#if canImport(QuartzCore)
import Foundation
import QuartzCore
import simd
import FieldUICore

// MARK: - FieldSurfaceLayer

/// The render surface — a CALayer the engine draws each frame, the analogue of the
/// managed full-viewport `<canvas>`. Decorative: never animates implicitly.
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
        // underlay stack: heatmap glow → waves + bound shimmer → matter → sparks
        if let hm = frame.heatmap { drawHeatmap(hm, frame, in: ctx) }
        if !frame.waves.isEmpty { drawWaves(frame, in: ctx) }
        switch frame.mode {
        case .dots:        drawDots(frame, in: ctx)
        case .trails:      drawTrails(frame, in: ctx)
        case .links:       drawLinks(frame, in: ctx); drawDots(frame, in: ctx)
        case .metaballs:   drawMetaballs(frame, in: ctx)
        case .voronoi:     drawVoronoi(frame, in: ctx); drawDots(frame, in: ctx)
        case .streamlines: drawStreamlineArrows(frame, in: ctx, raw: false)
        case .none_:       break
        }
        if !frame.sparks.isEmpty { drawSparks(frame, in: ctx) }
        // overlay readings, additive, in declared order
        for overlay in frame.overlays { drawOverlay(overlay, frame, in: ctx) }
    }

    // MARK: shared

    private func fill(_ ctx: CGContext, _ rgb: RGB, _ alpha: Float) {
        ctx.setFillColor(CGColor(red: CGFloat(rgb.x / 255), green: CGFloat(rgb.y / 255),
                                 blue: CGFloat(rgb.z / 255), alpha: CGFloat(clamp(alpha, 0, 1))))
    }

    private func stroke(_ ctx: CGContext, _ rgb: RGB, _ alpha: Float, width: CGFloat = 1) {
        ctx.setStrokeColor(CGColor(red: CGFloat(rgb.x / 255), green: CGFloat(rgb.y / 255),
                                   blue: CGFloat(rgb.z / 255), alpha: CGFloat(clamp(alpha, 0, 1))))
        ctx.setLineWidth(width)
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

    // MARK: matter modes (§20.6)

    private func drawDots(_ frame: RenderFrame, in ctx: CGContext) {
        for p in frame.particles {
            let (x, y) = frame.projection.project(p.position)
            let depth = frame.projection.depthHint(p.position)
            let radius = CGFloat(p.size * (1 + p.heat * 0.8) * (1 - depth * 0.5))
            fill(ctx, particleColor(p, frame), (0.55 + p.heat * 0.4) * (1 - depth * 0.6))
            ctx.fillEllipse(in: CGRect(x: CGFloat(x) - radius, y: CGFloat(y) - radius,
                                       width: radius * 2, height: radius * 2))
        }
    }

    /// Light-painting: each particle drawn as a velocity-stretched streak.
    private func drawTrails(_ frame: RenderFrame, in ctx: CGContext) {
        ctx.setLineCap(.round)
        for p in frame.particles {
            let (x, y) = frame.projection.project(p.position)
            let tail = p.position - p.velocity * 6
            let (tx, ty) = frame.projection.project(tail)
            stroke(ctx, particleColor(p, frame), 0.4 + p.heat * 0.5, width: CGFloat(p.size))
            ctx.move(to: CGPoint(x: CGFloat(tx), y: CGFloat(ty)))
            ctx.addLine(to: CGPoint(x: CGFloat(x), y: CGFloat(y)))
            ctx.strokePath()
        }
    }

    /// Constellation: short lines between close pairs, alpha by separation (linkAlpha).
    private func drawLinks(_ frame: RenderFrame, in ctx: CGContext) {
        let r: Float = 70
        let ps = frame.particles
        for i in 0..<ps.count {
            for j in (i + 1)..<ps.count {
                let d = simd_distance(ps[i].position, ps[j].position)
                let a = linkAlpha(d: d, r: r)
                if a <= 0 { continue }
                let (x1, y1) = frame.projection.project(ps[i].position)
                let (x2, y2) = frame.projection.project(ps[j].position)
                stroke(ctx, frame.accent, a)
                ctx.move(to: CGPoint(x: CGFloat(x1), y: CGFloat(y1)))
                ctx.addLine(to: CGPoint(x: CGFloat(x2), y: CGFloat(y2)))
                ctx.strokePath()
            }
        }
    }

    /// A liquid iso-surface: splat density to a grid, trace one contour with marching squares.
    private func drawMetaballs(_ frame: RenderFrame, in ctx: CGContext) {
        let step: Float = 18
        let cols = Int(frame.volume.width / step) + 2
        let rows = Int(frame.volume.height / step) + 2
        var grid = [Float](repeating: 0, count: cols * rows)
        for p in frame.particles {
            splatDensity(grid: &grid, cols: cols, rows: rows, step: step,
                         px: p.position.x, py: p.position.y, radius: p.size * 14)
        }
        let level: Float = 0.6
        stroke(ctx, frame.accent, 0.7, width: 1.5)
        for gy in 0..<(rows - 1) {
            for gx in 0..<(cols - 1) {
                let segs = marchingCell(
                    tl: grid[gy * cols + gx],       tr: grid[gy * cols + gx + 1],
                    br: grid[(gy + 1) * cols + gx + 1], bl: grid[(gy + 1) * cols + gx],
                    level: level
                )
                for s in segs {
                    ctx.move(to: CGPoint(x: CGFloat((Float(gx) + s.x1) * step), y: CGFloat((Float(gy) + s.y1) * step)))
                    ctx.addLine(to: CGPoint(x: CGFloat((Float(gx) + s.x2) * step), y: CGFloat((Float(gy) + s.y2) * step)))
                }
            }
        }
        ctx.strokePath()
    }

    /// Shattered glass: nearest-site cells, walls between owner changes.
    private func drawVoronoi(_ frame: RenderFrame, in ctx: CGContext) {
        let step: Float = 26
        let cols = Int(frame.volume.width / step) + 1
        let rows = Int(frame.volume.height / step) + 1
        let sites = frame.particles.map { SIMD2<Float>($0.position.x, $0.position.y) }
        var owners = [Int](repeating: -1, count: cols * rows)
        for gy in 0..<rows {
            for gx in 0..<cols {
                owners[gy * cols + gx] = nearestSite(Float(gx) * step, Float(gy) * step, sites: sites)
            }
        }
        stroke(ctx, frame.accent, 0.25)
        for w in voronoiWalls(owners: owners, cols: cols, rows: rows) {
            ctx.move(to: CGPoint(x: CGFloat(w.x1 * step), y: CGFloat(w.y1 * step)))
            ctx.addLine(to: CGPoint(x: CGFloat(w.x2 * step), y: CGFloat(w.y2 * step)))
        }
        ctx.strokePath()
    }

    // MARK: waves + bound shimmer (§2.3/§2.4)

    private func drawWaves(_ frame: RenderFrame, in ctx: CGContext) {
        let W = frame.volume.width
        let H = frame.volume.height
        for w in frame.waves {
            stroke(ctx, w.color, 0.05 + w.depth * 0.1)
            var first = true
            var x: Float = 0
            while x <= W {
                let y = waveYat(w, x: x, time: frame.time, H: H)
                if first {
                    ctx.move(to: CGPoint(x: CGFloat(x), y: CGFloat(y)))
                    first = false
                } else {
                    ctx.addLine(to: CGPoint(x: CGFloat(x), y: CGFloat(y)))
                }
                x += 14
            }
            ctx.strokePath()
        }
        // the bound shimmer riding the lines
        for b in frame.bound {
            guard frame.waves.indices.contains(b.wi) else { continue }
            let w = frame.waves[b.wi]
            let x = b.progress * W
            let y = waveYat(w, x: x, time: frame.time, H: H) + b.phase * 32
            fill(ctx, w.color, b.glow ? 0.5 : 0.25)
            let r = CGFloat(b.size)
            ctx.fillEllipse(in: CGRect(x: CGFloat(x) - r, y: CGFloat(y) - r, width: r * 2, height: r * 2))
        }
    }

    // MARK: sparks (§23)

    private func drawSparks(_ frame: RenderFrame, in ctx: CGContext) {
        for s in frame.sparks {
            let (x, y) = frame.projection.project(s.position)
            let r = CGFloat(0.8 + s.life * 1.6)
            fill(ctx, s.color, s.life * 0.9)
            ctx.fillEllipse(in: CGRect(x: CGFloat(x) - r, y: CGFloat(y) - r, width: r * 2, height: r * 2))
        }
    }

    // MARK: heatmap glow (H1)

    private func drawHeatmap(_ hm: Heatmap, _ frame: RenderFrame, in ctx: CGContext) {
        let cell = hm.cell
        var y: Float = 0
        while y <= frame.volume.height {
            var x: Float = 0
            while x <= frame.volume.width {
                let v = hm.norm(at: Vec3(x, y, 0))
                if v > 0.04 {
                    fill(ctx, frame.accent, v * 0.16)
                    ctx.fill(CGRect(x: CGFloat(x - cell / 2), y: CGFloat(y - cell / 2),
                                    width: CGFloat(cell), height: CGFloat(cell)))
                }
                x += cell
            }
            y += cell
        }
    }

    // MARK: overlay readings (Field Surfaces)

    private func drawOverlay(_ mode: FieldUICore.OverlayMode, _ frame: RenderFrame, in ctx: CGContext) {
        switch mode {
        case .off:           break
        case .streamlines:   drawStreamlineArrows(frame, in: ctx, raw: false)
        case .forceVectors:  drawStreamlineArrows(frame, in: ctx, raw: true)
        case .fieldLines:    drawFieldLines(frame, in: ctx)
        case .grid:          drawDeformedGrid(frame, in: ctx)
        case .temperature:   drawContours(frame, in: ctx) { p in
                                 // accumulated heat near a point (kernel over particles)
                                 var v: Float = 0
                                 for q in frame.particles {
                                     let d = simd_distance(q.position, p)
                                     if d < 60 { v += q.heat * (1 - d / 60) }
                                 }
                                 return v
                             }
        case .energy:        drawContours(frame, in: ctx) { p in
                                 var v: Float = 0
                                 for q in frame.particles {
                                     let d = simd_distance(q.position, p)
                                     if d < 60 { v += 0.5 * q.mass * simd_length_squared(q.velocity) * (1 - d / 60) }
                                 }
                                 return v
                             }
        case .path:          drawPaths(frame, in: ctx)
        case .data:          drawDataReadouts(frame, in: ctx)
        }
    }

    /// Short arrows along the net felt force at a probe lattice. `raw` scales by
    /// magnitude (force-vectors); otherwise normalized direction (streamlines).
    private func drawStreamlineArrows(_ frame: RenderFrame, in ctx: CGContext, raw: Bool) {
        let GRID: Float = 46
        stroke(ctx, frame.accent, 0.4)
        var y = GRID / 2
        while y < frame.volume.height {
            var x = GRID / 2
            while x < frame.volume.width {
                let f = frame.forceSampler(Vec3(x, y, 0))
                let mag = simd_length(f)
                if mag > 1e-6 {
                    let len: Float = raw ? min(mag * 18, GRID * 0.9) : GRID * 0.4
                    let u = f / mag
                    let tip = CGPoint(x: CGFloat(x + u.x * len), y: CGFloat(y + u.y * len))
                    ctx.move(to: CGPoint(x: CGFloat(x), y: CGFloat(y)))
                    ctx.addLine(to: tip)
                    // arrowhead
                    let side = simd_cross(Vec3(u.x, u.y, 0), Vec3(0, 0, 1))
                    ctx.move(to: tip)
                    ctx.addLine(to: CGPoint(x: tip.x - CGFloat((u.x * 0.6 + side.x * 0.4) * 5),
                                            y: tip.y - CGFloat((u.y * 0.6 + side.y * 0.4) * 5)))
                    ctx.move(to: tip)
                    ctx.addLine(to: CGPoint(x: tip.x - CGFloat((u.x * 0.6 - side.x * 0.4) * 5),
                                            y: tip.y - CGFloat((u.y * 0.6 - side.y * 0.4) * 5)))
                }
                x += GRID
            }
            y += GRID
        }
        ctx.strokePath()
    }

    /// Structure-field lines traced from seeds around each field-bearing body.
    private func drawFieldLines(_ frame: RenderFrame, in ctx: CGContext) {
        var opts = FieldLineOpts()
        opts.bounds = (frame.volume.width, frame.volume.height)
        var seeds: [Vec3] = []
        for b in frame.bodies where b.isVisible {
            let r = max(b.range * 0.2, 40)
            for k in 0..<8 {
                let a = Float(k) / 8 * 2 * .pi
                seeds.append(b.center + Vec3(cos(a) * r, sin(a) * r, 0))
            }
        }
        stroke(ctx, frame.accent, 0.35)
        for line in traceFieldLines(frame.fieldSampler, seeds: seeds, opts: opts) {
            ctx.move(to: CGPoint(x: CGFloat(line[0].x), y: CGFloat(line[0].y)))
            for pt in line.dropFirst() {
                ctx.addLine(to: CGPoint(x: CGFloat(pt.x), y: CGFloat(pt.y)))
            }
        }
        ctx.strokePath()
    }

    /// A reference lattice displaced by the local field — the deformation reading.
    private func drawDeformedGrid(_ frame: RenderFrame, in ctx: CGContext) {
        let GRID: Float = 44
        stroke(ctx, frame.accent, 0.22)
        var y: Float = 0
        while y <= frame.volume.height {
            var first = true
            var x: Float = 0
            while x <= frame.volume.width {
                let f = frame.forceSampler(Vec3(x, y, 0))
                let pt = CGPoint(x: CGFloat(x + clamp(f.x, -1, 1) * 10), y: CGFloat(y + clamp(f.y, -1, 1) * 10))
                if first { ctx.move(to: pt); first = false } else { ctx.addLine(to: pt) }
                x += GRID / 2
            }
            y += GRID
        }
        var x: Float = 0
        while x <= frame.volume.width {
            var first = true
            var y2: Float = 0
            while y2 <= frame.volume.height {
                let f = frame.forceSampler(Vec3(x, y2, 0))
                let pt = CGPoint(x: CGFloat(x + clamp(f.x, -1, 1) * 10), y: CGFloat(y2 + clamp(f.y, -1, 1) * 10))
                if first { ctx.move(to: pt); first = false } else { ctx.addLine(to: pt) }
                y2 += GRID / 2
            }
            x += GRID
        }
        ctx.strokePath()
    }

    /// Iso-contour lines of a scalar sampler (temperature / energy readings).
    private func drawContours(_ frame: RenderFrame, in ctx: CGContext, sampler: (Vec3) -> Float) {
        let step: Float = 36
        let cols = Int(frame.volume.width / step) + 2
        let rows = Int(frame.volume.height / step) + 2
        var grid = [Float](repeating: 0, count: cols * rows)
        var peak: Float = 1e-6
        for gy in 0..<rows {
            for gx in 0..<cols {
                let v = sampler(Vec3(Float(gx) * step, Float(gy) * step, 0))
                grid[gy * cols + gx] = v
                peak = max(peak, v)
            }
        }
        stroke(ctx, frame.accent, 0.4)
        for level in [0.25, 0.5, 0.75] {
            let iso = Float(level) * peak
            for gy in 0..<(rows - 1) {
                for gx in 0..<(cols - 1) {
                    for s in marchingCell(
                        tl: grid[gy * cols + gx],       tr: grid[gy * cols + gx + 1],
                        br: grid[(gy + 1) * cols + gx + 1], bl: grid[(gy + 1) * cols + gx],
                        level: iso
                    ) {
                        ctx.move(to: CGPoint(x: CGFloat((Float(gx) + s.x1) * step), y: CGFloat((Float(gy) + s.y1) * step)))
                        ctx.addLine(to: CGPoint(x: CGFloat((Float(gx) + s.x2) * step), y: CGFloat((Float(gy) + s.y2) * step)))
                    }
                }
            }
        }
        ctx.strokePath()
    }

    /// Streamline curves integrated from seeded probes — vector flow traced over distance.
    private func drawPaths(_ frame: RenderFrame, in ctx: CGContext) {
        var opts = FieldLineOpts()
        opts.bounds = (frame.volume.width, frame.volume.height)
        opts.maxSteps = 120
        var seeds: [Vec3] = []
        let n = 6
        for i in 0..<n {
            for j in 0..<n {
                seeds.append(Vec3((Float(i) + 0.5) / Float(n) * frame.volume.width,
                                  (Float(j) + 0.5) / Float(n) * frame.volume.height, 0))
            }
        }
        stroke(ctx, frame.accent, 0.3)
        for line in traceFieldLines(frame.forceSampler, seeds: seeds, opts: opts) {
            ctx.move(to: CGPoint(x: CGFloat(line[0].x), y: CGFloat(line[0].y)))
            for pt in line.dropFirst() {
                ctx.addLine(to: CGPoint(x: CGFloat(pt.x), y: CGFloat(pt.y)))
            }
        }
        ctx.strokePath()
    }

    /// Per-body density readout: a ring whose fill arc reads the eased density d.
    private func drawDataReadouts(_ frame: RenderFrame, in ctx: CGContext) {
        for b in frame.bodies where b.isVisible && b.feedback {
            let c = CGPoint(x: CGFloat(b.center.x), y: CGFloat(b.center.y))
            let r: CGFloat = 14
            stroke(ctx, frame.accent, 0.3, width: 2)
            ctx.addEllipse(in: CGRect(x: c.x - r, y: c.y - r, width: r * 2, height: r * 2))
            ctx.strokePath()
            stroke(ctx, frame.accent, 0.9, width: 2)
            ctx.addArc(center: c, radius: r, startAngle: -.pi / 2,
                       endAngle: -.pi / 2 + CGFloat(b.d) * 2 * .pi, clockwise: false)
            ctx.strokePath()
        }
    }
}

// MARK: - CoreGraphicsFieldRenderer

/// The CALayer-backed render backend for iOS and macOS.
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
