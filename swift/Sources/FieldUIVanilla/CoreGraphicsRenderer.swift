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

    /// Hybrid composition flags (HybridFieldRenderer): when the Metal layer beneath
    /// covers a pass, the CG layer skips it so nothing draws twice.
    /// `skipAmbient` — waves, the bound shimmer, and sparks.
    public var skipAmbient = false
    /// `skipMatter` — the particle layer (dots/trails/links).
    public var skipMatter = false

    public override init() {
        super.init()
        isOpaque = false
        drawsAsynchronously = true // CA executes the CG command stream off the main thread
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
        if !skipAmbient, !frame.waves.isEmpty { drawWaves(frame, in: ctx) }
        if !skipMatter { // the hybrid sets this exactly when Metal owns dots/trails/links
            switch frame.mode {
            case .dots:        drawDots(frame, in: ctx)
            case .trails:      drawTrails(frame, in: ctx)
            case .links:       drawLinks(frame, in: ctx); drawDots(frame, in: ctx)
            case .metaballs:   drawMetaballs(frame, in: ctx)
            case .voronoi:     drawVoronoi(frame, in: ctx); drawDots(frame, in: ctx)
            case .streamlines: drawStreamlineArrows(frame, in: ctx, raw: false)
            case .none_:       break
            }
        }
        if !skipAmbient, !frame.sparks.isEmpty { drawSparks(frame, in: ctx) }
        // overlay readings, additive, in declared order
        for overlay in frame.overlays { drawOverlay(overlay, frame, in: ctx) }
    }

    // MARK: shared
    // setFillColor(red:green:blue:alpha:) writes components straight into graphics state —
    // no CGColor object per call. At ~500 fills/frame the CGColor allocation churn of the
    // old path was a measurable slice of draw time.

    private func fill(_ ctx: CGContext, _ rgb: RGB, _ alpha: Float) {
        ctx.setFillColor(red: CGFloat(rgb.x / 255), green: CGFloat(rgb.y / 255),
                         blue: CGFloat(rgb.z / 255), alpha: CGFloat(clamp(alpha, 0, 1)))
    }

    private func stroke(_ ctx: CGContext, _ rgb: RGB, _ alpha: Float, width: CGFloat = 1) {
        ctx.setStrokeColor(red: CGFloat(rgb.x / 255), green: CGFloat(rgb.y / 255),
                           blue: CGFloat(rgb.z / 255), alpha: CGFloat(clamp(alpha, 0, 1)))
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

    /// Batched by quantized color: hundreds of per-dot setFillColor + fillEllipse calls
    /// collapse into one path-fill per color bucket (~20–40 buckets a frame). Each CG
    /// state change + fill flushes the rasterizer; batching is the difference between
    /// a CPU renderer that keeps 60fps and one that doesn't.
    private func drawDots(_ frame: RenderFrame, in ctx: CGContext) {
        var buckets: [UInt32: CGMutablePath] = [:]
        var colors: [UInt32: (RGB, Float)] = [:]
        for p in frame.particles {
            let (x, y) = frame.projection.project(p.position)
            let depth = frame.projection.depthHint(p.position)
            let radius = CGFloat(p.size * (1 + p.heat * 0.8) * (1 - depth * 0.5))
            let rgb = particleColor(p, frame)
            let alpha = clamp((0.55 + p.heat * 0.4) * (1 - depth * 0.6), 0, 1)
            // quantize to 16 levels/channel + 16 alpha steps → a stable, small bucket set
            let k = ((UInt32(rgb.x) >> 4) << 12) | ((UInt32(rgb.y) >> 4) << 8)
                  | ((UInt32(rgb.z) >> 4) << 4) | UInt32(alpha * 15)
            let path = buckets[k] ?? {
                let p = CGMutablePath()
                buckets[k] = p
                colors[k] = (rgb, alpha)
                return p
            }()
            path.addEllipse(in: CGRect(x: CGFloat(x) - radius, y: CGFloat(y) - radius,
                                       width: radius * 2, height: radius * 2))
        }
        for (k, path) in buckets {
            let (rgb, alpha) = colors[k]!
            fill(ctx, rgb, alpha)
            ctx.addPath(path)
            ctx.fillPath()
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
    /// Bucketed by a cell grid of the link radius — O(n·k) instead of the all-pairs O(n²)
    /// that dominated this mode's frame time at high densities.
    private func drawLinks(_ frame: RenderFrame, in ctx: CGContext) {
        let r: Float = 90 // match the JS connection radius (field.ts links R)
        let ps = frame.particles
        @inline(__always) func key(_ cx: Int32, _ cy: Int32) -> Int64 {
            (Int64(cx) << 32) | (Int64(cy) & 0xFFFF_FFFF)
        }
        var buckets: [Int64: [Int]] = [:]
        buckets.reserveCapacity(ps.count)
        for (i, p) in ps.enumerated() {
            buckets[key(Int32(p.position.x / r), Int32(p.position.y / r)), default: []].append(i)
        }
        // Collect segments grouped by quantized alpha, then stroke each segment as its
        // OWN tiny path with the color set once per group. Two truths shape this:
        // per-pair state changes are expensive (the original 46ms), AND many crossing
        // segments union'd into one stroke path explode CG's AA intersection pass (the
        // batched version was worse). A 2-point path cannot self-intersect — per-segment
        // strokes inside per-alpha groups dodge both costs.
        var groups: [[(CGFloat, CGFloat, CGFloat, CGFloat)]] = Array(repeating: [], count: 12)
        for (i, p) in ps.enumerated() {
            let cx = Int32(p.position.x / r)
            let cy = Int32(p.position.y / r)
            for dx: Int32 in -1...1 {
                for dy: Int32 in -1...1 {
                    guard let bin = buckets[key(cx + dx, cy + dy)] else { continue }
                    for j in bin where j > i { // each undirected pair once
                        let a = linkAlpha(d: simd_distance(p.position, ps[j].position), r: r)
                        if a <= 0 { continue }
                        let (x1, y1) = frame.projection.project(p.position)
                        let (x2, y2) = frame.projection.project(ps[j].position)
                        let q = min(11, Int(a / 0.12 * 12))
                        groups[q].append((CGFloat(x1), CGFloat(y1), CGFloat(x2), CGFloat(y2)))
                    }
                }
            }
        }
        for (q, segs) in groups.enumerated() where !segs.isEmpty {
            stroke(ctx, frame.accent, (Float(q) + 0.5) / 12 * 0.12)
            for s in segs {
                ctx.move(to: CGPoint(x: s.0, y: s.1))
                ctx.addLine(to: CGPoint(x: s.2, y: s.3))
                ctx.strokePath()
            }
        }
    }

    /// A liquid iso-surface: splat density to a grid, trace one contour with marching squares.
    private func drawMetaballs(_ frame: RenderFrame, in ctx: CGContext) {
        let step: Float = 16 // JS STEP
        let cols = Int(frame.volume.width / step) + 2
        let rows = Int(frame.volume.height / step) + 2
        var grid = [Float](repeating: 0, count: cols * rows)
        for p in frame.particles {
            splatDensity(grid: &grid, cols: cols, rows: rows, step: step,
                         px: p.position.x, py: p.position.y, radius: 34) // JS RAD (fixed, not size-scaled)
        }
        let level: Float = 0.9 // JS LEVEL
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
        let step: Float = 18 // JS STEP — match wall density
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
        case .temperature:   drawContours(frame, in: ctx) { $0.heat }
        case .energy:        drawContours(frame, in: ctx) { 0.5 * $0.mass * simd_length_squared($0.velocity) }
        case .path:          drawPaths(frame, in: ctx)
        case .data:          drawDataReadouts(frame, in: ctx)
        }
    }

    /// Short arrows along the net felt force at a probe lattice. `raw` scales by
    /// magnitude (force-vectors); otherwise normalized direction (streamlines).
    private func drawStreamlineArrows(_ frame: RenderFrame, in ctx: CGContext, raw: Bool) {
        let GRID: Float = 44 // match the JS overlay arrow lattice
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

    /// Structure-field lines traced through the NET field, seeded by each body's actual
    /// field geometry — the site's algorithm (apps/site field-probe traceDipole), made
    /// multi-body:
    ///
    ///   · DIPOLE bodies (magnetism): seed along the perpendicular bisector of the
    ///     heading axis — the centre plus ring offsets either side. Each offset lies on
    ///     a distinct nested field line, so tracing both directions closes one clean
    ///     N→S loop per seed: the bar-magnet diagram.
    ///   · MONOPOLE bodies (charge, gravity): seed a tight ring around the core — the
    ///     radial-spokes diagram (out of +, into −; inward for gravity).
    ///   · other field()-bearing bodies: a ring fallback.
    ///
    /// Tracing samples the superposition (frame.fieldSampler), so lines between two
    /// magnets link them — the geometry between bodies emerges, never drawn by hand.
    ///
    /// One stroke PER polyline, never one giant path: CG's antialiaser computes segment
    /// intersections, and accumulated self-crossing loops drove `aa_intersection_event`
    /// superlinear (~3 s/frame). Per-line strokes keep the cost linear; the turn budget
    /// stops genuine orbits in combined fields without truncating a closed loop (which
    /// turns exactly one revolution).
    private func drawFieldLines(_ frame: RenderFrame, in ctx: CGContext) {
        var opts = FieldLineOpts()
        opts.bounds = (frame.volume.width, frame.volume.height)
        opts.step = 5
        opts.maxSteps = 500
        opts.maxTurns = 2.25

        // seeds from each body's actual field geometry (core fieldLineSeeds): dipole
        // bisector for magnetism, monopole ring for charge/gravity, NONE for bodies that
        // radiate nothing — so an attract-only card no longer starbursts a neighbour's well.
        let seeds = fieldLineSeeds(bodies: frame.bodies)

        stroke(ctx, frame.accent, 0.35)
        for line in traceFieldLines(frame.fieldSampler, seeds: seeds, opts: opts) {
            ctx.move(to: CGPoint(x: CGFloat(line[0].x), y: CGFloat(line[0].y)))
            for pt in line.dropFirst() {
                ctx.addLine(to: CGPoint(x: CGFloat(pt.x), y: CGFloat(pt.y)))
            }
            ctx.strokePath() // stroke THIS line; do not accumulate
        }
    }

    /// A reference lattice displaced by the local field — the deformation reading.
    ///
    /// The displacement is the field DIRECTION times a power-compressed, peak-normalized
    /// magnitude: `dir · (|f|/peak)^0.4 · maxDisp`. Two problems the naive
    /// `clamp(f, -1, 1)·10` had, both fixed here:
    ///   · scale — a designed force (attract ≈ 0.3) and a real law (gravity ≈ M/d²)
    ///     differ 100×, so the fixed clamp rendered gravity sub-pixel. Peak-normalizing
    ///     makes any field scale read.
    ///   · falloff shape — gravity's 1/d² spikes at the body and is ~0 elsewhere, so even
    ///     normalized it gave one dimple, not a well. The 0.4 power lifts the weak-field
    ///     deflections (at 4× distance, |f| = peak/16 → still 0.30·maxDisp) into the
    ///     rubber-sheet funnel everyone reads as a gravity well.
    private func drawDeformedGrid(_ frame: RenderFrame, in ctx: CGContext) {
        let GRID: Float = 44
        let SUB = GRID / 2
        let maxDisp: Float = 18
        let cols = Int(frame.volume.width / SUB) + 1
        let rows = Int(frame.volume.height / SUB) + 1

        // pass 1: sample the field at every lattice node, track the peak magnitude
        var fx = [Float](repeating: 0, count: cols * rows)
        var fy = [Float](repeating: 0, count: cols * rows)
        var peak: Float = 1e-6
        for gy in 0..<rows {
            for gx in 0..<cols {
                let f = frame.forceSampler(Vec3(Float(gx) * SUB, Float(gy) * SUB, 0))
                let i = gy * cols + gx
                fx[i] = f.x
                fy[i] = f.y
                peak = max(peak, simd_length(f))
            }
        }

        @inline(__always) func node(_ gx: Int, _ gy: Int) -> CGPoint {
            let i = gy * cols + gx
            let mag = sqrt(fx[i] * fx[i] + fy[i] * fy[i])
            guard mag > 1e-9 else { return CGPoint(x: CGFloat(Float(gx) * SUB), y: CGFloat(Float(gy) * SUB)) }
            let disp = pow(mag / peak, 0.4) * maxDisp // power-compressed so weak field still reads
            return CGPoint(x: CGFloat(Float(gx) * SUB + (fx[i] / mag) * disp),
                           y: CGFloat(Float(gy) * SUB + (fy[i] / mag) * disp))
        }

        stroke(ctx, frame.accent, 0.22)
        // horizontal lines (every other row, fine columns)
        for gy in stride(from: 0, to: rows, by: 2) {
            ctx.move(to: node(0, gy))
            for gx in 1..<cols { ctx.addLine(to: node(gx, gy)) }
        }
        // vertical lines (every other column, fine rows)
        for gx in stride(from: 0, to: cols, by: 2) {
            ctx.move(to: node(gx, 0))
            for gy in 1..<rows { ctx.addLine(to: node(gx, gy)) }
        }
        ctx.strokePath()
    }

    /// Iso-contour lines of a per-particle scalar (temperature / energy readings).
    /// Splat-based: each particle deposits its weighted kernel into the node grid ONCE —
    /// O(particles × kernel nodes) instead of the O(nodes × particles) sweep that made
    /// these the most expensive readings by an order of magnitude.
    private func drawContours(_ frame: RenderFrame, in ctx: CGContext, weight: (Particle) -> Float) {
        let step: Float = 36
        let cols = Int(frame.volume.width / step) + 2
        let rows = Int(frame.volume.height / step) + 2
        var grid = [Float](repeating: 0, count: cols * rows)
        for q in frame.particles {
            let w = weight(q)
            if w > 1e-5 {
                splatDensity(grid: &grid, cols: cols, rows: rows, step: step,
                             px: q.position.x, py: q.position.y, radius: 60, weight: w)
            }
        }
        var peak: Float = 1e-6
        for v in grid where v > peak { peak = v }
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
        opts.maxTurns = 1.5  // orbital paths circle a well forever otherwise (same AA explosion)
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
            ctx.strokePath() // per-line stroke — same AA-intersection fix as field-lines
        }
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
