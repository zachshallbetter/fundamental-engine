import Foundation
import simd
import FieldUICore
import FieldUIPlatform

/// Eased target density for a body from its per-frame `count` (§8) — feedback.ts port.
func feedbackTarget(count: Float, engaged: Bool) -> Float {
    clamp(count / 20 + (engaged ? 0.45 : 0), 0, 1)
}

/// The concrete FieldHandle implementation — the running engine instance.
/// Equivalent to the field closure `createField` builds in @field-ui/core.
///
/// Owns the particle pool, the per-frame step, feedback easing, and the display loop.
/// Rendering is delegated through the FieldRenderer seam; the host supplies geometry,
/// scanning, and frame scheduling.
final class FieldEngine: FieldHandle {

    private let host: any FieldHost
    private var options: FieldOptions
    private let registry: Registry
    private let store: FieldStore
    private let env: Env
    private var loopToken: AnyObject?

    /// The render backend, if the mount provides one (signals-only when nil — render "none").
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
        }
        // spark + grid stay at their defaults until the spark pool / scalar grid land.
    }

    // MARK: Pool build (§2.5)

    /// (Re)build the base particle pool — `130 × density` particles, exactly the JS count.
    private func build() {
        let vol = host.volume
        let density = max(options.density ?? 1, 0)
        let n = Int((130 * density).rounded())
        store.clear()
        for _ in 0..<n {
            store.add(newParticle())
        }
        applySeed()
        _ = vol
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
        if options.firstClassMass { p.mass = size } // mass ∝ size when first-class mass is on
        return p
    }

    /// Round-robin the seeded records onto the base pool; weight scales mass + size.
    private func applySeed() {
        guard !seeded.isEmpty else { return }
        let ps = store.particles
        for (i, p) in ps.enumerated() {
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
        // eased scroll velocity — the same EMA the `scrolling` gate uses.
        scrollVel = scrollVel * 0.7 + abs(host.scrollY - lastScrollY) * 0.3
        lastScrollY = host.scrollY
        env.scrollV = scrollVel

        // formation easing (§7): the active preset glides toward its target.
        easeFormation(&env.form, toward: formTarget)

        // refresh body geometry + visibility from the host (the read phase).
        for b in bodies {
            if let view = b.view, let box = host.worldBox(of: view) {
                b.box = box
                b.isVisible = boxVisible(box, in: vol)
            }
        }

        // simulate
        store.reindex()
        step(StepInput(store: store, bodies: bodies, env: env,
                       forces: registry.forces, conditions: registry.conditions))

        // feedback easing (§8): fold count → eased density d.
        for b in bodies where b.feedback {
            let target = feedbackTarget(count: b.count, engaged: b.isEngaged)
            b.d += (target - b.d) * 0.08
        }

        // render (skipped while invisible or in signals-only mode — the sim stays live).
        if visible, options.render != .none_, let renderer {
            renderer.render(frame: RenderFrame(
                particles: store.particles, bodies: bodies, accent: accent,
                mode: options.render, projection: host.projection, volume: vol
            ))
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

    func threads(_ list: [ThreadLink]?) { /* thread rendering — lands with the renderer pass */ }

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
        env.spark(position, 2, color)
    }

    func flowTo(_ position: Vec3, strength: Float? = nil) { /* flow focus — next pass */ }
    func clearFlow() {}

    func seed(_ atoms: [AtomPayload]) {
        seeded = atoms
        applySeed()
    }

    /// The seeded record on the nearest particle within ~24px, or nil. For hover-to-inspect.
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
    }
}
