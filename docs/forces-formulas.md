# The Forces & Fields — Reference Formulas & Attributes

This document serves as the canonical reference for the physics formulas, DOM attribute APIs, and substrate math backing the reciprocal field system. It merges the active engine rules with the proposed extended/cosmological vocabulary.

---

## Notation & Symbol Legend

| Symbol | Meaning | Unit / Scale |
|---|---|---|
| $b$ | A registered DOM body / attractor element | Object |
| $p$ | A particle in the simulation | Object |
| $s$ | General variable for spin (vortex direction/strength) | $\pm 1$ |
| $t$ | Time parameter (current frame) | Frames ($1\ 	ext{frame} = 1/60\ 	ext{s}$) |
| $v, v_t$ | Particle velocity vector $(v_x, v_y)$ | $	ext{px}/	ext{frame}$ |
| $p.	ext{pos}$ | Particle position vector $(x, y)$ | $	ext{px}$ |
| $b.	ext{center}$ | Body center coordinates $(c_x, c_y)$ | $	ext{px}$ |
| $dx, dy$ | Vector from particle to body center: $(c_x - x, c_y - y)$ | $	ext{px}$ |
| $d, 	ext{dist}$ | Euclidean distance between particle and body center: $\sqrt{dx^2 + dy^2}$ | $	ext{px}$ |
| $d_{\max}, 	ext{range}$ | Maximum effective influence range of a force | $	ext{px}$ |
| $\hat{u}$ | Normalized unit vector from particle to body: $(dx, dy) / 	ext{dist}$ | Unit Vector |
| $S, 	ext{strength}$ | Nominal force magnitude scaling factor | Scalar |
| $	ext{on}, b.	ext{on}$ | Boolean flag indicating the body is engaged (hover, focus, tap) | `true` / `false` |
| $	ext{heat}$ | Particle excitation level, driving color blend and size | $[0, 1]$ |
| $m$ | Particle inertial mass | Scalar |
| $M$ | Body source mass | Scalar |
| $b.	ext{d}$ | Eased local density computed for a body | $[0, 1]$ |
| $b.	ext{count}$ | Raw density tally accumulated in the current frame | Scalar |
| $f$ | Medium friction coefficient (damping) | $pprox 0.95$ |
| $c, v_{\max}$ | Sim speed-of-light / velocity cap | Scalar |

---

## Implementation Classes

Forces are grouped into architectural classes that define their interaction scope and computational cost:

- **Class [A]**: **Body $ightarrow$ Particle.** Local force where a DOM body influences a particle. Compute cost: $O(b \cdot n)$. *Drop-in.*
- **Class [B]**: **Particle $ightarrow$ Particle.** Needs neighbor queries (typically via spatial hash). Compute cost: $O(n \cdot k)$ with $k$ neighbors.
- **Class [C]**: **Field-Buffer.** Reads/writes persistent scalar/vector grids. Compute cost: $O(n + 	ext{grid})$.
- **Class [D]**: **Target-Geometry.** Body carries a target point set; particles spring to matching points. Compute cost: $O(n)$.
- **Class [E]**: **Particle Attribute.** Uses additional particle state variables (charge, species, age).
- **Class [S]**: **Source / Sink.** Creates or destroys matter. *Breaks particle count conservation; must be budgeted.*
- **[Preset]**: **Virtual Composite.** Expands a single HTML element into co-located virtual bodies of Class [A] to compose complex reactions.

---

## 1. The Nine Canonical Forces (Active Engine)

These forces are fully implemented in `forces.js` and drive the homepage Capabilities matrix. By default, **engagement (hover/focus/tap)** widens their range and amplifies strength. Detailed formulas, attributes, and expected behaviors are listed in [Section 6.1](#61-the-nine-canonical-forces-active-engine).

| Force (Token) | Class | HTML Attributes & Defaults | Math Summary | Behavior & On-State Impact |
|---|---|---|---|---|
| **Attract**<br>`attract` | **[A]** | `data-strength="1.0"`<br>`data-range="300"` | $v += \hat{u} \cdot f$ | Bounded gravity-like attractor well. Range $	imes 1.5$, strength $	imes 3$ on engagement. Optional orbital swirl added near lines. |
| **Emitter**<br>`emitter` | **[A]** | `data-angle="0"`<br>`data-strength="1.0"`<br>`data-range="300"` | $v += \hat{u} \cdot f$ or launch jet | Recycle conduit: draws particles into a nozzle ($d \ge 24$) and ejects them as a hot jet ($d < 24$). |
| **Spring**<br>`spring` | **[A]** | `data-strength="1.0"`<br>`data-range="260"` | $v += \hat{u} \cdot 	ext{stretch} \cdot k$ | Tether with rest length. Pushes out when crowded, pulls in when strayed. Settle factor $0.985$ forms orbits. |
| **Reflect**<br>`reflect` | **[A]** | *none* (sized by bounding box) | $v_{	ext{axis}} = -v_{	ext{axis}} \cdot 0.85$ | Elastic bounce off element borders. Restitution $0.85$. Emits visual sparks on hard impacts ($|v| > 0.7$). |
| **Stream**<br>`stream` | **[A]** | `data-angle="0"`<br>`data-strength="1.0"`<br>`data-range="340"` | $v += (	ext{ux}, 	ext{uy}) \cdot f$ | Continuous directional flow vector. Range $	imes 1.4$, strength $	imes 2$ when `on`. |
| **Repel**<br>`repel` | **[A]** | `data-strength="1.1"`<br>`data-range="300"` | $v -= \hat{u} \cdot f$ | Soft outward push from center. Carves a clean void. Range $	imes 1.4$, strength $	imes 2$ when `on`. |
| **Drag**<br>`drag` | **[A]** | `data-strength="1.0"`<br>`data-range="300"` | $v -= v \cdot k$ | Viscous zone. Bleeds particle momentum without redirection. Calms dynamic areas. |
| **Vortex**<br>`vortex` | **[A]** | `data-spin="1"`<br>`data-strength="1.0"`<br>`data-range="320"` | $v += ec{v}_{	ext{tangential}} \cdot f$ | Tangential swirl. Inward bias factor $0.12$ prevents collapse. Range $	imes 1.4$, strength $	imes 2$ on engagement. |
| **Absorb**<br>`absorb` | **[A]** | `data-absorb="64"`<br>`data-max="30"` | $p.	ext{cap} = b$ | Accretion core. Traps particles ($d < 	ext{absorbR}$) and increases mass. Supernovas on reaching limit. |

---

## 2. Extended Force Vocabulary (Proposed & Physical Primitives)

These forces constitute the roadmap's forward registry, splitting into designed behaviors, physical primitives, and virtual cosmology presets. Detailed math models and expected behaviors are listed in [Section 6.2](#62-extended-designed-forces), [6.3](#63-cosmology-presets-composite-layouts), and [6.4](#64-natural-primitives).

### 2.1 Extended Designed Forces

| Force (Token) | Class | Attributes | Math Summary | Behavior & Unique Result |
|---|---|---|---|---|
| **Lens**<br>`lens` | **[A]** | `data-strength`, `data-range` | $v = 	ext{rotate}(v, 	heta)$ | Refracts path while preserving speed. Bends streams into caustics. |
| **Align**<br>`align` | **[A/B]** | `data-angle`, `data-strength` | $v += (\hat{h} \cdot |v| - v) \cdot k$ | Combed coherence. Steers particles toward a flow axis or local group vector. |
| **Crystallize**<br>`crystallize` | **[A]** | `data-strength`, `data-range` | $v += (	ext{node} - p) \cdot k$ | Freezes particles to a lattice when cool. Melts on heat/scroll. |
| **Resonate**<br>`resonate` | **[A]** | `data-strength`, `data-omega` | $S(t) = S_0 (1 + \sin(\omega t))$ | Periodic oscillation. Creates standing waves and moiré beats. |
| **Gate**<br>`gate` | **[A]** | `data-angle` | $v -= 2(v \cdot \hat{n})\hat{n}$ | One-way membrane. Traps particles on one side of a bounding box. |
| **Spotlight**<br>`spotlight` | **[A]** | `data-angle`, `data-fov` | $	ext{applyCoreForce}()$ inside cone | Angular boundary. Gates forces to an attention cone relative to heading. |
| **Wind**<br>`wind` | **[A]** | `data-strength`, `data-scale` | $v += 	ext{curl}(	ext{noise}) \cdot S$ | Curl-noise flow field. Generates divergence-free natural turbulence eddies. |
| **Shear**<br>`shear` | **[A]** | `data-angle`, `data-strength` | $v_{\parallel} += S \cdot rac{	ext{offset}_{\perp}}{d_{\max}}$ | Boundary shear flow. Slips velocity layer offset perpendicularly. |
| **Buoyancy**<br>`buoyancy` | **[A+E]** | `data-strength`, `data-range` | $v_y += (ho_{	ext{med}} - ho_p) g$ | Sedimentation. Hot particles expand and rise; cold/heavy ones sink. |
| **Cohesion**<br>`cohesion` | **[B]** | `data-r0`, `data-range` | $v += k_c \cdot (d - r_0)\hat{u}$ | Surface tension. Swarms merge and split like liquid droplets. |
| **Pressure**<br>`pressure` | **[B]** | `data-range`, `data-strength` | $v += -k (ho_p - ho_0)
abla W$ | Incompressible fluid SPH model. Resists crowding, spreads evenly. |
| **Link**<br>`link` | **[B]** | `data-link`, `data-len` | $p_a \leftrightarrow p_b$ distance snap | Verlet distance constraints. Chains particles to form ropes or cloth. |
| **Hunt**<br>`hunt` | **[B+E]** | `data-species`, `data-strength` | $v += 	ext{seek/flee} \cdot S$ | Predator/prey ecosystems. Cycles populations via Lotka-Volterra. |
| **Pheromone**<br>`pheromone`| **[C]** | `data-strength`, `data-follow` | $v += 
abla T(x) \cdot k$ | Stigmergy paths. Particles self-organize into transport networks. |
| **Memory**<br>`memory` | **[C]** | `data-strength`, `data-range` | $M(x) += \lambda \cdot 	au$ | Occupancy grid footprint. Frequently travelled pathways attract more. |
| **Morph**<br>`morph` | **[D]** | `data-target`, `data-strength` | $v += (t_k - p) \cdot k_m$ | SVG/data targeting. Constellates dust into symbols (marks/logos). |
| **Pigment**<br>`pigment` | **[E]** | `data-color` | $c_p = 	ext{mix}(c_p, c_{	ext{other}})$ | Conserved color advection. Swarms physically transport pigment dyes. |

### 2.2 Cosmology Presets (Composite Layouts)

Cosmology presets use co-located virtual bodies of basic forces to represent astronomical objects:

- **Blackhole (`blackhole`)**
  - *Class:* [A] (+[S] if `data-destroy` is set)
  - *Composition:* `attract` (steep) + `vortex` (frame drag) + `absorb` (event horizon) + `lens` (light bending)
- **Whitehole (`whitehole`)**
  - *Class:* [A] (+[S])
  - *Composition:* `repel` (extreme) + `stream` (eject vector)
- **Wormhole (`wormhole`)**
  - *Class:* [A · paired]
  - *Composition:* `attract` + `warp` (throat A) $\leftrightarrow$ `warp` + `repel` (throat B)
- **Supernova (`supernova`)**
  - *Class:* [S] (Source blast)
  - *Composition:* `spawn` (one-shot) + remnant swap
- **Fountain (`fountain`)**
  - *Class:* [S]
  - *Composition:* `spawn` (continuous) along a nozzle vector

---

## 3. Substrate & Field Mechanics (The Ground State)

This section documents the equations driving the background substrate, including velocity integration, wave current drift, noise, toroidal edge wrapping, global formations, and typographic feedback loops.

---

### 3.1 Mass & Velocity Integration
Particles integrate coordinates under a viscous friction model:
$$
v_{t+1} = v_t \cdot f \quad (f pprox 0.95)
$$
$$
	ext{heat}_{t+1} = 	ext{heat}_t \cdot 0.972
$$

* **Option A (Unit Mass - Default UI):**
  $$
  v += F
  $$
* **Option B (First-Class Mass - Physics Simulation):**
  $$
  a = F/m
  $$
  $$
  v += a \cdot 	au
  $$
  $$
  p = m \cdot v\ 	ext{(conserve momentum on collisions/fusions)}
  $$

---

### 3.2 Background Currents (Carrier Waves)
The background consists of $5$ layered standing waveforms that drift free particles and transport bound particles.

* **Wave Y-Coordinate Calculation (`waveYat`):**
  At horizontal coordinate $x$ and time $t$ (seconds), the height $y_w$ of wave $w$ is:
  $$
  y_w = w.	ext{baseFrac} \cdot H + w.	ext{offsetY} + \sin(x \cdot w.	ext{freq} + w.	ext{phase} + t \cdot w.	ext{speed} \cdot 1000 \cdot 	ext{waveSpeed}) \cdot w.	ext{amp} \cdot 	ext{amplitude}
  $$
  
* **Gaussian Spine Pull (Local Bending):**
  When a DOM element is engaged ($	ext{pull.k} > 0$), the waves locally bend toward its location $(	ext{pull.x}, 	ext{pull.y})$:
  $$
  \Delta x = x - 	ext{pull.x}
  $$
  $$
  	ext{fall} = \exp\left(-rac{\Delta x^2}{2 \cdot 260^2}ight)
  $$
  $$
  y_w \leftarrow y_w + (	ext{pull.y} - y_w) \cdot 0.42 \cdot 	ext{fall} \cdot 	ext{pull.k} \cdot (0.45 + w.	ext{depth} \cdot 0.55)
  $$

* **Wave Slope / Derivative (`waveSlope`):**
  The slope of the wave represents its spatial derivative, driving vertical velocity:
  $$
  	ext{slope}_w = \cos(x \cdot w.	ext{freq} + w.	ext{phase} + t \cdot w.	ext{speed} \cdot 1000 \cdot 	ext{waveSpeed}) \cdot w.	ext{amp} \cdot w.	ext{freq} \cdot 	ext{amplitude}
  $$

* **Free Particle Drift (Wave Current):**
  For each free particle, identify the closest wave $w$ in the viewport. If the vertical distance $	ext{nd} = |y_w - p.y| < 70\ 	ext{px}$, apply velocities:
  $$
  p.vx += w.	ext{dir} \cdot 0.035 \cdot \left(1 - rac{	ext{nd}}{70}ight)
  $$
  $$
  p.vy += 	ext{slope}_w \cdot 0.1 \cdot \left(1 - rac{	ext{nd}}{70}ight)
  $$

---

### 3.3 Brownian Jitter & Curl-Noise Wander
When formation wander is active ($	ext{wander} > 0$), random perturbations and divergence-free eddies are injected:

* **Periodic Jitter (Every 40 frames):**
  $$
  	ext{wsc} = 0.05 \cdot 	ext{form.wander}
  $$
  $$
  p.vx += (	ext{rand}() - 0.5) \cdot 	ext{wsc}
  $$
  $$
  p.vy += (	ext{rand}() - 0.5) \cdot 	ext{wsc}
  $$

* **Curl-Noise Eddies (Every frame, for $	ext{wander} > 0.05$):**
  $$
  	heta_{	ext{curl}} = \left(\sin(p.x \cdot 0.0032 + t \cdot 0.12) + \cos(p.y \cdot 0.0034 - t \cdot 0.15)ight) \cdot \pi
  $$
  $$
  p.vx += \cos(	heta_{	ext{curl}}) \cdot 0.013 \cdot 	ext{form.wander}
  $$
  $$
  p.vy += \sin(	heta_{	ext{curl}}) \cdot 0.013 \cdot 	ext{form.wander}
  $$

---

### 3.4 Boundary Toroidal Wrapping
Particles are wrapped around screen boundaries rather than bounced or deleted (conserving global count):
$$
	ext{EDGE} = 10\ 	ext{px}
$$
$$
	ext{if } p.x < -	ext{EDGE}: p.x = W + 	ext{EDGE}
$$
$$
	ext{if } p.x > W + 	ext{EDGE}: p.x = -	ext{EDGE}
$$
$$
	ext{if } p.y < -	ext{EDGE}: p.y = H + 	ext{EDGE}
$$
$$
	ext{if } p.y > H + 	ext{EDGE}: p.y = -	ext{EDGE}
$$

---

### 3.5 Global Formation Currents (IA Layout States)
Global currents affect free particle motion, overriding or reinforcing local body forces:

* **Lanes Current (`driftX`):**
  $$
  p.vx += 	ext{driftX} \cdot 0.02
  $$
* **Scatter Target Pull (`spread`):**
  Each particle pulls toward its custom grid slot $(t_x, t_y)$ mapping a spread state across the canvas:
  $$
  t_x = ((	ext{p.gx} + 	ext{frameCount} \cdot 0.00004) mod 1) \cdot W
  $$
  $$
  t_y = 	ext{p.gy} \cdot H
  $$
  $$
  p.vx += (t_x - p.x) \cdot 0.0006 \cdot 	ext{form.spread}
  $$
  $$
  p.vy += (t_y - p.y) \cdot 0.0006 \cdot 	ext{form.spread}
  $$
* **Accretion Center-of-Mass Convergence (`conv`):**
  Pull particles toward the first visible `absorb` body $b_{	ext{target}}$:
  $$
  \hat{u}_{	ext{core}} = rac{(b_{	ext{target}}.	ext{cx} - p.x, b_{	ext{target}}.	ext{cy} - p.y)}{	ext{dist}_{	ext{core}}}
  $$
  $$
  p.vx += \hat{u}_{	ext{core}, x} \cdot 	ext{form.conv} \cdot 0.06
  $$
  $$
  p.vy += \hat{u}_{	ext{core}, y} \cdot 	ext{form.conv} \cdot 0.06
  $$

---

### 3.6 Two-Way Density Feedback (The Bridge)
- **DOM $ightarrow$ Canvas (Pipe 1):**
  $$
  c_x = (	ext{rect.left} + 	ext{rect.width}/2) \cdot 	ext{DPR}
  $$
  $$
  c_y = (	ext{rect.top} + 	ext{rect.height}/2) \cdot 	ext{DPR}
  $$
  $$
  	ext{DPR} = \min(	ext{devicePixelRatio}, 2)
  $$
- **Canvas $ightarrow$ DOM (Pipe 2):**
  $$
  b.	ext{count} = \sum_p \max(0, 1 - 	ext{dist}(p,b)/r_s) \quad 	ext{for}\ 	ext{dist} < r_s\ (r_s = d_{\max} \cdot 0.5)
  $$
  $$
  	ext{target} = 	ext{clamp}(b.	ext{count}/20 + (	ext{on}\ ?\ 0.45 : 0), 0, 1)
  $$
  $$
  b.	ext{d} += (	ext{target} - b.	ext{d}) \cdot 0.08
  $$
  $$
  	ext{CSS:}\ 	ext{element.style.setProperty}('--d', b.	ext{d})
  $$
  $$
  	ext{Time Constant:}\ 	au = -1 / (60 \cdot \ln(1 - 0.08)) pprox 0.20\ 	ext{seconds}
  $$

---

### 3.7 Conserved Attention (Zero-Sum Allocation)
To prevent visual clutter, attention can be normalized as a fixed budget:
$$
	ext{demand:}\ m_i = S_i \cdot (1 + eta \cdot 	ext{on}_i) \cdot 	ext{vis}_i \quad (eta pprox 2)
$$
$$
	ext{ softmax share:}\ d_i^* = \hat{N} \cdot rac{m_i}{\sum_j m_j}
$$
$$
	ext{strength controller:}\ S_i^{	ext{eff}} = S_i \cdot 	ext{clamp}(d_i^* / (b.	ext{d}_i + \epsilon), S_{	ext{lo}}, S_{	ext{hi}})
$$

---

## 4. Energy-Transfer Micro-Reactions (Juice)

Visual reactions scale with the amount of kinetic energy ($KE$) lost during dissipative events:

$$
\Delta E = 0.5 \cdot m \cdot (|v_{	ext{before}}|^2 - |v_{	ext{after}}|^2)
$$
$$
	ext{Reaction Intensity:}\ I = 	ext{clamp}(k \cdot \Delta E, 0, I_{\max})
$$

$I$ drives parameters like spark count, glow flash radius, and element recoil.

### Impact Spark Formula (Reflect / Collide)
$$
	ext{if}\ |v| > 0.7: 	ext{sparks} = 	ext{round}(3 + 	ext{rand} \cdot |v| \cdot 3)
$$
$$
	ext{heat} = \max(	ext{heat}, \min(0.85, |v| \cdot 0.4))
$$

---

## 5. Design & Implementation Antipatterns

This section documents critical antipatterns across three categories: Creative & Design System integration, Engine Performance, and Mathematical/Physical Simulation logic. Developers and designers must check this list before introducing new components, physics rules, or layouts.

---

### 5.1 Creative & Design System Antipatterns

#### 5.1.1 The Word Silhouette Break (Punctuation Rule Violation)
* **Symptom:** Text words or case study headings are assembled from, or morphed out of, loose particles. The typography becomes noisy, jagged, and illegible.
* **Root Cause:** Direct morphing or glyph assembly (`data-glyph`) applied to prose words.
* **Correct Pattern:** Words must remain solid, vector-drawn typographic elements. The field must *decorate* and interact with the text box, not form the text itself. Reserve particle shape-assembly strictly for simple punctuation and marks (e.g., `.`, `—`, `·`, brackets, logos) where the silhouette remains simple and legible.
* **Typographic Interaction:** To make words feel alive, alter their typographic properties using the eased `--d` local density variable written back by the engine:
  ```css
  .liveword {
    /* Drive weight from local density */
    font-variation-settings: "wght" calc(300 + var(--d) * 500);
    /* Drive glow bloom from local density */
    text-shadow: 0 0 calc(var(--d) * 15px) var(--accent);
    /* Subtly mix color towards accent based on density */
    color: color-mix(in srgb, var(--accent) calc(var(--d) * 100%), var(--ink-base));
  }
  ```

#### 5.1.2 Static Metaphors (One-Way Fields)
* **Symptom:** Particles react to mouse cursor movement, but layout cards and text headers do not react to the particle concentration. The canvas feels like a passive backdrop screensaver.
* **Root Cause:** Neglecting to declare the `data-feedback` attribute on elements, or failing to bind the `--d` CSS variable to typographic/layout properties.
* **Correct Pattern:** Every engageable DOM element must opt into the reciprocal loop. When particles gather, the element must visually swell, glow, or shift weights to close the interaction loop.

#### 5.1.3 Over-Agitation & Lack of Restraint (Visual Fatigue)
* **Symptom:** The particle field is constantly flashing, sparking, and moving at high velocity even when the page is completely idle.
* **Root Cause:** Failing to decay particle heat (`heat *= 0.972`) or setting baseline ambient velocities too high.
* **Correct Pattern:** Keep the resting state quiet. The field at rest should float on slow, gentle curl-noise drift ($v pprox 0.1 ightarrow 0.5\ 	ext{px/frame}$). High-velocity motion, sparks, and flashes must be reserved as short-lived reactions to events (click-bursts, bounces, cursor drags) that decay rapidly back to the ground state.

#### 5.1.4 Color-Semantic Incoherence
* **Symptom:** Laying out cards or page sections with arbitrary colored accents (e.g. rendering a `spring` element in teal or a `vortex` card in pink).
* **Root Cause:** Hardcoding accent colors on components instead of deriving them from the canonical force-to-discipline mapping.
* **Correct Pattern:** All element colors must align with `DS_FORCES` (e.g., attract = blue `#4da3ff`, vortex = teal `#2dd4bf`, spring = green `#86e57f`). Derive these programmatically via `forces.config.ts` or bind to CSS tokens:
  ```css
  .card-spring {
    border-color: var(--f-spring); /* #86e57f */
  }
  ```

#### 5.1.5 Vignette Scrim Neglect (Contrast Muddying)
* **Symptom:** Page copy is unreadable because bright particles drift directly behind white text, creating a contrast violation.
* **Root Cause:** Missing or weak vignette scrim overlays, or canvas opacity set too high.
* **Correct Pattern:** Always layer a radial-linear vignette scrim at `z-index: 1` between the canvas (`z-index: 0`) and the content shell (`z-index: 2`). Keep background canvas opacity at `~0.34` globally, and only raise it (e.g. to `.6` or `.96`) in dedicated showcase view-states.
  ```css
  #field {
    position: fixed;
    inset: 0;
    z-index: 0;
    opacity: 0.34;
    transition: opacity 0.7s var(--ease);
  }
  .scrim {
    position: fixed;
    inset: 0;
    z-index: 1;
    pointer-events: none;
    background: radial-gradient(circle, transparent 20%, var(--bg-page) 90%);
  }
  ```

#### 5.1.6 Thread Flooding
* **Symptom:** The page is covered in a dense web of glowing connector lines linking unrelated content, creating extreme visual clutter.
* **Root Cause:** Declaring `data-threads` globally on all lists or grids.
* **Correct Pattern:** Use threads strictly as opt-in wiring for structured indexes or case study navigation. Pass `null` to clear the thread registry on engagement leave.

#### 5.1.7 Treating Coherence as a Force
* **Symptom:** Code implements a new `coherence` force module in the force registry.
* **Root Cause:** Misunderstanding the "resolved/accreted" state as a physical primitive.
* **Correct Pattern:** Coherence is a target destination state (represented by the `--coherence` gold `#ffce6b` color and coordinates in the `accretion` formation). It is driven by composite attraction wells, not a tenth force token.

---

### 5.2 Engine Performance & Architecture Antipatterns

#### 5.2.1 Per-Frame Bounding Box Polling (Layout Thrashing)
* **Symptom:** Jittery scrolling, frame drops, and high CPU usage when scrolling or resizing.
* **Root Cause:** Calling `element.getBoundingClientRect()` on all elements inside the main `requestAnimationFrame` loop every frame.
* **Correct Pattern:** Re-sample element coordinates at a lower frequency (e.g., every 6 frames) or use a `ResizeObserver` / `IntersectionObserver` pattern to measure boxes only when they mutate or enter view, marking coordinate states as dirty in the store.
  ```js
  // Inside integration loop:
  if (frameIndex % 6 === 0) {
    bodies.forEach(body => body.measure());
  }
  ```

#### 5.2.2 Unmanaged Source-Sink Pools (Memory Leaks)
* **Symptom:** Browser memory allocation grows linearly over time, eventually causing the tab to crash (OOM).
* **Root Cause:** Continuously spawning new particles (Class [S] forces like `spawn`, `fountain`, or `supernova`) without any despawning criteria or hard limits.
* **Correct Pattern:** Respect the conservation law. Every particle generator must be balanced by a sink (such as a `blackhole` with `data-destroy`), age decay (`p.age > data-life`), or a hard global particle pool cap.

#### 5.2.3 DPR Over-Sampling (GPU Fill-Rate Saturation)
* **Symptom:** Mobile devices heat up and thermal throttle within minutes of loading the site.
* **Root Cause:** Initializing the canvas backing store at the full hardware `devicePixelRatio` on high-resolution screens (e.g., 3x or 4x Retina).
* **Correct Pattern:** Cap the device pixel ratio at 2:
  ```js
  const DPR = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = rect.width * DPR;
  canvas.height = rect.height * DPR;
  ```

#### 5.2.4 Off-Screen Section Physics Waste
* **Symptom:** Heavy background processing cost on long pages when the active scrolled section contains no physics elements.
* **Root Cause:** Running force math and integration steps on elements that have scrolled out of the viewport.
* **Correct Pattern:** When a body scrolls off-screen (beyond a safety margin like `H * 0.15`), set `body.vis = false` and skip it in the integrator loop.

#### 5.2.5 Multiple Root Canvas Instances
* **Symptom:** The browser struggles to clear and draw to multiple full-viewport canvases running concurrent requestAnimationFrame loops.
* **Root Cause:** Instantiating a new canvas for every element or view that needs a background field.
* **Correct Pattern:** Mount a single, shared canvas (`<FieldCanvas />`) at the application root for the viewport background. For isolated inline demonstrations, use container-scoped, low-particle-count, paused `<forces-cell>` instances.

---

### 5.3 Mathematical & Physical Simulation Antipatterns

#### 5.3.1 Newtonian Singularity (Zero-Distance Velocity Blowup)
* **Symptom:** Particles disappear instantly or fly off-screen at extreme speeds when they approach the center of an attractor.
* **Root Cause:** Using the literal physical gravity law ($F = G/d^2$) without core softening, causing division by zero ($d ightarrow 0$).
* **Correct Pattern:** Use bounded designed wells $(1 - d/d_{\max})^n$ for UI attractors, or add Plummer softening ($\epsilon^2$) in natural equations:
  $$
  F = rac{G \cdot M}{d^2 + \epsilon^2} \quad (\epsilon pprox 	ext{horizon or core radius})
  $$

#### 5.3.2 Mass Dissonance (Nominal vs. Inertial Mass)
* **Symptom:** The UI claims larger particles have more inertia, but all particles accelerate identically under the same force.
* **Root Cause:** Documenting inertial mass behavior while running a Unit Mass integrator ($v += F$).
* **Correct Pattern:** Under Option A (default UI), size does not affect motion. Correct the manual copy, or run Option B (First-Class Mass: $a = F/m$) inside the Lab/simulation spaces where collisions and momentum-conservation are critical.

#### 5.3.3 Infinite Loop Instability (Typography Feedback Oscillation)
* **Symptom:** A text block fluctuates rapidly in width, causing jittery layout reflows and text shaking.
* **Root Cause:** High loop gain in the reciprocal feedback loop. Changing density alters font weight $ightarrow$ alters word width $ightarrow$ alters force bounding box $ightarrow$ alters local particle density. If $lpha$ (low-pass smoothing factor) is too high or the weight-width change is large, the system oscillates.
* **Correct Pattern:** Dampen typography bounds changes. Keep $lpha pprox 0.08$ (low-pass filter) and keep the weight-to-geometry coupling small ($|G| \ll 1$) so the loop converges.

#### 5.3.4 Orbital Swirl Injection Error (Tangential Acceleration Blowup)
* **Symptom:** Particles spiral rapidly outward and leave the attractor well instead of forming stable circular orbits.
* **Root Cause:** Continuously applying tangential acceleration ($a_t += 	ext{constant}$), which continually injects kinetic energy into the system, causing orbits to decay outward.
* **Correct Pattern:** Inject tangential *velocity* once when seeding particles, or scale the tangential force with the attractor's radial pull factor:
  $$
  v_{	ext{tangential}} = rac{(-dy, dx)}{d} \cdot f_{	ext{radial}} \cdot 	ext{form.orbit}
  $$

---

## 6. Detailed Force Catalog (Explanations, Parameters & Expected Behaviors)

This section provides a detailed, comprehensive handbook for every registered force, preset, and primitive in the system. It details what each force does, the mathematical role of its HTML attributes, and the expected behaviors verified in code by the conformance suite.

---

### 6.1 The Nine Canonical Forces (Active Engine)

#### 6.1.1 Attract (`attract`)
* **What it does (Summary):** Pulls free particles toward the center of the body using a quadratic falloff curve, with an optional orbital swirl when carrier waves or orbital formations are active.
* **Class:** Class [A]
* **Attributes & Parameters:**
  * `data-strength` ($S$, default `1.0`): Multiplies the force magnitude.
  * `data-range` ($d_{\max}$, default `300`): Maximum influence radius.
* **Mathematical Model:**
  $$
  r = 	ext{range} \cdot (	ext{on}\ ?\ 1.5 : 1)
  $$
  $$
  S' = S \cdot (	ext{on}\ ?\ 3 : 1)
  $$
  $$
  	ext{if}\ d \ge r:\ 	ext{skip}
  $$
  $$
  f = (1 - d/r)^2 \cdot S' \cdot 0.5
  $$
  $$
  v += \hat{u} \cdot f
  $$
  $$
  	ext{if}\ 	ext{form.orbit}:\ v += rac{(-dy, dx)}{d} \cdot f \cdot 	ext{form.orbit}
  $$
  $$
  	ext{if}\ 	ext{on}:\ 	ext{heat} = \max(	ext{heat}, (1 - d/r) \cdot 0.9)
  $$
* **Expected Behavior & Conformance Invariants:**
  * Particles inside the range accelerate radially inward toward the body center.
  * Acceleration decreases quadratically as distance increases, falling to zero exactly at $d_{\max}$.
  * Engagement (`b.on`) amplifies range by $1.5	imes$, strength by $3	imes$, and blends the particle color toward the accent hue.
  * *Invariants:* Verified via `movesToward(body)` and `exactDelta(0.125, 0)` under default parameter scenarios.

#### 6.1.2 Emitter (`emitter`)
* **What it does (Summary):** Acts as a recycling conduit. It draws surrounding particles inward toward the core, and upon entry into the nozzle ($d < 24$), re-launches them as high-velocity, high-heat jets along the specified heading direction.
* **Class:** Class [A]
* **Attributes & Parameters:**
  * `data-angle` ($	heta$, default `0`): Base heading angle (in degrees) for the ejected particle jet.
  * `data-strength` ($S$, default `1.0`): Modulates the nozzle jet velocity.
  * `data-range` ($d_{\max}$, default `300`): Maximum feed capture radius.
* **Mathematical Model:**
  $$
  r = 	ext{range} \cdot (	ext{on}\ ?\ 1.4 : 1)
  $$
  $$
  	ext{if}\ d \ge r:\ 	ext{skip}
  $$
  $$
  	ext{if}\ d < 24:
  $$
  $$
  	ext{spread} = 	ext{rand}(-0.4..0.4)\ 	ext{rad}
  $$
  $$
  h = 	ext{rotate}((	ext{ux}, 	ext{uy}), 	ext{spread})
  $$
  $$
  	ext{spd} = 2.4 + S \cdot 2.6
  $$
  $$
  v = h \cdot 	ext{spd};\ p.	ext{pos} = b.	ext{center} + h \cdot 26
  $$
  $$
  	ext{heat} = \max(	ext{heat}, 0.9)
  $$
  $$
  	ext{else}:
  $$
  $$
  f = (1 - d/r)^2 \cdot (0.25 + S \cdot 0.15)
  $$
  $$
  v += \hat{u} \cdot f
  $$
* **Expected Behavior & Conformance Invariants:**
  * Particles in the outer feed zone ($d \ge 24$) accelerate inward.
  * Particles entering the core ($d < 24$) are offset to $26	ext{px}$ along the vector and launched outward in a $\pm 0.4	ext{ rad}$ cone with peak heat ($	ext{heat} = 0.9$).
  * *Invariants:* Verified by asserting inward pull at distance and outward speed increase inside the core boundary.

#### 6.1.3 Spring (`spring`)
* **What it does (Summary):** Keeps particles tethered to a preferred shell boundary (rest radius), pushing back when too close and pulling in when too far, with damping to settle particles into a ring.
* **Class:** Class [A]
* **Attributes & Parameters:**
  * `data-strength` ($S$, default `1.0`): Spring stiffness factor $k$.
  * `data-range` ($d_{\max}$, default `260`): Defines the rest shell radius $	ext{rest} = 0.6 \cdot d_{\max}$.
* **Mathematical Model:**
  $$
  	ext{rest} = 	ext{range} \cdot 0.6 \cdot (	ext{on}\ ?\ 1.25 : 1)
  $$
  $$
  	ext{reach} = 	ext{rest} \cdot 2.1
  $$
  $$
  	ext{if}\ d \ge 	ext{reach}:\ 	ext{skip}
  $$
  $$
  k = (0.006 + S \cdot 0.012) \cdot (	ext{on}\ ?\ 1.7 : 1)
  $$
  $$
  	ext{stretch} = d - 	ext{rest}
  $$
  $$
  v += \hat{u} \cdot 	ext{stretch} \cdot k
  $$
  $$
  v *= 0.985
  $$
  $$
  	ext{if}\ 	ext{on}:\ 	ext{heat} = \max\left(	ext{heat}, \left(1 - rac{|	ext{stretch}|}{	ext{rest}}ight) \cdot 0.5ight)
  $$
* **Expected Behavior & Conformance Invariants:**
  * Particles closer than `rest` are repelled outward.
  * Particles farther than `rest` (up to $2.1	imes 	ext{rest}$) are pulled inward.
  * Velocity is damped ($v *= 0.985$) so particles settle into a circular orbit around the shell.
  * *Invariants:* Verified using the `exactDelta(-0.532, 0)` invariant at resting offset.

#### 6.1.4 Reflect (`reflect`)
* **What it does (Summary):** Bounces particles elastically off the borders of the element's bounding box.
* **Class:** Class [A]
* **Attributes & Parameters:**
  * Bounding box dimensions are parsed dynamically from the DOM layout.
* **Mathematical Model:**
  $$
  	ext{pad} = 6
  $$
  $$
  	ext{if}\ p\ 	ext{is outside}\ (	ext{box} + 	ext{pad}):\ 	ext{skip}
  $$
  $$
  	ext{resolve shallower penetration axis: push } p 	ext{ outside boundary}
  $$
  $$
  v_{	ext{axis}} = -v_{	ext{axis}} \cdot 0.85
  $$
  $$
  	ext{if}\ |v| > 0.7:
  $$
  $$
  	ext{env.spark}(x, y, \min(2.4, |v|))
  $$
  $$
  	ext{heat} = \max(	ext{heat}, \min(0.85, |v| \cdot 0.4))
  $$
* **Expected Behavior & Conformance Invariants:**
  * Particles crossing into the box+padding boundaries undergo a velocity inversion on the shallower penetration axis (restitution coefficient $0.85$).
  * Hits above speed $0.7$ trigger environmental sparks.
  * *Invariants:* Verified by asserting velocity reversal and spark emissions on boundary entry.

#### 6.1.5 Stream (`stream`)
* **What it does (Summary):** Creates a uniform, directional current that sweeps particles along the heading angle.
* **Class:** Class [A]
* **Attributes & Parameters:**
  * `data-angle` ($	heta$, default `0`): Heading direction vector.
  * `data-strength` ($S$, default `1.0`): Flow velocity magnitude.
  * `data-range` ($d_{\max}$, default `340`): Field width.
* **Mathematical Model:**
  $$
  r = 	ext{range} \cdot (	ext{on}\ ?\ 1.4 : 1)
  $$
  $$
  S' = S \cdot (	ext{on}\ ?\ 2 : 1)
  $$
  $$
  	ext{if}\ d \ge r:\ 	ext{skip}
  $$
  $$
  f = (1 - d/r)^{1.1} \cdot S' \cdot 0.5
  $$
  $$
  v += (	ext{ux}, 	ext{uy}) \cdot f
  $$
  $$
  	ext{if}\ 	ext{on}:\ 	ext{heat} = \max(	ext{heat}, (1 - d/r) \cdot 0.5)
  $$
* **Expected Behavior & Conformance Invariants:**
  * Particles inside the range are accelerated in a straight line along the heading vector.
  * *Invariants:* Verified using `exactDelta(0.233, 0)`.

#### 6.1.6 Repel (`repel`)
* **What it does (Summary):** Pushes particles radially away from the body center.
* **Class:** Class [A]
* **Attributes & Parameters:**
  * `data-strength` ($S$, default `1.1`): Push force magnitude.
  * `data-range` ($d_{\max}$, default `300`): Push limit.
* **Mathematical Model:**
  $$
  r = 	ext{range} \cdot (	ext{on}\ ?\ 1.4 : 1)
  $$
  $$
  S' = S \cdot (	ext{on}\ ?\ 2 : 1)
  $$
  $$
  	ext{if}\ d \ge r:\ 	ext{skip}
  $$
  $$
  f = (1 - d/r)^2 \cdot S' \cdot 0.5
  $$
  $$
  v -= \hat{u} \cdot f
  $$
* **Expected Behavior & Conformance Invariants:**
  * Particles inside the range are driven outward along the unit vector $-\hat{u}$, carving a clean void around the DOM element.
  * *Invariants:* Verified using `movesAway()` and `exactDelta(-0.125, 0)`.

#### 6.1.7 Drag (`drag`)
* **What it does (Summary):** Bleeds velocity from particles, simulating a localized high-viscosity fluid zone.
* **Class:** Class [A]
* **Attributes & Parameters:**
  * `data-strength` ($S$, default `1.0`): Viscosity coefficient.
  * `data-range` ($d_{\max}$, default `300`): Friction zone radius.
* **Mathematical Model:**
  $$
  r = 	ext{range} \cdot (	ext{on}\ ?\ 1.4 : 1)
  $$
  $$
  	ext{if}\ d \ge r:\ 	ext{skip}
  $$
  $$
  k = (1 - d/r) \cdot (0.05 + S \cdot 0.07) \cdot (	ext{on}\ ?\ 1.6 : 1)
  $$
  $$
  v -= v \cdot k
  $$
* **Expected Behavior & Conformance Invariants:**
  * Particles slow down when entering the range. The friction coefficient increases linearly as the particle approaches the body center, with no direction changes.
  * *Invariants:* Verified using `speedReduced()`.

#### 6.1.8 Vortex (`vortex`)
* **What it does (Summary):** Spins particles tangentially around the body center, drawing them slightly inward.
* **Class:** Class [A]
* **Attributes & Parameters:**
  * `data-spin` ($s$, default `1`): Spin direction (clockwise $+1$, counter-clockwise $-1$).
  * `data-strength` ($S$, default `1.0`): Tangential velocity multiplier.
  * `data-range` ($d_{\max}$, default `320`): Whirlpool radius.
* **Mathematical Model:**
  $$
  r = 	ext{range} \cdot (	ext{on}\ ?\ 1.4 : 1)
  $$
  $$
  S' = S \cdot (	ext{on}\ ?\ 2 : 1)
  $$
  $$
  	ext{if}\ d \ge r:\ 	ext{skip}
  $$
  $$
  f = (1 - d/r)^{1.4} \cdot S' \cdot 0.45
  $$
  $$
  v_x += (dy/d) \cdot f \cdot s + (dx/d) \cdot f \cdot 0.12
  $$
  $$
  v_y += (-dx/d) \cdot f \cdot s + (dy/d) \cdot f \cdot 0.12
  $$
  $$
  	ext{if}\ 	ext{on}:\ 	ext{heat} = \max(	ext{heat}, (1 - d/r) \cdot 0.6)
  $$
* **Expected Behavior & Conformance Invariants:**
  * Particles rotate around the attractor in a whirlpool. A small radial pull factor ($0.12$) pulls particles inward to keep the whirlpool structured rather than flinging particles out.
  * *Invariants:* Verified using `exactDelta(0.020, -0.171)`.

#### 6.1.9 Absorb (`absorb`)
* **What it does (Summary):** Captures nearby particles into a central storage core. When core mass reaches capacity, it collapse-triggers a supernova explosion.
* **Class:** Class [A]
* **Attributes & Parameters:**
  * `data-absorb` ($r_{	ext{absorb}}$, default `64`): Capture radius threshold.
  * `data-max` ($M_{\max}$, default `30`): Mass capacity.
  * `data-strength` ($S$, default `0.8`): Accretion speed.
  * `data-range` ($d_{\max}$, default `360`): Accretion area.
* **Mathematical Model:**
  $$
  	ext{if}\ p.	ext{cap}\ 	ext{or}\ d \ge 	ext{absorbR}:\ 	ext{skip}
  $$
  $$
  p.	ext{cap} = b
  $$
  $$
  b.	ext{mass} += 1
  $$
  $$
  	ext{if}\ b.	ext{mass} \ge 	ext{maxMass}:\ 	ext{env.supernova}(b)
  $$
* **Expected Behavior & Conformance Invariants:**
  * Uncaptured particles passing within `data-absorb` are bound (`p.cap = b`), incrementing the core's mass counter. On reaching `maxMass`, all held particles are released radially with extreme speeds ($4 ightarrow 7\ 	ext{px/frame}$) and peak heat.
  * *Invariants:* Verified by asserting capture accumulation and subsequent radial burst trigger.

---

### 6.2 Extended Designed Forces

#### 6.2.1 Lens (`lens`)
* **What it does (Summary):** Bends the velocity path of a particle relative to its proximity, acting like gravitational path refraction without changing kinetic energy.
* **Class:** Class [A]
* **Attributes & Parameters:**
  * `data-strength` ($	heta_{\max}$): Maximum bending rotation angle.
  * `data-range` ($d_{\max}$): Refraction boundary.
  * `data-spin` ($	ext{sign}$): Bending direction ($\pm 1$).
* **Mathematical Model:**
  $$
  	heta = 	heta_{\max} \cdot (1 - d/d_{\max}) \cdot 	ext{sign}
  $$
  $$
  v = 	ext{rotate}(v, 	heta)
  $$
* **Expected Behavior & Conformance Invariants:**
  * Bends the trajectory of particles passing through the zone, preserving velocity magnitude. Generates visual caustics and arcs.
  * *Invariants:* Verified using `speedPreserved()`.

#### 6.2.2 Align (`align`)
* **What it does (Summary):** Steers particles to match a reference heading direction (Class A) or the average heading direction of neighboring particles (Class B).
* **Class:** Class [A/B]
* **Attributes & Parameters:**
  * `data-angle` ($	heta$): Target alignment angle.
  * `data-strength` ($k_{	ext{align}}$): Angular steering rate.
  * `data-range`: Neighbor lookup radius.
* **Mathematical Model:**
  $$
  \hat{h} = 	ext{heading (A) or mean}(v_n)	ext{ (B)}
  $$
  $$
  v += (\hat{h} \cdot |v| - v) \cdot k_{	ext{align}} \quad (d < d_{\max})
  $$
* **Expected Behavior & Conformance Invariants:**
  * Schooling/flocking dynamics where particles align to move in parallel.
  * *Invariants:* Verified using `movesToward()` or mean neighboring direction steering.

#### 6.2.3 Crystallize (`crystallize`)
* **What it does (Summary):** Snaps particles to static lattice positions when they are cold, mimicking phase transitions.
* **Class:** Class [A]
* **Attributes & Parameters:**
  * `data-strength` ($k_{	ext{snap}}$): Snap speed constant.
  * `data-range`: Influence limit.
* **Mathematical Model:**
  $$
  	ext{if}\ 	ext{heat} < 	heta_{	ext{freeze}}:
  $$
  $$
  v += (	ext{latticeNode}(p) - p) \cdot k_{	ext{snap}}
  $$
  $$
  v *= 0.9
  $$
* **Expected Behavior & Conformance Invariants:**
  * Particles snap onto crystal grid nodes and lock in place when cool. When heated, they melt back into liquid state.
  * *Invariants:* Verified using node snapping under cool conditions.

#### 6.2.4 Resonate (`resonate`)
* **What it does (Summary):** Modulates sibling force strength using a sinusoidal wave to create harmonic oscillations.
* **Class:** Class [A] (modifier)
* **Attributes & Parameters:**
  * `data-strength` ($S_0$): Base force amplitude.
  * `data-omega` ($\omega$): Temporal frequency of oscillation.
* **Mathematical Model:**
  $$
  S(t) = S_0 \cdot (1 + \sin(\omega \cdot t + \phi))
  $$
  $$
  	ext{applyCoreForce}(S(t))
  $$
* **Expected Behavior & Conformance Invariants:**
  * Sibling forces pulsate periodically, generating standing waves and beat interference patterns.
  * *Invariants:* Verified using `modulatesStrength()`.

#### 6.2.5 Gate (`gate`)
* **What it does (Summary):** Acts as a one-way physical gate, allowing particles to cross in one direction while reflecting them in the opposite direction.
* **Class:** Class [A]
* **Attributes & Parameters:**
  * `data-angle` ($	heta$): Normal vector direction for the gate boundary.
* **Mathematical Model:**
  $$
  \hat{n} = (\cos	heta, \sin	heta)
  $$
  $$
  	ext{if}\ (v \cdot \hat{n}) < 0:
  $$
  $$
  v -= 2(v \cdot \hat{n}) \cdot \hat{n}
  $$
* **Expected Behavior & Conformance Invariants:**
  * Particles moving along the normal vector pass through. Particles hitting the boundary in the opposite direction are reflected elastically.
  * *Invariants:* Verified by asserting wrong-way velocity reversal.

#### 6.2.6 Spotlight (`spotlight`)
* **What it does (Summary):** Gates companion forces to a directional cone relative to a central heading.
* **Class:** Class [A] (modifier)
* **Attributes & Parameters:**
  * `data-angle` ($	heta$): Direction vector.
  * `data-fov` ($\phi$): FOV half-cone angle.
* **Mathematical Model:**
  $$
  	ext{if}\ 	ext{acos}(\hat{u}_{b ightarrow p} \cdot \hat{h}) < \phi:
  $$
  $$
  	ext{applyCoreForce}()
  $$
* **Expected Behavior & Conformance Invariants:**
  * Forces are active inside the spotlight cone, and skipped/gated outside.
  * *Invariants:* Verified using `gatesOutsideCone()`.

#### 6.2.7 Wind (`wind`)
* **What it does (Summary):** Applies a divergence-free curl-noise velocity to particles, simulating turbulent gust flows.
* **Class:** Class [A]
* **Attributes & Parameters:**
  * `data-strength` ($S$): Gust velocity.
  * `data-scale` ($s$): Spatial frequency of turbulence.
* **Mathematical Model:**
  $$
  v += 	ext{curl}(	ext{noise}(x \cdot s, y \cdot s, t \cdot s_t)) \cdot S
  $$
* **Expected Behavior & Conformance Invariants:**
  * Particles wander through naturally evolving eddies and wind currents.
  * *Invariants:* Verified by asserting divergence-free vector drift.

#### 6.2.8 Shear (`shear`)
* **What it does (Summary):** Creates a velocity gradient parallel to the flow axis, dragging particles in proportion to their perpendicular offset.
* **Class:** Class [A]
* **Attributes & Parameters:**
  * `data-angle`: Axis angle of the shear flow.
  * `data-strength` ($S$): Gradient strength factor.
  * `data-range` ($d_{\max}$): Layer boundary.
* **Mathematical Model:**
  $$
  v_{\parallel} += S \cdot rac{	ext{offset}_{\perp}}{d_{\max}} \cdot (1 - d/d_{\max})
  $$
* **Expected Behavior & Conformance Invariants:**
  * Laminar drag layers where particles accelerate more the farther they are offset from the axis line.
  * *Invariants:* Verified using gradient velocity additions.

#### 6.2.9 Buoyancy (`buoyancy`)
* **What it does (Summary):** Calculates particle expansion from heat, driving vertical rises or sinks in density.
* **Class:** Class [A+E]
* **Attributes & Parameters:**
  * `data-strength` ($g$): Gravity acceleration scalar.
* **Mathematical Model:**
  $$
  ho_p = rac{	ext{base}}{	ext{size} \cdot (1 + 	ext{heat})}
  $$
  $$
  v_y += (ho_{	ext{med}} - ho_p) \cdot g
  $$
* **Expected Behavior & Conformance Invariants:**
  * Hot/large (less dense) particles rise vertically. Cold/small (more dense) particles sink.
  * *Invariants:* Verified by vertical movement correlation with heat.

#### 6.2.10 Cohesion (`cohesion`)
* **What it does (Summary):** Simulates molecular surface tension, attracting nearby particles while pushing back on overlap.
* **Class:** Class [B]
* **Attributes & Parameters:**
  * `data-r0`: Hard overlap core radius.
  * `data-range` ($r_1$): Attraction radius.
  * `data-strength` ($k_c$): Attraction coefficient.
* **Mathematical Model:**
  $$
  	ext{for}\ n\ 	ext{in neighbors}(p, r_1):
  $$
  $$
  	ext{if}\ d_n < r_0: v -= k_p \cdot (r_0 - d_n) \cdot \hat{u}_n
  $$
  $$
  	ext{else}: v += k_c \cdot (d_n - r_0) \cdot \hat{u}_n
  $$
* **Expected Behavior & Conformance Invariants:**
  * Particles cluster and group into cohesive droplets that merge and split on impact.
  * *Invariants:* Verified by asserting attraction at mid-range and push inside $r_0$.

#### 6.2.11 Pressure (`pressure`)
* **What it does (Summary):** Simulates incompressible SPH fluid density relaxation, pushing overlapping particles down the density gradient.
* **Class:** Class [B]
* **Attributes & Parameters:**
  * `data-range` ($h$): Smoothing kernel radius.
  * `data-strength` ($k$): Gas constant/relaxation factor.
  * `data-rho0` ($ho_0$): Target rest density.
* **Mathematical Model:**
  $$
  ho_p = \sum_n W(d_n, h)
  $$
  $$
  v += -k \cdot \sum_n (ho_p - ho_0) \cdot 
abla W(d_n, h)
  $$
* **Expected Behavior & Conformance Invariants:**
  * Particles actively resist crowding, spreading out to fill local spaces evenly and splashing on impacts.
  * *Invariants:* Verified by density spreading and SPH relaxation checks.

#### 6.2.12 Link (`link`)
* **What it does (Summary):** Project-constrains distance between paired particles, acting like elastic strings or chains.
* **Class:** Class [B]
* **Attributes & Parameters:**
  * `data-link`: Spaced IDs of linked particles.
  * `data-len` ($L$): Rest distance.
* **Mathematical Model:**
  $$
  e = (|p_a - p_b| - L)
  $$
  $$
  p_a -= 0.5 \cdot e \cdot \hat{u};\ p_b += 0.5 \cdot e \cdot \hat{u}
  $$
* **Expected Behavior & Conformance Invariants:**
  * Particles stay bound to rest distance, forming ropes, chains, or cloth meshes.
  * *Invariants:* Verified by asserting distance conservation.

#### 6.2.13 Hunt (`hunt`)
* **What it does (Summary):** Sets two distinct particle species to predator or prey, simulating pursuit and evasion.
* **Class:** Class [B+E]
* **Attributes & Parameters:**
  * `data-species`: E.g., predator or prey.
  * `data-strength` ($S$): Pursuit/evasion speed.
* **Mathematical Model:**
  $$
  	ext{predator}: v += 	ext{seek}(	ext{prey}) \cdot S
  $$
  $$
  	ext{prey}: v += 	ext{flee}(	ext{predator}) \cdot S
  $$
* **Expected Behavior & Conformance Invariants:**
  * Predators accelerate toward the nearest prey; prey particles accelerate away from predators, creating migratory trails.
  * *Invariants:* Verified by seek/flee species tracking.

#### 6.2.14 Pheromone (`pheromone`)
* **What it does (Summary):** Spawns decaying trails on a scalar grid that guide particles up the trail gradient.
* **Class:** Class [C]
* **Attributes & Parameters:**
  * `data-strength` ($\delta$): Grid deposition amount.
  * `data-follow` ($k_{	ext{follow}}$): Gradient follow factor.
* **Mathematical Model:**
  $$
  	ext{deposit}: T(x) += \delta
  $$
  $$
  	ext{steer}: v += 
abla T(x) \cdot k_{	ext{follow}}
  $$
  $$
  	ext{grid}: T \leftarrow (T \cdot 	ext{decay}) \circledast 	ext{blur}
  $$
* **Expected Behavior & Conformance Invariants:**
  * Particles self-organize into branch networks, tracing paths between active attractor nodes (slime mold simulation).
  * *Invariants:* Verified by `followsGradient()` check.

#### 6.2.15 Memory (`memory`)
* **What it does (Summary):** Tracks occupancy grid footprints, reinforcing frequently travelled pathways.
* **Class:** Class [C]
* **Attributes & Parameters:**
  * `data-strength` ($\mu$): Trail draw multiplier.
* **Mathematical Model:**
  $$
  M(x) += \lambda \cdot 	au
  $$
  $$
  	ext{force\_factor} = (1 + \mu \cdot M(x))
  $$
* **Expected Behavior & Conformance Invariants:**
  * Sibling attractor forces are amplified along heavily travelled paths, focusing particles onto worn trails.
  * *Invariants:* Verified by path accumulation reinforcement.

#### 6.2.16 Morph (`morph`)
* **What it does (Summary):** Directs particles to coordinate points on an SVG path, image mask, or dataset.
* **Class:** Class [D]
* **Attributes & Parameters:**
  * `data-target`: SVG path or shape reference.
  * `data-strength` ($k_m$): Snapping factor.
* **Mathematical Model:**
  $$
  v += (t_k - p) \cdot k_m + 	ext{jitter} \cdot (1 - 	ext{arrived})
  $$
  $$
  	ext{arrived} = 	ext{clamp}(1 - |t_k - p|/\epsilon, 0, 1)
  $$
* **Expected Behavior & Conformance Invariants:**
  * Particles spring to and shape target symbols (favicons, marks, punctuation), fading their jitter on arrival.
  * *Invariants:* Verified by shape convergence.

#### 6.2.17 Pigment (`pigment`)
* **What it does (Summary):** Transfers color dye dynamically between particles and bodies, simulating pigment advection.
* **Class:** Class [E]
* **Attributes & Parameters:**
  * `data-color`: Dye tint hex.
* **Mathematical Model:**
  $$
  c_p = 	ext{mix}(c_p, c_{	ext{other}}, 	ext{rate})
  $$
* **Expected Behavior & Conformance Invariants:**
  * Particles passing through the body's overlap radius adopt its pigment color, carrying it down the flow field.
  * *Invariants:* Verified using `adoptsTint()`.

#### 6.2.18 Warp (`warp`)
* **What it does (Summary):** Relocates particles between paired spatial coordinates.
* **Class:** Class [A] (paired)
* **Attributes & Parameters:**
  * `data-pair`: Exit selector targeting exit partner.
  * `data-throat`: Throat radius.
  * `data-twist` ($\Delta	heta$): Twist rotation applied during bridge crossing.
  * `data-scale` ($k$): Exit velocity scaling factor.
* **Mathematical Model:**
  $$
  	ext{if}\ d < 	ext{throatR}:
  $$
  $$
  	ext{local\_offset} = (p.	ext{pos} - A.	ext{center}) \cdot k
  $$
  $$
  p.	ext{pos} = B.	ext{center} + 	ext{rotate}(	ext{local\_offset}, \Delta	heta)
  $$
  $$
  p.	ext{vel} = 	ext{rotate}(p.	ext{vel}, \Delta	heta) \cdot k
  $$
* **Expected Behavior & Conformance Invariants:**
  * Draws particles into the entry mouth and teleports them to the exit mouth, carrying momentum.
  * *Invariants:* Verified by position change on throat entry.

#### 6.2.19 Spawn (`spawn`)
* **What it does (Summary):** Mints new particles into the environment.
* **Class:** Class [S] (Source)
* **Attributes & Parameters:**
  * `data-rate`: Spawn rate.
  * `data-create`: One-shot count.
  * `data-remnant`: Dead remnant preset.
* **Mathematical Model:**
  $$
  	ext{spawn N new:}\ 	heta = 2\pi k/N;\ v_{	ext{spawn}} = (\cos	heta, \sin	heta) \cdot 	ext{spd};\ 	ext{age}=0
  $$
* **Expected Behavior & Conformance Invariants:**
  * Spawns new particles that expire by age.
  * *Invariants:* Verified by particle count increment and subsequent age decay.

---

### 6.3 Cosmology Presets (Composite Layouts)

Cosmology presets use co-located virtual bodies of basic forces to represent astronomical objects.

#### 6.3.1 Blackhole (`blackhole`)
* **What it does (Summary):** Simulates a massive gravitational sink.
* **Class:** Class [A] / Preset
* **Composition:** `attract` (steep well) + `vortex` (tangential frame drag) + `absorb` (event horizon capture) + `lens` (light bending).
* **Attributes & Parameters:**
  * `data-strength` ($S$ / $GM$): Gravity well mass.
  * `data-horizon` ($r_s$): Radius of capture.
  * `data-spin`: Accretion disk swirl.
  * `data-max`: Saturation mass.
* **Mathematical Model:**
  $$
  M_{	ext{source}} = S \cdot k_g
  $$
  $$
  	ext{if}\ d \le r_s\ (	ext{horizon}): p.	ext{cap} = b;\ b.	ext{mass}++
  $$
  $$
  	ext{else}:
  $$
  $$
  	ext{radial acceleration:}\ a = M_{	ext{source}} / (d^2 + \epsilon^2)
  $$
  $$
  v += a \cdot \hat{u}
  $$
  $$
  	ext{frame drag swirl:}\ v += rac{(-dy, dx)}{d} \cdot a \cdot 	ext{spin} \cdot 0.3
  $$
  $$
  	ext{path deflection:}\ 	heta = 2 \cdot M_{	ext{source}} / (d \cdot c^2);\ v = 	ext{rotate}(v, 	heta)
  $$
  $$
  	ext{heating:}\ 	ext{heat} = \max(	ext{heat}, (1 - (d-r_s)/d_{\max}) \cdot 0.9)
  $$
* **Expected Behavior:** Bends incoming particle paths (lensing) and swirls them into an orbital disk (frame drag). Particles crossing the horizon are captured, triggering a supernova at capacity.

#### 6.3.2 Whitehole (`whitehole`)
* **What it does (Summary):** Simulates a massive gravitational repeller.
* **Class:** Class [A] / Preset
* **Composition:** `repel` (extreme) + `stream` (eject).
* **Attributes & Parameters:**
  * `data-strength` ($GM$): Outward push force.
  * `data-horizon` ($r_s$): Emission radius.
  * `data-angle`: Ejection angle direction.
* **Mathematical Model:**
  $$
  	ext{if}\ d < r_s:\ p.	ext{pos} = b.	ext{center} + \hat{u}_{	ext{out}} \cdot r_s;\ v = \hat{u}_{	ext{out}} \cdot 	ext{spd}
  $$
  $$
  	ext{else}:\ v -= (GM/d^2) \cdot \hat{u}
  $$
* **Expected Behavior:** Particles are pushed away radially. Particles inside the horizon are instantly ejected along the angle heading.

#### 6.3.3 Wormhole (`wormhole`)
* **What it does (Summary):** Relocates particles between paired spatial coordinates.
* **Class:** Class [A] / Preset
* **Composition:** `attract` + `warp` + `repel`.
* **Attributes & Parameters:**
  * `data-pair`: Selector targeting partner throat.
  * `data-throat`: Transfer radius.
  * `data-twist` ($\Delta	heta$): Rotation added during bridge crossing.
  * `data-scale` ($k$): Speed scalar multiplier.
* **Mathematical Model:**
  $$
  	ext{if}\ d < 	ext{throatR}:
  $$
  $$
  	ext{local\_offset} = (p.	ext{pos} - A.	ext{center}) \cdot k
  $$
  $$
  p.	ext{pos} = B.	ext{center} + 	ext{rotate}(	ext{local\_offset}, \Delta	heta)
  $$
  $$
  p.	ext{vel} = 	ext{rotate}(p.	ext{vel}, \Delta	heta) \cdot k
  $$
* **Expected Behavior:** Draws particles into the entry mouth and teleports them to the exit mouth, carrying momentum.

#### 6.3.4 Supernova (`supernova`)
* **What it does (Summary):** Collapse explosion.
* **Class:** Class [S] / Preset
* **Composition:** `spawn` (one-shot).
* **Attributes & Parameters:**
  * `data-create` ($N$): Number of particles spawned.
  * `data-strength` ($v_0$): Initial velocity of spawned matter.
  * `data-range` ($R$): Shockwave radius.
* **Mathematical Model:**
  $$
  	ext{release:}\ p.	ext{cap} = 	ext{null};\ v = \hat{u} \cdot 	ext{rand}(4..7);\ 	ext{heat}=1\ \ (	ext{held particles})
  $$
  $$
  	ext{spawn N new:}\ 	heta = 2\pi k/N;\ v_{	ext{spawn}} = (\cos	heta, \sin	heta) \cdot 	ext{spd};\ 	ext{age}=0
  $$
  $$
  	ext{shockwave:}\ 	ext{burst}(c_x, c_y, R)
  $$
* **Expected Behavior:** Releases captured particles, spawns $N$ new particles radially with high heat, sends a shockwave burst, and leaves behind a neutron star (`spring`) or black hole remnant.

#### 6.3.5 Fountain (`fountain`)
* **What it does (Summary):** Continuous particle emitter.
* **Class:** Class [S] / Preset
* **Composition:** `spawn` (continuous).
* **Attributes & Parameters:**
  * `data-rate` ($r$): Particles spawned per frame.
  * `data-angle`: Vector heading.
  * `data-strength`: Initial speed.
  * `data-spread`: Cone angle spread.
* **Mathematical Model:**
  $$
  	ext{each frame (Poisson rate}\ r	ext{): spawn}\ \lfloor r floor\ 	ext{particles}
  $$
  $$
  v_{	ext{spawn}} = \hat{h} \cdot 	ext{spd} + 	ext{cone}(	ext{spread});\ 	ext{heat}=	ext{warm};\ 	ext{age}=0
  $$
* **Expected Behavior:** Sprays particles continuously along the nozzle angle inside a spread cone. Particles fade out and despawn based on age.

---

### 6.4 Natural Primitives

#### 6.4.1 Gravity (`gravity`)
* **What it does (Summary):** Simulates natural, softened inverse-square gravitational attraction.
* **Class:** Class [A]
* **Attributes & Parameters:**
  * `data-strength` ($M$): Source mass.
* **Mathematical Model:**
  $$
  F = rac{G \cdot M}{d^2 + \epsilon^2} \cdot \hat{u} \quad (\epsilon pprox 2GM/c^2)
  $$
* **Expected Behavior & Conformance Invariants:**
  * Particles inside range are pulled inward. Clamps terminal velocity to the sim speed of light ($c = v_{\max}$).
  * *Invariants:* Verified using `movesToward()` and $1/d^2$ scaling.

#### 6.4.2 Charge (`charge`)
* **What it does (Summary):** Simulates electrostatic-like interactions with signed charge attraction and repulsion.
* **Class:** Class [A]
* **Attributes & Parameters:**
  * `data-strength`: Mass.
  * `data-spin`: Source charge sign ($\pm 1$).
* **Mathematical Model:**
  $$
  F = -\sigma \cdot q \cdot rac{G \cdot M}{d^2 + \epsilon^2} \cdot \hat{u}
  $$
* **Expected Behavior & Conformance Invariants:**
  * Repels like charges, attracts opposite charges. Ignored by neutral particles.
  * *Invariants:* Verified using `unaffectedWhenNeutral()`.

#### 6.4.3 Magnetism (`magnetism`)
* **What it does (Summary):** Simulates Lorentz force magnetic deflection on moving charged particles.
* **Class:** Class [A]
* **Attributes & Parameters:**
  * `data-strength` ($B$): Field density.
* **Mathematical Model:**
  $$
  F = q \cdot B \cdot (-v_y, v_x)
  $$
* **Expected Behavior & Conformance Invariants:**
  * Deflects moving charged particles perpendicular to their velocity vector without doing work.
  * *Invariants:* Verified using `perpendicularToVelocity()`.

#### 6.4.4 Thermal (`thermal`)
* **What it does (Summary):** Simulates localized heat-based Langevin Brownian motion.
* **Class:** Class [A]
* **Attributes & Parameters:**
  * `data-strength` ($T$): Temperature factor.
* **Mathematical Model:**
  $$
  \sigma = \sqrt{2 \cdot S \cdot (1 - d/r)}
  $$
* **Expected Behavior & Conformance Invariants:**
  * Agitates particles into random walks.
  * *Invariants:* Verified by checking isotropic distribution and statistical variance.

#### 6.4.5 Collide (`collide`)
* **What it does (Summary):** Resolves elastic billiard-ball collisions between particles.
* **Class:** Class [B]
* **Attributes & Parameters:**
  * `data-strength` ($e$): Restitution factor.
* **Mathematical Model:**
  $$
  	ext{elastic half-impulse along contact normal } \hat{n} 	ext{ with restitution } e = S
  $$
* **Expected Behavior & Conformance Invariants:**
  * Particles approaching within contact distance bounce elastically, conserving kinetic energy and momentum.
  * *Invariants:* Verified using `momentumConserved()` and separation.

#### 6.4.6 Diffuse (`diffuse`)
* **What it does (Summary):** Drives particles to move up the concentration gradient of a diffused scalar field.
* **Class:** Class [C]
* **Mathematical Model:**
  $$
  rac{\partial \phi}{\partial t} = D 
abla^2 \phi
  $$
  $$
  v += 
abla \phi
  $$
* **Expected Behavior & Conformance Invariants:**
  * Particles steer toward grid coordinates of higher concentration.
  * *Invariants:* Verified using `followsGradient()`.

#### 6.4.7 Propagate (`propagate`)
* **What it does (Summary):** Simulates wave propagation in the medium, creating wave fronts that push particles along.
* **Class:** Class [C]
* **Mathematical Model:**
  $$
  rac{\partial^2 \phi}{\partial t^2} = c^2 
abla^2 \phi
  $$
* **Expected Behavior & Conformance Invariants:**
  * Particles are swept along by expanding wavefronts.
  * *Invariants:* Verified by wave-riding and shock displacement.
