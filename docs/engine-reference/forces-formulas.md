> **Status: as-built force-engine reference.**
> Accurate for force formulas, catalogs, and engine behavior. It does NOT define the full current Fundamental platform architecture — for that see [../canonical/platform-architecture.md](../canonical/platform-architecture.md) and [../canonical/system-contracts.md](../canonical/system-contracts.md).

# The Forces & Fields — Reference Formulas & Attributes

This document serves as the canonical reference for the physics formulas, DOM attribute APIs, and substrate math backing the reciprocal field system. It merges the active engine rules with the extended/cosmological vocabulary. The force engine is one layer of Fundamental: Fundamental computes this renderer-agnostic field behavior, while @fundamental-engine/dom binds it to the DOM (measurement, state, feedback, relationships, visual bindings, overlays, scheduling) and the canvas is one render surface among many. This reference covers the force/substrate math; the platform architecture lives in the canonical docs linked in the status banner above.

---

## Notation & Symbol Legend

| Symbol | Meaning | Unit / Scale |
|---|---|---|
| $b$ | A registered DOM body / attractor element | Object |
| $p$ | A particle in the simulation | Object |
| $s$ | General variable for spin (swirl direction/strength) | $\pm 1$ |
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
- **Class [D]**: **Target-Geometry.** Body carries a target point set; particles tether to matching points. Compute cost: $O(n)$.
- **Class [E]**: **Particle Attribute.** Uses additional particle state variables (charge, species, age).
- **Class [S]**: **Source / Sink.** Creates or destroys matter. *Breaks particle count conservation; must be budgeted.*
- **[Preset]**: **Virtual Composite.** Expands a single HTML element into co-located virtual bodies of Class [A] to compose complex reactions.

---

## 1. The Nine Canonical Forces (Active Engine)

These forces are fully implemented in `packages/core/src/forces/index.ts` and drive the live Field Manual. By default, **engagement (hover/focus/tap)** widens their range and amplifies strength.

| Force (Token) | Class | HTML Attributes & Defaults | Math Formula / Implementation | Behavior & On-State Impact |
|---|---|---|---|---|
| **Attract**<br>`attract` | **[A]** | `data-strength="1.0"`<br>`data-range="300"` | $$r = \text{range} \cdot (\text{on}\ ?\ 1.5 : 1)$$<br>$$S' = S \cdot (\text{on}\ ?\ 3 : 1)$$<br>$\text{if}\ d \ge r:\ \text{skip}$<br>$$f = (1 - d/r)^2 \cdot S' \cdot 0.5$$<br>$$v += \hat{u} \cdot f$$<br>$\text{if}\ \text{form.orbit}: v += \frac{(-dy, dx)}{d} \cdot f \cdot \text{form.orbit}$<br>$\text{if}\ \text{on}: \text{heat} = \max(\text{heat}, (1 - d/r) \cdot 0.9)$ | Bounded gravity-like attractor well. Range $\times 1.5$, strength $\times 3$ on engagement. Optional orbital swirl added near lines. |
| **Jet**<br>`jet` | **[A]** | `data-angle="0"`<br>`data-strength="1.0"`<br>`data-range="300"` | $$r = \text{range} \cdot (\text{on}\ ?\ 1.4 : 1)$$<br>$\text{if}\ d \ge r:\ \text{skip}$<br>$\text{if}\ d < 24:$<br>&nbsp;&nbsp;&nbsp;&nbsp;$$\text{spread} = \text{rand}(-0.4..0.4)\ \text{rad}$$<br>&nbsp;&nbsp;&nbsp;&nbsp;$$h = \text{rotate}((\text{ux}, \text{uy}), \text{spread})$$<br>&nbsp;&nbsp;&nbsp;&nbsp;$$\text{spd} = 2.4 + S \cdot 2.6$$<br>&nbsp;&nbsp;&nbsp;&nbsp;$$v = h \cdot \text{spd};\ p.\text{pos} = b.\text{center} + h \cdot 26$$<br>&nbsp;&nbsp;&nbsp;&nbsp;$$\text{heat} = \max(\text{heat}, 0.9)$$<br>$\text{else}:$<br>&nbsp;&nbsp;&nbsp;&nbsp;$$f = (1 - d/r)^2 \cdot (0.25 + S \cdot 0.15)$$<br>&nbsp;&nbsp;&nbsp;&nbsp;$$v += \hat{u} \cdot f$$ | Recycle conduit: draws particles into a nozzle ($d \ge 24$) and ejects them as a hot jet ($d < 24$). Range $\times 1.4$ when `on`. |
| **Tether**<br>`tether` | **[A]** | `data-strength="1.0"`<br>`data-range="260"` | $$\text{rest} = \text{range} \cdot 0.6 \cdot (\text{on}\ ?\ 1.25 : 1)$$<br>$$\text{reach} = \text{rest} \cdot 2.1$$<br>$\text{if}\ d \ge \text{reach}:\ \text{skip}$<br>$$k = (0.006 + S \cdot 0.012) \cdot (\text{on}\ ?\ 1.7 : 1)$$<br>$$\text{stretch} = d - \text{rest}$$<br>$$v += \hat{u} \cdot \text{stretch} \cdot k$$<br>$$v *= 0.985$$<br>$\text{if}\ \text{on}: \text{heat} = \max\left(\text{heat}, \left(1 - \frac{|\text{stretch}|}{\text{rest}}\right) \cdot 0.5\right)$ | Tether with rest length. Pushes out when crowded, pulls in when strayed. Settle factor $0.985$ forms orbits. |
| **Wall**<br>`wall` | **[A]** | *none* (sized by bounding box) | $$\text{pad} = 6$$<br>$\text{if}\ p\ \text{is outside}\ (\text{box} + \text{pad}):\ \text{skip}$<br>$\text{resolve shallower penetration axis}:$<br>&nbsp;&nbsp;&nbsp;&nbsp;$$\text{push}\ p\ \text{outside boundary}$$<br>&nbsp;&nbsp;&nbsp;&nbsp;$$v_{\text{axis}} = -v_{\text{axis}} \cdot 0.85$$<br>$\text{if}\ |v| > 0.7:$<br>&nbsp;&nbsp;&nbsp;&nbsp;$$\text{env.spark}(x, y, \min(2.4, |v|))$$<br>&nbsp;&nbsp;&nbsp;&nbsp;$$\text{heat} = \max(\text{heat}, \min(0.85, |v| \cdot 0.4))$$ | Elastic bounce off element borders. Restitution $0.85$. Emits visual sparks on hard impacts ($|v| > 0.7$). |
| **Stream**<br>`stream` | **[A]** | `data-angle="0"`<br>`data-strength="1.0"`<br>`data-range="340"` | $$r = \text{range} \cdot (\text{on}\ ?\ 1.4 : 1)$$<br>$$S' = S \cdot (\text{on}\ ?\ 2 : 1)$$<br>$\text{if}\ d \ge r:\ \text{skip}$<br>$$f = (1 - d/r)^{1.1} \cdot S' \cdot 0.5$$<br>$$v += (\text{ux}, \text{uy}) \cdot f$$<br>$\text{if}\ \text{on}: \text{heat} = \max(\text{heat}, (1 - d/r) \cdot 0.5)$ | Continuous directional flow vector. Range $\times 1.4$, strength $\times 2$ when `on`. |
| **Repel**<br>`repel` | **[A]** | `data-strength="1.1"`<br>`data-range="300"` | $$r = \text{range} \cdot (\text{on}\ ?\ 1.4 : 1)$$<br>$$S' = S \cdot (\text{on}\ ?\ 2 : 1)$$<br>$\text{if}\ d \ge r:\ \text{skip}$<br>$$f = (1 - d/r)^2 \cdot S' \cdot 0.5$$<br>$$v -= \hat{u} \cdot f$$ | Soft outward push from center. Carves a clean void. Range $\times 1.4$, strength $\times 2$ when `on`. |
| **Viscosity**<br>`viscosity` | **[A]** | `data-strength="1.0"`<br>`data-range="300"` | $$r = \text{range} \cdot (\text{on}\ ?\ 1.4 : 1)$$<br>$\text{if}\ d \ge r:\ \text{skip}$<br>$$k = (1 - d/r) \cdot (0.05 + S \cdot 0.07) \cdot (\text{on}\ ?\ 1.6 : 1)$$<br>$$v -= v \cdot k$$ | Viscous zone. Bleeds particle momentum without redirection. Calms dynamic areas. Range $\times 1.4$ when `on`. |
| **Swirl**<br>`swirl` | **[A]** | `data-spin="1"`<br>`data-strength="1.0"`<br>`data-range="320"` | $$r = \text{range} \cdot (\text{on}\ ?\ 1.4 : 1)$$<br>$$S' = S \cdot (\text{on}\ ?\ 2 : 1)$$<br>$\text{if}\ d \ge r:\ \text{skip}$<br>$$f = (1 - d/r)^{1.4} \cdot S' \cdot 0.45$$<br>$$v_x += (dy/d) \cdot f \cdot s + (dx/d) \cdot f \cdot 0.12$$<br>$$v_y += (-dx/d) \cdot f \cdot s + (dy/d) \cdot f \cdot 0.12$$<br>$\text{if}\ \text{on}: \text{heat} = \max(\text{heat}, (1 - d/r) \cdot 0.6)$ | Tangential swirl. Inward bias factor $0.12$ gives light inward retention; the swirl dominates. Range $\times 1.4$, strength $\times 2$ on engagement. |
| **Sink**<br>`sink` | **[A]** | `data-absorb="64"`<br>`data-max="30"`<br>`data-strength="0.8"`<br>`data-range="360"` | $\text{if}\ p.\text{cap}\ \text{or}\ d \ge \text{absorbR}:\ \text{skip}$<br>$$p.\text{cap} = b$$<br>$$b.\text{accreted} += 1$$<br>$\text{if}\ b.\text{accreted} \ge \text{capacity}:$<br>&nbsp;&nbsp;&nbsp;&nbsp;$$\text{env.supernova}(b)$$ | Accretion core. Traps particles ($d < \text{absorbR}$) and grows its accreted count. Supernovas at `capacity`, ejecting the held matter radially. |

---

## 2. Extended Force Vocabulary (Designed Forces, Physical Primitives & Presets)

These forces split into designed behaviors, physical primitives, and virtual cosmology presets. Most of this vocabulary now ships; the few genuinely spec-only items are called out explicitly below.

> **Status.** Most of this vocabulary now ships; the as-built set and exact tokens live in §1, [`forces-system.md`](forces-system.md) §20, and the catalog. Names here are the shipped tokens: the pheromone field ships as `diffuse`, `diffuse` and `memory` are class [C] natural primitives, and the budgeted class-[S] source ships as `spawn`. The relocation atom `warp` now ships (it is in the 36-force catalog, with a conformance experiment). Still spec-only: the `wormhole` preset it composes. The registered presets are `blackhole`, `whitehole`, `star`, `quasar`, `galaxy`, `nebula`, `tornado`, `fountain`; `supernova` below is the sink-release *event*, not a `data-preset`.

### 2.1 Extended Designed Forces

| Force (Token) | Class | Attributes | Math Formula / Implementation | Behavior & Unique Result |
|---|---|---|---|---|
| **Lens**<br>`lens` | **[A]** | `data-strength`<br>`data-range`<br>`data-spin` | $$\theta = \theta_{\max} \cdot (1 - d/d_{\max}) \cdot \text{sign}$$<br>$$v = \text{rotate}(v, \theta)$$ | Refracts path while preserving speed. Bends streams into caustics. |
| **Align**<br>`align` | **[A/B]** | `data-angle`<br>`data-strength`<br>`data-range` | $$\hat{h} = \text{heading (A) or mean}(v_n)\text{ (B)}$$<br>$$v += (\hat{h} \cdot |v| - v) \cdot k_{\text{align}}\ \ (d < d_{\max})$$ | Combed coherence. Steers particles toward a flow axis or local group vector. |
| **Crystallize**<br>`crystallize` | **[A]** | `data-strength`<br>`data-range` | $\text{if}\ \text{heat} < \theta_{\text{freeze}}:$<br>&nbsp;&nbsp;&nbsp;&nbsp;$$v += (\text{latticeNode}(p) - p) \cdot k_{\text{snap}}$$<br>&nbsp;&nbsp;&nbsp;&nbsp;$$v *= 0.9$$ | Freezes particles to a lattice when cool. Melts on heat/scroll. |
| **Resonate**<br>`resonate` | **[A]** | `data-strength`<br>`data-spin` | $$S(t) = S_0 \cdot (1 + \sin(\omega \cdot t + \phi))$$<br>$$\text{applyCoreForce}(S(t))$$ | Periodic oscillation. Creates standing waves and moiré beats. |
| **Gate**<br>`gate` | **[A]** | `data-angle` | $$\hat{n} = (\cos\theta, \sin\theta)$$<br>$\text{if}\ (v \cdot \hat{n}) < 0: v -= 2(v \cdot \hat{n}) \cdot \hat{n}$ | One-way membrane. Traps particles on one side of a bounding box. |
| **Spotlight**<br>`spotlight` | **[A]** | `data-angle` | $\text{if}\ \text{acos}(\hat{u}_{b \rightarrow p} \cdot \hat{h}) < \phi:$<br>&nbsp;&nbsp;&nbsp;&nbsp;$$\text{applyCoreForce}()$$ | Angular boundary. Gates forces to an attention cone relative to heading. |
| **Wind**<br>`wind` | **[A]** | `data-strength`<br>`data-range` | $$v += \text{curl}(\text{noise}(x \cdot s, y \cdot s, t \cdot s_t)) \cdot S$$ | Curl-noise flow field. Generates divergence-free natural turbulence eddies. |
| **Shear**<br>`shear` | **[A]** | `data-angle`<br>`data-strength`<br>`data-range` | $$v_{\parallel} += S \cdot \frac{\text{offset}_{\perp}}{d_{\max}} \cdot (1 - d/d_{\max})$$ | Boundary shear flow. Slips velocity layer offset perpendicularly. |
| **Buoyancy**<br>`buoyancy` | **[A+E]** | `data-strength`<br>`data-range` | $$\rho_p = \frac{\text{base}}{\text{size} \cdot (1 + \text{heat})}$$<br>$$v_y += (\rho_{\text{med}} - \rho_p) \cdot g$$ | Sedimentation. Hot particles expand and rise; cold/heavy ones sink. |
| **Cohesion**<br>`cohesion` | **[B]** | `data-strength`<br>`data-range` | $\text{for}\ n\ \text{in neighbors}(p, r_1):$<br>&nbsp;&nbsp;&nbsp;&nbsp;$\text{if}\ d_n < r_0: v -= k_p \cdot (r_0 - d_n) \cdot \hat{u}_n$<br>&nbsp;&nbsp;&nbsp;&nbsp;$\text{else}: v += k_c \cdot (d_n - r_0) \cdot \hat{u}_n$ | Surface tension. Swarms merge and split like liquid droplets. |
| **Pressure**<br>`pressure` | **[B]** | `data-strength`<br>`data-range` | $$\rho_p = \sum_n W(d_n, h)$$<br>$$v += -k \cdot \sum_n (\rho_p - \rho_0) \cdot \nabla W(d_n, h)$$ | Incompressible fluid SPH model. Resists crowding, spreads evenly. |
| **Link**<br>`link` | **[B]** | `data-strength`<br>`data-range` | $$e = (|p_a - p_b| - L)$$<br>$$p_a -= 0.5 \cdot e \cdot \hat{u};\ p_b += 0.5 \cdot e \cdot \hat{u}$$ | Verlet distance constraints. Chains particles to form ropes or cloth. |
| **Hunt**<br>`hunt` | **[B+E]** | `data-strength`<br>`data-range` | $$\text{predator}: v += \text{seek}(\text{prey}) \cdot S$$<br>$$\text{prey}: v += \text{flee}(\text{predator}) \cdot S$$ | Predator/prey ecosystems. Cycles populations via Lotka-Volterra. |
| **Diffuse**<br>`diffuse` | **[C]** | `data-strength`<br>`data-range` | $$\text{deposit}: T(x) += \delta$$<br>$$\text{steer}: v += \nabla T(x) \cdot k_{\text{follow}}$$<br>$$\text{grid}: T \leftarrow (T \cdot \text{decay}) \circledast \text{blur}$$ | Stigmergy paths. Particles self-organize into transport networks. |
| **Memory**<br>`memory` | **[C]** | `data-strength`<br>`data-range` | $$M(x) += \lambda \cdot \tau$$<br>$$\text{force\_factor} = (1 + \mu \cdot M(x))$$ | Occupancy grid footprint. Frequently travelled pathways attract more. |
| **Morph**<br>`morph` | **[D]** | `data-target`<br>`data-strength` | $$v += (t_k - p) \cdot k_m + \text{jitter} \cdot (1 - \text{arrived})$$<br>$$\text{arrived} = \text{clamp}(1 - |t_k - p|/\epsilon, 0, 1)$$ | SVG/data targeting. Constellates dust into symbols (marks/logos). |
| **Pigment**<br>`pigment` | **[E]** | `data-range`<br>`data-color` | $$c_p = \text{mix}(c_p, c_{\text{other}}, \text{rate})$$ | Conserved color advection. Swarms physically transport pigment dyes. |
| **Field Flow**<br>`fieldflow` | **[A]** | `data-strength`<br>`data-range` | $$\hat{n} = \text{netField}/\lvert\text{netField}\rvert$$<br>$$v += (\hat{n}\cdot\lvert v\rvert - v)\cdot k_{\text{steer}} + \hat{n}\cdot\text{gain}\cdot a_{\text{accel}}$$<br>$$\text{gain} = S\cdot(1 - d/d_{\max})$$ | Follows the field lines. Steers onto and streams down the net field every body radiates (range 0 ⇒ the global `magnetic` formation). |

### 2.2 Cosmology Presets (Composite Layouts)

Cosmology presets use co-located virtual bodies of basic forces to represent astronomical objects:

- **Blackhole (`blackhole`)**
  - *Class:* [A] (+[S] if `data-destroy` is set)
  - *Composition:* `attract` (steep) + `swirl` (frame drag) + `sink` (event horizon) + `lens` (light bending)
  - *Formula:*
    $$M_{\text{source}} = S \cdot k_g$$
    $$\text{if}\ d \le r_s\ (\text{horizon}): p.\text{cap} = b;\ b.\text{accreted}++$$
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
- **Wormhole (`wormhole`)** — *proposed preset; composes the shipped `warp` atom*
  - *Class:* [A · paired]
  - *Composition:* `attract` + `warp` (throat A) $\leftrightarrow$ `warp` + `repel` (throat B)
  - *Formula (Warp throat relocation):*
    $$\text{if}\ d < \text{throatR}:$$
    $$\text{local\_offset} = (p.\text{pos} - A.\text{center}) \cdot k$$
    $$p.\text{pos} = B.\text{center} + \text{rotate}(\text{local\_offset}, \Delta\theta)$$
    $$p.\text{vel} = \text{rotate}(p.\text{vel}, \Delta\theta) \cdot k$$
    $$p.\text{heat} = \max(p.\text{heat}, 0.6)$$
- **Supernova (`supernova`)** — *the sink-release event, not a registered preset*
  - *Class:* [S] (Source blast)
  - *Composition:* `spawn` (one-shot) + remnant swap
  - *Formula:*
    $$\text{release:}\ p.\text{cap} = \text{null};\ v = \hat{u} \cdot \text{rand}(4..7);\ \text{heat}=1\ \ (\text{held particles})$$
    $$\text{spawn N new:}\ \theta = 2\pi k/N;\ v_{\text{spawn}} = (\cos\theta, \sin\theta) \cdot \text{spd};\ \text{age}=0$$
    $$\text{shockwave:}\ \text{burst}(c_x, c_y, R)$$
    $$\text{remnant:}\ b \rightarrow \text{neutron star (`tether`) or Blackhole}$$
- **Fountain (`fountain`)**
  - *Class:* [S]
  - *Composition:* `spawn` (continuous) along a nozzle vector
  - *Formula:*
    $$\text{each frame (Poisson rate}\ r\text{): spawn}\ \lfloor r \rfloor\ \text{particles}$$
    $$v_{\text{spawn}} = \hat{h} \cdot \text{spd} + \text{cone}(\text{spread});\ \text{heat}=\text{warm};\ \text{age}=0$$
    $$\text{despawn}\ \text{if}\ \text{age} > \text{life}$$

---

## 3. Substrate & Field Mechanics (The Ground State)

This section documents the equations driving the background substrate, including velocity integration, wave current drift, noise, toroidal edge wrapping, global formations, and typographic feedback loops.

---

### 3.1 Mass & Velocity Integration
Particles integrate coordinates under a viscous friction model:
$$v_{t+1} = v_t \cdot f \quad (f \approx 0.95)$$
$$\text{heat}_{t+1} = \text{heat}_t \cdot 0.972$$

* **Option A (Unit Mass - Default UI):**
  $$v += F$$
* **Option B (First-Class Mass - Physics Simulation):**
  $$a = F/m$$
  $$v += a \cdot \tau$$
  $$p = m \cdot v\ \text{(conserve momentum on collisions/fusions)}$$

---

### 3.2 Background Currents (Carrier Waves)
The background consists of $5$ layered standing waveforms that drift free particles and transport bound particles. They support two modes: **Linear** (default parallel horizontal waves) and **Circular** (concentric closed orbits).

#### Linear Waves (`waveStyle: 'linear'`)

* **Wave Y-Coordinate Calculation (`waveYat`):**
  At horizontal coordinate $x$ and time $t$ (seconds), the height $y_w$ of wave $w$ is:
  $$y_w = w.\text{baseFrac} \cdot H + w.\text{offsetY} + \sin(x \cdot w.\text{freq} + w.\text{phase} + t \cdot w.\text{speed} \cdot 1000 \cdot \text{waveSpeed}) \cdot w.\text{amp} \cdot \text{amplitude}$$
  
* **Gaussian Spine Pull (Local Bending):**
  When a DOM element is engaged ($\text{pull.k} > 0$), the waves locally bend toward its location $(\text{pull.x}, \text{pull.y})$:
  $$\Delta x = x - \text{pull.x}$$
  $$\text{fall} = \exp\left(-\frac{\Delta x^2}{2 \cdot 260^2}\right)$$
  $$y_w \leftarrow y_w + (\text{pull.y} - y_w) \cdot 0.42 \cdot \text{fall} \cdot \text{pull.k} \cdot (0.45 + w.\text{depth} \cdot 0.55)$$

* **Wave Slope / Derivative (`waveSlope`):**
  The slope of the wave represents its spatial derivative, driving vertical velocity:
  $$\text{slope}_w = \cos(x \cdot w.\text{freq} + w.\text{phase} + t \cdot w.\text{speed} \cdot 1000 \cdot \text{waveSpeed}) \cdot w.\text{amp} \cdot w.\text{freq} \cdot \text{amplitude}$$

* **Free Particle Drift (Linear Wave Current):**
  For each free particle, identify the closest wave $w$ in the viewport. If the vertical distance $\text{nd} = |y_w - p.y| < 70\ \text{px}$, apply velocities:
  $$p.vx += w.\text{dir} \cdot 0.035 \cdot \left(1 - \frac{\text{nd}}{70}\right)$$
  $$p.vy += \text{slope}_w \cdot 0.1 \cdot \left(1 - \frac{\text{nd}}{70}\right)$$

#### Circular Waves (`waveStyle: 'circular'`)
Concentric closed orbits circling around a central coordinate $(\text{cx}, \text{cy})$ resolved dynamically (defaulting to the first body tagged with `star`/`vortex`, or the viewport center).

* **Radial Wave Distance Calculation (`waveRAt`):**
  At angle $\theta \in [0, 2\pi]$ and time $t$, the undulating wave radius $r_w(\theta)$ is:
  $$r_w(\theta) = w.\text{baseFrac} \cdot R_{\text{max}} + \sin(N \cdot \theta + w.\text{phase} + t \cdot w.\text{speed} \cdot 1000 \cdot \text{waveSpeed}) \cdot w.\text{amp} \cdot \text{amplitude}$$
  where $R_{\text{max}} = 0.48 \cdot \min(W, H)$ and $N = \max(1, \text{round}(w.\text{freq} \cdot 2500))$ is clamped to integer values to guarantee the loops close seamlessly.

* **Wave Slope / Derivative (`waveSlope`):**
  The angular rate of radius change is:
  $$\text{slope}_w = \cos(N \cdot \theta + w.\text{phase} + t \cdot w.\text{speed} \cdot 1000 \cdot \text{waveSpeed}) \cdot w.\text{amp} \cdot N \cdot \text{amplitude}$$

* **Free Particle Drift (Circular Wave Current):**
  Calculate particle angle $\theta = \text{atan2}(p.y - cy, p.x - cx)$ and distance $d_{\text{center}}$ to center. For the closest wave $w$, if radial gap $\text{nd} = |r_w(\theta) - d_{\text{center}}| < 70\ \text{px}$, apply centripetal correction and tangential drive:
  $$\text{pull} = (r_w(\theta) - d_{\text{center}}) \cdot 0.05 \cdot \left(1 - \frac{\text{nd}}{70}\right)$$
  $$\text{drive} = w.\text{dir} \cdot 0.05 \cdot \left(1 - \frac{\text{nd}}{70}\right)$$
  Converting back to Cartesian velocity updates:
  $$p.vx += \cos(\theta) \cdot \text{pull} - \sin(\theta) \cdot \text{drive}$$
  $$p.vy += \sin(\theta) \cdot \text{pull} + \cos(\theta) \cdot \text{drive}$$
  $$p.vx *= 0.98$$
  $$p.vy *= 0.98$$

---

### 3.3 Brownian Jitter & Curl-Noise Wander
When formation wander is active ($\text{wander} > 0$), random perturbations and divergence-free eddies are injected:

* **Periodic Jitter (Every 40 frames):**
  $$\text{wsc} = 0.05 \cdot \text{form.wander}$$
  $$p.vx += (\text{rand}() - 0.5) \cdot \text{wsc}$$
  $$p.vy += (\text{rand}() - 0.5) \cdot \text{wsc}$$

* **Curl-Noise Eddies (Every frame, for $\text{wander} > 0.05$):**
  $$\theta_{\text{curl}} = \left(\sin(p.x \cdot 0.0032 + t \cdot 0.12) + \cos(p.y \cdot 0.0034 - t \cdot 0.15)\right) \cdot \pi$$
  $$p.vx += \cos(\theta_{\text{curl}}) \cdot 0.013 \cdot \text{form.wander}$$
  $$p.vy += \sin(\theta_{\text{curl}}) \cdot 0.013 \cdot \text{form.wander}$$

---

### 3.4 Boundary Toroidal Wrapping
Particles are wrapped around screen boundaries rather than bounced or deleted (conserving global count):
$$\text{EDGE} = 10\ \text{px}$$
$$\text{if } p.x < -\text{EDGE}: p.x = W + \text{EDGE}$$
$$\text{if } p.x > W + \text{EDGE}: p.x = -\text{EDGE}$$
$$\text{if } p.y < -\text{EDGE}: p.y = H + \text{EDGE}$$
$$\text{if } p.y > H + \text{EDGE}: p.y = -\text{EDGE}$$

---

### 3.5 Global Formation Currents (IA Layout States)
Global currents affect free particle motion, overriding or reinforcing local body forces:

* **Lanes Current (`driftX`):**
  $$p.vx += \text{driftX} \cdot 0.02$$
* **Scatter Target Pull (`spread`):**
  Each particle pulls toward its custom grid slot $(t_x, t_y)$ mapping a spread state across the canvas:
  $$t_x = ((\text{p.gx} + \text{frameCount} \cdot 0.00004) \bmod 1) \cdot W$$
  $$t_y = \text{p.gy} \cdot H$$
  $$p.vx += (t_x - p.x) \cdot 0.0006 \cdot \text{form.spread}$$
  $$p.vy += (t_y - p.y) \cdot 0.0006 \cdot \text{form.spread}$$
* **Accretion Center-of-Mass Convergence (`conv`):**
  Pull particles toward the first visible `sink` body $b_{\text{target}}$:
  $$\hat{u}_{\text{core}} = \frac{(b_{\text{target}}.\text{cx} - p.x, b_{\text{target}}.\text{cy} - p.y)}{\text{dist}_{\text{core}}}$$
  $$p.vx += \hat{u}_{\text{core}, x} \cdot \text{form.conv} \cdot 0.06$$
  $$p.vy += \hat{u}_{\text{core}, y} \cdot \text{form.conv} \cdot 0.06$$

---

### 3.6 Two-Way Density Feedback (The Bridge)
This is the bidirectional DOM $\leftrightarrow$ field runtime loop. In the platform runtime the MeasurementRegistry reads body geometry and the FeedbackRegistry writes the density variable; the canvas is the render surface where particle proximity is tallied.
- **DOM $\rightarrow$ field runtime (Pipe 1):**
  $$c_x = (\text{rect.left} + \text{rect.width}/2) \cdot \text{DPR}$$
  $$c_y = (\text{rect.top} + \text{rect.height}/2) \cdot \text{DPR}$$
  $$\text{DPR} = \min(\text{devicePixelRatio}, 2)$$
- **Field runtime $\rightarrow$ DOM (Pipe 2):**
  $$b.\text{count} = \sum_p \max(0, 1 - \text{dist}(p,b)/r_s) \quad \text{for}\ \text{dist} < r_s\ (r_s = d_{\max} \cdot 0.5)$$
  $$\text{target} = \text{clamp}(b.\text{count}/20 + (\text{on}\ ?\ 0.45 : 0), 0, 1)$$
  $$b.\text{d} += (\text{target} - b.\text{d}) \cdot 0.08$$
  $$\text{CSS:}\ \text{element.style.setProperty}('--field-density', b.\text{d})\ \ (\text{mirrored to compact alias}\ \texttt{--d})$$
  $$\text{Time Constant:}\ \tau = -1 / (60 \cdot \ln(1 - 0.08)) \approx 0.20\ \text{seconds}$$

---

### 3.7 Conserved Attention (Zero-Sum Allocation)
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

### Impact Spark Formula (Wall / Collide)
$$\text{if}\ |v| > 0.7: \text{sparks} = \text{round}(3 + \text{rand} \cdot |v| \cdot 3)$$
$$\text{heat} = \max(\text{heat}, \min(0.85, |v| \cdot 0.4))$$

---

## 5. Design & Implementation Antipatterns

This section documents critical antipatterns across three categories: Creative & Design System integration, Engine Performance, and Mathematical/Physical Simulation logic. Developers and designers must check this list before introducing new components, physics rules, or layouts.

---

### 5.1 Creative & Design System Antipatterns

These guidelines ensure visual consistency and typography legibility. They preserve the site's identity as a *reciprocal medium* rather than a collection of visual effects.

#### 5.1.1 The Word Silhouette Break (Punctuation Rule Violation)
* **Symptom:** Text words or case study headings are assembled from, or morphed out of, loose particles. The typography becomes noisy, jagged, and illegible.
* **Root Cause:** Direct morphing or glyph assembly (`data-glyph`) applied to prose words.
* **Correct Pattern:** Words must remain solid, vector-drawn typographic elements. The field must *decorate* and interact with the text box, not form the text itself. Reserve particle shape-assembly strictly for simple punctuation and marks (e.g., `.`, `—`, `·`, brackets, logos) where the silhouette remains simple and legible.
* **Typographic Interaction:** To make words feel alive, alter their typographic properties using the eased local density variable written back by the engine. The primary token is `--field-density` (`--d` is the compact alias the FeedbackRegistry keeps mirrored; the legacy `--forces-density` CSS variable has been removed):
  ```css
  .liveword {
    /* Drive weight from local density */
    font-variation-settings: "wght" calc(300 + var(--field-density) * 500);
    /* Drive glow bloom from local density */
    text-shadow: 0 0 calc(var(--field-density) * 15px) var(--accent);
    /* Subtly mix color towards accent based on density */
    color: color-mix(in srgb, var(--accent) calc(var(--field-density) * 100%), var(--ink-base));
  }
  ```

#### 5.1.2 Static Metaphors (One-Way Fields)
* **Symptom:** Particles react to mouse cursor movement, but layout cards and text headers do not react to the particle concentration. The canvas feels like a passive backdrop screensaver.
* **Root Cause:** Neglecting to declare the `data-feedback` attribute on elements, or failing to bind the `--field-density` CSS variable (primary; `--d` is the compact alias) to typographic/layout properties.
* **Correct Pattern:** Every engageable DOM element must opt into the reciprocal loop. When particles gather, the element must visually swell, glow, or shift weights to close the interaction loop.

#### 5.1.3 Over-Agitation & Lack of Restraint (Visual Fatigue)
* **Symptom:** The particle field is constantly flashing, sparking, and moving at high velocity even when the page is completely idle.
* **Root Cause:** Failing to decay particle heat (`heat *= 0.972`) or setting baseline ambient velocities too high.
* **Correct Pattern:** Keep the resting state quiet. The field at rest should float on slow, gentle curl-noise drift ($v \approx 0.1 \rightarrow 0.5\ \text{px/frame}$). High-velocity motion, sparks, and flashes must be reserved as short-lived reactions to events (click-bursts, bounces, cursor drags) that decay rapidly back to the ground state.

#### 5.1.4 Color-Semantic Incoherence
* **Symptom:** Laying out cards or page sections with arbitrary colored accents (e.g. rendering a `tether` element in teal or a `swirl` card in pink).
* **Root Cause:** Hardcoding accent colors on components instead of deriving them from the canonical force-to-discipline mapping.
* **Correct Pattern:** All element colors must align with `DS_FORCES` (e.g., attract = blue `#4da3ff`, swirl = teal `#2dd4bf`, tether = green `#86e57f`). Derive these programmatically via `forces.config.ts` or bind to CSS tokens:
  ```css
  .card-tether {
    border-color: var(--f-tether); /* #86e57f */
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

These engineering guidelines keep the viewport rendering at a stable 60 fps on mobile and low-power devices.

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
* **Correct Pattern:** Mount a single, shared canvas (`<FieldCanvas />`) at the application root for the viewport background — one canvas render surface drawing the one shared field context, not one canvas per element. For isolated inline demonstrations, use container-scoped, low-particle-count, paused `<field-cell>` instances.

---

### 5.3 Mathematical & Physical Simulation Antipatterns

These math guidelines keep the integration loop numerically stable, preventing particle explosion or orbit decay.

#### 5.3.1 Newtonian Singularity (Zero-Distance Velocity Blowup)
* **Symptom:** Particles disappear instantly or fly off-screen at extreme speeds when they approach the center of an attractor.
* **Root Cause:** Using the literal physical gravity law ($F = G/d^2$) without core softening, causing division by zero ($d \rightarrow 0$).
* **Correct Pattern:** Use bounded designed wells $(1 - d/d_{\max})^n$ for UI attractors, or add Plummer softening ($\epsilon^2$) in natural equations:
  $$F = \frac{G \cdot M}{d^2 + \epsilon^2} \quad (\epsilon \approx \text{horizon or core radius})$$

#### 5.3.2 Mass Dissonance (Nominal vs. Inertial Mass)
* **Symptom:** The UI claims larger particles have more inertia, but all particles accelerate identically under the same force.
* **Root Cause:** Documenting inertial mass behavior while running a Unit Mass integrator ($v += F$).
* **Correct Pattern:** Under Option A (default UI), size does not affect motion. Correct the manual copy, or run Option B (First-Class Mass: $a = F/m$) inside the Lab/simulation spaces where collisions and momentum-conservation are critical.

#### 5.3.3 Infinite Loop Instability (Typography Feedback Oscillation)
* **Symptom:** A text block fluctuates rapidly in width, causing jittery layout reflows and text shaking.
* **Root Cause:** High loop gain in the reciprocal feedback loop. Changing density alters font weight $\rightarrow$ alters word width $\rightarrow$ alters force bounding box $\rightarrow$ alters local particle density. If $\alpha$ (low-pass smoothing factor) is too high or the weight-width change is large, the system oscillates.
* **Correct Pattern:** Dampen typography bounds changes. Keep $\alpha \approx 0.08$ (low-pass filter) and keep the weight-to-geometry coupling small ($|G| \ll 1$) so the loop converges.

#### 5.3.4 Orbital Swirl Injection Error (Tangential Acceleration Blowup)
* **Symptom:** Particles spiral rapidly outward and leave the attractor well instead of forming stable circular orbits.
* **Root Cause:** Continuously applying tangential acceleration ($a_t += \text{constant}$), which continually injects kinetic energy into the system, causing orbits to decay outward.
* **Correct Pattern:** Inject tangential *velocity* once when seeding particles, or scale the tangential force with the attractor's radial pull factor:
  $$v_{\text{tangential}} = \frac{(-dy, dx)}{d} \cdot f_{\text{radial}} \cdot \text{form.orbit}$$
