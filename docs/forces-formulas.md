# The Forces & Fields — Reference Formulas & Attributes

This document serves as the canonical reference for the physics formulas, DOM attribute APIs, and substrate math backing the reciprocal field system. It merges the active engine rules with the proposed extended/cosmological vocabulary.

---

## Notation & Symbol Legend

| Symbol | Meaning | Unit / Scale |
|---|---|---|
| $b$ | A registered DOM body / attractor element | Object |
| $p$ | A particle in the simulation | Object |
| $s$ | General variable for spin (vortex direction/strength) | $\pm 1$ |
| $t$ | Time parameter (current frame) | Frames ($1\ \text{frame} = 1/60\ \text{s}$) |
| $v, v_t$ | Particle velocity vector $(v_x, v_y)$ | $\text{px}/\text{frame}$ |
| $p.\text{pos}$ | Particle position vector $(x, y)$ | $\text{px}$ |
| $b.\text{center}$ | Body center coordinates $(c_x, c_y)$ | $\text{px}$ |
| $dx, dy$ | Vector from particle to body center: $(c_x - x, c_y - y)$ | $\text{px}$ |
| $d, \text{dist}$ | Euclidean distance between particle and body center: $\sqrt{dx^2 + dy^2}$ | $\text{px}$ |
| $d_{\max}, \text{range}$ | Maximum effective influence range of a force | $\text{px}$ |
| $\hat{u}$ | Normalized unit vector from particle to body: $(dx, dy) / \text{dist}$ | Unit Vector |
| $S, \text{strength}$ | Nominal force magnitude scaling factor | Scalar |
| $\text{on}, b.\text{on}$ | Boolean flag indicating the body is engaged (hover, focus, tap) | `true` / `false` |
| $\text{heat}$ | Particle excitation level, driving color blend and size | $[0, 1]$ |
| $m$ | Particle inertial mass | Scalar |
| $M$ | Body source mass | Scalar |
| $b.\text{d}$ | Eased local density computed for a body | $[0, 1]$ |
| $b.\text{count}$ | Raw density tally accumulated in the current frame | Scalar |
| $f$ | Medium friction coefficient (damping) | $\approx 0.95$ |
| $c, v_{\max}$ | Sim speed-of-light / velocity cap | Scalar |

---

## Implementation Classes

Forces are grouped into architectural classes that define their interaction scope and computational cost:

- **Class [A]**: **Body $\rightarrow$ Particle.** Local force where a DOM body influences a particle. Compute cost: $O(b \cdot n)$. *Drop-in.*
- **Class [B]**: **Particle $\rightarrow$ Particle.** Needs neighbor queries (typically via spatial hash). Compute cost: $O(n \cdot k)$ with $k$ neighbors.
- **Class [C]**: **Field-Buffer.** Reads/writes persistent scalar/vector grids. Compute cost: $O(n + \text{grid})$.
- **Class [D]**: **Target-Geometry.** Body carries a target point set; particles spring to matching points. Compute cost: $O(n)$.
- **Class [E]**: **Particle Attribute.** Uses additional particle state variables (charge, species, age).
- **Class [S]**: **Source / Sink.** Creates or destroys matter. *Breaks particle count conservation; must be budgeted.*
- **[Preset]**: **Virtual Composite.** Expands a single HTML element into co-located virtual bodies of Class [A] to compose complex reactions.

---

## 1. The Nine Canonical Forces (Active Engine)

These forces are fully implemented in `forces.js` and drive the homepage Capabilities matrix. By default, **engagement (hover/focus/tap)** widens their range and amplifies strength.

| Force (Token) | Class | HTML Attributes & Defaults | Math Formula / Implementation | Behavior & On-State Impact |
|---|---|---|---|---|
| **Attract**<br>`attract` | **[A]** | `data-strength="1.0"`<br>`data-range="300"` | $$r = \text{range} \cdot (\text{on}\ ?\ 1.5 : 1)$$<br>$$S' = S \cdot (\text{on}\ ?\ 3 : 1)$$<br>$\text{if}\ d \ge r:\ \text{skip}$<br>$$f = (1 - d/r)^2 \cdot S' \cdot 0.5$$<br>$$v += \hat{u} \cdot f$$<br>$\text{if}\ \text{form.orbit}: v += \frac{(-dy, dx)}{d} \cdot f \cdot \text{form.orbit}$<br>$\text{if}\ \text{on}: \text{heat} = \max(\text{heat}, (1 - d/r) \cdot 0.9)$ | Bounded gravity-like attractor well. Range $\times 1.5$, strength $\times 3$ on engagement. Optional orbital swirl added near lines. |
| **Emitter**<br>`emitter` | **[A]** | `data-angle="0"`<br>`data-strength="1.0"`<br>`data-range="300"` | $$r = \text{range} \cdot (\text{on}\ ?\ 1.4 : 1)$$<br>$\text{if}\ d \ge r:\ \text{skip}$<br>$\text{if}\ d < 24:$<br>&nbsp;&nbsp;&nbsp;&nbsp;$$\text{spread} = \text{rand}(-0.4..0.4)\ \text{rad}$$<br>&nbsp;&nbsp;&nbsp;&nbsp;$$h = \text{rotate}((\text{ux}, \text{uy}), \text{spread})$$<br>&nbsp;&nbsp;&nbsp;&nbsp;$$\text{spd} = 2.4 + S \cdot 2.6$$<br>&nbsp;&nbsp;&nbsp;&nbsp;$$v = h \cdot \text{spd};\ p.\text{pos} = b.\text{center} + h \cdot 26$$<br>&nbsp;&nbsp;&nbsp;&nbsp;$$\text{heat} = \max(\text{heat}, 0.9)$$<br>$\text{else}:$<br>&nbsp;&nbsp;&nbsp;&nbsp;$$f = (1 - d/r)^2 \cdot (0.25 + S \cdot 0.15)$$<br>&nbsp;&nbsp;&nbsp;&nbsp;$$v += \hat{u} \cdot f$$ | Recycle conduit: draws particles into a nozzle ($d \ge 24$) and ejects them as a hot jet ($d < 24$). Range $\times 1.4$ when `on`. |
| **Spring**<br>`spring` | **[A]** | `data-strength="1.0"`<br>`data-range="260"` | $$\text{rest} = \text{range} \cdot 0.6 \cdot (\text{on}\ ?\ 1.25 : 1)$$<br>$$\text{reach} = \text{rest} \cdot 2.1$$<br>$\text{if}\ d \ge \text{reach}:\ \text{skip}$<br>$$k = (0.006 + S \cdot 0.012) \cdot (\text{on}\ ?\ 1.7 : 1)$$<br>$$\text{stretch} = d - \text{rest}$$<br>$$v += \hat{u} \cdot \text{stretch} \cdot k$$<br>$$v *= 0.985$$<br>$\text{if}\ \text{on}: \text{heat} = \max\left(\text{heat}, \left(1 - \frac{|\text{stretch}|}{\text{rest}}\right) \cdot 0.5\right)$ | Tether with rest length. Pushes out when crowded, pulls in when strayed. Settle factor $0.985$ forms orbits. |
| **Reflect**<br>`reflect` | **[A]** | *none* (sized by bounding box) | $$\text{pad} = 6$$<br>$\text{if}\ p\ \text{is outside}\ (\text{box} + \text{pad}):\ \text{skip}$<br>$\text{resolve shallower penetration axis}:$<br>&nbsp;&nbsp;&nbsp;&nbsp;$$\text{push}\ p\ \text{outside boundary}$$<br>&nbsp;&nbsp;&nbsp;&nbsp;$$v_{\text{axis}} = -v_{\text{axis}} \cdot 0.85$$<br>$\text{if}\ |v| > 0.7:$<br>&nbsp;&nbsp;&nbsp;&nbsp;$$\text{env.spark}(x, y, \min(2.4, |v|))$$<br>&nbsp;&nbsp;&nbsp;&nbsp;$$\text{heat} = \max(\text{heat}, \min(0.85, |v| \cdot 0.4))$$ | Elastic bounce off element borders. Restitution $0.85$. Emits visual sparks on hard impacts ($|v| > 0.7$). |
| **Stream**<br>`stream` | **[A]** | `data-angle="0"`<br>`data-strength="1.0"`<br>`data-range="340"` | $$r = \text{range} \cdot (\text{on}\ ?\ 1.4 : 1)$$<br>$$S' = S \cdot (\text{on}\ ?\ 2 : 1)$$<br>$\text{if}\ d \ge r:\ \text{skip}$<br>$$f = (1 - d/r)^{1.1} \cdot S' \cdot 0.5$$<br>$$v += (\text{ux}, \text{uy}) \cdot f$$<br>$\text{if}\ \text{on}: \text{heat} = \max(\text{heat}, (1 - d/r) \cdot 0.5)$ | Continuous directional flow vector. Range $\times 1.4$, strength $\times 2$ when `on`. |
| **Repel**<br>`repel` | **[A]** | `data-strength="1.1"`<br>`data-range="300"` | $$r = \text{range} \cdot (\text{on}\ ?\ 1.4 : 1)$$<br>$$S' = S \cdot (\text{on}\ ?\ 2 : 1)$$<br>$\text{if}\ d \ge r:\ \text{skip}$<br>$$f = (1 - d/r)^2 \cdot S' \cdot 0.5$$<br>$$v -= \hat{u} \cdot f$$ | Soft outward push from center. Carves a clean void. Range $\times 1.4$, strength $\times 2$ when `on`. |
| **Drag**<br>`drag` | **[A]** | `data-strength="1.0"`<br>`data-range="300"` | $$r = \text{range} \cdot (\text{on}\ ?\ 1.4 : 1)$$<br>$\text{if}\ d \ge r:\ \text{skip}$<br>$$k = (1 - d/r) \cdot (0.05 + S \cdot 0.07) \cdot (\text{on}\ ?\ 1.6 : 1)$$<br>$$v -= v \cdot k$$ | Viscous zone. Bleeds particle momentum without redirection. Calms dynamic areas. Range $\times 1.4$ when `on`. |
| **Vortex**<br>`vortex` | **[A]** | `data-spin="1"`<br>`data-strength="1.0"`<br>`data-range="320"` | $$r = \text{range} \cdot (\text{on}\ ?\ 1.4 : 1)$$<br>$$S' = S \cdot (\text{on}\ ?\ 2 : 1)$$<br>$\text{if}\ d \ge r:\ \text{skip}$<br>$$f = (1 - d/r)^{1.4} \cdot S' \cdot 0.45$$<br>$$v_x += (dy/d) \cdot f \cdot s + (dx/d) \cdot f \cdot 0.12$$<br>$$v_y += (-dx/d) \cdot f \cdot s + (dy/d) \cdot f \cdot 0.12$$<br>$\text{if}\ \text{on}: \text{heat} = \max(\text{heat}, (1 - d/r) \cdot 0.6)$ | Tangential swirl. Inward bias factor $0.12$ prevents collapse. Range $\times 1.4$, strength $\times 2$ on engagement. |
| **Absorb**<br>`absorb` | **[A]** | `data-absorb="64"`<br>`data-max="30"`<br>`data-strength="0.8"`<br>`data-range="360"` | $\text{if}\ p.\text{cap}\ \text{or}\ d \ge \text{absorbR}:\ \text{skip}$<br>$$p.\text{cap} = b$$<br>$$b.\text{mass} += 1$$<br>$\text{if}\ b.\text{mass} \ge \text{maxMass}:$<br>&nbsp;&nbsp;&nbsp;&nbsp;$$\text{env.supernova}(b)$$ | Accretion core. Traps particles ($d < \text{absorbR}$) and increases mass. Supernovas on reaching limit, ejecting matter radially. |

---

## 2. Extended Force Vocabulary (Proposed & Physical Primitives)

These forces constitute the roadmap's forward registry, splitting into designed behaviors, physical primitives, and virtual cosmology presets.

### 2.1 Extended Designed Forces

| Force (Token) | Class | Attributes | Math Formula / Implementation | Behavior & Unique Result |
|---|---|---|---|---|
| **Lens**<br>`lens` | **[A]** | `data-strength`<br>`data-range`<br>`data-spin` | $$\theta = \theta_{\max} \cdot (1 - d/d_{\max}) \cdot \text{sign}$$<br>$$v = \text{rotate}(v, \theta)$$ | Refracts path while preserving speed. Bends streams into caustics. |
| **Align**<br>`align` | **[A/B]** | `data-angle`<br>`data-strength`<br>`data-range` | $$\hat{h} = \text{heading (A) or mean}(v_n)\text{ (B)}$$<br>$$v += (\hat{h} \cdot |v| - v) \cdot k_{\text{align}}\ \ (d < d_{\max})$$ | Combed coherence. Steers particles toward a flow axis or local group vector. |
| **Crystallize**<br>`crystallize` | **[A]** | `data-strength`<br>`data-range` | $\text{if}\ \text{heat} < \theta_{\text{freeze}}:$<br>&nbsp;&nbsp;&nbsp;&nbsp;$$v += (\text{latticeNode}(p) - p) \cdot k_{\text{snap}}$$<br>&nbsp;&nbsp;&nbsp;&nbsp;$$v *= 0.9$$ | Freezes particles to a lattice when cool. Melts on heat/scroll. |
| **Resonate**<br>`resonate` | **[A]** | `data-strength`<br>`data-range`<br>`data-omega` | $$S(t) = S_0 \cdot (1 + \sin(\omega \cdot t + \phi))$$<br>$$\text{applyCoreForce}(S(t))$$ | Periodic oscillation. Creates standing waves and moiré beats. |
| **Gate**<br>`gate` | **[A]** | `data-angle` | $$\hat{n} = (\cos\theta, \sin\theta)$$<br>$\text{if}\ (v \cdot \hat{n}) < 0: v -= 2(v \cdot \hat{n}) \cdot \hat{n}$ | One-way membrane. Traps particles on one side of a bounding box. |
| **Spotlight**<br>`spotlight` | **[A]** | `data-angle`<br>`data-fov` | $\text{if}\ \text{acos}(\hat{u}_{b \rightarrow p} \cdot \hat{h}) < \phi:$<br>&nbsp;&nbsp;&nbsp;&nbsp;$$\text{applyCoreForce}()$$ | Angular boundary. Gates forces to an attention cone relative to heading. |
| **Wind**<br>`wind` | **[A]** | `data-strength`<br>`data-range`<br>`data-scale` | $$v += \text{curl}(\text{noise}(x \cdot s, y \cdot s, t \cdot s_t)) \cdot S$$ | Curl-noise flow field. Generates divergence-free natural turbulence eddies. |
| **Shear**<br>`shear` | **[A]** | `data-angle`<br>`data-strength`<br>`data-range` | $$v_{\parallel} += S \cdot \frac{\text{offset}_{\perp}}{d_{\max}} \cdot (1 - d/d_{\max})$$ | Boundary shear flow. Slips velocity layer offset perpendicularly. |
| **Buoyancy**<br>`buoyancy` | **[A+E]** | `data-strength`<br>`data-range` | $$\rho_p = \frac{\text{base}}{\text{size} \cdot (1 + \text{heat})}$$<br>$$v_y += (\rho_{\text{med}} - \rho_p) \cdot g$$ | Sedimentation. Hot particles expand and rise; cold/heavy ones sink. |
| **Cohesion**<br>`cohesion` | **[B]** | `data-r0`<br>`data-range`<br>`data-strength` | $\text{for}\ n\ \text{in neighbors}(p, r_1):$<br>&nbsp;&nbsp;&nbsp;&nbsp;$\text{if}\ d_n < r_0: v -= k_p \cdot (r_0 - d_n) \cdot \hat{u}_n$<br>&nbsp;&nbsp;&nbsp;&nbsp;$\text{else}: v += k_c \cdot (d_n - r_0) \cdot \hat{u}_n$ | Surface tension. Swarms merge and split like liquid droplets. |
| **Pressure**<br>`pressure` | **[B]** | `data-range`<br>`data-strength`<br>`data-rho0` | $$\rho_p = \sum_n W(d_n, h)$$<br>$$v += -k \cdot \sum_n (\rho_p - \rho_0) \cdot \nabla W(d_n, h)$$ | Incompressible fluid SPH model. Resists crowding, spreads evenly. |
| **Link**<br>`link` | **[B]** | `data-link`<br>`data-len`<br>`data-stiff` | $$e = (|p_a - p_b| - L)$$<br>$$p_a -= 0.5 \cdot e \cdot \hat{u};\ p_b += 0.5 \cdot e \cdot \hat{u}$$ | Verlet distance constraints. Chains particles to form ropes or cloth. |
| **Hunt**<br>`hunt` | **[B+E]** | `data-species`<br>`data-strength` | $$\text{predator}: v += \text{seek}(\text{prey}) \cdot S$$<br>$$\text{prey}: v += \text{flee}(\text{predator}) \cdot S$$ | Predator/prey ecosystems. Cycles populations via Lotka-Volterra. |
| **Pheromone**<br>`pheromone`| **[C]** | `data-strength`<br>`data-range`<br>`data-follow` | $$\text{deposit}: T(x) += \delta$$<br>$$\text{steer}: v += \nabla T(x) \cdot k_{\text{follow}}$$<br>$$\text{grid}: T \leftarrow (T \cdot \text{decay}) \circledast \text{blur}$$ | Stigmergy paths. Particles self-organize into transport networks. |
| **Memory**<br>`memory` | **[C]** | `data-strength`<br>`data-range` | $$M(x) += \lambda \cdot \tau$$<br>$$\text{force\_factor} = (1 + \mu \cdot M(x))$$ | Occupancy grid footprint. Frequently travelled pathways attract more. |
| **Morph**<br>`morph` | **[D]** | `data-target`<br>`data-strength` | $$v += (t_k - p) \cdot k_m + \text{jitter} \cdot (1 - \text{arrived})$$<br>$$\text{arrived} = \text{clamp}(1 - |t_k - p|/\epsilon, 0, 1)$$ | SVG/data targeting. Constellates dust into symbols (marks/logos). |
| **Pigment**<br>`pigment` | **[E]** | `data-color` | $$c_p = \text{mix}(c_p, c_{\text{other}}, \text{rate})$$ | Conserved color advection. Swarms physically transport pigment dyes. |

### 2.2 Cosmology Presets (Composite Layouts)

Cosmology presets use co-located virtual bodies of basic forces to represent astronomical objects:

- **Blackhole (`blackhole`)**
  - *Class:* [A] (+[S] if `data-destroy` is set)
  - *Composition:* `attract` (steep) + `vortex` (frame drag) + `absorb` (event horizon) + `lens` (light bending)
  - *Formula:*
    $$M_{\text{source}} = S \cdot k_g$$
    $$\text{if}\ d \le r_s\ (\text{horizon}): p.\text{cap} = b;\ b.\text{mass}++$$
    $$\text{else}:$$
    $$\text{radial acceleration:}\ a = M_{\text{source}} / (d^2 + \epsilon^2)$$
    $$\text{velocity update:}\ v += a \cdot \hat{u}$$
    $$\text{frame drag swirl:}\ v += \frac{(-dy, dx)}{d} \cdot a \cdot \text{spin} \cdot 0.3$$
    $$\text{path deflection:}\ \theta = 2 \cdot M_{\text{source}} / (d \cdot c^2);\ v = \text{rotate}(v, \theta)$$
    $$\text{heating:}\ \text{heat} = \max(\text{heat}, (1 - (d-r_s)/d_{\max}) \cdot 0.9)$$
- **Whitehole (`whitehole`)**
  - *Class:* [A] (+[S])
  - *Composition:* `repel` (extreme) + `stream` (eject vector)
  - *Formula:*
    $$\text{if}\ d < r_s:\ p.\text{pos} = b.\text{center} + \hat{u}_{\text{out}} \cdot r_s;\ v = \hat{u}_{\text{out}} \cdot \text{spd}$$
    $$\text{else}:\ v -= (GM/d^2) \cdot \hat{u}$$
- **Wormhole (`wormhole`)**
  - *Class:* [A · paired]
  - *Composition:* `attract` + `warp` (throat A) $\leftrightarrow$ `warp` + `repel` (throat B)
  - *Formula (Warp throat relocation):*
    $$\text{if}\ d < \text{throatR}:$$
    $$\text{local\_offset} = (p.\text{pos} - A.\text{center}) \cdot k$$
    $$p.\text{pos} = B.\text{center} + \text{rotate}(\text{local\_offset}, \Delta\theta)$$
    $$p.\text{vel} = \text{rotate}(p.\text{vel}, \Delta\theta) \cdot k$$
    $$p.\text{heat} = \max(p.\text{heat}, 0.6)$$
- **Supernova (`supernova`)**
  - *Class:* [S] (Source blast)
  - *Composition:* `spawn` (one-shot) + remnant swap
  - *Formula:*
    $$\text{release:}\ p.\text{cap} = \text{null};\ v = \hat{u} \cdot \text{rand}(4..7);\ \text{heat}=1\ \ (\text{held particles})$$
    $$\text{spawn N new:}\ \theta = 2\pi k/N;\ v_{\text{spawn}} = (\cos\theta, \sin\theta) \cdot \text{spd};\ \text{age}=0$$
    $$\text{shockwave:}\ \text{burst}(c_x, c_y, R)$$
    $$\text{remnant:}\ b \rightarrow \text{neutron star (`spring`) or Blackhole}$$
- **Fountain (`fountain`)**
  - *Class:* [S]
  - *Composition:* `spawn` (continuous) along a nozzle vector
  - *Formula:*
    $$\text{each frame (Poisson rate}\ r\text{): spawn}\ \lfloor r \rfloor\ \text{particles}$$
    $$v_{\text{spawn}} = \hat{h} \cdot \text{spd} + \text{cone}(\text{spread});\ \text{heat}=\text{warm};\ \text{age}=0$$
    $$\text{despawn}\ \text{if}\ \text{age} > \text{life}$$

---

## 3. Substrate & Field Mechanics (The Ground State)

### 3.1 Mass & Velocity Integration
Particles integrate coordinates under a viscous friction model:
$$v_{t+1} = v_t \cdot f \quad (f \approx 0.95)$$
$$\text{heat}_{t+1} = \text{heat}_t \cdot 0.972$$

- **Option A (Unit Mass - Default UI):**
  $$v += F$$
- **Option B (First-Class Mass - Physics Simulation):**
  $$a = F/m$$
  $$v += a \cdot \tau$$
  $$p = m \cdot v\ \text{(conserve momentum on collisions/fusions)}$$

### 3.2 Background Currents (Carrier Waves)
The background currents create a baseline flow-field force:
$$\text{slope}(x) = \cos(x \cdot \text{freq} + \phi) \cdot \text{freq} \cdot \text{amp}$$
$$v_x += \text{slope} \cdot \text{influence}$$

Waves bend locally toward the engaged body ($b.\text{on} == \text{true}$) using a Gaussian falloff ($\sigma = 260\ \text{px}$).

### 3.3 Two-Way Density Feedback (The Bridge)
- **DOM $\rightarrow$ Canvas (Pipe 1):**
  $$c_x = (\text{rect.left} + \text{rect.width}/2) \cdot \text{DPR}$$
  $$c_y = (\text{rect.top} + \text{rect.height}/2) \cdot \text{DPR}$$
  $$\text{DPR} = \min(\text{devicePixelRatio}, 2)$$
- **Canvas $\rightarrow$ DOM (Pipe 2):**
  $$b.\text{count} = \sum_p \max(0, 1 - \text{dist}(p,b)/r_s) \quad \text{for}\ \text{dist} < r_s\ (r_s = d_{\max} \cdot 0.5)$$
  $$\text{target} = \text{clamp}(b.\text{count}/20 + (\text{on}\ ?\ 0.45 : 0), 0, 1)$$
  $$b.\text{d} += (\text{target} - b.\text{d}) \cdot 0.08$$
  $$\text{CSS:}\ \text{element.style.setProperty}('--d', b.\text{d})$$
  $$\text{Time Constant:}\ \tau = -1 / (60 \cdot \ln(1 - 0.08)) \approx 0.20\ \text{seconds}$$

### 3.4 Conserved Attention (Zero-Sum Allocation)
To prevent visual clutter, attention can be normalized as a fixed budget:
$$\text{demand:}\ m_i = S_i \cdot (1 + \beta \cdot \text{on}_i) \cdot \text{vis}_i \quad (\beta \approx 2)$$
$$\text{ softmax share:}\ d_i^* = \hat{N} \cdot \frac{m_i}{\sum_j m_j}$$
$$\text{strength controller:}\ S_i^{\text{eff}} = S_i \cdot \text{clamp}(d_i^* / (b.\text{d}_i + \epsilon), S_{\text{lo}}, S_{\text{hi}})$$

---

## 4. Energy-Transfer Micro-Reactions (Juice)

Visual reactions scale with the amount of kinetic energy ($KE$) lost during dissipative events:

$$\Delta E = 0.5 \cdot m \cdot (|v_{\text{before}}|^2 - |v_{\text{after}}|^2)$$
$$\text{Reaction Intensity:}\ I = \text{clamp}(k \cdot \Delta E, 0, I_{\max})$$

$I$ drives parameters like spark count, glow flash radius, and element recoil.

### Impact Spark Formula (Reflect / Collide)
$$\text{if}\ |v| > 0.7: \text{sparks} = \text{round}(3 + \text{rand} \cdot |v| \cdot 3)$$
$$\text{heat} = \max(\text{heat}, \min(0.85, |v| \cdot 0.4))$$

---

## 5. Design & Implementation Antipatterns

### 5.1 Design & Presentation Antipatterns
- **Rebuilding Words from Dots (The Punctuation Rule Violation):**
  - *Antipattern:* Assembling or morphing particles directly into full letters or text words. It creates noisy, illegible silhouettes.
  - *Correct Pattern:* Reserve particle-to-shape morphology (`morph` or glyph assembly) strictly for punctuation and marks (`.`, `—`, `·`, brackets, logos). Make words feel alive by animating the *surrounding* field or altering type attributes (weight, glow, spacing) via the local density `--d` variable.
- **Decoration Without Behavior (One-Way Metaphors):**
  - *Antipattern:* Adding the particle field as a passive screen-saver backdrop that doesn't read or react to DOM boxes.
  - *Correct Pattern:* Maintain absolute reciprocity. Elements must bend the field (Pipe 1), and local density must swell/glow the elements back (Pipe 2).
- **Constant Chaos (Noisy Resting State):**
  - *Antipattern:* Keeping the field constantly agitated, fast, or noisy when the user is idle.
  - *Correct Pattern:* *"Make the transfer legible; keep the steady state quiet."* A force at rest is silent. Reserve heavy excitement, heat, and visual sparks for transitional triggers (hover, click-bursts, boundary collision impacts).
- **Hype-heavy Copywriting:**
  - *Antipattern:* Describing the site's physics using buzzwords like "synergy," "revolutionary," or "game-changing."
  - *Correct Pattern:* Use a plain, declarative, physical voice (e.g., "The page's elements bend the field; the field's density bends the elements back").

### 5.2 Physics & Engine Implementation Antipatterns
- **Unbounded Particle Spawning (Class [S] Law-Breaks):**
  - *Antipattern:* Creating particles continuously via sources (`spawn` / `fountain` / `supernova`) without allocating a budget or clean-up routine.
  - *Correct Pattern:* Respect the global conservation law. Every particle generator must be paired with a sink (`blackhole` with `data-destroy`), an age despawn threshold (`age > life`), or a global ceiling to prevent browser tab crashes.
- **Aspirational Mass in Unit-Mass Integrators:**
  - *Antipattern:* Claiming that particle sizes or labels affect their trajectory arcs when running a unit-mass model ($v += F$).
  - *Correct Pattern:* Clearly declare if Option A (Unit Mass) is running. In Option A, size is purely cosmetic. To enable physical size-mass behaviors, upgrade to Option B ($a = F/m$) and conserve momentum.
- **Synchronous Viewport Box Polling:**
  - *Antipattern:* Running `getBoundingClientRect()` on all elements every frame.
  - *Correct Pattern:* Re-sample layout bounds every 6 frames, deactivate forces on off-screen elements, and use `ResizeObserver`/`IntersectionObserver` to trigger measurements on mutation.
- **Unbounded / Diverging Wells at Scale:**
  - *Antipattern:* Implementing pure Newtonian gravity ($1/d^2$) for UI attractors, leading to infinite acceleration/velocities at zero distance.
  - *Correct Pattern:* Use soft, bounded designs $(1 - d/d_{\max})^n$ for user-interface targets, or apply Plummer softening ($1 / (d^2 + \epsilon^2)$) to keep natural forces mathematically finite.
