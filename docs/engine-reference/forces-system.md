> **Status: as-built force-engine reference.**
> Accurate for force formulas, catalogs, and engine behavior. It does NOT define the full current Fundamental platform architecture — for that see [../canonical/platform-architecture.md](../canonical/platform-architecture.md) and [../canonical/system-contracts.md](../canonical/system-contracts.md).

# The Forces System — Full Definition

> A complete, implementation-ready specification of the **reciprocal field** that
> backs the site. This is the canonical reference: it captures every force,
> formation, condition, constant, contract, and lifecycle event derived from the
> design prototype (`forces.js`, `field.js`, `interact.js`, `lab.js`, `caps.js`,
> `ds-data.js`). A coding agent should be able to port the system from this doc
> without re-reading the prototype.

Status: **as-built** — the engine ships. The force math, conditions, formations,
render modes, and two-way feedback described here are live in `Fundamental` and
exercised through the authoring surfaces (`<field-root>`, `mountField()`,
`<FieldField>`). This document is the canonical reference for the **force engine**;
it does **not** define the full Fundamental platform architecture. DOM participation —
measurement, state, feedback writes, relationships, visual bindings, overlays,
scheduling, and linting — now lives in `@fundamental-engine/dom`, which binds the
renderer-agnostic core to the DOM (the platform runtime is the default for
`<field-root>`). For that architecture see
[../canonical/platform-architecture.md](../canonical/platform-architecture.md)
and [../canonical/system-contracts.md](../canonical/system-contracts.md).
This spec was originally extracted from the design-system prototype; the engine
behavior it describes has since been built.

Source of authority:
- **Force identity** (id, color, discipline, default attrs, law) → `ds-data.js`
  (`window.DS_FORCES`) is the single source of truth.
- **Force math** (the exact per-frame formula) → `forces.js`
  (`window.__forces` / `window.__conditions`).
- **The loop, conservation, lifecycle, feedback** → `field.js` (`window.__field`).
- **The narrative / how it's explained** → `manual.html` + `manual.js` (the Field
  Manual, §16) and the Design System's Forces view `ds-forces.jsx` (§17).

---

## Contents

- [1. The idea](#1-the-idea)
- [2. The substrate (engine fundamentals)](#2-the-substrate-engine-fundamentals)
- [3. Data model](#3-data-model)
- [4. The force registry contract](#4-the-force-registry-contract)
- [5. Conditions (`data-when` gates)](#5-conditions-data-when-gates)
- [6. The nine forces](#6-the-nine-forces)
- [7. Formations (global field arrangements)](#7-formations-global-field-arrangements)
- [8. Two-way density feedback](#8-two-way-density-feedback)
- [9. The accent journey](#9-the-accent-journey)
- [10. Threads (wiring a set)](#10-threads-wiring-a-set)
- [11. Lifecycle events](#11-lifecycle-events)
- [12. Declaring a body (authoring API)](#12-declaring-a-body-authoring-api)
- [13. Public field API (`FieldHandle`)](#13-public-field-api-fieldhandle)
- [14. The Lab (interactive sandbox)](#14-the-lab-interactive-sandbox)
- [15. Disciplines ↔ forces (the practice matrix)](#15-disciplines-↔-forces-the-practice-matrix)
- [16. The Field Manual (the canonical narrative)](#16-the-field-manual-the-canonical-narrative)
- [17. The Design System (where the forces live)](#17-the-design-system-where-the-forces-live)
- [18. Accessibility, reduced motion, performance](#18-accessibility-reduced-motion-performance)
- [19. Notes for adapting the engine](#19-notes-for-adapting-the-engine)
- [20. Extended force set — implemented](#20-extended-force-set--implemented)
- [21. Mass & momentum — audit and first-class proposal](#21-mass--momentum--audit-and-first-class-proposal)
- [22. Force targets — particles, elements & events](#22-force-targets--particles-elements--events)
- [23. Micro-reactions — energy transfer made visible](#23-micro-reactions--energy-transfer-made-visible)
- [24. Currents — the carrier waves](#24-currents--the-carrier-waves)
- [25. Additive concepts from the design system](#25-additive-concepts-from-the-design-system)

---

## 1. The idea

> The page's **elements** bend the field; the field's **density** bends the
> elements back.

Every meaningful thing on the page — a word in the hero, a capability card, the
contact email — is registered as a **body** in a shared field context. The
conserved particle field is one engine/render layer of that context, drawn on a
full-viewport `<canvas>` behind the content (canvas is one render surface of
several — see the render modes in §20.6 and the diagnostic surfaces). Bodies exert
**forces** on free particles. In return, the local particle **density** around a
body is written back into that element as a CSS variable (`--field-density`, with
the legacy/compat alias `--d`), so type can swell, glow, and gain weight where the
field gathers. The interaction is two-way and continuous.

Three invariants define the system:

1. **Reciprocity.** Elements move matter; matter moves elements. Neither is
   purely decorative.
2. **Conservation.** Nothing is created or destroyed. Particles are captured,
   released, detached from waves, and reclaimed — never spawned or deleted in the
   steady state. An "sink" body *holds* matter and later *releases exactly what
   it held* (a supernova).
3. **Synchronization.** The page and the field share one coordinate space. Every
   body's `getBoundingClientRect()` is re-sampled onto the canvas each frame
   (scaled by DPR), so invisible force fields stay locked to visible boxes through
   scroll, resize, and reflow.

---

## 2. The substrate (engine fundamentals)

What the field is made of, before any force acts. From `field.js` and
`DS_SUBSTRATE`.

### 2.1 Coordinate synchronization
A registry samples every `[data-body]` element's bounding rect each frame and maps
its center onto the canvas:

```
canvas_x = (rect.left + rect.width / 2) · DPR
```

- `DPR = min(devicePixelRatio, 1.5)` (capped at 1.5 for performance).
- Bodies are re-measured every **6 frames** (not every frame) for cost;
  particles integrate every frame.
- A body whose element is scrolled off-screen (beyond a `H · 0.15` margin) sets
  `vis = false` and exerts **no force** — a section's physics switch off when it
  leaves the viewport.

### 2.2 Mass & damping
Particles are point-masses in a viscous medium. Velocity is in px/frame; every
frame it is multiplied by a friction factor so momentum bleeds off and the swarm
settles:

```
v_{t+1} = v_t · f        f ≈ 0.95   (free particles)
heat_{t+1} = heat_t · 0.972
```

> ⚠️ **Mass is currently nominal — it is not in the equations of motion.** The
> engine integrates `v += F` (every particle behaves as **unit mass**); `baseSize`
> drives only the *rendered* dot radius. The substrate/manual claim *"mass ∝ size,
> heavier particles swing on wider arcs"* is **aspirational, not implemented.** The
> word "mass" elsewhere (now `b.accreted`) is a *different* quantity — a sink body's
> captured-particle **count**. See **§21** for the full audit and the first-class-mass
> upgrade.

### 2.3 Currents (the waves)
Five layered background sine waves are a **flow field**, not decoration. Near a
wave line a particle picks up a drift along the slope (the derivative of the
sine), so it drifts like debris down a river — which is why the resting field
feels alive with no input:

```
slope(x) = cos(x·freq + φ) · freq · amp
v_x += slope · influence          (influence falls off with distance to the line)
```

- 5 wave layers; base fractions `[0.24, 0.40, 0.55, 0.70, 0.85]` of viewport
  height, amplitudes `22 + i·15`, frequencies `0.0012 + i·0.0008`.
- Waves bend locally toward whatever element is currently **engaged** (the old
  "spine" behavior), via a Gaussian falloff (`s = 260`).

> These carrier lines — canonically **Currents** — are far more than a flow field
> (they're also a reservoir, an agent, and a carrier of bound matter). Their full
> role, place in the taxonomy, and color rules are **§24**.

### 2.4 Conservation law
- **Bound** particles ride the wave lines (shimmer). **Free** particles roam.
- A click, a force reaching a line, or a supernova **detaches** bound particles
  into free bodies (conserved, carried at their current position/velocity).
- **Wave healing:** free particles that are calm (`heat < 0.12`) and *already*
  drifting near a line (`< 64px`) are gently reclaimed and, when very close
  (`< 20px`) and slow, snap back to bound. Lines never vacuum the open field, so a
  quiet/dragged patch keeps its swarm.

### 2.5 Particle counts & global knobs
Defaults from `window.__field` config:

| Knob | Default | Meaning |
|---|---|---|
| `density` | `1` | Scales particle counts: bound `= round(16·density)` per wave × 5 layers; free `= round(130·density)`. |
| `amplitude` | `1` | Wave height multiplier. |
| `waveSpeed` | `1` | Wave horizontal speed. |
| `darkness` | `0.97` | Background lift; higher = darker base. |
| `bloom` | `1` | Glow/shadow-blur multiplier. |
| `showWaves` | `true` | Draw the wave layers. |
| `bodies` | `true` | Enable DOM-body forces. |
| `feedback` | `true` | Enable two-way density write-back. |
| `boot` | `0→1` | Fade-in ramp (`+0.012`/frame); set to `1` immediately under reduced motion. |
| `waveColors` | `['#4da3ff','#2dd4bf','#a78bfa']` | Wave layer palette. |
| `accent` | `'#4da3ff'` | Travelling accent (driven by scroll — see §9). |

---

## 3. Data model

The three objects every force module sees. From the `forces.js` header contract.

### 3.1 Body `b` — a registered DOM element
Parsed from `data-*` attributes in `scanBodies()`:

| Field | Source attr | Default | Meaning |
|---|---|---|---|
| `tokens` | `data-body` | — | Space-joined force ids, e.g. `"sink attract"`. Forces compose. |
| `strength` | `data-strength` | `0.5` | Force magnitude `S`. |
| `range` | `data-range` | `280` | Influence radius `d_max` (px). |
| `absorbR` | `data-absorb` | `64` | Capture radius for `sink`. |
| `capacity` | `data-max` | `60` | Saturation count → supernova. |
| `spin` | `data-spin` | `1` | Swirl direction/strength (±). |
| `angle`,`ux`,`uy` | `data-angle` | `0°` | Heading for `stream`/`jet` (deg → unit vector). |
| `when` | `data-when` | `''` | Conditional gate (see §5). |
| `feedback` | `data-feedback` | absent | Opt into density write-back. |
| `fmin`,`fmax` | `data-fmin/fmax` | `0` | Font-weight range driven by density. |
| `opsz` | `data-opsz` | `''` | Optical-size axis paired with `fmax`. |
| `M`,`accreted`,`cx`,`cy`,`hw`,`hh`,`on`,`vis`,`count`,`d` | — | runtime | Live state (source mass, accretion count, center, half-extents, engaged, visible, density tally, eased density). |

`b.on` is `true` when the element has `data-active="1"` (set on hover/focus/tap by
the conductor — see §13).

### 3.2 Particle `p` — a free agent (mutate these)
```
{ x, y, vx, vy, heat, cap }
```
`heat` ∈ [0,1] drives color (toward accent) and size/glow. `cap` is the sink
body currently holding this particle (or `null`).

### 3.3 Environment `env` — shared, rebuilt per particle/frame
```
{ dx, dy, dist, form, supernova, spark, W, H }
  dx, dy = (b.cx − p.x, b.cy − p.y)      vector from particle to body
  dist   = |(dx, dy)|, clamped ≥ 1
  form   = the active (eased) formation preset
  spark(x, y, power)  → throw a brief impact burst (collision feel)
  supernova(b)        → release everything a body has captured
```

---

## 4. The force registry contract

Forces are modular. The engine owns the loop and everything conserved; each force
owns **only** the math that nudges one free particle. Adding a force never touches
the core:

```js
window.__forces[token] = {
  token, label,
  apply(b, p, env),   // mutate p.vx / p.vy / p.heat / p.x / p.y
  meta: { desc }
}

window.__conditions[name] = (b, p) => boolean   // the data-when gate
```

Each frame, for every visible body and every free particle, the engine:
1. computes `env.dx/dy/dist`,
2. checks the body's `when` gate (`§5`),
3. calls `FORCES[token].apply(b, p, env)` for each token in `data-body`.

Because tokens compose, one element can pull **and** swallow **and** drag at once.

> **Target.** Here the thing a force acts on (`p`) is a **particle**. The same forces
> can also target **DOM elements** (move them) and **events** (fire behavior) — that
> generalization is the unified *target model* in **§22**.

---

## 5. Conditions (`data-when` gates)

A body can act only when a predicate holds. From `window.__conditions` /
`DS_CONDITIONS`.

| id | Label | Fires when | Selective? |
|---|---|---|---|
| `''` | Always | every particle, every frame (default) | no |
| `active` | Active | the body is engaged (hover/focus/tap → `b.on`) | no |
| `fast` | Fast | `vx² + vy² > 0.9` | **yes** (reads each particle) |
| `slow` | Slow | `vx² + vy² < 0.22` | **yes** |
| `hot` | Hot | `heat > 0.3` | **yes** |
| `cool` | Cool | `heat < 0.08` | **yes** |
| `scrolling` | Scrolling | page scroll velocity `> 0.25` | no |

**Selective** conditions read individual particles, so they act only on free
agents — bound (wave) particles are skipped for selective gates. (The engine only
tears a bound particle loose for `active`/always bodies, not for selective ones.)

---

## 6. The nine forces

Identity, color, and discipline mapping are **canonical** (`DS_FORCES`); the math
column is the **exact engine implementation** (`forces.js`). `S = strength`,
`d = dist`, `d_max = effective range`, `û = (dx,dy)/dist`.

> **On-state amplification.** When a body is engaged (`b.on`), most forces widen
> their range and boost strength (e.g. attract: ×1.5 range, ×3 strength). The
> per-force multipliers are listed below.

| # | Force | Color | Discipline → verb | One-line law |
|---|---|---|---|---|
| 1 | **Attract** | `#4da3ff` | Product strategy → gives direction | inverse-square pull, bent into a spiral |
| 2 | **Jet** | `#a78bfa` | AI systems → adapts response | recycles the field into a stream |
| 3 | **Tether** | `#86e57f` | Software architecture → gives structure | a rest length — a leash, not a drain |
| 4 | **Wall** | `#c4b5fd` | Experience design → the human surface | elastic bounce off the bounding box |
| 5 | **Stream** | `#7dd3fc` | Motion → reveals motion | constant force along a heading |
| 6 | **Repel** | `#ff9d5c` | Commerce → market pressure | inverted well — carves a clean void |
| 7 | **Viscosity** | `#8da2c0` | Physical production → adds constraint | viscosity — bleeds momentum off |
| 8 | **Swirl** | `#2dd4bf` | Creative technology → spins it together | tangential force — circles, never collapses |
| 9 | **Sink** | `#ff6e9c` | Attention → holds, then releases | accretion, then supernova |

> **Falloff accuracy.** The DS "law" column calls `attract`/`repel` *inverse-square*,
> but the engine falloff is a **bounded** `(1 − d/d_max)ⁿ` — a *designed* well with
> predictable reach, not literal `1/d²`. The real inverse-square law is the `gravity`
> primitive (§20.10); at UI scale the two read the same.

> **Two naming registers.** The engine **token** (`attract`, `viscosity`, `sink`,
> `jet`, …) is the API; the Field Manual narrates each with a descriptive
> **concept name**. Keep both straight when implementing:
>
> | Token | DS name | Manual concept name |
> |---|---|---|
> | `attract` | Attract | Attraction |
> | `repel` | Repel | Repulsion |
> | `wall` | Wall | Reflection |
> | `swirl` | Swirl | Swirl |
> | `stream` | Stream | Stream |
> | `tether` | Tether | Tether |
> | `viscosity` | Viscosity | **Viscosity** |
> | `sink` | Sink | **Accretion & release** |
> | `jet` | Jet | **Emission** |

### 6.1 Attract — `attract`
A soft, gravity-*like* well — note the falloff is a **bounded** `(1 − d/d_max)²`,
**not** literal inverse-square (the true `1/d²` law is the `gravity` primitive,
§20.10). Optional orbital swirl.
```
range = range·(on?1.5:1);  S' = S·(on?3:1)
if dist ≥ range: skip
f = (1 − dist/range)² · S' · 0.5
v += û · f
if form.orbit:  v += (−dy, dx)/dist · f · form.orbit      // tangential → orbits
if on:          heat = max(heat, (1 − dist/range)·0.9)
```
Default attrs: `data-strength="1" data-range="300"`.

### 6.2 Jet — `jet`
A conduit (not a source): draws matter into a nozzle, relaunches it as a hot jet
along `data-angle`. The field is recycled — nothing created.
```
range = range·(on?1.4:1)
if dist ≥ range: skip
if dist < 24:                              // at the nozzle → relaunch as a jet
   spread = rand(−0.4..0.4) rad            // cone
   h = rotate((ux,uy), spread)
   spd = 2.4 + S·2.6
   v = h · spd;  p.pos = b.center + h·26;  heat = max(heat, 0.9)
else:                                       // feed → draw toward the nozzle
   f = (1 − dist/range)² · (0.25 + S·0.15)
   v += û · f
```
Default attrs: `data-angle="0" data-strength="1" data-range="300"`.

### 6.3 Tether — `tether`
A tether with a **rest length** — holds matter at a preferred shell radius; pushes
out when crowded, reels in when strayed. Settles into an orbiting ring.
```
rest  = range · 0.6 · (on?1.25:1)
reach = rest · 2.1                          // beyond this the leash lets go
if dist ≥ reach: skip
k = (0.006 + S·0.012) · (on?1.7:1)
stretch = dist − rest                       // + → reel in, − → push off
v += û · stretch · k
v *= 0.985                                  // light damping → settles into the shell
if on: heat = max(heat, (1 − min(1, |stretch|/rest))·0.5)
```
Default attrs: `data-strength="1" data-range="260"`.

### 6.4 Wall — `wall`
An axis-aligned bouncing wall around the element's box; throws sparks on hard hits.
(The exemplar micro-reaction — generalized in **§23**; note it sparks the *particle*
but does **not** yet recoil the wall, §23.5.)
```
pad = 6
if particle outside box+pad on either axis: skip
restitution = 0.85
resolve the shallower-penetration axis: push particle out, v_axis ← −v_axis · 0.85
if speed > 0.7:  env.spark(p.x, p.y, min(2.4, speed));  heat = max(heat, min(0.85, speed·0.4))
```
Default attrs: *(none — sized by the element box)*.

### 6.5 Stream — `stream`
A steady directional current along `data-angle`.
```
range = range·(on?1.4:1);  S' = S·(on?2:1)
if dist ≥ range: skip
f = (1 − dist/range)^1.1 · S' · 0.5
v += (ux, uy) · f
if on: heat = max(heat, (1 − dist/range)·0.5)
```
Default attrs: `data-angle="0" data-strength="1" data-range="340"`.

### 6.6 Repel — `repel`
Soft outward push — bounded `(1 − d/d_max)²`, not literal inverse-square (§20.10);
carves a void.
```
range = range·(on?1.4:1);  S' = S·(on?2:1)
if dist ≥ range: skip
f = (1 − dist/range)² · S' · 0.5
v −= û · f
```
Default attrs: `data-strength="1.1" data-range="300"`.

### 6.7 Viscosity — `viscosity`
Viscosity — thickens the medium, bleeding momentum (no redirection). On its own it
calms a patch; paired with attract it turns a slingshot into a settled orbit.
```
range = range·(on?1.4:1)
if dist ≥ range: skip
k = (1 − dist/range) · (0.05 + S·0.07) · (on?1.6:1)
v −= v · k
```
Default attrs: `data-strength="1" data-range="300"`.

### 6.8 Swirl — `swirl`
Tangential swirl with light inward retention so it holds shape instead of
flinging matter out. A tight inward spiral (a drain) is a preset, not canonical
swirl. `spin` sets direction/strength.
```
range = range·(on?1.4:1);  S' = S·(on?2:1)
if dist ≥ range: skip
f = (1 − dist/range)^1.4 · S' · 0.45;  s = spin
v += (dy/dist)·f·s + (dx/dist)·f·0.12          // tangential + slight inward 0.12
v += (−dx/dist)·f·s + (dy/dist)·f·0.12
if on: heat = max(heat, (1 − dist/range)·0.6)
```
Default attrs: `data-spin="1" data-strength="1" data-range="320"`.

### 6.9 Sink — `sink`
Captures matter into an accretion core (held, not deleted), then releases exactly
what it held when saturated — a supernova. Always paired with `attract` so matter
is pulled in first (`data-body="sink attract"`).
```
if p.cap or dist ≥ absorbR: skip
p.cap = b;  b.accreted += 1                         // held — conserved
if b.accreted ≥ capacity:  env.supernova(b)          // saturate → release all
```
Captured particles orbit toward `b.center` and feed `b.accreted`; the element inflates
via `--load = accreted/capacity` (alias `--mass`). **Supernova** (`field.js`): each held particle is
released radially from the core (`spd 4–7`, `heat 1`); nearby free particles
(`< 320px`) are shoved; nearby bound particles (`< 320px`) are torn loose; then
`accreted = 0`.
Default attrs: `data-absorb="64" data-max="30" data-strength="0.8" data-range="360"`.

---

## 7. Formations (global field arrangements)

A formation reconfigures the **whole** field. The engine eases the active preset
toward the target (`lerp 0.03`/frame). From `FORMS` / `DS_FORMATIONS`.

| id | Section | `driftX` | `wander` | `orbit` | `spread` | `conv` | Feel |
|---|---|---|---|---|---|---|---|
| `ambient` | Hero | 0 | 1.0 | 0.10 | 0 | 0 | resting curl-noise drift (default everywhere) |
| `wells` | Work | 0 | 0.7 | 0.85 | 0 | 0 | matter pools into tight orbits |
| `lanes` | Writing | 0.55 | 0.5 | 0 | 0 | 0 | a sideways current in bands |
| `scatter` | Practice | 0 | 1.7 | 0 | 0.6 | 0 | even brownian dispersal |
| `accretion` | Contact | 0 | 0.6 | 0.4 | 0 | 0.6 | everything converges to one mass |

Field terms applied to each free particle:
- `driftX` → lateral current `v_x += driftX · 0.02`.
- `wander` → brownian jitter (every 40 frames) **and** a smooth curl-noise eddy.
- `orbit` → multiplies attract's tangential swirl (orbits near attractors).
- `spread` → pull toward an even scatter across the viewport.
- `conv` → pull toward the accretion target (first visible `sink` body).

### 7.1 The journey
The conductor maps the in-view section to a formation
(`interact.js` `SECTION_FORM`):

```
top/hero → ambient · capabilities/practice → scatter · work → wells
writing → lanes · contact → accretion
```

**Idle behavior:** after **6000 ms** with no input the field drifts to calm
`ambient`; any input (`pointer`, `wheel`, `key`, `touch`) re-energizes the current
section's formation.

---

## 8. Two-way density feedback

The reciprocal half of the system. Each frame, for every body with `data-feedback`:

```
// engine bookkeeping (not a force): sample local density within range·0.5
if dist < range·0.5:  b.count += (1 − dist / (range·0.5))

// write density back into the element, eased
target = clamp(b.count/20 + (on ? 0.45 : 0), 0, 1)
b.d   += (target − b.d) · 0.08
element.style.setProperty('--field-density', b.d)   // primary; --d is the compact alias

// optional: drive a variable font weight from density
if fmax:  element.style.fontVariationSettings = `"wght" lerp(fmin, fmax, b.d)` (+ opsz)
```

So `--field-density` (primary; `--d` is the compact alias) ∈ [0,1] is "how much
field is gathered on me right now." CSS uses it for
glow, color-mix, weight, and the per-card density wash. Sink bodies additionally
expose `--load` ∈ [0,1] (alias `--mass`) so they can inflate as they fill.

Example body (the hero's live word):
```html
<em class="liveword" data-hot data-color="#4da3ff"
    data-feedback data-body="attract" data-strength="0.9" data-range="300">feel</em>
```

---

## 9. The accent journey

A single travelling accent color is shared by background and foreground. From
`interact.js`:

- Scroll position interpolates through stops
  `['#4da3ff','#2dd4bf','#a78bfa','#ff6e9c','#ff9d5c']` (eased, `0.08`/frame).
- Hovering a `[data-color]` element **overrides** the accent with that element's
  color until you leave.
- The result is set on `--accent` (CSS) and pushed to the field via
  `__field.setAccent(hex)`. Particle `heat` blends a particle toward this accent.

---

## 10. Threads (wiring a set)

When a member of a `[data-index][data-threads]` group is engaged, the engine draws
glowing lines from it to its siblings with travelling pulses
(`__field.threads(list)`). Opt-in only (`data-threads`) because it felt busy on
content sets; the manual demo and the Lab use it. Pass `null` to clear.

---

## 11. Lifecycle events

| Event | Trigger | Effect |
|---|---|---|
| **Boot** | load (or immediately under reduced motion) | `boot` ramps `0→1`; content fades in via `body.loaded` / `body.assembled`. |
| **Glyph assembly** | fonts ready | Particles rasterized from a `[data-glyph]` host rise into its shape, hold, then fade (stride `max(3, fontSize/26)`, cap **560** pts; ease `1−(1−t)⁴`; assembled 1800 ms, form 2600 ms, hold 4000 ms, fade by 5800 ms; skipped under reduced motion). **⚠ Deprecated for words — use only for punctuation / marks (the rule below).** |
| **Burst** | `pointerdown` anywhere | Shoves + heats free particles within 260 px (`f=(1−d/260)·4.4`, `heat += (1−d/260)·1.3`); tears bound particles within 200 px loose. No ring (kept clean). |
| **Engage** | hover/focus/tap a `[data-hot]` | Sets `data-active="1"` (`b.on`), lights the element, dims siblings, optionally wires threads, overrides accent. Waves bend toward it. |
| **Capture → Supernova** | particle enters a `sink` core; `accreted ≥ capacity` | Hold, then radial release of exactly what was held (see §6.9). |
| **Spark** | hard `wall` impact (`speed > 0.7`) | Short-lived impact debris (≤ 260 sparks) — pure collision feel. The exemplar micro-reaction; generalized as a system in **§23**. |
| **Wave healing** | calm free particle near a line | Reclaimed to bound (conserved) — see §2.4. |
| **Ripple** | (disabled project-wide) | `__field.ripple()` is a no-op; concentric rings were cut for cost/fit. |

> ⚠️ **Word treatment — the punctuation rule (design law).** **Do not assemble
> particles into words or letterforms** — it reads as rough and noisy. Glyph
> assembly is therefore **deprecated for words**: reserve particle-into-shape
> effects (`morph`, glyph assembly) for **punctuation and marks** — a `.`, `—`, `·`,
> brackets, a logo glyph — where the silhouette is simple and legible.
>
> To make a **word** feel alive, act on the *type and the field around it*, never by
> rebuilding it from dots:
> - **Glow + grow** — drive variable-font weight, `text-shadow` bloom, and color
>   from the gathered density `--d` (§8); the word thickens and lights as the field
>   collects on it (the `liveword`).
> - **Ripple / field-change** — put a force body *on* the word (attract / swirl) so
>   the field bends, swells, and sparks (§23) around it.
> - **Engage** — on hover/focus its body amplifies (on-state, §6), the Currents bend
>   toward it (the spine, §24), and the accent shifts (§9).
>
> **Words are bodies the field *decorates*; punctuation is where matter *assembles*.**

---

## 12. Declaring a body (authoring API)

Any element opts into the field by adding attributes — no JS needed:

```html
<a class="node"
   data-body="sink attract"   <!-- space-joined force ids; they compose      -->
   data-strength="0.8"          <!-- S (force magnitude)                       -->
   data-range="340"             <!-- d_max influence radius (px)               -->
   data-absorb="74" data-max="44"  <!-- sink capture radius & saturation     -->
   data-spin="1"                <!-- swirl direction/strength (±)             -->
   data-angle="0"               <!-- stream/jet heading (deg)              -->
   data-when="hot"              <!-- conditional gate (§5)                      -->
   data-feedback                <!-- enable density write-back (--d)           -->
   data-fmin="300" data-fmax="800" data-opsz="96"  <!-- density→font weight    -->
   data-hot data-color="#ff9d5c"   <!-- engageable + its accent color          -->
>hi@zachshallbetter.com</a>
```

Grouping: wrap a set in `[data-index]` so engaging one dims the rest; add
`data-threads` to also wire connecting lines.

**Demo affordances** (used by the Manual and the Design System; from `manual.js`
and `ds-interactions.js`):

| Attribute | Effect |
|---|---|
| `data-drag` | Makes the body draggable; on pointer-move it repositions and calls `__field.rescan()` so the **force follows the element** across the field. The clearest proof that force is bound to the element, not the cursor. |
| `data-agitate="#sel"` | On a button — fires a one-shot `__field.burst()` at the center of the target element `#sel` (tinted by its `--cc`/`--cat`, falling back to `--accent`), plus a CSS shockwave ring. A **discrete burst, not a steady force** — see §11/§16. |
| `.body-core` + `.meter > i` | A sink core whose paired meter bar reads the live `--load` the engine writes (`width = --load · 100%`) — visualizes accretion filling toward supernova. |

---

## 13. Public field API (`FieldHandle`)

> **As-built note.** The prototype exposed a `window.__field` global; the shipped API is the
> `FieldHandle` returned by `createField()` (or `createBrowserField()` in `@fundamental-engine/vanilla`),
> and proxied onto `<field-root>` as instance methods. All interaction with the running engine
> goes through this handle; the internal `store`, `env`, and particle array are not accessible
> from outside.
>
> **DOM-free consumers.** `headlessHost()` (from `@fundamental-engine/core`) provides a
> `FieldHost` with no DOM dependency, for non-DOM consumers (engine-driven agents, native
> sidecars, tests). It pairs with `render: 'none'` and the signal read-outs — bodies are
> registered programmatically via `addBody` (§13.8) rather than scanned from `[data-body]`.
>
> **Kotlin/Android parity.** The Kotlin port's `:fundamental-core` needs no `headlessHost()` stub —
> it is host-free by construction: `createField(…)` / `FieldController.tick(dt)` run the full
> simulation with no view or renderer, and bodies are registered programmatically through the
> `FieldHandle` API rather than scanned. A `FieldHost` is injected only by `:fundamental-platform`
> when a host is present. In active development on the Android port branch — not a published release.

### 13.1 Configuration

| Method | Description |
|---|---|
| `setAccent(hex)` | Recolour the travelling accent (§9). |
| `setPalette(name \| stops[])` | Swap the accent's colour template live — built-in name or custom hex stops. |
| `setFormation(name)` | Switch the global formation: `ambient` · `wells` · `lanes` · `scatter` · `accretion` (§7). |
| `setAttention(on)` | Toggle conserved attention (§2.4) — one finite strength budget. |
| `setCausality(on)` | Toggle cross-boundary causality (Concept 4) — density spills to neighbours. |
| `setHeatmap(on)` | Toggle the density heatmap layer (H1). |
| `setRender(mode)` | Switch the underlay render mode (§20.6): `dots` · `trails` · `links` · `metaballs` · `voronoi` · `streamlines` · `flow` (a composite — `dots` + `streamlines`) · `none` (the signals-only mode — never draws; see §13.7). |
| `setOverlay(mode)` | Render a field-structure visualization on the overlay surface: `off` · `streamlines` · `force-vectors` · `field-lines`. |
| `setSeparation(strength)` | Particle-to-particle short-range repulsion strength (`0..1`, default `0`) — keeps free matter from clumping. Mirrors `FieldOptions.separation` and the `separation` attribute on `<field-root>`. |
| `setWaveCenter(center)` | Set the center the `circular` Currents orbit (§24.1). Resolved live in three modes: a body token tracked each frame (e.g. `star`/`vortex`), a custom `{ x, y }` coordinate (or a `() => { x, y }` provider), or `null` to fall back to the viewport center. |
| `registerOverlay(name, drawFn)` | Register a custom named overlay into the `setOverlay` stack; `drawFn(backend, env, W, H)` is called each frame while `name` is active. Returns an unregister function. |

### 13.2 DOM synchronization

| Method | Description |
|---|---|
| `scan()` / `rescan()` | Re-read `[data-body]` elements after a layout change. |

### 13.3 Discrete actions

| Method | Description |
|---|---|
| `burst(x, y[, hex])` | Shove + heat matter near `(x, y)`, optionally tinting it (§11). |
| `threads(list \| null)` | Wire glowing connector lines between a set — `[{ a, b, color }]` — or clear with `null` (§10). |
| `flowTo(x, y[, opts])` | Place or move a dynamic flow focus the field bends toward. Call repeatedly to retarget; clear with `clearFlow()`. |
| `clearFlow()` | Remove the flow focus; the field relaxes back to its bodies-only shape. |

### 13.4 Data binding (`seed` / atoms)

| Method | Description |
|---|---|
| `seed(atoms)` | Bind a data record to each base particle, round-robin. Each record's `weight ∈ [0,1]` scales that particle's mass + size. |
| `atomAt(x, y)` | Return the seeded record on the nearest particle to `(x, y)` within ~24 px, or `null`. |
| `focusAt(x, y)` | Hold + highlight the nearest seeded particle; return its record (the dwell affordance before a click). |
| `clearFocus()` | Release the focused particle; it resumes drifting. |

### 13.5 Diagnostics

These accessors exist to give external tools — debug overlays, the DataConsole, Inspector panels —
read-only access to engine state that would otherwise require a reference to internal structures
(`store.particles`, `store.size`) that are intentionally not part of the public handle contract.

| Method | Returns | Description |
|---|---|---|
| `particleCount()` | `number` | Live size of the particle pool (`store.size`). Use for budget monitors that need the count without walking the array. |
| `readParticles(out)` | `number` | Zero-copy bulk read into a caller-owned `Float32Array` — stride-5 layout `[x, y, z, heat, size]` per particle (`PARTICLE_STRIDE = 5`, format `PARTICLE_WIRE_VERSION = 0`, both exported from `@fundamental-engine/core` types). Returns the count actually written; engine-stepped agents (§22.8) are excluded. |
| `readParticleIds(out)` | `number` | Stable-id read into a `Uint32Array`, parallel to `readParticles` (same pool order, same agent exclusion) — `ids[i]` is the stable id of the particle at stride offset `i*5`. Lets a host key its own payload off pooled particles' identity. |
| `readParticleChannels(channels, out)` | `number` | Column-wise multi-channel read: for each name in `channels` (`'x'·'y'·'z'·'vx'·'vy'·'heat'·'size'·'m'·'id'·'age'·'charge'`) fill the parallel `Float32Array` in `out`. Unknown channels write `0`; agent-exclusion matches `readParticles`. |
| `energy()` | `{ kinetic, thermal, total, count }` | Per-frame energy snapshot. Forwards to `energyReport(store.particles)` from `@fundamental-engine/core/diagnostics/energy`. |
| `scrollV()` | `number` | The engine's eased page-scroll velocity — the same EMA the `scrolling` condition gate (§5) reads: `(prev × 0.7) + (\|Δscroll\| × 0.3)` per frame. Units are **px/frame at the display refresh rate** — refresh-rate dependent (roughly half on a 120 Hz display; a px/ms normalization may replace the unit before 1.0 — the surface is experimental). The platform runtime mirrors it to `--field-scroll-v` on `:root` each frame. Pull-based: read on demand, do not poll in tight loops. |

> **Encapsulation note.** `store.particles` (the internal `Particle[]`) is not exposed — only
> computed summaries are. External tools must not hold a reference to the particle array between
> frames; the pool is rebuilt on resize and density changes.

### 13.6 Lifecycle

| Method | Description |
|---|---|
| `destroy()` | Stop the loop and release all listeners. |

### 13.7 Element visibility — `setVisible(on)` — and the signals-only render mode `'none'` (experimental)

| Method | Description |
|---|---|
| `setVisible(on)` | Element-level visibility hint. `setVisible(false)` skips **all** draw work each frame — the underlay render and the overlay surface, usually the dominant frame cost — while the simulation and its feedback signals stay live: `scrollV()`, `--d`, `--load`, and capture events keep flowing. |
| `render: 'none'` / `setRender('none')` | The same skip, made **structural**: a named render mode in which the engine never draws at all. The simulation, feedback writes, events, sinks, and engagement are unchanged and live — the field exists purely as signals. |

Distinct from the **tab-level** pause: the host's `visibilitychange` already stops the loop
entirely when the tab is backgrounded; `setVisible` is for a canvas that is hidden or offscreen
(`display: none`, scrolled out) while the page stays active. `<field-root>` wires it
automatically from an IntersectionObserver on the host element (the host is `position:fixed
inset:0`, so not-intersecting means hidden or zero-sized), and an engine rebuild (density / waves
/ mass change) re-applies the last observed state so a hidden field stays draw-skipped. Related
cost control: under `prefers-reduced-motion` the scene is static (`dt = 0`), so a visible canvas
redraws at quarter rate — visually identical at a quarter of the cost.

**Render mode `'none'` — the signals-only engine ([#297](https://github.com/zachshallbetter/fundamental-engine/issues/297)).**
Where `setVisible(false)` is a *dynamic* hint (the field may become visible again any frame, so
the drawing machinery stays ready), `render: 'none'` is the *structural* contract behind the
typographic (invisible) placement. A field **created** with `createField(canvas, { render:
'none' })` guarantees, from construction:

- **No canvas context.** `getContext('2d')` is never called — on the main canvas or the overlay
  canvas. (Consequently the mode never throws the "2D canvas context unavailable" error.)
- **No backing store.** `resize()` never assigns `canvas.width`/`canvas.height`; the backing
  store stays 0×0 — no pixel-buffer allocation. The simulation's `W`/`H` still track the
  viewport exactly as in every other mode, so the physics space is unchanged.
- **No render scratch.** The per-mode scratch buffers (the metaball density grid, the voronoi
  owner grid, the heatmap's offscreen raster canvas) are allocated inside the render paths, so
  they are never allocated. (The `Heatmap` *simulation* buffer is the exception: it feeds the
  `--field-heatmap-density` feedback channel, so `heatmap: true` still allocates it — that is a
  signal, not a drawing.)
- **Signals stay live.** `--d`, `--load`, `--lit`, `field:captured`/`field:released`,
  `field:lit`/`field:dim`, `data-on` event bindings, `scrollV()`, engagement (`data-hot`),
  element movers/docking — the full pipeline runs every frame. Neither the underlay `render()`
  nor the overlay `renderOverlay()` is ever invoked (`setOverlay` is accepted but draws nothing
  while the mode is `'none'`).

Runtime transitions via `setRender`:

- **From `'none'` to a drawing mode** — the context is acquired *lazily* at that moment and the
  backing store is sized once (the deferred resize). If acquisition fails (a lost GPU process,
  context exhaustion), the engine warns and stays signals-only rather than crash the live
  simulation.
- **To `'none'` from a drawing mode** — drawing stops from the next frame, but an
  already-acquired context and its backing store are **kept** (and the last drawn frame stays on
  the canvas — hide or clear it with CSS if it is on screen, exactly as with
  `setVisible(false)`). The no-allocation guarantee is **creation-time only**: it belongs to
  fields created with `render: 'none'`, not to fields switched into it.

A simulation that runs with no drawn surface at all — feedback variables styled by author CSS as
the only output — is the **invisible-fields** pattern; `render: 'none'` is its engine-level
contract. See `docs/canonical/invisible-fields.md` for the placement taxonomy
(underlay / overlay / typographic) and the two-field page architecture this enables.

### 13.8 Programmatic bodies & edges

Bodies and relationships can be created **with no DOM element** — the path a non-DOM host
(`headlessHost`, a Three.js scene, a native sidecar) uses, where there is no `[data-body]`
to scan. These are the engine-level counterparts of a DOM body (§3.1) and a relationship
edge; the force-target view of the same primitives is §22.11 / §22.12.

| Method | Returns | Description |
|---|---|---|
| `addBody(spec)` | `BodyHandle` | Register a body the engine treats like any scanned `[data-body]`. `spec` carries `tokens` (the force ids it emits), a `rect()` position sampler (the host projects its position through this each frame), and optional `strength`/`range`/`spin`/`angle`/`color`/`data`/`onFeedback`. The returned `BodyHandle` exposes the carried `data`, live `channels`, a `set(params)` for reactive force-param changes, and `remove()`. |
| `addEdge(a, b, opts)` | `EdgeHandle` | Relate two programmatic bodies — `a` and `b` are `BodyHandle`s returned by `addBody` on this field. `opts` selects the `type`, `strength`, and `direction` (`from-to` · `to-from` · `bidirectional`). Returns an `EdgeHandle` (`set` / `remove`); read the live graph back via `readEdges()`. |

A *structural* change (different `tokens`) still needs `remove()` + `addBody` — tokens are
classified once, not reactive. Per-body feedback is delivered through `spec.onFeedback`
(demultiplexed from the global sink) and mirrored on the handle's `channels`.

---

## 14. The Lab (interactive sandbox)

A floating toolbar (`lab.js`) lets a visitor **paint forces onto the field**. Each
dropped chip is a real DOM `[data-body]` the engine reads — the exact mechanism
the site itself uses. On the homepage it's confined to the `#experience` play
zone; a standalone `field.html` opens the whole viewport.

### 14.1 Brush tune table
Click a brush, optionally pick a condition, click the field to drop. Defaults
(`TUNE` in `lab.js`):

| Brush | `data-body` | strength | range | extra |
|---|---|---|---|---|
| Attract | `attract` | 0.9 | 320 | — |
| Repel | `repel` | 1.1 | 300 | — |
| Sink | `sink attract` | 0.5 | 300 | `sink 80`, `max 40` |
| Swirl | `swirl` | 1 | 320 | `spin 1` |
| Stream | `stream` | 1 | 340 | `angle 0` |
| Viscosity | `viscosity` | 1 | 300 | — |
| Tether | `tether` | 1 | 260 | — |
| Jet | `jet` | 1 | 300 | `angle 0` |

Brush colors match the canonical force colors (§6), except the Lab tints
**viscosity** `#8da2c0` and **sink** `#ff6e9c` (both canonical) — note the Lab does
**not** expose `wall` as a brush.

### 14.2 Conditions & formations exposed
- Conditions: **Always**, **Fast**, **Hot** (a subset of §5).
- Formations: all five (§7), switchable live.

### 14.3 Chips
Drag to move (re-measured live), hover to thread to every other chip, ×/double-
click to remove, "Clear all" to reset.

### 14.4 Shareable fields
The dropped set serializes into the URL hash and restores on load:
```
#f=tool,cond,fracX,fracY;tool,cond,fracX,fracY;...
```
(`serialize()` / `loadFromHash()` — coordinates stored as viewport fractions.)

---

## 15. Disciplines ↔ forces (the practice matrix)

The homepage capabilities grid (`#capsGrid`, 8 cards) is the human-facing face of
the force set: each discipline is presented as a force acting on the field.
Clicking a card focuses it and fans out 14 facets (`caps.js` `RELATED`).

**Canonical mapping** (`DS_FORCES`, the authority):

| Discipline | Force | Verb |
|---|---|---|
| Product strategy | Attract | gives direction |
| AI systems | Jet | adapts response |
| Software architecture | Tether | gives structure |
| Experience design | Wall | the human surface |
| Motion | Stream | reveals motion |
| Commerce | Repel | market pressure |
| Physical production | Viscosity | adds constraint |
| Creative technology | Swirl | spins it together |
| *(Attention)* | Sink | holds, then releases |

> ⚠️ **Known inconsistency to reconcile when implementing.** The prototype's
> homepage `index.html` caps cards assign *different* colors than the canonical
> `DS_FORCES` (e.g. Tether is tinted `#2dd4bf` on the card but is canonically
> `#86e57f`; Wall is `#7dd3fc` on the card but canonically `#c4b5fd`), and it
> labels AI systems' force "Condition" rather than the canonical verb "adapts
> response." **`DS_FORCES` colors/identity are the authority** — align the cards to
> them. Sink maps to "Attention" and is not shown as a discipline card (it's the
> Contact body and a Lab brush).

---

## 16. The Field Manual (the canonical narrative)

`manual.html` ("Field Manual · v6 · the physics of this page") is the prose
explanation of the system, with the **real engine running live behind every
example**. It is the authority for *how the system is explained* and the order it
builds up. Thesis: *elements have mass*

Structured as **four chapters / sixteen numbered concepts**:

| Ch | Concepts |
|---|---|
| **I · Substrate** | 01 Synchronization · 02 Mass & damping · 03 Currents |
| **II · Forces** | 04 Attraction · 05 Repulsion · 06 Reflection · 07 Swirl · 08 Stream · 09 Tether · 10 Viscosity · 11 Accretion & release · 12 Emission |
| **III · Conditions** | 13 Conditional |
| **IV · System** | 14 Reciprocity · 15 Threads · 16 Formations |

Manual-specific behavior (`manual.js`): each `.concept[data-form]` section cues a
formation as it scrolls into view (the field "reorganizes under you"); a chapter
rail highlights the current chapter; `[data-drag]` chips and `[data-agitate]`
buttons drive the live demos (§12); the accretion `.meter` reads `--load`.

**Agitate vs. a force.** The manual draws a sharp line worth preserving in the
implementation: a **force** is a steady, continuous influence a body exerts every
frame; **agitate** (`__field.burst()`) is a *discrete one-shot* — it shoves and
heats nearby matter once, like a shockwave. The design system's guidance: "use it
for confirmations and arrivals." Both obey conservation — agitate shoves existing
matter, it spawns nothing.

---

## 17. The Design System (where the forces live)

`design-system.html` + the `ds-*` files are a full design system whose signature
surface is this field. The canonical data (`ds-data.js`, §15) feeds every view.

**Information architecture** (`DS_NAV`):

| Group | Views |
|---|---|
| **Foundations** | Brand · Style · Type |
| **The Field** | Substrate · **Forces** · Formations · Lab |
| **Interface** | Components · Patterns · Library · Screens |

The **Forces** view (`ds-forces.jsx`, "Nine forces. One reciprocal field.",
05/11) is the structured counterpart to the manual, in ten sections: Reciprocity
→ Force set → Anatomy of a body → Force formulas → Drag a body → Agitate →
Accretion → Conditions → Threads → Reciprocal feedback. It frames **reciprocity
as two directions**:

- **Element → Field:** a body emits its force into the medium; the layout shapes
  the field.
- **Field → Element:** where density gathers, the element gains weight/glow/pull;
  the field shapes the layout in return.

**Gated live field** (`ds-interactions.js` → `window.DSInteractions`): in the
design system every demo is **inert until the visitor flips a "Reciprocal Field"
toggle** (default OFF, persisted in `localStorage` as `ds-field-live`). While off,
trying to interact nudges the toggle; turning it on binds engagement, drag,
agitate, and the meter, and starts the accent journey. This is the recommended
pattern for embedding the (cost-heavy) field inside a denser documentation UI.

> Note: the DS accent journey uses a **different, 7-stop** order
> (`#4da3ff #a78bfa #86e57f #7dd3fc #ff9d5c #2dd4bf #ff6e9c`, one per force) than
> the site's 5-stop scroll journey (§9). The site journey is the one to ship; the
> DS order exists to showcase all nine force colors.

---

## 18. Accessibility, reduced motion, performance

### 18.1 Accessibility

- **Reduced motion** (`prefers-reduced-motion: reduce`): the integration step `dt` is set to `0`
  — waves and particles render static, no motion occurs. Sparks are suppressed. This is the only
  built-in quality lever; it is binary (full physics or full freeze).
- **Engageable elements** (`[data-hot]`) respond to `focus`/`blur` as well as pointer; touch
  devices use tap-toggle so the effect persists without hover.
- The field canvas is `aria-hidden="true"` and sits at `z-index: 0` behind content. It is
  decorative ambiance, never an interactive element.

### 18.2 Performance budget

The engine defines a `PerformanceBudget` with defaults enforced by `inspectBudget()` from
`@fundamental-engine/core`:

| Dimension | Default limit | Notes |
|---|---|---|
| `particles` | 600 | Pool grows on demand; no built-in shrink path. |
| `bodies` | 80 | `[data-body]` / `[data-preset]` elements the engine tracks. |
| `localCells` | 3 | Active `<field-cell>` scoped regions. |
| `fieldLines` | 256 | Field-line overlay count cap. |
| `heatmapResolution` | 6 px | Cell size of the density heatmap grid (4–8 px range). |
| `dprCap` | 1.5 | Device pixel ratio ceiling for the canvas backing store. |

```ts
import { inspectBudget, DEFAULT_BUDGET } from '@fundamental-engine/core';

const findings = inspectBudget({ bodies: n, particles: handle.particleCount() });
// → BudgetFinding[] — each over-limit dimension with { field, value, limit, over }
```

`withinBudget(counts)` returns a boolean shorthand. Both are pure — they read the counts you
supply; they do not sample the engine.

### 18.3 Cost controls (as-built)

- DPR capped at 1.5 (the `dprCap` budget default above).
- Bodies measured every 6 frames; off-screen elements exert no force.
- Spark cap 260; canvas uses `alpha: false`.
- `store.reindex()` rebuilds the spatial hash every frame from scratch — no amortization.
- There is **no automatic quality throttle**. The only quality reduction path is
  `prefers-reduced-motion` (which freezes physics entirely). If the engine falls behind its
  frame budget, nothing adjusts. See `docs/engine-reference/observable-surface.md` for the
  identified gaps and the `FieldPerf` design direction.

---

## 19. Notes for adapting the engine

> **As-built note.** This section describes how the *force engine* is mounted; it is
> not the full platform architecture. In the shipped system, `Fundamental`
> computes renderer-agnostic field behavior (force math, conservation, conditions,
> formations) and `@fundamental-engine/dom` binds it to the DOM — measurement, state,
> feedback writes, relationships, visual bindings, overlays, scheduling (the explicit
> discover → read → compute → state → write → render phases), and linting. The
> platform runtime is the **default** for `<field-root>`. For the complete
> architecture see the canonical docs linked in the status banner at the top.

The original prototype was plain DOM + a `requestAnimationFrame` loop reading
`[data-body]` attributes. Adapting it into any app comes down to one decision:

1. **Mount the engine once** as a single canvas render surface at the app root that scans
   `[data-body]` elements — keeping the declarative authoring model intact. This is what
   the shipped adapters do (`<field-root>`, `mountField()`, `<FieldField>`); or
2. **Re-express the forces** on top of an existing particle/behavior system, mapping each
   force in §6 to that system's primitive.

Either way, this document is the contract: the **nine forces** (§6), **five
formations** (§7), **seven conditions** (§5), the **body attribute API** (§12),
the **`window.__field` surface** (§13), and the **two-way feedback** rule (§8) are
what must be preserved for the field to read as *reciprocal* rather than as a
generic particle background.

Recommended next step: lift `ds-data.js` verbatim into a typed module
(`src/config/forces.config.ts`) so `DS_FORCES` / `DS_FORMATIONS` /
`DS_CONDITIONS` become the single source of truth in the app too, then build the
engine and the caps matrix against it.

---

## 20. Extended force set — **implemented**

> This section is the **formal spec** (token, class, formula, defaults) for the extended
> vocabulary, and the **forces** are now **built**: every force below ships in the engine —
> the relocation atom `warp` included ([A · paired], conformance-tested, traced on the home
> manual) — except the `wormhole` preset that composes it (still spec-only);
> a few forward items in §20.6 (render modes) and §20.10 (transmutation atoms) are spec-only
> too and are marked inline. Rationale, "unique result," and
> sequencing live in `docs/forces-possibilities.md`. The foundational pass the classes
> depend on — `FieldStore`, the spatial hash (`env.neighbors`), the scalar grid
> (`env.grid`), the target store (`body.targets`), particle attributes, and the source
> sink — all shipped, so [A]–[E] and [S] are live.

**The layered model.** The vocabulary looks large, but everything sits in one of a
few layers — keep them distinct and the apparent sprawl collapses:

1. **Primitives** — the irreducible forces the engine actually implements, in two
   registers: *designed* (bounded, UI-legible: the nine of §6 plus `gate` · `lens` ·
   `spotlight` · `morph` …) and *natural* (real physical laws: `gravity` · `charge` ·
   `magnetism` · `thermal` · `propagate` · `collide` · `diffuse` · `cohesion`, §20.10),
   plus the two source/relocate atoms `spawn` · `warp`.
2. **Composites** — named *presets* over primitives (§20.9): `blackhole`, `wormhole`,
   `supernova`, `star`, `pulsar` … — **no new engine code.**
3. **Emergent** — behaviors that *arise* from primitives + initial conditions, never
   coded as forces: orbits, flocking, demixing, networks, phase transitions.
4. **Orthogonal axes** — **conditions** (*when* a force acts, §20.4), **formations**
   (a *global* bias — often one primitive applied field-wide, §20.5), and **render
   modes** (draw-pass swaps, independent of the physics, §20.6).

The working discipline: grow the **primitive** layer rarely and deliberately;
express new ideas as composites or as emergent behavior. That is what keeps a large
vocabulary standing on a compact set of real atoms.

### 20.1 Implementation classes
The canonical nine are all class **[A]**. The extended set spans five classes; the
class sets the architectural cost and whether it's a drop-in:

| Class | Meaning | Cost | Drop-in? |
|---|---|---|---|
| **[A]** | body → particle (fits today's registry contract) | O(b·n) | yes — new tokens/attrs only |
| **[B]** | particle → particle (needs a neighbor query on `env`) | O(n·k) | needs a **spatial hash** |
| **[C]** | field-buffer (reads/writes a persistent grid) | O(n + grid) | needs a **grid buffer** |
| **[D]** | target-geometry (body carries a point set) | O(n) | needs a **target store** |
| **[E]** | particle attribute (charge / species / age / color) | — | needs a **new particle field** |
| **[S]** | **source / sink — creates or destroys matter** | — | needs pool mgmt; **breaks conservation** |

The foundational pass that unlocks [B]–[E] **shipped**: a `FieldStore` owning the particle
pool, a spatial index (uniform hash), scalar grids, and an extended `env` exposing
`neighbors(p, r)` and `grid(name)` — plus `body.targets` for [D] and the `source()` hook +
aging/despawn sink for [S]. Class [A] forces and all of §20.4–§20.5 were drop-in.

> **Conservation note (class [S]).** The whole field's thesis is *"nothing created
> from nothing"* (§2.4) — every canonical force only *moves* matter. A few of the
> cosmology forces below (`supernova`, `fountain`, and a `blackhole`/`whitehole`
> set to destroy/mint) deliberately **break that law**. That is allowed but must be
> *budgeted*: a source needs a matching sink, an `age`/despawn cap, or a global pool
> ceiling, or the particle count grows unbounded and the sim dies. The engine
> already has a **conserved** `supernova` *event* (sink → release exactly what was
> held, §6.9); the class-[S] `supernova` *force* below is its dramatic superset
> (with `data-create="0"` it collapses back to the conserved event). Prefer the
> conserved path; reach for [S] only when the creation *is* the point (a star that
> seeds the field, a literal water fountain).

### 20.2 Registry (**names & colors** — reconciled)

> The reconciliation pass is **done**. The as-built registry lives in
> `packages/core/src/config/manual.ts` (and is cross-checked against the live force
> registry by a completeness test, so it can't drift). Every one of the **36 registered
> forces** carries a canonical color; the `mass`→`accreted` split (§21.2) shipped. The
> table below is the design source for this — read it with three deltas:
>
> - **`pheromone` shipped as the token `diffuse`** (deposit + steer up a diffusing grid);
>   its wave sibling is **`propagate`** (`∂²φ/∂t² = c²∇²φ`). Both are class [C].
> - **`warp` shipped; `wormhole` did not.** The relocation atom is built
>   (`packages/core/src/forces/extended.ts`, [A · paired], conformance-tested, traced on
>   the home manual); the `wormhole` preset that composes it remains spec-only, and the
>   rest of the cosmology set is composed from existing tokens (`blackhole`, `whitehole`)
>   or the conserved sink→release event (`supernova`).
> - **`spawn` [S] and `fountain`** shipped as written (a budgeted source + its preset).
>
> Everything else below is implemented under the listed token and color.

| Force | `token` | Class | Color | Discipline fit | Unique result |
|---|---|---|---|---|---|
| Lens | `lens` | A | `#67e8f9` | Motion | bends a flow into caustics — deflection with no capture |
| Align | `align` | A / B | `#fbbf24` | Experience / Motion | flocking, schooling, combed coherence |
| Orbit | *(emergent)* | — | `#b39ddb` | Product strategy | **not a force** — `gravity`/`attract` + tangential velocity (§20.3) |
| Crystallize | `crystallize` | A | `#93c5fd` | Physical production | solid↔liquid↔gas phase change, driven by `heat` |
| Resonate | `resonate` | A | `#f0abfc` | Motion | driven oscillation — standing waves, beats |
| Gate | `gate` | A | `#fb7185` | Software architecture | one-way membrane — matter rectifies / accumulates |
| Spotlight | `spotlight` | A | `#facc15` | AI systems | a directional perception/attention cone |
| Screen | `screen` | modifier | `#a8b8d8` | Experience design | a quiet zone — damps OTHER bodies' forces inside its radius (workover v0.3) |
| Wind | `wind` | A | `#38bdf8` | Motion | curl-noise turbulence — natural, non-repeating eddies |
| Shear | `shear` | A | `#818cf8` | Creative technology | laminar shear flow — turbulence at boundaries |
| Buoyancy | `buoyancy` | A+E | `#fcd34d` | Commerce / Physical | sedimentation — hot/light rises, heavy sinks |
| Charge | `charge` | A+E | `#60a5fa` / `#f472b6` | Commerce / AI | self-sorting — matter demixes into domains by sign |
| Cohesion | `cohesion` | B | `#34d399` | Physical production | a liquid with a skin — droplets that merge/split |
| Pressure | `pressure` | B | `#5eead4` | Software architecture | incompressible fill — even density, splashes |
| Link | `link` | B | `#94a3b8` | Software architecture | Verlet ropes, chains, cloth, soft structures |
| Hunt | `hunt` | B+E | `#ef4444` / `#22d3ee` | AI / systems | a living ecosystem — chases, population cycles |
| Pheromone | `diffuse` | C | `#a3e635` | AI / Creative tech | self-growing transport networks (Physarum) |
| Memory | `memory` | C | `#c084fc` | Experience design | paths wear in — the field remembers where matter went |
| Morph | `morph` | D | `#e879f9` | Creative tech / Design | matter becomes a shape: logo, **mark/punctuation**, map, **chart** — *not* words (§11) |
| Pigment | `pigment` | E | *(carried)* | Commerce / brand | conserved color transport — sections stain the field |
| Warp | `warp` | A · paired | `#8b5cf6` | Software architecture | **atom** — conserved relocation between paired throats |
| Spawn | `spawn` | **S** | `#fb923c` | Creative tech / Motion | **atom** — creates particles (continuous or one-shot) |
| Blackhole | `blackhole` | **preset** | `#fbbf24` (disk) | Product strategy | = `attract swirl sink lens` — horizon + disk + lensing |
| Whitehole | `whitehole` | **preset** | `#e0f2fe` | Commerce | = `repel stream` — emission-only horizon |
| Wormhole | `wormhole` | **preset** | `#8b5cf6` | Software architecture | = `attract warp` ↔ `warp repel` — two linked throats |
| Supernova | `supernova` | **preset [S]** | `#fb923c` | Creative technology | = `spawn` (one-shot blast) + remnant swap |
| Fountain | `fountain` | **preset [S]** | `#38bdf8` | Motion | = `spawn` (continuous) along a heading |

### 20.3 Formulas
`S = strength`, `d = dist`, `d_max = range`, `û = (dx,dy)/dist`, `f ≈ 0.95`.

**Lens — `lens` [A].** Rotate velocity, preserve speed (path bend, no energy).
```
θ = θ_max · (1 − d/d_max) · sign ;   v ← rotate(v, θ)
```
Attrs: `data-strength`(=θ_max), `data-range`, `data-spin`(=sign).

**Align — `align` [A heading | B neighbors].** Steer toward a heading or neighbor mean.
```
ĥ = heading (A)  or  mean(neighbor v̂) (B) ;   v += (ĥ·|v| − v) · k_align     (d < d_max)
```
Attrs: `data-angle`(heading), `data-strength`(=k_align), `data-range`.

**Orbit — *emergent*, not a force.** A closed orbit is what `gravity` (§20.10) or
`attract` already produces when matter carries tangential velocity; *continuously
injecting* tangential speed (an earlier draft) would spiral outward, not orbit. So
there is no `orbit` module — seed matter with sideways velocity near a `gravity`
well, or use the `wells` formation's `orbit` swirl term (§7). Kept in the registry
only as a named **behavior**, for the relationship maps.

**Crystallize — `crystallize` [A].** Snap to a lattice when cool, melt when hot.
```
if heat < θ_freeze:  v += (latticeNode(p) − p)·k_snap ;  v *= 0.9     // solid
else:                /* free — melted */
```
Attrs: `data-range`, `data-strength`(=k_snap), `data-when="cool"` pairs naturally.

**Resonate — `resonate` [A].** Time-varying strength feeding an attract/stream core.
```
S(t) = S₀ · (1 + sin(ω·t + φ)) ;   apply chosen core force with S(t)
```
Attrs: `data-strength`(=S₀), `data-range`, `data-omega`, `data-body="resonate attract"`.

**Gate — `gate` [A].** Pass one way across axis `n`, wall the other.
```
n = (cosθ, sinθ) ;   if (v·n) < 0:  v −= 2(v·n)·n        // wall wrong-way crossers
```
Attrs: `data-angle`(=n heading). Sized by the element box (like `wall`).

**Spotlight — `spotlight` [A].** Gate any force on an angular cone of the heading.
```
act only if  acos( û_{b→p} · heading ) < φ                 // else skip
```
Attrs: `data-angle`(heading), `data-fov`(=φ°), plus the core force in `data-body`.

**Screen — `screen` [modifier · cross-body] (workover v0.3).** A quiet zone / shield:
damps the magnitude of **other** bodies' forces on matter inside its radius — text
shielded from a noisy field, a calm pocket in a busy page. Unlike `spotlight`/`resonate`
(which modify their *own* siblings via `modify()`), `screen` is cross-body: the
attenuation is applied in the integrator's force pass, where per-particle, per-body
forces compose. A screen never attenuates its own sibling tokens. Truth mode: designed.
```
falloff      = max(0, 1 − d/range)²                        // smooth at the edge, no cliff
screenFactor = clamp(1 − S·falloff, min, 1)                // min from data-screen-min (default 0)
otherForce  *= screenFactor                                // per particle inside the radius
```
Attrs: `data-strength`(=S), `data-range` (0 ⇒ inert — screens are always local, never
global), `data-screen-min`(=min). The initial mode is `local`; `data-screen-mode`
(`inside`/`outside`/`behind`) is future work. Diagnostic probe samplers (`forceAt`, the
Lab's frame-0 delta) read raw forces and do not apply screen attenuation — the
integrator pass is the contract.

**Wind — `wind` [A].** Curl of a noise field → divergence-free turbulence.
```
v += curl( noise(x·s, y·s, t·s_t) ) · S                    // (∂n/∂y, −∂n/∂x)
```
Attrs: `data-strength`, `data-range` (0 ⇒ global), `data-scale`(=s).

**Shear — `shear` [A].** Velocity grows tangentially with perpendicular offset.
```
v_∥ += S · (offset_⊥ / d_max) · (1 − d/d_max)              // laminar gradient
```
Attrs: `data-angle`(flow axis), `data-strength`, `data-range`.

**Buoyancy — `buoyancy` [A+E].** Constant body force by density difference.
```
ρ_p = base / (size · (1 + heat)) ;   v_y += (ρ_med − ρ_p) · g
```
Attrs: `data-strength`(=g), `data-range` (0 ⇒ global). Particle needs `size`/`heat` (have).

**Charge — `charge` [A+E].** The **signed sibling of `gravity`** — the same `1/d²`
kernel, sign decides direction (like repels, opposite attracts).
```
F = σ · q · GM /(d² + ε²) ;   v += F · û        // σ = body sign, q = particle charge
```
Attrs: `data-spin`(=σ ±1), `data-strength`(=GM), `data-range`. Particle needs `q`.
**Code it once** as the shared inverse-square kernel with `gravity` (§20.10); a
source scalar (mass ≥ 0 vs charge ±) is the only difference.

**Cohesion — `cohesion` [B].** Short-range push + mid-range pull over neighbors.
```
for n in neighbors(p, r₁):
  if dn < r₀:  v −= k_p·(r₀ − dn)·û_n          // pressure (no overlap)
  else:        v += k_c·(dn − r₀)·û_n          // cohesion (skin)
```
Attrs: `data-r0`, `data-range`(=r₁), `data-strength`(=k_c).

**Pressure — `pressure` [B].** SPH-style density relaxation → incompressible fill.
```
ρ_p = Σ_n W(dn, h) ;   v += −k · Σ_n (ρ_p − ρ₀)·∇W(dn, h)   // push down density gradient
```
Attrs: `data-range`(=h), `data-strength`(=k), `data-rho0`.

**Link — `link` [B].** Verlet distance constraint between paired particles.
```
each step:  e = (|p_a − p_b| − L) ;   p_a −= ½ e·û ;  p_b += ½ e·û     // satisfy rest length
```
Attrs: declared as pairs/chains (`data-link="idA idB"`), `data-len`(=L), `data-stiff`.

**Hunt — `hunt` [B+E].** Two species; predators seek, prey flee; populations cycle.
```
predator: v += seek(nearest prey)·S ;   prey: v += flee(nearest predator)·S
populations evolve Lotka–Volterra:  Ṗ = αP − βPQ ,  Q̇ = δPQ − γQ
```
Attrs: `data-species`, `data-strength`, `data-range`. Particle needs `species`.

**Pheromone — `diffuse` [C].** Deposit to a decaying grid; steer up its gradient.
```
deposit:  T(x) += δ ;   steer:  v += ∇T(x)·k_follow
grid/frame:  T ← (T · decay) ⊛ blur                         decay ≈ 0.97
```
Attrs: `data-strength`(=δ), `data-range`, `data-follow`(=k_follow). Needs grid `T`.

**Memory — `memory` [C].** A slowly-accumulating occupancy grid biases the force.
```
M(x) += λ each frame a particle sits there ;  M decays slowly
local force scaled by  (1 + μ·M(x))                          // worn paths attract more
```
Attrs: `data-strength`(=μ), `data-range`. Needs grid `M`.

**Morph — `morph` [D].** Assign particles to target points; tether in with fading
jitter. **Targets are punctuation, marks, logos, shapes, or data — never
words/letterforms** (the punctuation rule, §11); for words use `--d` glow/grow (§8).
```
assign p → target t_k (stable hash) ;   v += (t_k − p)·k_m + jitter·(1 − arrived)
arrived = clamp(1 − |t_k − p|/ε, 0, 1)
```
Attrs: `data-target`(SVG path | image | dataset id), `data-strength`(=k_m). Needs target store.

**Pigment — `pigment` [E].** Conserved color advected with matter; subtractive mixing.
```
on contact/overlap:  c_p ← mix(c_p, c_other, rate)          // pigment moves with particles
```
Attrs: bodies stamp `data-color`; particles carry `c`. Drives the accent journey as real transport.

**Field Flow — `fieldflow` [A].** Follow the field lines. Where `magnetism` curls a charge
*across* the field (perpendicular Lorentz, no work) and `charge` pushes only charged matter
along its own radial field, `fieldflow` advects **all** matter **along** the net structure
field every body radiates — the superposition of every `field()` hook, read through
`env.fieldAt`. It steers velocity onto the local line (speed-preserving) and accelerates down
it (does work), so a swarm threads the dipole loops of a magnet or streams off a charge like
plasma along a solar prominence.
```
n̂ = netField(x,y) / |netField(x,y)|                         // line tangent, scale-free
v += (n̂·|v| − v)·k_steer    +    n̂ · gain · a_accel          // steer onto + stream down
gain = strength · (1 − d/r)                                  // range 0 ⇒ global field-follow (the planned `magnetic` formation, §20.5)
```
The line direction is used normalized, so a faint dipole channels matter as surely as a strong
monopole — the look no longer depends on the field's absolute magnitude. Following the *net*
field routes matter along the lines that link two poles, so channelling *between* bodies emerges
from the geometry. Acts on neutral matter too — it is field transport of the medium, not the
charge-gated Lorentz force. Attrs: `data-strength`(gain), `data-range`(locality).

#### Cosmology set
A themed family — **realized as composites of primitives, not new force modules**
(see §20.9, the preset layer). Decomposed, the whole set needs only **two new
atoms**: `warp` (the wormhole's relocation) and `spawn` (particle creation);
`blackhole` and `whitehole` are pure compositions of existing tokens and need *zero*
new code. The blocks below give each force's **target/emergent physics** and double
as the spec for the two atoms. `blackhole`/`whitehole`/`wormhole` are **conserved**;
`supernova`/`fountain` are class **[S]** sources — read the conservation note in
§20.1 first. `c` is the "speed of light" scaling the relativistic terms
(lensing/redshift); at this layer it's a tunable constant, but §20.10 makes it the
real velocity cap `v_max` so those terms become *derived* rather than fudged.

**Blackhole — `blackhole` [A] (+[S] if `data-destroy`).** Newtonian infall with an
event horizon that captures (like `sink`), frame-dragging that builds an
accretion disk (like `swirl`), and grazing-path bending (like `lens`). It is the
*extreme* of `attract`.
```
GM = strength · k_g
if d ≤ r_s:                                   // event horizon (r_s = data-horizon)
    capture: p.cap = b ; b.accreted++         // held (conserved) unless data-destroy → removed
    if b.accreted ≥ capacity:  supernova(b) | jet(b)   // saturate → release / quasar
else:
    a   = GM / d²                             // radial infall (diverges near r_s)
    v  += a · û
    v  += (−dy, dx)/d · a · spin · χ          // frame-drag → accretion disk (χ ≈ 0.3)
    θ   = 2·GM / (d · c²)                      // light bending of grazing matter
    v   = rotate(v, θ)
    heat = max(heat, (1 − (d−r_s)/d_max)·0.9) // inner disk runs hot (→ color, §20.8)
tidal stretch ∝ 2·GM / d³                      // spaghettification (render as elongation)
```
Attrs: `data-strength`(GM), `data-range`, `data-horizon`(r_s≈40), `data-spin`(frame-drag),
`data-max`(mass cap), `data-destroy`(make it a true sink). Composite of attract +
swirl + sink + lens — see §20.7.

**Whitehole — `whitehole` [A] (+[S]).** The time-reverse of a black hole: matter can
only *leave*. A hard repeller with an emission horizon — and the natural exit mouth
of a `wormhole`.
```
if d < r_s:  v = û_out · spd ; p.pos = center + û_out·r_s   // eject; never admit
else:        v −= (GM / d²) · û                             // outward push (extreme repel)
```
Attrs: `data-strength`(GM), `data-horizon`, `data-angle`(preferred eject heading).

**Wormhole — `wormhole` [A · paired].** Two throats A↔B linked; matter entering one
throat is relocated to the partner with its momentum carried through (and optionally
twisted/scaled). **Conserved** — it only relocates.
```
partner B = resolve(data-pair)
if d < throatR:
    local  = (p.pos − A.center) · k       rotate by Δθ        // map into B's frame
    p.pos  = B.center + local
    p.vel  = rotate(p.vel, Δθ) · k                            // momentum through the bridge
    p.heat = max(p.heat, 0.6)                                 // exit glow
```
Attrs: `data-pair`(partner selector), `data-throat`(radius), `data-twist`(Δθ),
`data-scale`(k). One-way variant = `blackhole` mouth A + `whitehole` mouth B.

**Supernova — `supernova` [S].** Core-collapse blast: releases any held matter
(conserved part), **mints `N` new particles** (nucleosynthesis — the law-break),
shockwaves the neighborhood, and leaves a remnant body. Triggered on saturation, a
`data-when` gate, or an event.
```
on trigger at (cx, cy):
  release:  for p in captured:  p.cap = null ; v = û·rand(4,7) ; heat = 1     // conserved
  create:   for k in 1..N:                                                    // [S] — new matter
              θ = 2πk/N + jitter ; spd = v0·(0.7 + 0.6·rand)
              spawn { pos: center, vel: (cosθ,sinθ)·spd, heat: 1, age: 0 }
  shock:    burst(cx, cy, R)                                                  // shove + detach (§11)
  remnant:  leave data-remnant ∈ { tether (neutron star) | blackhole | none }
```
Attrs: `data-create`(N; 0 ⇒ conserved event), `data-strength`(v0/blast), `data-range`(shock R),
`data-remnant`. Pair with a sink (a `blackhole`, or `age` despawn) to balance the budget.

**Fountain — `fountain` [S].** A true source: continuously *creates* particles at a
nozzle with an initial heading, which then fall under gravity/formation and expire
by age. Distinct from `jet`, which *recycles* existing field (conserved conduit).
```
each frame (Poisson rate r = data-rate):
  spawn ⌊r⌋ particles at nozzle:  vel = heading·spd + cone(spread) ; heat = warm ; age = 0
particles integrate normally; despawn when age > life or off-screen  ← required sink
```
Attrs: `data-rate`(spawn/frame), `data-angle`(heading), `data-strength`(spd),
`data-spread`(cone), `data-life`(age cap). Relationship: `fountain : jet ::
source : conduit` (§20.7).

### 20.4 Extended conditions (`data-when`)
Drop-in [A]; selective ones read each particle (like `hot`/`cool`, §5).

| id | Fires when | Selective? |
|---|---|---|
| `near` | a reference point (cursor/another body) is within a radius | no |
| `dense` | local density `b.d > θ` | no |
| `sparse` | local density `b.d < θ` | no |
| `aligned` | particle heading matches the body heading (`v̂·ĥ > θ`) | yes |
| `aging` | particle lifetime in a band (`age ∈ [a,b]`) | yes (needs `age`) |
| `charged` / `species` | particle attribute matches | yes (needs attr) |
| `dwell` | the body has been engaged longer than `t` | no |
| `pointer-fast` | cursor speed `> θ` | no |
| `schedule` | clock / time-of-day window | no |
| `inview` | element intersection ratio in a band | no |

### 20.5 Extended formations (global biases, joining the five in §7)

> **Spec-only / not yet implemented.** The five shipped formations are the set in §7
> (`ambient`, `wells`, `lanes`, `scatter`, `accretion`). Every row below is a *planned*
> extension — none is wired today.

| id | Bias |
|---|---|
| `gravity` | constant downward force → particles fall and pile (sedimentation) |
| `tide` | oscillating global drift `driftX = A·sin(ωt)` |
| `lattice` | crystalline rest grid (global `crystallize`) |
| `flock` | global velocity alignment |
| `spiral` | global tangential + slight inward bias |
| `turbulence` | global curl-noise `wind` |
| `pressure` | incompressible even-fill via mutual repulsion |
| `shatter` | one-shot explosive scatter, then reform to the prior formation |
| `magnetic` | follow field lines between charged bodies (global `fieldflow`) |
| `disk` | matter settles into a banded accretion ring around the dominant `blackhole` |
| `binary` | two orbiting cores share the field; matter trades between them |
| `nebula` | low-density, slow cohesion clouds — the pre-stellar resting state |

> **Many formations are just a primitive applied field-wide:** `lattice` = global
> `crystallize`, `turbulence` = global `wind`, `pressure` = global `pressure`,
> `flock` = global `align`, `magnetic` = `charge` field lines. A **formation is the
> *global* axis of a force**; a body is the *local* one — same math, different scope.

### 20.6 Render modes (same sim, different material)
The integrator is decoupled from the draw; these change the *look* without
touching the physics. Each is a swap of the particle draw pass in the renderer.
The render-mode catalog (authoritative in `packages/core/src/visual/visualization.ts`
`RENDER_MODES`, with per-mode shipped/planned status) **now ships a broad set** — the
six core particle-draw swaps plus the structure, scalar, graph, and debug/diagnostic
modes that drive `/docs/diagnostics`. The core `setRender()` API surfaces the six
particle-draw modes (`dots`, `trails`, `links`, `metaballs`, `voronoi`,
`streamlines`); the remaining shipped modes are render *layers* exposed through the
visualization/diagnostics surface (`field-lines`, `heatmap`, `force-vectors`,
`contours`, `potential`, `energy`, `topology`, `inspector`, `causality`,
`prediction`). `knockout`, `redshift`, and `blackbody` remain spec-only and are
marked **planned**.

> **The shipped `heatmap` render mode vs. the density-heatmap overlay.** The shipped
> `heatmap` render mode renders the density/`heat` grid as an attention contour
> (`status: 'shipped'` in the catalog). It is distinct from the **density-heatmap
> overlay layer** (the `heatmap` field option / `toggleHeatmap`, drawn as a glow
> underlay and sampled to bodies as `--field-heatmap-density`, §2 / field-systems H1).
> The overlay is a layer under the particle draw, not one of the six core draw-pass
> modes.

| Mode | How | Result | Status |
|---|---|---|---|
| `dots` | heat-tinted points (the default draw) | the baseline field | shipped |
| `metaballs` | threshold a summed density field (marching squares) | a liquid iso-surface, not dots | shipped |
| `trails` | persist a faded previous frame instead of clearing | long-exposure light-painting | shipped |
| `voronoi` | nearest-site cells over particle centers | shattered glass / cells | shipped |
| `links` | line between particles within `r` (particle↔particle threads) | constellation / neural-net | shipped |
| `streamlines` | trace the force field itself, not the particles | a diagnostic vector view | shipped |
| `field-lines` | trace the `field()` geometry every body radiates | the net structure field as lines | shipped |
| `heatmap` | render the density/`heat` grid as a contour | an attention contour map | shipped |
| `force-vectors` | draw the actual per-agent cause from `apply()` | a debug vector field of real forces | shipped |
| `contours` | equal-value isolines over a scalar field | topographic contour map | shipped |
| `potential` | shade the potential field | wells and gradients | shipped |
| `energy` | shade kinetic / potential / thermal energy | an energy map | shipped |
| `topology` | draw threads and flux links between bodies | the relationship graph | shipped |
| `inspector` | overlay bodies, agents, metrics, contracts | live diagnostic readout | shipped |
| `causality` | draw each agent's contribution sources | what is acting on what | shipped |
| `prediction` | draw a ghost trajectory ahead of each agent | predicted motion | shipped |
| `knockout` | clip particle draw to text via `destination-in` | the field visible only inside letters | planned |
| `redshift` | tint by velocity/proximity (Doppler + gravitational, §20.8) | relativistic accretion-disk look | planned |
| `blackbody` | tint by energy on a blackbody ramp (§20.8) | physically-warm temperature color | planned |

### 20.7 Force relationships (the "side" relationships)
Forces aren't a flat list — they relate by inversion, intensity, composition, and
lifecycle. Encoding these lets the system reason about a force ("what's the opposite
of this?", "what's the calm version?") and lets authors build big effects from
primitives.

**Dual / inverse pairs** (one undoes the other):
```
attract ↔ repel            blackhole ↔ whitehole         jet ↔ fountain   (recycle ↔ mint)
sink  ↔ spawn            (sink ↔ source)               viscosity    ↔ resonate   (remove ↔ add energy)
wall ↔ gate             (symmetric wall ↔ one-way)    charge(+) ↔ charge(−)
```

**Intensity ladders** (mild → extreme — same axis, more of it):
```
wander → stream → wind/shear            (drift → directed → turbulent)
attract → orbit → blackhole             (pull → bound orbit → event horizon)
repel  → whitehole                      (push → emission horizon)
sink → blackhole → supernova          (hold → trap → erupt)
```

**Composites** (a named force = primitives, fired together via `data-body`):
```
blackhole   = attract(steep) + swirl(frame-drag) + sink(horizon) + lens(bending)
whitehole   = repel(strong) + stream(eject)
wormhole    = attract + warp(throat A) ⟷ warp + repel(throat B), paired
pulsar      = gravity(spin) + resonate + spotlight(sweeping beam)
quasar/jet  = blackhole + jet(along the poles)
accretion disk = blackhole + tether(ISCO ring) + temperature gradient (§20.8)
comet       = spawn/jet(tail) + `trails` render mode
binary      = two gravity bodies, paired
```
These are formalized as the **preset layer** in §20.9 — only `warp` and `spawn` are
new atoms; the rest compose the canonical nine + `lens`.

**Lifecycle chains** (state machines over time / mass — a body becomes another):
```
star:      cloud(cohesion) → ignite(resonate) → supernova → remnant{ neutron-star=tether/pulsar | blackhole }
accretion: matter → blackhole grows (mass↑) → at cap → quasar jet (jet) | supernova
transit:   enter blackhole mouth → wormhole bridge → exit whitehole mouth
```

**Conservation class of each** (how it touches the budget — see §20.1):
```
conserved (move only):  all of §6, most of §20  ·  pass-through: wormhole (relocate)
source [S+]:  supernova(create), fountain        ·  sink [S−]: blackhole/whitehole w/ data-destroy
```
Rule: every [S+] needs a matching [S−], an `age` despawn, or a pool ceiling.

### 20.8 Color physics (an extended, physical color model)
The engine already maps radius → temperature and `heat` → accent blend (§ field.js
free-agent draw). Promote that into one coherent model so color *means* something —
energy, motion, charge, or pigment. `c` is the velocity cap / "speed of light" of
the unit system (§20.10), not a free knob.

**Temperature → blackbody.** Map a particle's energy to a blackbody ramp instead of
the current two-stop cool↔warm:
```
T = T₀ + (heat + ½|v|²)·ΔT
color = blackbody(T)          // deep-red → orange → white → blue-white as T rises
```

**Doppler + gravitational redshift.** Color by radial velocity (and proximity to a
horizon) — this is what gives an accretion disk its asymmetric look:
```
z_doppler = (v · û_view) / c                   // receding → red, approaching → blue
z_grav    = 1/√(1 − r_s/d) − 1                  // → red as d → r_s (near a blackhole)
hueShift  = k·(z_doppler + z_grav)
```
A rotating disk thus shows one limb blue (approaching) and one red (receding) —
relativistic beaming, for free, from the frame-drag term in `blackhole`.

**Charge → hue.** Signed particles read as a diverging scale (matches the proposed
`charge` colors): `q = +1 → #60a5fa`, `q = −1 → #f472b6`; domains color-sort as
matter demixes (§20.3 `charge`).

**Pigment (conserved color).** Per §20.3 `pigment`: bodies stamp `data-color` onto
particles; particles advect it and mix subtractively on contact; total "dye" is
conserved. The scroll **accent journey (§9)** becomes *literal pigment transport*
down the page rather than a global lerp.

**Force-identity tint.** A particle under force `X` tints toward `X`'s canonical hue
(§6 / §20.2), so you can *see which force is acting* on a region — the field
self-labels.

**Accretion-disk gradient.** Falls out of the above: hot inner edge (blue-white) →
cool outer (red) from temperature × radius, banded by the `tether`/ISCO ring. No
special-case code — just the color model applied near a `blackhole`.

### 20.9 Cosmology as composites — the preset layer

The cosmology forces are **named arrangements of primitives**, not new modules.
This keeps the registry small and means the dramatic effects fall out of forces
already specified.

**The one blocker, and the fix (shipped).** A body shares a single `strength`/`range`
across every token in its `data-body` (§3.1) — so `attract swirl sink` can't tune
the horizon (`sink`) independently of the well (`attract`). The fix — now built — is a
thin **preset layer** (`config/presets.ts` → `scanner.ts`) that expands one element into
several **co-located virtual bodies**, each a primitive with its *own* attrs, all bound to
the same rect. The force loop is unchanged — it already iterates `bodies × tokens` (§4);
the scanner just emits more bodies. Shipped presets: `blackhole`, `whitehole`, `star`,
`quasar`, `galaxy`, `nebula`, `tornado`, `fountain`.

```js
// authoring:  <a data-preset="blackhole"> …  (or data-preset="wormhole" data-pair="#b">)
window.__presets = {
  blackhole: [
    { body:'attract', strength:1.4, range:340 },          // the well
    { body:'swirl',  strength:1.0, range:300, spin:1 },   // frame-drag → accretion disk
    { body:'sink',  sink:42,    max:60,   strength:0 },// event horizon (capture)
    { body:'lens',    strength:0.5, range:380 },           // grazing-path bending
  ],
  whitehole: [
    { body:'repel',   strength:1.4, range:340 },           // emission horizon
    { body:'stream',  strength:0.6, range:300, angle:0 },  // optional directed eject
  ],
  wormhole: [                                              // mouth A; data-pair → mouth B
    { body:'attract', strength:0.9, range:300 },           // draw matter into the throat
    { body:'warp',    throat:40,   pair:'@pair', twist:0, scale:1 },  // relocate A→B (conserved)
  ],
  supernova: [                                             // one-shot; fire on trigger/saturation
    { body:'spawn',   create:120,  strength:5, range:320, oneshot:true, remnant:'tether' },
  ],
  fountain: [
    { body:'spawn',   rate:3,      strength:4, angle:-90, spread:0.5, life:240 },
  ],
};
// scanBodies(): an element with data-preset pushes one virtual body per entry,
// sharing cx/cy/hw/hh, each carrying its own strength/range/spin/angle/etc.
```

**The two irreducible atoms** (everything else is the canonical nine + `lens`):

- **`warp` [A · paired]** — the wormhole's relocation core (the formula under
  *Wormhole* in §20.3). Conserved: it only moves a particle from throat A to its
  `pair` throat B, carrying momentum (optionally twisted/scaled).
- **`spawn` [S]** — particle creation (the *Fountain*/*Supernova* logic in §20.3).
  `rate` ⇒ continuous (fountain); `oneshot:true` + `create:N` ⇒ a single burst that
  also shoves neighbors and can swap the element's preset to its `remnant`
  (`tether` = neutron star, `blackhole` = collapse). Class [S] — budget it (§20.1).

**Composite map** (what each preset *is*):

| Preset | Atoms / tokens | New code |
|---|---|---|
| `blackhole` | `attract` + `swirl` + `sink` + `lens` | none |
| `whitehole` | `repel` + `stream` | none |
| `wormhole` | `attract` + **`warp`** (×2 mouths, paired) | `warp` |
| `supernova` | **`spawn`** (one-shot) + remnant swap | `spawn` |
| `fountain` | **`spawn`** (continuous) | `spawn` |
| *pulsar* | `gravity`(spin) + `resonate` + `spotlight` | none |
| *quasar* | `blackhole` + `jet` (poles) | none |
| *comet* | `spawn`/`jet` + `trails` render | none |

So the entire cosmology family — plus pulsar/quasar/comet — costs **two new atoms
and a preset table.** Two approximations remain at this layer — `attract`'s bounded
well stands in for a true `1/d²`, and the relativistic terms are scaled by a fudged
`c` — **both fixed in §20.10** by swapping in the natural `gravity` primitive and a
consistent unit system. Use the designed-force version for cheap UI surfaces, the
physical version (§20.10) where fidelity matters.

> This is also the recommended pattern for the discipline cards (§15): keep the
> **canonical nine + a short atom set** as the real registry, and express richer
> bodies (cosmology and beyond) as **presets** over them — so the vocabulary can
> grow without the engine growing.

### 20.10 Physical primitives & the unit system (fixing the caveats)

§20.9 left two honest approximations. Both come from the same root: the canonical
forces are **designed** (bounded falloff, predictable reach, tuned constants — good
for UI) where the cosmology wants **natural** primitives (true field laws in a
consistent unit system). Keeping both, and labeling which is which, fixes it.

> **Designed vs. natural.** `attract`/`repel`/`tether` are *designed* — finite range,
> soft `(1 − d/d_max)ⁿ` falloff, chosen for legibility on content bodies. The
> primitives below are *natural* — real laws (`1/d²`, Lorentz, Langevin) for the
> field/experience surfaces. A composite picks the register it needs: a hero word
> uses designed `attract`; a `blackhole` uses natural `gravity`.

#### The unit system (so relativity is derived, not fudged)
Pick a small, self-consistent set of sim-natural units; every relativistic term
then *follows* instead of being scaled by a magic `c`:
```
length  L = 1 px
time    τ = 1 frame (1/60 s)
speed   c = v_max            ← the hard velocity cap IS the speed of light in-sim
mass    M = source scalar    (strength·k_g, or captured particle count)
G       chosen so r_s = 2GM/c² lands at the wanted horizon (≈40 px for a "stellar" M)
```
Derived, no hand-waving:
```
r_s (horizon) = 2GM/c²        θ_lens = 2GM/(c²·d) = r_s/d        ISCO = 3·r_s
z_grav = (1 − r_s/d)^(−½) − 1        z_doppler = (v·û_view)/c
```
The old `c = 6` becomes the real `v_max` (shipped as `c = 12`). Caveat 2 gone: lensing and redshift are
consequences of `{G, M, c}`, internally consistent.

> **As-built (v0.3).** The integrator applies the `|v| ≤ c` clamp to *every* free
> particle each step, so the cap is universal — no canonical force or composite can
> drive a runaway, not just the natural primitives. A conformance **safety sweep**
> runs every experiment and asserts the whole trajectory stays finite (no NaN/Infinity),
> bounded in heat, capped in speed, and conserved in count unless a budgeted [S] source
> is active. See [`docs/physics-workover.md`](physics-workover.md).

#### `gravity` — true softened inverse-square `[A]` (fixes caveat 1)
Plummer softening keeps it finite at the core while staying a real `1/d²` law far
out — exactly how N-body sims do it:
```
F = G·M · d̂ / (d² + ε²)            ε = softening ≈ r_s        // 1/d² far, finite at center
v += F·τ ;   clamp |v| ≤ c
```
Replaces `attract` inside physical composites; `attract` stays the designed UI well.

#### The fundamental-force basis (what nature actually has)
Four forces; map each to a primitive, add the two that are missing:

| Nature | Primitive | Status | Law |
|---|---|---|---|
| Gravity | `gravity` | **add** | `F = GM·d̂/(d²+ε²)` — always attractive, mass-sourced |
| Electrostatic | `charge` | have (§20.3) | `F = σq·d̂/d²` — signed (same kernel as gravity) |
| Magnetic (Lorentz) | `magnetism` | **add** | `F = q(v × B)` — acts on *moving* charge, ⟂ to v |
| Strong (hard core + bind) | `cohesion` | have (§20.3) | repel `< r₀`, attract `r₀…r₁` — molecular/nuclear shape |
| Weak (decay/transmute) | `decay` | **add** | spontaneous transform after a lifetime |

`gravity` and `charge` share one `1/d²` kernel — one source scalar (mass ≥ 0 or
charge ±) selects which. That's the real unification worth coding once.

> **As-built — charge induction (v0.3).** The `charge`/`magnetism` *force* acts only on
> charged matter (`q = 0 → no force`); that contract is golden-tested. But the live field
> starts every particle neutral, so the force alone would never move anything. The field
> therefore **polarizes** matter that enters a charge/magnetism body's range — a neutral
> particle picks up a sign by which side of the body it sits on (a two-domain +/- split),
> induced once so matter carries its sign. Induction is a field-level pass
> (`reservoir.ts induceCharges`), deliberately *outside* the integrator the conformance
> suite drives — so "the force ignores neutral matter" stays exactly true in the math,
> while the live field has charged matter for it to push.

#### Effective / continuum primitives (faithful media)
The medium itself needs a few atoms the prototype only faked:

**`magnetism` `[A+E]`** — Lorentz force (2D: `B` is a scalar out of plane):
```
F = q·B·(−v_y, v_x) ;   v += F·τ          // cyclotron radius r_L = m|v|/(qB)
```
Magnetic confinement, field lines, aurora. Shares particle `q` with `charge`.

**`thermal` `[A]`** — Langevin/Brownian agitation (the honest `wander`):
```
v += √(2·k_B·T·γ) · ξ      ξ ~ N(0,1) per axis
```
Paired with `viscosity` (`−γv`) it's a **thermostat** — fluctuation–dissipation, the
swarm equilibrates at temperature `T`. The current friction + random `wander`
already *approximate* this; naming it makes the medium physically real and lets `T`
be sourced (heat, scroll energy).

**`propagate` `[C]`** — finite-speed propagation on a scalar field `φ` (a *traveling*
disturbance — distinct from the **Currents** of §24, which are standing carrier
waveforms):
```
∂²φ/∂t² = c²·∇²φ           // travels at c, reflects, interferes
a disturbance injects φ → a real expanding shock; particles ride ∇φ
```
Grounds `c`, and makes the supernova shock and the (disabled) ripples *physical*,
with interference for free.

**`collide` `[B]`** — elastic pairwise collision (granular / billiard):
```
close pair (d < r_a+r_b): exchange normal momentum,  v·n ← −e·(v·n)   // e = restitution
```
Momentum- and (for `e=1`) energy-conserving — the hard-sphere complement to the
smooth `pressure` and the wall-bound `wall`.

**`diffuse` `[C]`** — scalar diffusion (generalizes the pheromone blur):
```
∂φ/∂t = D·∇²φ              // heat / concentration / pigment spreads down its gradient
```

#### Transmutation primitives (matter changes form)
`spawn` (create) and `sink` (capture) already exist; nature also merges and splits:

**`fuse` `[B]`** — merge on energetic contact (`2 → 1`, conserved mass + momentum):
```
if d < r_fuse and |v_rel| > v_ignite:
   m = m_a + m_b ;  p = p_a + p_b ;  heat += ΔE_bind ;  remove one     // fusion → energy
```
**`fission` `[S]`** — split on overheat/impact (`1 → 2+`, mass conserved, +KE).
**`decay` `[E+S]`** — transform/emit after a sampled lifetime (the weak force):
```
age += τ ;  if age > −τ_half·ln(rand):  spawn daughter / change species / emit
```

#### The faithful composites (caveats fixed)
With the above, the cosmology presets stop approximating:
```
blackhole = gravity(GM, ε=r_s) + swirl(frame-drag) + sink(r_s) + lens(derived)
            → r_s, θ_lens = r_s/d, redshift all derive from {G, M, c} — no fudge
supernova = fuse(core ignites) → spawn(ejecta) + propagate(real shock) + remnant
star      = gravity(collapse)  ⇄  thermal(pressure)        ← hydrostatic equilibrium
            + fuse(fusion burn) → … → supernova
```
The star is now *literally* gravity balanced by thermal pressure with fusion in the
core — every term a primitive, nothing hand-waved. That equilibrium (`gravity ⇄
thermal`) is the same fluctuation–dissipation balance that keeps the resting field
calm, scaled up.

#### Net additions
Eight physical atoms — `gravity`, `magnetism`, `thermal`, `propagate`, `collide`,
`diffuse`, `fuse`/`fission`, `decay` — plus a unit-system constant set `{c, G}`.
With these the registry is a genuine **physical basis**: every named force and
composite (designed or cosmological) reduces to it, faithfully.

---

### 20.11 Boundaries — the boundary-type table (workover v0.3)

Boundary is a **concept category, not a single force** (physics-workover §"Boundaries
and interfaces"). Several distinct mechanisms shape edges, membranes, cones, horizons,
and shields; this table is the authority for what each one is, its truth mode, and its
honest shipped status (verified against the code, not the plan).

| Boundary type | Mechanism | Behavior | Truth mode | Status |
|---|---|---|---|---|
| **Wall** | `wall` (§6.4) | elastic bounce off the element box; sparks on hard impact | designed | ✅ shipped (canonical) |
| **Membrane** | `gate` (§20.3) | one-way: passes matter along its heading, reflects the reverse crosser | designed | ✅ shipped (extended) |
| **Cone** | `spotlight` (§20.3) | gates its sibling forces to an angular cone of the heading | designed | ✅ shipped (modifier) |
| **Optical** | `lens` (§20.3) | rotates velocity, preserving speed — bends paths without adding energy | designed | ✅ shipped (extended) |
| **Shear layer** | `shear` (§20.3) | laminar velocity gradient — laminae slide past each other at the edge | designed | ✅ shipped (extended) |
| **Event horizon** | `sink` (§6.9) · `blackhole` preset (§20.9) | capture within `data-absorb`; held (conserved) until the supernova release | designed (sink) · poetic (preset) | ✅ shipped |
| **Shield** | `screen` (§20.3, workover v0.3) | damps OTHER bodies' forces inside its radius — quiet zones, text shielding | designed | ✅ shipped (this workover); `data-screen-mode` inside/outside/behind is planned |
| **Portal** | `warp` (§22.3) + `data-pair` | conserved relocation between paired throats (matter and `data-warp` elements) | designed | ✅ shipped; the `wormhole` preset composes it |
| **World edge** | toroidal wrap (integrator §2.2) | matter leaving one edge re-enters the opposite one; count conserved | designed (substrate) | ✅ shipped |
| **Content** | the DOM rect (`measureBodies`, `data-shaped`) | the element box itself is the boundary: walls/gates size to it; shaped sources shell it | designed (substrate) | ✅ shipped |
| **Shape** | `morph` target geometry (§20.3 [D]) | matter assembles onto a sampled mark/chart/logo — never words (§11) | designed | ✅ shipped |
| **View** | off-screen visibility (`b.vis`, §2.1) | an off-screen body exerts no force — the viewport is a soft boundary of influence | designed (substrate) | ✅ shipped |

Nothing in this table is a new engine: every boundary is either one of the registered
tokens above or an engine substrate rule. The honest gaps: `screen` ships only its
`local` mode; a *reflective* world edge (walls at the viewport instead of the wrap) and
a membrane with per-species selectivity are unbuilt ideas, not shipped behavior.

## 21. Mass & momentum — audit and first-class proposal

### 21.1 What's actually conserved (the audit)
The headline law is *particle-count* conservation, not Newtonian conservation. As
built:

| Quantity | Status | Why |
|---|---|---|
| **Count** (particles) | ✅ respected | the §2.4 law — captured/released/detached/reclaimed, never spawned or deleted (except deliberate class [S], which self-budgets via lifespan + pool ceiling). |
| **Mass** (inertial `m`) | ✅ opt-in | particles carry `m` (default 1 = unit mass). With `FieldOptions.mass`, `m ∝ size` and body forces accelerate by `a = F/m` (§21.3). |
| **Momentum** (`p = m·v`) | ◐ partial | `collide` now conserves it pairwise (equal & opposite impulses); `wall`/`collide` push back on a `data-body` element (recoil, §23.5). The ambient field is still driven/damped by design — friction bleeds `p` every frame. |
| **Energy** | ❌ not respected | friction + `heat` decay; it's a *driven, damped* field on purpose. |

This is the right feel for a calm UI backdrop. The honest split below **shipped**:

- **Option A — unit mass (default).** The ambient UI field stays unit-mass and damped:
  cheap, calm, and `collide`/`fuse` read as equal-mass.
- **Option B — first-class mass (opt-in).** `FieldOptions.mass` turns on real `m` and
  `a = F/m`, so the cosmology/Lab lifecycle (accretion → fusion → supernova) conserves
  mass. Both ship; the surface picks.

### 21.2 The `mass` rename (resolving the overload)
"Mass" names two unrelated things today. Split them:

| Concept | New name | Was | Meaning |
|---|---|---|---|
| particle inertial mass | **`m`** | *(absent)* | resistance to acceleration; `∝ baseSize²` or seeded |
| body source mass | **`M`** | `strength·k_g` | sources `gravity`/`charge`; for a UI body, `M = strength·k` |
| accretion load | **`b.accreted`** | `b.mass` | running total a sink has captured |
| accretion capacity | **`capacity`** | `maxMass` | the load at which a sink supernovas |
| CSS inflation var | **`--load`** | `--mass` | `accreted / capacity` ∈ [0,1] (author-facing; alias `--mass` for back-compat) |

After the rename, **`m`/`M` always mean mass**; `b.accreted`/`capacity`/`--load` are
the accretion bookkeeping. (§6.9, §13, §20.3's blackhole all reference the old names —
update them with the rename.)

### 21.3 First-class mass (Option B spec)
1. **Carry it.** Particle gains `m` (default `∝ baseSize²`; `data-mass` to seed).
2. **Integrate Newton.** `a = F/m ; v += a·τ ; v *= f`. Heavier particles now resist
   forces and swing wider — the manual's claim becomes *true*.
3. **Momentum `p = m·v`, exchanged reciprocally** where it matters:
   - `collide` — exchange normal momentum by mass (unequal masses → real billiard).
   - `fuse` — `m = m_a+m_b`, `p = p_a+p_b` (conserve both; energy → `heat`).
   - `warp`/`wormhole` — carry `m` and `p` through the throat.
   - `sink` — `b.accreted += p.m`; `supernova` releases exactly that mass back
     (and, if faithful, recoils the remnant by `−Σp`).
4. **Accretion in mass units.** supernova fires at `b.accreted ≥ capacity`;
   `--load = accreted/capacity`.
5. **Sourcing.** `gravity`/`charge` act from body `M` on particle `m`.

> **The subtle, correct part:** by the equivalence principle, `gravity`'s
> *acceleration* is mass-independent (`a = G·M·d̂/(d²+ε²)` — the particle's `m`
> cancels), so adding `m` **does not change how gravity looks.** It changes
> `collide`, `fuse`, `buoyancy`, and `magnetism` (cyclotron `r_L = m|v|/(qB)`), and it
> makes momentum exchange real. That's the test of whether we're respecting mass
> *thoughtfully* rather than sprinkling an unused field — mass should show up exactly
> where inertia and momentum-trading live, and nowhere it shouldn't.

### 21.4 Recommendation
Run **unit mass (A)** on content/UI surfaces (cheap, and gravity-feel is identical
anyway) and **first-class mass (B)** on the Lab and cosmology surfaces, where
collisions, fusion, and accretion should actually conserve mass and momentum. Either
way, **fix the prose now**: §2.2 no longer claims size-mass affects motion, and this
section is the single source of truth for what "mass" means.

---

## 22. Force targets — particles, elements & events

A core promise of the system is that forces act on **everything the page is made
of**, not just the particle field. The four body roles (§22.1) are wired, and every
influence kind is now realized for particles and (opt-in by attribute) for elements:
impulse/constraint/feedback, plus capture (`data-dock`), relocate (`data-warp`, the
`warp` atom), and emit (`data-emit`). The one still-planned cell is the element
`trigger` class-toggle. The canonical, status-annotated account is
[agent-consumption-model.md](../canonical/agent-consumption-model.md);
this section is the engine-level record.

### 22.1 What's maintained (and what isn't)
| A DOM element can be a… | Status | Where |
|---|---|---|
| **Source** — emits forces onto particles | ✅ as-built | §3.1, §6 |
| **Density receiver** — gathered field → CSS (`--d`/`--load`) → styling | ✅ as-built | §8 |
| **Force target** — forces *move* the element itself | ✅ as-built | `data-move` (§22.4); self-laying-out (Concept 3) |
| **Event host** — the field fires app behavior off it | ✅ as-built | `data-on` (§22.5); cross-boundary `field:lit` |

All four are now wired: an element **sources** force, **receives density**, is **moved**
by the field (a `data-move` element agent — anchor tether + field force, with optional
mutual repulsion + density pressure for self-laying-out layout), and the field **signals
through it** (a saturated body fires `field:lit`/`field:dim`; `data-on` binds field state
to DOM events). One model — agents and consumers (§22.2).

### 22.2 The unified model: agents & consumers
Generalize "particle" to **agent** — anything a force can act on. A force produces
an **influence at a location**; each agent type owns a **consumer** that decides how
to apply it. Forces stay target-agnostic; agents differ only in how they consume.

| Agent | position | inertia | "capture" means | consumes force as |
|---|---|---|---|---|
| **Particle** | `x,y` | `m` (§21) | held in a sink core | velocity impulse + heat |
| **Element** (DOM) | rect center | `m_el` (∝ area or `data-mass`) | docked / collapsed | a transform offset, CSS var, or class |
| **Event sink** | its host body | — | — | a dispatched signal on threshold crossing |

The point: **particles are just the lightest agents.** An element is a *heavy* body
with a DOM consumer; an event sink is a *write-only* agent. One DOM body can be all
three at once — sourcing force, being pushed by neighbors, and firing events.

### 22.3 Influence kinds → how each agent consumes them
Every force emits one of a few influence kinds. The matrix is the spec; each cell
carries its own status (✅ shipped · 🔭 planned). Verify against
[agent-consumption-model.md](../canonical/agent-consumption-model.md).

| Influence (from force) | Particle | Element | Event sink |
|---|---|---|---|
| **impulse** `Δv` (attract, repel, wind, stream…) | ✅ `v += F/m` | ✅ `o_v += F/m_el` → `translate(o)` (`data-move`) | — |
| **constraint** (tether, wall, gate) | ✅ clamp pos/vel | ✅ anchor tether + offset clamp (`maxOffset`) | — |
| **capture** (sink) | ✅ `cap = b` (held, then released) | ✅ dock/collapse the element (`data-dock`) | ✅ fire `field:captured` / `field:released` |
| **relocate** (warp) | ✅ `warp` throat → paired body (conserved) | ✅ teleport offset to the pair (`data-warp`) | — |
| **emit** (spawn) | ✅ new particle | ✅ clone a decorative template (`data-emit`) | — |
| **trigger** (threshold) | ✅ (sets heat) | 🔭 toggle a class (no built-in; use a `data-on` handler) | ✅ **dispatch a `CustomEvent`** (`data-on`) |

"Apply a force to a DOM element" = it consumes the *same* impulse a particle would,
but as a **transform** (with element mass `m_el`) instead of raw velocity. "Apply a
force to an event" = the influence, on crossing a threshold, becomes a **signal**.

### 22.4 Elements as targets — the self-moving layout
Each targetable element carries an anchor `a` (its CSS layout slot), a live offset
`o`, and mass `m_el`. Forces sum to `F`; integrate and write a transform:
```
o_v += F/m_el · τ ;   o_v *= f ;   o += o_v       // a tether to a → equilibrium at o = 0
element.style.transform = `translate(${o.x}px, ${o.y}px)`
```
Now `blackhole`/`gravity` pulls cards in, `repel` spaces them, `wall` elements
collide, `stream` drifts them. **Heavier (or `data-mass`-flagged) UI resists** — the
inertia of importance. Pipe 1 (§2.1) re-reads the moved rect each frame, so the field
stays locked to where the element actually is. (Rationale & forces: possibilities
"DOM ⇄ Canvas" Concept 3.)

### 22.5 Events as targets — the field drives behavior
A force targeting an **event sink** turns physics into app logic — the write side of
field → DOM *beyond* styling. Declare bindings on a body:
```html
<article data-body="sink attract"
         data-on="captured:field:dock, dense:field:lit, spotlight:field:seen">…</article>
```
On the influence/condition firing, dispatch a debounced `CustomEvent` carrying
`{ body, influence, value }`. Examples: `sink` an element → `field:dock` (app
collapses it into a tray); density `> θ` → `field:lit` (highlight); `spotlight`
sweeps over → `field:seen` (lazy-load / analytics); `supernova` → `field:erupt`
(fire a transition). The field can now move **state**, not just pixels.

### 22.6 The contract generalization
Extend §4 from particle-only to agent-polymorphic, back-compatibly:
```js
window.__forces[token] = {
  token, label,
  apply(b, target, env),       // target.kind ∈ 'particle' | 'element' | 'event'
  meta: { targets: ['particle', 'element', 'event'] }   // which tiers it supports
}
```
A force untouched from today implicitly declares `targets: ['particle']` and runs
exactly as before. The engine routes each force only to the agent tiers it lists, and
the **agent's consumer** (§22.3) does the tier-specific application — so most forces
need *no* per-tier code; only structural ones (`wall`/`sink`/`warp`/`spawn`)
implement tier semantics.

### 22.7 Conservation across tiers
Cross-tier interaction is where this gets honest (tie-in to §21):
- **Momentum can cross tiers.** A particle striking a card imparts impulse to the
  card (`o_v += p_particle/m_el`) and recoils — real particle↔DOM momentum exchange.
- **Capture is conserved at the element level.** Absorbing an element **docks** it
  (held, removed from flow), and supernova **restores** it — the §2.4 law, lifted to
  the DOM: docked ≠ destroyed.
- **Count is *not* shared** across tiers — moving elements doesn't change particle
  count. Conservation applies *within* a tier; momentum is the bridge *between* them.

> **Net:** "everything is a body" completed. Forces are defined once and act on
> particles, DOM elements, and events alike; agents differ only in how they consume
> an influence. This is the structural reason the field reads as one medium the whole
> interface lives inside — not a backdrop the interface sits on top of.

### 22.8 Engine-stepped agents — `FieldHandle.addAgent`
The §22.2 table gives a heavy element a DOM consumer (`data-move`). A non-DOM host (a
Three.js scene, a `<canvas>` widget) needs the same thing for a *renderer-owned object*:
a participant the engine **moves**, reporting its state back to drive an external
transform. `addAgent({ x, y, z?, mass?, maxSpeed?, species?, report })` is that consumer.
An agent is **a particle with a report hook** — it lives in the pool, so it feels every
force the swarm feels: not only body forces but the **particle-level** ones (`hunt`,
`align`, `cohesion`, `diffuse`) that act *between* particles. That is the lever: those
forces only act on the field's own matter, so a creature unlocks them only by *being*
field matter. Each step the integrator calls `report(p)` with the live particle; `maxSpeed`
clamps it; it **edge-bounces** rather than toroidally wrapping (a creature stays in the
world), skips ambient formation wander (force/steer-driven), and is **excluded from
`readParticles`** (it draws as its own object, not a swarm dot). Distinct from the
self-integrating `FieldAgent` sampler in `@fundamental-engine/three`, where the *caller*
integrates: with `addAgent` the **engine owns the motion**. The conserved swarm is
bit-for-bit unchanged — every agent branch is gated on the report hook's presence.

### 22.9 Matter tagging — selective forces across one field
A body may declare a **species set it acts on** (`data-affects`, e.g. `"1"` or `"1,2"`);
matter whose `species` is outside the set is skipped entirely (no impulse, no density
sample). Omit `data-affects` and the body acts on all matter — the back-compatible
default, bit-for-bit. A `spawn` source stamps its emitted matter with `data-species`, and
seeded particles / agents carry an explicit `species`. So **several ecologies coexist in
one field** — pollen, seeds, spores — each pulled only by its own attractors and sinks,
without separate engine instances. (Generalizes the `hunt` force's two-species tag, §20.3,
to a filter every force honors.)

### 22.10 Sampling the density scalar — `FieldHandle.sampleScalar`
`sample(x,y)` returns the force *vector*; `sampleScalar(x,y)` returns the smooth **density
scalar** ∈ [0,1] — the heatmap grid (§H1), bilinear-sampled. Because the grid is diffused,
its gradient stays meaningful *at* a source, where a nearest-body readout flattens to zero —
the property forage-by-gradient needs. Requires the heatmap layer (`createField({ heatmap:
true })`); read-only, updated each frame including under `render: 'none'`.

`sampleGradient(x,y)` returns that gradient directly — the `{x,y}` **direction and steepness**
(in 1/px) of *increasing* density — instead of leaving callers to finite-difference `sampleScalar`
(which, sampled too close in, re-introduces the very flattening it exists to avoid). It is the
analytic companion off the same diffused grid (central difference, normalized by the eased peak),
non-degenerate at a source; add it to a heading to climb toward matter, negate it to flee crowding.
Requires the heatmap layer; returns `{ x: 0, y: 0 }` when off or empty. Mirrored on
vanilla / elements / three.

### 22.11 Programmatic bodies — `FieldHandle.addBody`
A source body need not be a DOM element. `addBody(spec)` registers an **engine body with no
DOM element** — the same agent a scanned `[data-body]` becomes (§3.1, §22.1), but positioned
by a `rect()` sampler the host owns rather than a measured DOM rect. It is the source-side
counterpart of the renderer-owned `addAgent` target (§22.8): `addAgent` is a particle the
engine *moves*; `addBody` is a body that *emits* force. The returned `BodyHandle` carries the
body's `data`, its live feedback `channels`, a `set(params)` for reactive force changes, and
`remove()`. The signature and field-API placement are §13.8 — referenced here, not duplicated.

### 22.12 Programmatic edges — `FieldHandle.addEdge`
Relationships are likewise expressible without DOM. `addEdge(a, b, opts)` relates two
programmatic bodies (the `BodyHandle`s from `addBody`) into the same relationship graph the
DOM relationship registry feeds — coupling that strengthens while the source is salient and
decays while idle, with slow-moving `memory`. The returned `EdgeHandle` mutates (`set`) or
drops (`remove`) the edge; `readEdges()` reads the live graph (`EdgeView`) back for a
non-visual consumer. See §13.8 for the full signature.

---

## 23. Micro-reactions — energy transfer made visible

The system's *feel* lives in the **moment of interaction**, not the steady state: a
particle strikes a wall and **sparks**; a click shoves and heats; a core captures and
the matter dims. These tiny, fast, legible reactions are what separate a living field
from a screensaver. The prototype's `wall` spark (§6.4) is the exemplar — and it's
worth making the *principle*, not a one-off.

### 23.1 The principle (and how it reconciles §21)
> **Energy isn't lost — it's spent on spectacle.** Whenever a force removes energy
> from an agent (a bounce's restitution, viscosity's bleed, a capture, a collision), that
> energy is **accounted for as a proportional micro-reaction**.

§21 noted the field is *damped by design* — energy isn't conserved in motion. §23 is
where that removed energy **goes**: at every interaction, the dissipated `ΔE` is
rendered as a reaction whose intensity scales with it. So the damping that keeps the
field calm is the same budget that funds the sparks — honest, and it *sings*.

### 23.2 The reaction budget (one formula)
At any interaction, measure the energy removed and emit a reaction scaled to it:
```
ΔE = ½·m·(|v_before|² − |v_after|²)          // energy this interaction took out
I  = clamp(k · ΔE, 0, I_max)                  // reaction intensity
```
`I` drives spark count, flash magnitude, flash radius, recoil, (optional) sound. A
glancing touch barely flickers; a hard hit erupts. **The budget kit shipped** in
`core/reactions.ts`: `energyDelta` (ΔE), `reactionIntensity` (I), `sparkCount`, and
`recoilImpulse` (the element-recoil side, §23.5). `wall` ships the canonical slice
(spark when `speed > 0.7`, `heat = min(0.85, speed·0.4)`); §23 generalizes it across
dissipative interactions.

### 23.3 Catalog — where energy transfers, and the reaction it should shed
| Interaction | Energy event | Reaction | Status |
|---|---|---|---|
| **Wall impact** | KE lost to restitution `(1−e²)` | sparks + heat flash `∝ speed` | ✅ as-built |
| **Collide** (particle↔particle) | KE lost when `e < 1` | contact spark at the midpoint `∝ \|v_rel\|` | proposed |
| **Viscosity** | KE bled continuously | faint heat shimmer in the zone `∝ ΔKE` (drag *warms* the medium — real) | proposed |
| **Sink capture** | KE swallowed, matter held | inward flash + a core intake-pulse | proposed |
| **Supernova / spawn** | binding/PE → KE released | radial ejecta + `heat = 1` | ✅ as-built |
| **Detach** (bound→free) | binding broken | the carried velocity + a tiny snap-flash | ✅ / proposed |
| **Wave-heal snap** | particle rejoins a line | a soft settle-glow as it docks | proposed |
| **Engage / hover** | a force switches on | lit state + accent shift (ripple, currently off) | ✅ / proposed |
| **Gate block** | wrong-way crosser rejected | edge flicker at the boundary | proposed |
| **Fuse** | binding energy released | a bright ignition flash + heat | proposed |
| **Element pushed** (§22) | impulse into a DOM body | a recoil shudder + edge glow on the card | ✅ as-built (`recoilImpulse`, §23.5) |

### 23.4 Reaction primitives (the kit of "juice")
A small shared vocabulary the catalog draws from — keep them as renderable atoms:
- **spark** — N fast-fading debris (exists; cap 260, §11).
- **flash / bloom** — a brief heat/alpha spike on the agent (exists via `heat`).
- **recoil** — the equal-and-opposite impulse on the *other* agent (§21 momentum) —
  **currently missing**: `wall` sparks the particle but never shudders the wall.
- **ripple** — a one-frame expanding ring (was disabled for cost; cheap to revive
  scoped to a single interaction).
- **pulse** — the body scales/glows briefly (sink intake, capture).
- **trail** — a short motion-blur on fast agents (§20.6 render mode).
- **chromatic shed** — the released energy tints toward the *acting force's* color
  (§20.8 identity tint), so you can **see which force did it**.
- **tick** *(optional audio)* — a click whose pitch ∝ `ΔE`; the field becomes audible.

### 23.5 Two-sidedness — the deepest version
A *true* energy transfer has **two sides**. Today `wall` only reacts on the
particle; first-class reactions make **both** agents respond, split by mass (§21):
the particle sparks **and** the wall shudders a hair, `Δv_wall = −Δp/m_el`. "Every
action has an equal and opposite reaction" is exactly what makes a transfer read as a
*transfer* and not a one-way erasure. Across tiers (§22) this is how a particle
striking a DOM card visibly nudges the card.

### 23.6 Design law
**Make the transfer legible; keep the steady state quiet.** A force at rest is
near-silent; the *change* — entering a well, crossing a wall, being captured,
releasing, igniting — is where the reaction fires. Same rule as motion design's
"animate the transition, not the state," and the reason `agitate` (discrete) punches
harder than a steady force: **the reaction marks the event, not the condition.** This
is the layer that makes the whole field sing.

---

## 24. Currents — the carrier waves

The most *visible* structure in the field (the layered lines in the hero/manual) is
not decoration and not a force. It carries bound particles along it, imparts a flow on
the free ones, and **bends and retunes in response to the page**. This section names
it, places it in the system, and fixes its color.

### 24.1 Name
Canonically **Currents** — each line a *current*; *rendered as* waves (they have
amplitude and frequency, which is what the page can change). They are the substrate's
**resting structure** — the field's ground state, the thing forces act *within*.

> **Naming:** "wave" now has one meaning at the token level — the propagation
> primitive is `propagate` (§20.10). A **Current** is a standing carrier waveform, not
> a traveling disturbance. ("Waves" stays fine as the casual/brand word for the
> rendered Currents.)

Engine facts (`field.js`): 5 layers at depth fractions `[0.24, 0.40, 0.55, 0.70,
0.85]`, amplitude `22 + i·15`, frequency `0.0012 + i·0.0008`, alternating direction,
scroll parallax `offsetY = scrollY·(0.025 + depth·0.08)`, a boot growth sweep.

Supports two styles:
- **`linear`**: Parallel horizontal carrier lines.
- **`circular`**: Concentric closed loop orbits circling the `waveCenter` (e.g. `<field-root wave-style="circular">`).

The orbits' center is dynamically resolved per frame:
1. **Dynamic body tracking**: If a body carrying the `"star"` or `"vortex"` token exists in the field, its coordinates are used.
2. **Custom coordinate**: A custom `{ x, y }` position or closure coordinate-provider.
3. **Viewport center**: Defaults to the exact center of the field workspace.

### 24.2 Four roles (why they're first-class)
1. **Current — a flow source.** Near a line, free particles pick up drift along the
   slope (§2.3). In circular mode, they receive centripetal pull and tangential acceleration, carrying them in stable, perpetual orbits.
2. **Reservoir — the conservation buffer.** Currents hold **bound** particles and
   exchange them with the **free** pool — detach on disturbance, wave-heal on calm
   (§2.4). They are where count-conservation is bookkept: the field's *bank*.
3. **Agent / target (§22).** Currents bend toward engaged elements and shift their
   amplitude & frequency in response to the page — **DOM → Current**. They are a
   **line-shaped agent**: they consume influence (bend, retune) and emit it (carry,
   push). This extends "everything is a body" from points and boxes to **lines**.
4. **Carrier.** The lit shimmer riding a Current is the visible matter; Currents are
   how matter travels *coherently* instead of just drifting.

### 24.3 Where they sit in the taxonomy
- **Substrate, not a force** (§2) — medium structure, the ground state.
- **Reciprocal, like type (§8).** Density→type is one reciprocity channel; **page →
  Current shape** (bend/amplitude/frequency) is another. A Current is to the field what
  a `liveword` is to type — a body that both acts and is acted upon.
- **Kin to `lanes`/`stream`/`shear`.** A Current is a persistent, curved streamline;
  the `lanes` formation is its free-particle echo.
- **A micro-reaction site (§23).** Detach = a *snap* (energy to tear matter loose);
  heal = a *settle-glow*. The bound↔free boundary is dense with small reactions.

### 24.4 Color alignment (one palette · cool baseline · travels with the accent)
Today `field.js` hardcodes `waveColors = ['#4da3ff', '#2dd4bf', '#a78bfa']` — a
*subset* of the force palette (attract/swirl/jet). Formalize that into a rule:

1. **One source of truth.** Currents draw from the canonical force palette
   (`DS_FORCES`), never a separate constant — derive `waveColors` from it.
2. **Currents are the cool, resting baseline of the temperature model (§20.8).** The
   medium at rest is cool (blue→teal→violet); **heat and forces warm it locally**
   toward accent. Currents = ground state; energy = warmth. (This already matches the
   engine's cool-center → warm-edge particle ramp.)
3. **Travel with the accent journey (§9).** As scroll moves the accent through the
   palette, Currents retint with it — **the section you're in colors the medium.** The
   engine already pushes `setAccent`; Currents should follow it.
4. **Depth = palette spread.** Map the 5 layers across a *slice* of the palette
   (current accent ± neighbors) so depth reads as a gradient, not three repeating hues.
5. **Pigment (§20.8), when real.** Currents carry bound matter; dyed particles
   **stain** the Current they ride — sections literally tint the lines they pass.

> **Net:** Currents never own a separate color system. They are the **cool floor** of
> the single field palette — traveling with the accent and warming wherever a force
> injects energy. Same palette as everything else, just at rest.

### 24.5 Orbits and Stability
A common misconception is trying to produce stable particle orbits using a combination of point forces (e.g. `["attract", "swirl"]`). In practice, the engine's built-in particle friction (defaulting to a decay of 0.95 per frame) drains kinetic energy faster than these forces can balance it, causing particles to either spiral inward to a clump or disperse outward.

The correct, robust primitive for orbital motion is **concentric circular currents** (`waveStyle: 'circular'`). The wave integrator explicitly applies two corrective physical forces to particles near the orbital waves:
1. **Centripetal Radial Pull**: Gently restores the particle to the orbital wave's radius $r_w(\theta)$, counteracting both friction and outward centrifugal drift.
2. **Tangential Drive**: Accelerates the particle along the circle, sustaining its orbital velocity.

**Critical Requirements:**
* **`waves` option must be active** (`waves: true` / `<field-root waves>`): Disabling the waves layer bypasses the current integrator entirely, killing all orbital currents.
* **Anchor body**: The center of the orbits defaults to any body tagged with the `"star"` or `"vortex"` token. Ensure your central element is registered as a body with one of these tokens.

---

## 25. Additive concepts from the design system

> **Precedence:** §1–§24 are the authority. The items here are *additive* concepts
> mined from the original design-system prototype; where anything
> conflicts with the canonical spec, **the spec wins**. In particular the Field
> Cell runs a *deliberately simplified* demo engine — its constants are **not**
> canonical; the authoritative force math stays §6.

### 25.1 The Field Cell — an in-frame field surface
The spec describes one field: the full-viewport background. The design system adds a
second surface — a **standalone field sized to its container** that renders *one*
force or *one* formation, with its own particle pool, its own pointer interaction,
and a lifecycle that pauses when off-screen. It's the unit behind every live demo,
the natural embeddable (`<field-cell force="swirl">`), and a concrete realization
of the poster/reduced variant (possibilities §1.4) and render modes (§20.6).

```js
// window.makeFieldCell(canvas, { force | formation, color, count }) → { set, reset, destroy }
const DPR   = Math.min(2, devicePixelRatio || 1);
const reach = Math.min(W, H) * 0.62;            // range is FRAME-relative, not viewport
const WELLS = [[0.28,0.42],[0.7,0.34],[0.5,0.72]];   // formation centres as frame fractions
const LANES = [0.28, 0.5, 0.72];
// cursor repel, per-cell:  if (d < 80) a += (dx/d)·(1 − d/80)·1.8
// lifecycle: ResizeObserver re-fits the canvas; IntersectionObserver gates the rAF loop
// edge per mode: wrap | wall | jet-respawn
```

> It is **not** the §-engine — it's a lighter "demo/poster" engine. Document its
> *role*, not its numbers.

### 25.2 Design tokens — the palette as a CSS contract
`ds-tokens.css` is the single CSS source of truth, and pins two things §1–§24 didn't
name: the canonical **easing** and the **coherence** color.

```css
--f-attract:#4da3ff; --f-jet:#a78bfa; --f-tether:#86e57f;
--f-wall:#c4b5fd; --f-stream:#7dd3fc;  --f-repel:#ff9d5c;
--f-viscosity:#8da2c0;    --f-swirl:#2dd4bf;  --f-sink:#ff6e9c;
--f-condition: var(--f-jet);   /* "condition" === the jet body */
--coherence: #ffce6b;              /* resolved / accreted — gold, NOT a force */
--ease: cubic-bezier(0.16, 1, 0.3, 1);   /* the system easing curve */
```

These align with the canonical palette (§6/§20.2) and the `accretion` formation
color (`#ffce6b`); emit them as CSS variables in `forces.config.ts` consumers.

### 25.3 Coherence — the resolved / accreted state (§7, §15)
Beyond the nine forces there is a **resolved state**: what the field settles into,
what a sink's released matter represents, the hub every discipline pulls toward.
The design system encodes it as the `--coherence` gold, as the substrate equation
**`captured = released`**, and as a single "Coherence" goal node every discipline
threads to. It is the *destination* of the `accretion` formation (§7) and the
disciplines' shared sink (§15) — a named state, not a tenth force.

### 25.4 Embedding the field — opacity, scrim, nav continuity (§17/§18)
A concrete recipe for layering a live field under content (slots beside the §18 cost
controls and the §17 gated-toggle):

```css
#field               { position:fixed; inset:0; z-index:0; opacity:.34; transition:opacity .7s ease; }
.show-field  #field  { opacity:.6; }    /* physics views */
.field-live  #field  { opacity:.96; }   /* reciprocal field toggled on */
.scrim { position:fixed; inset:0; z-index:1; pointer-events:none; /* radial+linear vignette */ }
/* content at z-index:2. Kill nav flash: inline dark <html>, color-scheme:dark, @view-transition{navigation:auto} */
```

### 25.5 Assembly targets a mark, never a word
`forces-mark.js` (`buildForcesMark(host,{size,color})`) renders the favicon/wordmark
as a **live field**: an opaque core with smaller bodies + dust orbiting within a
bounded radius. It's "identity that's generated, not drawn" — and the canonical
example of particle **assembly targeting a mark/icon** (per the punctuation rule, §11
note). Bodies stay inside the silhouette: `maxRad(r) = max(0, 186 − r − glow(r))`.
