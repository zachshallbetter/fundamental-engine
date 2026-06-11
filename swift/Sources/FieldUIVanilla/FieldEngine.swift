import Foundation
import simd
import FieldUICore
import FieldUIPlatform

/// Eased target density for a body from its per-frame `count` (§8) — feedback.ts port.
func feedbackTarget(count: Float, engaged: Bool) -> Float {
    clamp(count / 20 + (engaged ? 0.45 : 0), 0, 1)
}

/// The concrete FieldHandle implementation — the running engine instance: the Swift
/// counterpart of the field closure `createField` builds in @field-ui/core.
///
/// Owns the particle pool, the carrier waves + bound reservoir, the spark pool, the
/// scalar grids, the per-frame step, feedback easing, attention/causality, and the
/// display loop. Rendering is delegated through the FieldRenderer seam.
final class FieldEngine: FieldHandle {

    private let host: any FieldHost
    private var options: FieldOptions
    private let registry: Registry
    private let store: FieldStore
    private let env: Env
    private var loopToken: AnyObject?

    /// The render backend, if the mount provides one (signals-only when nil).
    var renderer: (any FieldRenderer)?

    // Simulation state
    private var bodies: [Body] = []
    private var formTarget: Formation
    private var accent: RGB
    private var visible = true
    private var startTime: TimeInterval?
    private var lastScrollY: Float = 0
    private var scrollVel: Float = 0
    private var focused: Particle?
    private var seeded: [AtomPayload] = []
    private let spawnCeiling: Int
    private var unsubscribers: [() -> Void] = []

    // Currents (§2.3) + the bound↔free reservoir (§2.4)
    private var waves: [Wave] = []
    private var bound: [BoundParticle] = []
    private var boundTarget: Int = 0

    // Sparks (§23), flow focus, grids (§20.1 [C]), heatmap (H1)
    private var sparks: [Spark] = []
    private var flow: FlowFocus?
    private var threadLinks: [ThreadLink] = []
    private var grids: [String: ScalarGridImpl] = [:]
    private var heatmap: Heatmap?

    init(host: any FieldHost, options: FieldOptions, registry: Registry = .standard()) {
        self.host = host
        self.options = options
        self.registry = registry
        self.store = FieldStore()
        self.env = Env()
        self.accent = hexToRgb(options.accent ?? "#4da3ff")
        self.formTarget = formation(named: "ambient")!.preset
        let density = max(options.density ?? 1, 0)
        self.spawnCeiling = Int((130 * density).rounded()) * 4

        env.form = formTarget
        env.dt = host.prefersReducedMotion ? 0 : 1
        wireEnvServices()
        build()
        start()

        unsubscribers.append(host.onResize { [weak self] in self?.build() })
        unsubscribers.append(host.onScroll { [weak self] in self?.sampleScroll() })
    }

    // MARK: Env services (the closures the JS env carries)

    private func wireEnvServices() {
        env.spawn = { [weak self] p in
            guard let self, self.store.size < self.spawnCeiling else { return }
            self.store.add(p)
        }
        env.neighbors = { [weak self] p, r in
            self?.store.neighbors(p, r: r) ?? []
        }
        env.spark = { [weak self] at, power, color in
            self?.spawnSpark(at: at, power: power, color: color)
        }
        // scalar field-buffer service (§20.1 class [C]): created on demand, so a field
        // with no diffuse/propagate body allocates nothing. Grids named "wave…" use the
        // wave scheme, "memory…" the slow-decay scheme; everything else diffuses.
        env.grid = { [weak self] name in
            guard let self else { return NoopGrid() }
            if let g = self.grids[name] { return g }
            let vol = self.host.volume
            let mode: GridMode = name.hasPrefix("wave") ? .wave : name.hasPrefix("memory") ? .memory : .diffuse
            let g = ScalarGridImpl(width: vol.width, height: vol.height, mode: mode)
            self.grids[name] = g
            return g
        }
        env.supernova = { [weak self] b in
            guard let self else { return }
            // release exactly what was captured — radial, from the core (§6.9). Held matter
            // is conserved: released particles stay in the pool.
            let released = Set(releaseCaptured(self.store.particles, from: b).map(ObjectIdentifier.init))
            // the blast shoves nearby *free* matter outward (but not what it just released).
            for q in self.store.particles where !released.contains(ObjectIdentifier(q)) {
                let d3 = q.position - b.center
                let d = max(simd_length(d3), 1)
                if d < 320 {
                    let f = (1 - d / 320) * 4
                    q.velocity += (d3 / d) * f
                    q.heat = max(q.heat, 0.8)
                }
            }
            // the blast also tears nearby bound matter off the Currents (§6.9, §2.4).
            let vol = self.host.volume
            tearBoundNear(bound: &self.bound, waves: self.waves, center: b.center, radius: 320,
                          W: vol.width, H: vol.height, time: self.env.t) { self.env.spawn($0) }
        }
    }

    /// Spark pool (§23) — capped, skipped under reduced motion.
    private func spawnSpark(at: Vec3, power: Float, color: String?) {
        if host.prefersReducedMotion || sparks.count > 260 { return }
        let c: RGB = color.map(hexToRgb) ?? WARM
        let n = sparkCount(power: power)
        for _ in 0..<n {
            let a = Float.random(in: 0..<6.28318)
            let s = 0.8 + Float.random(in: 0..<1) * (power > 0 ? power : 1) * 1.7
            sparks.append(Spark(position: at, velocity: Vec3(cos(a) * s, sin(a) * s, 0), life: 1, color: c))
        }
    }

    // MARK: Pool build (§2.5)

    /// (Re)build the base pool — 130×density free particles, the waves, and the bound
    /// shimmer (16×density riders per wave), exactly the JS counts.
    private func build() {
        let density = max(options.density ?? 1, 0)
        store.clear()
        for _ in 0..<Int((130 * density).rounded()) {
            store.add(newParticle())
        }
        applySeed()

        if options.waves {
            waves = buildWaves(palette: [accent, COOL, WARM])
            bound = buildBound(waveCount: waves.count, density: density) { Float.random(in: 0..<1) }
            boundTarget = bound.count
        } else {
            waves = []
            bound = []
            boundTarget = 0
        }

        let vol = host.volume
        for g in grids.values { g.resize(width: vol.width, height: vol.height) }
        heatmap?.resize(width: vol.width, height: vol.height)
    }

    private func newParticle(at position: Vec3? = nil) -> Particle {
        let vol = host.volume
        let size = 0.7 + Float.random(in: 0..<1) * 1.8
        let p = Particle(
            position: position ?? Vec3(
                Float.random(in: 0..<1) * vol.width,
                Float.random(in: 0..<1) * vol.height,
                vol.depth > 0 ? Float.random(in: 0..<1) * vol.depth : 0
            ),
            velocity: Vec3(
                (Float.random(in: 0..<1) - 0.5) * 0.25,
                (Float.random(in: 0..<1) - 0.5) * 0.18,
                vol.depth > 0 ? (Float.random(in: 0..<1) - 0.5) * 0.18 : 0
            ),
            mass: 1,
            heat: 0,
            size: size,
            gx: Float.random(in: 0..<1),
            gy: Float.random(in: 0..<1),
            gz: Float.random(in: 0..<1)
        )
        if options.firstClassMass { p.mass = size }
        return p
    }

    /// Round-robin the seeded records onto the base pool; weight scales mass + size.
    private func applySeed() {
        guard !seeded.isEmpty else { return }
        for (i, p) in store.particles.enumerated() {
            let atom = seeded[i % seeded.count]
            p.atom = atom
            if let w = atom.weight {
                let k = 0.6 + clamp(w, 0, 1) * 1.4
                p.size = (0.7 + 1.8 * 0.5) * k
                if options.firstClassMass { p.mass = p.size }
            }
        }
    }

    // MARK: Loop

    private func start() {
        loopToken = host.scheduleFrame { [weak self] timestamp in
            self?.tick(at: timestamp)
        }
    }

    private func tick(at timestamp: TimeInterval) {
        guard !host.isHidden else { return }
        if startTime == nil { startTime = timestamp }
        let vol = host.volume

        // env frame state
        env.volume = vol.size3
        env.t = Float(timestamp - startTime!)
        env.frameN += 1
        env.dt = host.prefersReducedMotion ? 0 : 1
        scrollVel = scrollVel * 0.7 + abs(host.scrollY - lastScrollY) * 0.3
        lastScrollY = host.scrollY
        env.scrollV = scrollVel

        // formation easing (§7)
        easeFormation(&env.form, toward: formTarget)

        // refresh body geometry + visibility from the host (the read phase), and resolve
        // warp pairings (§22.3) into live relocate targets.
        for b in bodies {
            if let view = b.view, let box = host.worldBox(of: view) {
                b.box = box
                b.isVisible = boxVisible(box, in: vol)
            }
            if let pair = b.pairBody {
                b.warpTarget = pair.center
                b.warpHas = true
            } else {
                b.warpHas = false
            }
        }

        // conserved attention (§2.4): one finite strength budget across the live bodies.
        if options.attention {
            let muls = attentionMuls(bodies.map { AttnInput(strength: $0.strength, on: $0.isEngaged) })
            for (i, b) in bodies.enumerated() { b.attn = muls[i] }
        } else {
            for b in bodies { b.attn = nil }
        }

        // charge induction (§20.10): charge/magnetism bodies polarize neutral matter.
        induceCharges(bodies: bodies, particles: store.particles)

        // simulate
        store.reindex()
        step(StepInput(store: store, bodies: bodies, env: env,
                       forces: registry.forces, conditions: registry.conditions,
                       waves: waves.isEmpty ? nil : waves))

        // flow focus: pull free matter toward the target (gain 0.6, the JS particle gain).
        if let flow {
            for p in store.particles where p.cap == nil {
                p.velocity += flowBias(at: p.position, focus: flow)
            }
        }

        // the bound↔free reservoir (§2.4): forces tear bound matter loose; calm free
        // matter heals back onto the lines, up to the build target.
        if !waves.isEmpty && env.dt != 0 {
            tearBoundByForces(bound: &bound, waves: waves, bodies: bodies, forces: registry.forces,
                              W: vol.width, H: vol.height, time: env.t) { self.env.spawn($0) }
            healWaves(store: store, bound: &bound, boundTarget: boundTarget, waves: waves,
                      W: vol.width, H: vol.height, time: env.t) { Float.random(in: 0..<1) }
        }

        // advance the scalar grids (diffuse blur / wave leapfrog / memory decay).
        for g in grids.values { g.step() }

        // density heatmap (H1), when enabled.
        if options.heatmap {
            if heatmap == nil { heatmap = Heatmap(width: vol.width, height: vol.height) }
            heatmap!.update(particles: store.particles)
        }

        // spark decay (§23) — drift, damp, fade, drop.
        if !sparks.isEmpty {
            for i in sparks.indices {
                sparks[i].position += sparks[i].velocity
                sparks[i].velocity *= 0.92
                sparks[i].life -= 0.04
            }
            sparks.removeAll { $0.life <= 0 }
        }

        // feedback easing (§8) + measured thermodynamics + cross-boundary causality.
        for b in bodies where b.feedback {
            let target = feedbackTarget(count: b.count, engaged: b.isEngaged)
            b.d += (target - b.d) * 0.08
            if b.thermo != nil { b.metrics = thermoMetrics(b.thermo) }
        }
        if options.causality {
            let feedbackBodies = bodies.filter { $0.feedback }
            let deltas = spillover(feedbackBodies.map { SpillBody(d: $0.d, center: $0.center) })
            for (i, b) in feedbackBodies.enumerated() {
                emitFeedback(b, lit: clamp(b.d + deltas[i], 0, 1))
            }
        } else {
            for b in bodies where b.feedback { emitFeedback(b, lit: nil) }
        }

        // hold the focused particle still (the dwell affordance).
        if let focused {
            focused.velocity = .zero
            focused.heat = 1
        }

        // render (skipped while invisible or signals-only — the sim stays live).
        if visible, options.render != .none_, let renderer {
            let bodiesRef = bodies
            let forcesRef = registry.forces
            let envRef = env
            renderer.render(frame: RenderFrame(
                particles: store.particles, bodies: bodies, accent: accent,
                mode: options.render, projection: host.projection, volume: vol,
                time: env.t, waves: waves, bound: bound, sparks: sparks,
                heatmap: options.heatmap ? heatmap : nil,
                overlays: activeOverlays(),
                forceSampler: { forceAt(bodies: bodiesRef, forces: forcesRef, env: envRef, at: $0) },
                fieldSampler: { netField(bodies: bodiesRef, forces: forcesRef, at: $0) },
                flow: flow, threads: resolvedThreads()
            ))
        }
    }

    /// Route a body's per-frame channels to the configured sink (Phase D3 seam) — the
    /// Swift counterpart of the CSS-variable write-back.
    private func emitFeedback(_ b: Body, lit: Float?) {
        guard let sink = options.feedbackSink, let view = b.view else { return }
        var ch = FeedbackChannels()
        ch.density = b.d
        ch.load = sinkLoad(b)
        ch.lit = lit
        if let m = b.metrics {
            ch.entropy = m.entropy
            ch.coherence = m.coherence
            ch.temperature = m.temperature
        }
        if options.heatmap, let hm = heatmap {
            ch.heatmapDensity = hm.norm(at: b.center)
        }
        sink(view, ch)
    }

    private func activeOverlays() -> [OverlayMode] {
        switch options.overlay {
        case .single(let m): return m == .off ? [] : [m]
        case .stack(let ms): return ms.filter { $0 != .off }
        }
    }

    private func boxVisible(_ box: Box, in vol: FieldVolume) -> Bool {
        let mn = box.center - box.halfExtents
        let mx = box.center + box.halfExtents
        return mx.x > 0 && mn.x < vol.width && mx.y > 0 && mn.y < vol.height
    }

    private func sampleScroll() {
        // scroll velocity is sampled per-frame in tick(); the event keeps the loop honest.
    }

    // MARK: FieldHandle

    func scan() {
        bodies = host.scanBodies()
    }

    func rescan() { scan() }

    func setAccent(_ hex: String) {
        options.accent = hex
        accent = hexToRgb(hex)
    }

    func setPalette(_ palette: [String]) { options.palette = palette }
    func setRender(_ mode: RenderMode)   { options.render = mode }

    func setOverlay(_ input: OverlayInput) {
        options.overlay = input
    }

    func setFormation(_ name: String) {
        if let def = formation(named: name) { formTarget = def.preset }
    }

    func setAttention(_ on: Bool) { options.attention = on }
    func setCausality(_ on: Bool) { options.causality = on }
    func setHeatmap(_ on: Bool)   { options.heatmap = on }

    /// Glowing connectors (§10): store the links; they're resolved to live body positions and
    /// drawn (with travelling pulses) each frame. `nil` clears them.
    func threads(_ list: [ThreadLink]?) { threadLinks = list ?? [] }

    /// Resolve each link's view endpoints to the current centers of their bodies — the segments
    /// the renderer draws. A link whose endpoints aren't both live bodies this frame is dropped.
    private func resolvedThreads() -> [ThreadSegment] {
        guard !threadLinks.isEmpty else { return [] }
        return threadLinks.compactMap { link in
            guard let a = bodies.first(where: { $0.view === link.a })?.center,
                  let b = bodies.first(where: { $0.view === link.b })?.center else { return nil }
            return ThreadSegment(a: a, b: b, color: link.color)
        }
    }

    /// Discrete one-shot: shove + heat nearby matter, optionally tint it (§11).
    func burst(at position: Vec3, color: String? = nil) {
        let R: Float = 160
        for q in store.particles {
            let (dv, heat) = burstImpulse(delta: q.position - position, r: R)
            if heat == 0 { continue }
            q.velocity += dv
            q.heat = max(q.heat, heat)
            if let color { q.color = color } // carried pigment (§20.8)
        }
        // detach nearby bound matter so the shock is actually felt (§2.4)
        let vol = host.volume
        tearBoundNear(bound: &bound, waves: waves, center: position, radius: R,
                      W: vol.width, H: vol.height, time: env.t) { self.env.spawn($0) }
        spawnSpark(at: position, power: 2, color: color) // a visible pop at the blast (§23)
    }

    /// Place or move the flow focus (§flowTo) — retarget every frame to follow a path.
    func flowTo(_ position: Vec3, strength: Float? = nil) {
        flow = makeFlowFocus(at: position, strength: strength)
    }

    func clearFlow() {
        flow = nil
    }

    func seed(_ atoms: [AtomPayload]) {
        seeded = atoms
        applySeed()
    }

    func atomAt(_ position: Vec3) -> AtomPayload? {
        nearestSeeded(to: position)?.atom
    }

    func focusAt(_ position: Vec3) -> AtomPayload? {
        guard let p = nearestSeeded(to: position) else {
            clearFocus()
            return nil
        }
        focused = p
        p.velocity = .zero
        p.heat = 1
        return p.atom
    }

    func clearFocus() {
        focused = nil
    }

    private func nearestSeeded(to position: Vec3) -> Particle? {
        var best: Particle?
        var bestD: Float = 24 * 24
        for p in store.particles where p.atom != nil {
            let d2 = simd_length_squared(p.position - position)
            if d2 < bestD {
                bestD = d2
                best = p
            }
        }
        return best
    }

    func particleCount() -> Int { store.size }

    func energy() -> EnergyReport { energyReport(store.particles) }

    func scrollV() -> Float { scrollVel }

    func setVisible(_ on: Bool) { visible = on }

    func destroy() {
        if let token = loopToken { host.cancelFrame(token) }
        loopToken = nil
        for unsub in unsubscribers { unsub() }
        unsubscribers.removeAll()
        store.clear()
        sparks.removeAll()
        bound.removeAll()
        grids.removeAll()
    }
}
