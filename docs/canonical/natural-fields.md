> **Status: canonical.**
> This document defines the Natural Field Translation System — how Fundamental translates the four
> fundamental fields into interface behavior. The classification here is data
> (`FORCE_KIND` / `FORCE_FIELD` / `NATURAL_FIELDS` in `packages/core/src/config/manual.ts`), so the
> force manual, the Lab badges, and `/docs/natural-fields` all read it and cannot drift. It changes
> no particle/engine behavior — only how each token is explained and organized. See
> [platform-architecture.md](platform-architecture.md) and
> [../engine-reference/forces-system.md](../engine-reference/forces-system.md). For *why* a token is
> designed vs. natural — its relationship to what nature actually does, and why the departures are the
> engine's flexibility — see [designed-vs-natural-map.md](designed-vs-natural-map.md). For how dimensions,
> fields, forces, and relationships compose — orthogonal-by-default, association ≠ coupling, forces as the
> only coupling mechanism — see [dimensional-coupling.md](dimensional-coupling.md).

# Natural Fields

**How Fundamental translates the four fundamental fields into interface behavior.**

Fundamental does not copy physics into the interface. It **translates** the four fundamental fields into
interface behavior:

- **Gravity** becomes priority.
- **Electromagnetism** becomes polarity and signal.
- **Strong interaction** becomes binding.
- **Weak interaction** becomes transformation.

The engine then exposes practical primitives that make those translations usable inside a DOM-native
runtime. Every interface already has priority, polarity, binding, and transformation; physics already
has a compact language for those relations. Fundamental borrows the language, not the literal physics.

> **Four fields. Many expressions. One DOM runtime.**

## The governing doctrine

```
Natural fields are conceptual.
Engine primitives are translations.
Canonical forces are designed verbs.
Derived behaviors are not additional fundamental forces.
Fieldflow is transport along field structure.
Diagnostics reveal invisible structure.
Configurations compose behavior into interface meaning.
FieldRecipe is the current API representation of a configuration.
```

Short version: **natural fields are not tokens; tokens are translations.** So `gravity` is both a
fundamental field and an implemented primitive; `charge` is not a fifth force but an electromagnetic
translation; `magnetism` is the magnetic expression of electromagnetism; `thermal` is a derived energy
behavior; `memory` is a persistence metric; `fieldflow` is transport along field structure.

This does **not** reduce the particle engine. Particles still fall into wells, curve through magnetic
fields, flow along field lines, scatter under thermal agitation, diffuse, collide, bind, and leave
memory trails. The four-field model only gives each behavior a clean place in the hierarchy:

```
Natural field → interface translation → engine primitive → metric → diagnostic → recipe
```

## The four fields

### Gravity — priority, convergence, hierarchy

Gravity is the grammar of what matters. In physics it gathers mass, makes wells, and produces orbital
structure. In Fundamental it translates into priority, weight, attraction, hierarchy, settling, and
convergence. Reach for it for ranking, search relevance, centrality, anchoring, and attention wells.

- Engine expressions: `gravity` (primitive); plus `mass`, `potential`, `prediction` as measurement.
- Note: `attract` is **not** gravity — `attract` is a designed UI well; `gravity` is the natural translation.

### Electromagnetic — polarity, signal, field lines, flow

The grammar of difference and signal. Electric fields push charged matter; magnetic fields bend moving
charged matter. In Fundamental this becomes polarity, opposition, signal, routing, field lines,
propagation, and guided flow — for contrast, state opposition, relationship currents, and plasma-like
motion.

- Engine expressions: `charge`, `magnetism`, `propagate` (primitives); `fieldflow` (transport).
- The rule: **Electric fields push. Magnetic fields bend. Fieldflow carries.** Do not make
  `magnetism.apply()` follow magnetic field lines — field-aligned transport belongs to `fieldflow`.
- Note: `repel` is **not** charge — `repel` is a designed UI verb.

### Strong — binding, cohesion, structure

The grammar of what holds together: groups, clusters, relationships, constraints, bonds, lattices,
durable local structure. Reach for it for grouping, relationship strength, clusters, and material
integrity.

- Engine expressions (analogues): `cohesion`, `link`, `crystallize`, `pressure`, `align`.

### Weak — transformation, decay, release

The grammar of change: fading, mutation, release, conversion, instability, phase shifts, expiration,
handoff. Reach for it for state change, decay, expiration, and transformation.

- Engine expression (analogue): `morph`. Other weak behaviors (phase, decay, fission) are conceptual
  and not yet implemented as forces; the closest shipped persistence behavior is `memory` decay.

## Fields vs primitives vs forces

| Type | Definition | Examples |
|---|---|---|
| **Natural field** | conceptual physical basis | gravity, electromagnetic, strong, weak |
| **Engine primitive** | a direct field expression | `gravity`, `charge`, `magnetism`, `propagate` |
| **Derived behavior** | effective behavior from many interactions / scalar fields | `thermal`, `collide`, `diffuse` |
| **Material analogue** | a strong/weak structural analogue | `cohesion`, `link`, `crystallize`, `pressure`, `align`, `morph` |
| **Transport** | motion along field structure | `fieldflow`, `pigment` |
| **Metric** | a persistence/measurement signal, not physics | `memory` |
| **Canonical force** | a designed UI verb with bounded behavior | `attract`, `repel`, `swirl`, `stream`, `viscosity`, `jet`, `tether`, `wall`, `sink` |
| **Composite** | a recipe of tokens | `blackhole`, `galaxy`, `star`, … |

This keeps the full implementation vocabulary while preventing the confusion of a flat "natural forces"
list. (The machine-readable form is `FORCE_KIND` + `FORCE_FIELD` in `config/manual.ts`.)

## The interface translation table

The lanes are kept separate: **runtime tokens** (strict, real engine forces), **metrics** (measured
state), and **diagnostics** (inspection modes). A word's lane is never left to the reader to guess.

| Interface need | Natural field | Runtime tokens | Metrics | Diagnostics |
|---|---|---|---|---|
| Show importance | Gravity | `gravity`, `attract` | mass, priority, attention | potential, prediction |
| Draw attention | Gravity + EM | `gravity`, `charge`, `spawn` | attention, confidence | potential, causality |
| Show opposition | Electromagnetic | `charge`, `repel` | polarity, conflict | field-lines, causality |
| Route signal | Electromagnetic | `charge`, `propagate`, `fieldflow`, `stream` | signal, strength | field-lines, force-vectors |
| Show relationship | Strong + EM | `link`, `cohesion` | relation-strength | topology, causality |
| Keep things grouped | Strong | `cohesion`, `crystallize`, `align` | cluster, density | topology, heatmap |
| Show instability / change | Weak | `morph` | entropy, conflict | causality, contours |
| Let state fade | Weak + memory | `morph`, `memory` | decay, age | heatmap, inspector |
| Show flow through structure | EM + transport | `fieldflow`, `stream` | flow, velocity | field-lines, prediction |
| Show reading history | Memory (metric) | `memory` | attention, recency | heatmap, inspector |

In every row the `code-styled` words are real runtime tokens; the unstyled words are metrics or
diagnostics, never forces. `mass` is a metric, `potential` is a diagnostic — neither is a token.

## Diagnostics by field

Each diagnostic answers "which invisible relation am I revealing?"

| Diagnostic | Reveals | Field |
|---|---|---|
| Potential | wells and energy landscape | Gravity |
| Field lines | electromagnetic structure | Electromagnetic |
| Topology | binding and relationships | Strong |
| Causality | which primitive caused change | any |
| Prediction | near-future path | Gravity / flow |
| Energy | activity level | derived (thermal) |
| Contours | scalar fields | derived (diffuse, memory) |
| Velocity vectors | actual motion | transport (fieldflow) |
| Inspector | all of the above | system |

All diagnostic render modes are shipped — see [visualization-methods-taxonomy.md](visualization-methods-taxonomy.md)
and the live [/docs/diagnostics](https://fundamental-engine.com/docs/diagnostics).

## Recipes by meaning

Interface-native recipes name the *meaning*, then map to a field:

| Recipe | Field | Use | Primitives |
|---|---|---|---|
| Priority Well | Gravity | search, dashboards, navigation | `gravity`, potential, prediction |
| Signal Path | Electromagnetic | citations, dependencies, evidence | `charge`, `propagate`, `fieldflow` |
| Relationship Bond | Strong | groups, semantic clusters | `link`, `cohesion`, topology |
| Memory Trace | Metric / weak decay | reading, history | `memory`, attention, feedback |
| Reading Field | Gravity + memory + relationships | long content pages | measurement, state, feedback, relationships |
| Evidence Field | Electromagnetic + strong | source support | `charge`, topology, causality |

## The frame

The system should not say "we have physics-inspired UI effects." It says: every interface has
priority, polarity, binding, and transformation; physics already has a compact language for those
relations; Fundamental translates that language into DOM behavior. **Four fields. Many expressions. One
DOM runtime.**
