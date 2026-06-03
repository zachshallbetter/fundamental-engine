# The Forces System — Possibilities & Roadmap

> What the [reciprocal field](forces-system.md) unlocks once it stops being a
> background effect and becomes wired to *meaning* — your archive, your taxonomy,
> your attention. This is an options menu and a suggested sequence, not a
> commitment. Companion to `docs/forces-system.md` (the definition); section refs
> like §6 point there.

## The core thesis

The field is a **metaphor engine with a real physics API**. Its highest-leverage
use is as a **dumb renderer for the archive** — which is exactly the direction the
data layer is already heading (`data = life archive · API is the contract ·
client is disposable`, see `docs/archive-architecture.md`). The prototype
hardcodes its bodies in markup; the win is to let **force metadata flow from the
API** so the field *is* a visualization of the work, not a decoration on top of it.

Two ideas carry the most leverage:
- **A — Bind the field to the archive.** Make disciplines, significance, recency,
  and relationships *render as forces*.
- **E — Publish the executable design system.** You say you build executable
  design systems; the `ds-*` bundle already is one. Shipping it is the proof.

## How to read the tiers

Ranked by **leverage ÷ effort**, not by ambition alone.

| Tier | Meaning |
|---|---|
| **1 · Quick wins** | Days, mostly mechanical, low risk. Make the field *mean* something with what already exists. |
| **2 · Signature bets** | Weeks. The differentiated, "this is the site" work. A & E live here. |
| **3 · Moonshots** | Open-ended. High upside, real research/cost risk. |

---

## Tier 1 — Quick wins

### 1.1 Discipline → force, from data
Each archive entry already has a category. Map category → canonical force using
`DS_FORCES` (§6, §15). The API returns a `force` token per entry; the client
renders a body. **This is the unlock that makes everything else in A possible**,
and it's mostly a lookup table.
- *Touches:* archive contract (add `force`/derive it), one render helper.
- *Risk:* low. The mapping is already authored.

### 1.2 Tags → threads (the relationship graph)
The "Everything connects to the experience" system-map is literally the
`threads()` API (§10). Hover a tag or a hub node → wire every entry that shares
it. Makes the archive's graph visible on demand.
- *Touches:* a `data-index data-threads` group + tag→entry index.

### 1.3 Recency/significance → heat & strength
New entries spawn "hot"; prominent ones get higher `data-strength`. Pure
attribute mapping (§3.1, §6) — the field weights what matters with no new physics.

### 1.4 Reduced-motion / poster variant
A frozen, screenshot-able render of the field for OG images, low-power devices,
and `prefers-reduced-motion` (§18). Same engine, `boot=1`, `dt=0`. Cheap, and it
de-risks the "is this too heavy?" objection everywhere else.

### 1.5 Generalized glyph assembly
Today only the hero name assembles from particles (§11). Generalize the
`[data-glyph]` host so section titles / the contact email / a case-study title can
materialize from the field. Small change, big "wow" reuse.

---

## Tier 2 — Signature bets

### A — The archive-bound field (deep dive)

The field becomes a live map of the body of work. Built on Tier-1 §1.1.

**A1 · Force metadata in the contract.** Extend the entry schema so each entry
resolves to `{ force, strength, color, when? }` — derived server-side from
category/prominence/recency so the **client stays dumb**. The homepage Work/Writing
indexes (which already declare forces in the prototype) bind to real entries.

**A2 · Reciprocity as a live signal.** The `--d` density write-back (field →
element, §8) is the rarest, most underused part of the system. Pipe real
engagement (view counts, recently-opened) into density so the most-read pieces
*gain weight and glow*. The archive's analytics become typography. **This is the
part almost nothing else on the web does** — worth protecting as the signature.

**A3 · Formations as view-state.** Formations already shift per section (§7);
promote them to **IA states** driven by the query:
- search results → `scatter`
- browse-by-discipline → `wells` (entries pool into discipline clusters)
- chronological → `lanes` (a timeline current)
- a single open entry → `accretion` (everything converges on it)

The interface explains its own state through behavior, without chrome.

**A4 · Conditions tied to real state.** `data-when` (§5): featured entries attract
harder; "new" runs hot; scroll-velocity gates the heavy effects so fast scrolling
stays calm.

*Sequencing within A:* 1.1 → A1 → A3 → A2 → A4. (Density-as-signal last; it needs
an analytics source.)

### E — Publish the executable design system (deep dive)

You build executable design systems; `design-system.html` + `ds-*` is a running
one — 11 views across Foundations / The Field / Interface (§17), with live demos
behind a gated "Reciprocal Field" toggle (default off, the right cost pattern).

**E1 · Ship it as a public site.** A portfolio piece that *is* the thesis: a design
system you can operate, with the physics live behind it. Lift `ds-data.js` into a
typed `src/config/forces.config.ts` as the single source of truth (recommended in
§19) so the DS and the live site read the same catalog.

**E2 · Extract the engine as a library.** The force registry is clean and modular —
`window.__forces[token] = { apply(b,p,env) }`, core never changes (§4). It's a
publishable package ("a reciprocal DOM-physics field"). Open-sourcing it is itself
credibility, and forces a clean API boundary.

**E3 · The Lab as a signature interaction.** Shareable fields via URL hash already
work (§14.4). Could be a play space, a generative-wallpaper generator, or a quirky
contact mechanism ("build me a field, send it").

### Identity (rides alongside E)
A forces-derived brand system — nine colors, the `forces-mark` favicon/wordmark
(it's already a field render). Coherent identity that's *generated, not drawn*.

---

## Tier 3 — Moonshots

### M1 · Conversational field (AI surface)
There's a `view-conversation.jsx` screen, and the archive roadmap includes an
LLM-agent client. An AI chat whose responses **render into the field** (emitter =
AI systems, fittingly) collapses the interface and the system into one object.
High novelty; real scope (streaming → particle choreography, latency, cost).

### M2 · Narrative scrollytelling for case studies
The manual's chapter-by-chapter formation shifts (§16) are a storytelling device.
Apply to project case studies: each section cues a formation, the field narrates
the story underneath the prose.

### M3 · Generative / seasonal field
Accent journey + formations varied by time of day, season, or "mood" of the
archive (what you've shipped lately). The site as a living instrument.

---

## DOM ⇄ Canvas — concepts & formulas

The reciprocal field's rarest property is a **two-way binding between layout and a
physics sim**. Most particle backgrounds are one-way (canvas reacts to the mouse).
Here the DOM *is* the simulation's geometry, and the simulation writes back into
layout and type. Everything below is an elaboration of two pipes (§2.1, §8); each
spec gives the exact math and how it hooks the existing engine.

> The concepts here (esp. self-laying-out layout and field→DOM events) are
> formalized into one mechanism — forces targeting particles, DOM elements, **and**
> events interchangeably — in the **unified target model, forces-system.md §22**.

### Notation
Reusing the engine's symbols (see `forces-system.md`):
`S` strength, `d_max` effective range, `(cx,cy)` body center, `(hw,hh)` half-
extents, `b.count` per-frame density tally, `b.d` eased density ∈ [0,1], `b.on`
engaged, `b.mass` captured count. Per particle: position/velocity `(x,y,vx,vy)`,
`heat`, friction `f ≈ 0.95`. Frame rate assumed 60 fps.

### The two transfer functions (the whole bridge)

**Pipe 1 — DOM → Canvas (geometry).** Each frame a body's box is read and mapped
to canvas space:
```
cx = (rect.left + rect.width/2)·DPR     hw = rect.width/2·DPR     (DPR = min(dpr, 2))
```
Consequence: **any DOM change (reflow, transform, resize) is an instantaneous
change to the force geometry** — animating the DOM animates the sim for free.

**Pipe 2 — Canvas → DOM (density).** Each frame, density is sampled in a disc of
radius `r_s = d_max·0.5` and low-pass filtered into `b.d`:
```
count = Σ_p  max(0, 1 − dist(p,b)/r_s)        over free particles, dist < r_s
target = clamp(count/K + (on ? 0.45 : 0), 0, 1)        K = 20
b.d   += (target − b.d)·α                               α = 0.08
```
`b.d` is a **first-order low-pass** on density. Its step response and settling
time matter for every Canvas→DOM effect:
```
b.d(t) = target·(1 − (1−α)^t)        time constant  τ = −1 / (60·ln(1−α)) ≈ 0.20 s
```
So any density-driven visual reaches ~63% of its target in ~0.2 s and ~95% in
~0.6 s. That easing is also what keeps the closed-loop concepts (below) stable.

---

### Concept 1 · Material typography (Canvas → DOM, with a mild loop)

**Idea.** A word's *appearance is a live readout of the particle mass pooled under
it* — and you can physically disturb it (agitate) and watch it recover. Type as a
material. The prototype's `liveword` does the weight axis for one word (§8); this
generalizes it.

**Axis mapping.** For any CSS-numeric target `A` with range `[A₀, A₁]`:
```
A(b) = A₀ + (A₁ − A₀)·b.d
```
Apply across whatever the typeface and design expose:
```
wght           = round(lerp(w_min,  w_max,  b.d))          // 300 → 800
opsz           = lerp(opsz_min, opsz_max, b.d)
letter-spacing = ls₀ − Δls·b.d                              // tightens as it gathers
text-shadow    = blur = B_max·b.d ,  alpha = 0.2 + 0.6·b.d  // bloom
color          = color-mix(in srgb, accent (b.d·100)%, ink) // warms toward accent
```
Write them from the same `--d` the engine already sets:
`element.style.setProperty('--d', b.d)` → CSS reads `--d` for all of the above.

**Disturbance + recovery (the demo).** Agitate fires `burst()` (§11): free
particles within 260 px get `vx += (1−r/260)·4.4` and `heat += (1−r/260)·1.3`,
emptying the disc. So `count` drops → `b.d` eases down → the word thins. As
particles drift back under the body's own `attract`, `count` refills and `b.d`
recovers on the `τ ≈ 0.2 s` curve above. **The word visibly goes light when you
blow on it, then thickens as the field resettles.**

**Why it's a (stable) loop, not one-way.** Changing `wght` changes the rendered
text *width* → changes `hw` (Pipe 1) → changes the force geometry → changes
density (Pipe 2). Loop gain:
```
G = (∂hw/∂wght)·(∂count/∂hw)·(∂target/∂count)·α
```
Because `∂hw/∂wght` is tiny (a few px across the full weight range) and `α = 0.08`
heavily attenuates, `|G| ≪ 1` → the loop converges to a stable equilibrium rather
than oscillating. (If you *want* a deliberate "bloom," raise the weight→geometry
coupling and/or `α` until `G → 1⁻`.)

---

### Concept 2 · Conserved attention (the full loop, zero-sum)

**Idea.** There is one finite pool of matter for the whole page. Engaging a body
**pulls matter off every other body** — so the site physically cannot emphasize
two things at once. Focus isn't styled; it's enforced by conservation (§2.4).

**Model.** Let the visible feedback bodies be `i = 1…n`. Define each body's
*demand* (how hard it's currently competing for matter):
```
m_i = S_i · (1 + β·on_i) · vis_i          β ≈ 2   (engagement multiplier)
```
The total free-particle pool `N` is fixed (conservation). Allocate a target
density to each body by softmax/share of demand:
```
d_i* = N̂ · m_i / Σ_j m_j                  N̂ = N / (K · n)   (normalizer to [0,1])
```
Add a **controller** that nudges each body's *effective* strength toward its
allotment — starving the over-filled, boosting the under-filled:
```
S_i^eff = S_i · clamp( d_i* / (b.d_i + ε), S_lo, S_hi )      ε = 0.05
```
Feed `S_i^eff` into the force math in place of `S_i`. The dynamics:
engaging `k` ⇒ `m_k` jumps ⇒ `d_k*` rises and every `d_j*` (j≠k) falls ⇒ the
controller raises `S_k^eff`, lowers `S_j^eff` ⇒ matter physically drifts from the
others to `k`. **Navigation becomes moving matter between sections, not fading
opacity.**

**Conservation check.** `Σ_i d_i*` is held constant by construction
(`Σ_i m_i/Σ_j m_j = 1`), so total allocated attention is invariant — the budget is
literally conserved frame to frame. Stability comes from the same `α = 0.08`
low-pass on `b.d` plus clamping `S^eff ∈ [S_lo, S_hi]`.

---

### Concept 3 · Self-laying-out page (Canvas → DOM position)

**Idea.** Elements find equilibrium *positions* in the field instead of being
pinned by CSS — resize and the page re-settles like a physical object.

**Model.** Give element `i` a CSS anchor `a_i` (its normal layout position) and a
live offset `o_i` written as `transform: translate(o_i.x, o_i.y)`. Sum three
forces on the offset:
```
F_anchor = −k_a · o_i                                   // Hookean pull home (k_a ≈ 0.02)
F_repel  = Σ_{j≠i} C_r · (c_i − c_j) / |c_i − c_j|²     // elements push apart
F_press  = −∇ρ(c_i)                                     // pushed toward lower density
```
where `∇ρ` is estimated by sampling `count` at `c_i ± δ` on each axis (a 4-tap
finite difference). Integrate with damping and write back:
```
v_i = (v_i + (F_anchor + F_repel + F_press)·dt)·f_layout     f_layout ≈ 0.9
o_i += v_i ;  element.style.transform = `translate(${o_i.x}px, ${o_i.y}px)`
```
Next frame Pipe 1 re-reads the moved rect, so the field tracks the new position.
`F_anchor` dominates at rest → guaranteed equilibrium at `o_i = 0` when the field
is calm; disturbances make the layout *breathe* and settle.

---

### Concept 4 · Cross-boundary causality (density overflow → DOM events)

**Idea.** Hover A → its field swells → spills into neighbor B → B lights up.
Relationships between UI elements become physically visible and *emergent*.

**Model.** When a body saturates (`b.d > 1` after the engagement boost), it spills
to neighbors at a rate weighted by proximity:
```
Φ_{i→j} = κ · max(0, b.d_i − 1) · w_ij ,   w_ij = 1 / dist(c_i, c_j)
b.d_j  += Φ_{i→j} ;   b.d_i −= Φ_{i→j}          (conserved transfer)
```
Fire a DOM event when a neighbor crosses a threshold, so the canvas can *drive*
the DOM, not just read it:
```
if b.d_j crosses θ (≈ 0.6):  element_j.dispatchEvent('field:lit')  → CSS/JS reaction
```
This is the "Everything connects" system-map (§10 threads) made emergent instead
of hand-drawn — the wiring appears because matter actually flows between boxes.

---

### Concept 5 · State transitions as conserved events

Map app state onto the conservation grammar (§6.9) so transitions are *physical*:
```
loading   → accretion   : absorb body, mass ramps  scale = 1 + (mass/maxMass)·0.45
success   → supernova   : release all captured radially (spd 4–7, heat 1)
submit    → capture      : p.cap = b ; b.mass++
error     → repel burst  : F = −(1 − d/d_max)²·S  (carve a void, §6.6)
```
Nothing is faked — every transition shoves or releases *existing* matter, so the
UI feedback obeys the same law as the rest of the field.

---

### Enabling the heavy concepts (the bridge, optimized)

The per-frame `getBoundingClientRect()` poll is fine for ~dozens of bodies; the
loop-heavy concepts (2, 3, 4 across a whole page) want a cheaper, smoother bridge:

- **`ResizeObserver` + `IntersectionObserver`** mark bodies dirty instead of
  re-reading every rect every frame — measure only what moved.
- **Houdini `@property --d { syntax:'<number>'; … }`** types the density vars as
  real numbers so they *interpolate/transition* smoothly and can be animated by
  the compositor.
- **`OffscreenCanvas` + worker** runs the sim off the main thread; the main thread
  only reads dirty rects and writes CSS vars. This is what makes **conserved
  attention across a full page of bodies affordable on mobile.**

---

## Beyond the nine — an extended force vocabulary

The canonical nine (§6) are all **body → particle, local, O(b·n)** forces: each
reads one particle against one body. The most *unique* results come from three
frontiers the prototype never crosses. Flagging the **class** of each addition
matters, because two of the frontiers break the current registry contract ("a
force owns only the math that nudges one free particle given a shared env"):

- **[A] Body→particle** — fits the existing contract; pure addition. New attrs only.
- **[B] Particle→particle** — needs neighbor access (a spatial hash in `env`);
  cost is O(n·k) with `k` neighbors. Enables *emergent matter*.
- **[C] Field-buffer** — needs a persistent scalar/vector grid the sim reads and
  writes. Enables *memory and self-organization*.
- **[D] Target-geometry** — a body carries a point set; particles are assigned to
  targets. Enables *matter becoming shapes/data*.
- **[E] Particle attribute** — needs a new per-particle field (charge, species,
  age, color). Composable with the others.

### New forces (curated, with the unique result each returns)

**Lens — refract a flow without trapping it.** `[A]`
```
θ = θ_max·(1 − d/d_max)·sign ;   v ← rotate(v, θ)     // speed preserved
```
*Unique:* bends streams into caustics and arcs; deflection with zero capture.
*Fits:* Motion.

**Align — flock / school.** `[A]` (toward a heading) or `[B]` (toward neighbor mean)
```
v += ( ĥ·|v| − v )·k_align        within d_max     // ĥ = body heading or mean neighbor dir
```
*Unique:* coherent schooling, murmurations, combed coherence. *Fits:* Experience / Motion.

**Charge — signed magnet, self-sorting.** `[A]+[E]`  (particle carries `q ∈ {+1,−1}`)
```
F = σ·q·GM/(d² + ε²) · û            // signed sibling of gravity; like repels, opposite attracts
```
*Unique:* matter **demixes into domains by type** — categories visibly separate.
*Fits:* Commerce / AI (classification).

**Cohesion — surface tension, liquid droplets.** `[B]`
```
F = k·(d − r₀)   for r₀ < d < r₁ (pull) ;   F = −k_p·(r₀ − d)  for d < r₀ (push)
```
*Unique:* the swarm coalesces into **blobs with a skin** that merge and split — a
liquid, not dots. *Fits:* Physical production (materials).

**Pheromone — stigmergy / slime-mold networks.** `[C]`  (decaying scalar grid `T`)
```
deposit:  T(x) += δ at each particle
steer:    v += ∇T(x)·k_follow
field:    T ← (T·decay) ⊛ blur        decay ≈ 0.97
```
*Unique:* **self-organizing transport networks grow between source bodies** — the
archive's relationship graph literally *builds itself* (Physarum). On-brand for
"everything connects." *Fits:* AI / Creative technology.

**Crystallize — phase transition by heat.** `[A]`  (ties into the existing `heat`)
```
if heat < θ_freeze:  v += (latticeNode(p) − p)·k_snap        // solid
else:                free                                     // melted
```
*Unique:* solid ↔ liquid ↔ gas driven by heat or scroll — a hero that **melts as
you scroll**. *Fits:* Physical production.

**Resonator — driven oscillator / standing waves.** `[A]`
```
S(t) = S₀·(1 + sin(ω·t)) ;   apply attract/stream with S(t)
```
*Unique:* pumping, breathing regions, and **interference/beats between two
resonators**. *Fits:* Motion.

**Buoyancy — sedimentation & layering.** `[A]+[E]`  (particle density `ρ_p ∝ size·heat`)
```
F_y = (ρ_med − ρ_p)·g                 // hot/light rises, heavy sinks
```
*Unique:* stratified field; matter **sorts into layers**. *Fits:* Commerce / Physical.

**Gate — one-way membrane (diode).** `[A]`  (axis `n`)
```
if v·n < 0:  reflect across n ;   else pass                  // rectifier
```
*Unique:* matter **accumulates on one side** — valves, funnels, pressure builds.
*Fits:* Software architecture (flow control).

**Morph — particles become an arbitrary shape.** `[D]`  (target set `{t_k}`: SVG path,
image samples, or datapoints)
```
assign each p a target t_k ;   F = (t_k − p)·k_m + jitter·(1 − arrived)
```
*Unique:* the field **assembles into logos, words, maps, or charts** — glyph
assembly (§11) generalized to any geometry. The bridge to brand + data-viz: *a bar
chart whose bars are accreted matter.* *Fits:* Creative technology / Design.

**Constraint — Verlet ropes & cloth.** `[B]`  (linked pairs, rest length `L`)
```
each step, project both ends:  correct |p_a − p_b| → L  (split the error)
```
*Unique:* ropes, chains, **cloth and soft structures** spanning the layout. *Fits:*
Software architecture (structure).

**Spotlight — a perception/attention cone.** `[A]`  (heading, half-angle `φ`)
```
act only if  angle(û_{b→p}, heading) < φ                    // directional sensing
```
*Unique:* scanning beams and **literal "attention" cones** — apt for AI. *Fits:* AI.

**Predator–prey — a living two-species ecosystem.** `[B]+[E]`
```
species A: seek nearest B ;   species B: flee nearest A ;   Lotka–Volterra populations
```
*Unique:* oscillating populations, chases — the field becomes **alive/animal**.
*Fits:* AI / systems.

**Orbit — *emergent*, not a force.** A true orbit is what `gravity` produces given
tangential velocity — there's no `orbit` module (continuously injecting tangential
speed would spiral outward). *Unique:* stable angular momentum, for free, from
`gravity` + initial sideways velocity. *Fits:* Product strategy. (Formal note:
forces-system.md §20.3.)

**Wind — curl-noise turbulence.** `[A]`
```
v += curl(noise(x·s, y·s, t·s_t))·S                         // divergence-free
```
*Unique:* natural, non-repeating eddies — the grown-up version of the engine's
`wander`. *Fits:* Motion.

**Shear — laminar gradient flow.** `[A]`
```
v_∥ += S·(offset_⊥ / d_max)·(1 − d/d_max)
```
*Unique:* velocity layers that slide past each other → turbulence at boundaries.
*Fits:* Creative technology.

**Pressure — incompressible fluid (SPH).** `[B]`
```
ρ_p = Σ_n W(dₙ,h) ;   v += −k·Σ_n (ρ_p − ρ₀)·∇W(dₙ,h)
```
*Unique:* a liquid that fills evenly, splashes, and resists compression. *Fits:*
Software architecture.

**Memory — the field remembers.** `[C]`  (slow occupancy grid `M`)
```
M(x) += λ where matter sits ;   local force ×= (1 + μ·M(x))
```
*Unique:* **paths wear in** — frequently-travelled routes deepen over time. *Fits:*
Experience design.

**Pigment — conserved color transport.** `[E]`
```
on overlap:  c_p ← mix(c_p, c_other, rate)                  // color advects with matter
```
*Unique:* sections **stain** the field; the accent journey becomes literal pigment
moving through the medium, conserved. *Fits:* Commerce / brand.

#### Cosmology cluster (a themed family)
A coherent astrophysical set — most conserved, two deliberate **sources** (class
[S], which *break* "nothing from nothing" and must be budgeted; see §20.1).
**These are composites, not new modules:** the whole family is realized as a
**preset layer** over the primitives (forces-system.md §20.9), needing only two new
atoms — `warp` (teleport) and `spawn` (create matter). `blackhole` and `whitehole`
are pure compositions of existing tokens (`attract vortex absorb lens` /
`repel stream`) and need zero new code.

**Blackhole — `blackhole` [A].** Extreme `attract` with an event horizon (capture),
frame-dragging (accretion disk), and path-bending (lensing). *Unique:* a real
gravity well with a disk and relativistic color (§20.8). *Fits:* Product strategy.

**Whitehole — `whitehole` [A].** The inverse — an emission-only horizon nothing can
enter; the exit mouth of a wormhole. *Unique:* a pure outward fountain of *existing*
matter. *Fits:* Commerce.

**Wormhole — `wormhole` [A · paired].** Two linked throats; matter teleports A→B with
momentum carried through. *Unique:* **conserved teleport** — routing made physical.
*Fits:* Software architecture.

**Supernova — `supernova` [S].** Releases held matter, **mints new particles**
(nucleosynthesis), shockwaves, and leaves a remnant. *Unique:* the field can
*erupt and seed itself* — the dramatic superset of the conserved release event
(§6.9). *Fits:* Creative technology. *(Source — pair with a sink.)*

**Fountain — `fountain` [S].** A true source: continuously *creates* particles at a
nozzle (vs `emitter`, which recycles the field). *Unique:* a literal spray — the
minting sibling of emitter. *Fits:* Motion. *(Source — cap with `age`/despawn.)*

> **Relationships & color.** These forces relate by inversion, intensity,
> composition, and lifecycle (e.g. `blackhole = attract + vortex + absorb + lens`;
> `star: cloud → supernova → remnant`), and they unlock a physical **color model**
> (blackbody temperature, Doppler/gravitational redshift, charge hue, conserved
> pigment). Both are specified in `docs/forces-system.md` §20.7–§20.8.

> **Physical basis (caveats fixed).** The cosmology approximations (bounded well vs
> `1/d²`, fudged `c`) are resolved in §20.10 by separating **designed** forces
> (`attract`/`repel`, UI) from **natural** primitives in a consistent unit system:
> add `gravity` (softened `1/d²`), `magnetism` (Lorentz), `thermal` (Langevin),
> `propagate` (finite-speed propagation), `collide`, `diffuse`, and the transmutation
> set (`fuse`/`fission`/`decay`). The payoff: a **star becomes literally `gravity ⇄
> thermal` pressure with `fuse` in the core** — every term a primitive, nothing
> hand-waved.

> **Formal specs** (tokens, classes, default attrs, exact formulas) for every force,
> condition, formation, and render mode below now live in
> `docs/forces-system.md` §20 — the forward registry. This section keeps the *why*.

### New conditions (`data-when` extensions)
`near` (proximity to cursor/another body) · `dense` / `sparse` (local density gate)
· `aligned` (velocity direction matches) · `aging` (particle lifetime) · `charged`
/ `species` (attribute gate) · `dwell` (how long the body has been engaged) ·
`pointer-fast` (cursor velocity) · `schedule` (clock / time of day) · `inview`
(intersection ratio band).

### New formations (global biases, joining the five in §7)
`gravity` (constant down → particles fall and pile, sedimentation) · `tide`
(oscillating global drift) · `lattice` (crystalline rest grid) · `flock` (global
alignment) · `spiral` · `turbulence` (curl-noise wind) · `pressure`
(incompressible even-fill via mutual repulsion) · `shatter` (explosive scatter,
then reform) · `magnetic` (follow field lines between charged bodies).

### New rendering modes (same sim, different material)
The physics is decoupled from the look — these return wholly different aesthetics
from identical forces:
- **Metaballs / iso-surface** → render density as a liquid skin, not dots.
- **Trails / long-exposure** → persist faded history → light-painting.
- **Voronoi / Delaunay** over particles → shattered glass, cells.
- **Proximity links** (particle↔particle threads) → constellation / neural-net.
- **Streamlines / vector field** → *draw the forces themselves* (a diagnostic view).
- **Type knockout** → particles visible only *inside* letters; the field fills text.

### Emergent system behaviors (the headline "unique results")
These aren't single forces — they're phenomena that *emerge* when the above
combine, and none of them exist on a normal site:
- **Self-assembly** (Morph) — data and identity rendered as particle constellations.
- **Grown networks** (Pheromone) — the relationship graph organizes itself.
- **Phase transitions** (Crystallize + heat/scroll) — solid that melts on scroll.
- **Demixing / sorting** (Charge or Buoyancy) — categories physically separate.
- **Reaction–diffusion** (cohesion + inhibition on a grid) — Turing spots/stripes
  as living texture behind the type.
- **Interference** (two Resonators/Streams) — moiré and beat patterns.
- **Ecosystems** (Predator–prey / Align) — a field that behaves like a school or
  a swarm of animals.

> **Architectural note.** Classes [B]/[C]/[D]/[E] are not pure additions like the
> nine — they require: a **spatial hash** exposed on `env` (neighbor queries),
> **persistent buffers** (grids, target sets), or **new particle attributes**.
> Worth a single foundational pass (a `FieldStore` that owns particles + a spatial
> index + optional grids) before reaching for the emergent concepts. The local
> `[A]` forces and all the conditions/formations are drop-in against today's
> engine.

---

## Cross-cutting decisions (resolve before building Tier 2)

1. **Coexist or replace?** The repo already has wave/particle systems
   (`useWaves`, `WaveContext`, `src/experiments/particle-life*`,
   `src/behaviors/`). Decide whether the field engine *replaces* them or runs
   beside them. (Replacing is cleaner long-term; coexisting is faster short-term.)
2. **Keep the client dumb.** Honor the archive direction — force metadata comes
   from the **API**, not hardcoded in components (the prototype does the latter).
3. **Cost budget.** Full field on mobile is heavy. The DS "live toggle, default
   off" is the tell for where it's expensive; pair every field surface with the
   Tier-1 §1.4 poster fallback.
4. **One source of truth.** Lift `ds-data.js` → `src/config/forces.config.ts`
   first (§19); both the site and any DS read it.

## Suggested sequence

```
Foundations:  forces.config.ts (one source of truth)  +  1.4 poster fallback
Quick wins:   1.1 discipline→force → 1.2 threads → 1.3 heat/strength → 1.5 glyph
Signature:    A1 contract → A3 formations-as-view → A2 density-as-signal → A4 conditions
              E1 publish DS (parallel track, shares forces.config.ts)
Then:         E2 extract library · E3 Lab · Identity
Moonshots:    M1 conversational field · M2 case-study scrollytelling · M3 generative
```

Quickest path to a differentiated site: **forces.config.ts → 1.1 → A1 → A3**, with
**A2 (density-as-signal)** as the moment it becomes unmistakably yours.
