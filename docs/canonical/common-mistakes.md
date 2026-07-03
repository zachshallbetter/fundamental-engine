# Common mistakes — don't guess

> **Status: reference.** The first-contact mistakes an agent or developer makes about Fundamental — and
> the correct answer. If you are about to guess at the API or the behavior, check here first; the truth
> is cheaper than a wrong guess.

Fundamental's surface is small but its mental model is unusual, so confident wrong guesses are common.
Each item below is a mistake we have actually seen, paired with the fact and where to verify it.

## 1. "It's a particle background."

**No — it is a behavior layer.** A field reads each `[data-body]` element's position every frame and
writes the local field back as `--field-*` CSS variables (`--field-density` / its alias `--d`, `--load`,
`--lit`) your own styles consume. It reacts to *your* layout and engagement, not to a cursor over a
decorative canvas. Particles are **one optional render surface**, not the system. See
[invisible-fields.md](invisible-fields.md).

## 2. "`render` defaults to particles."

**No — since [#538](https://github.com/zachshallbetter/fundamental-engine/issues/538) `render` defaults
to `'none'` (signals-first).** A field created without an explicit `render` runs the full simulation and
emits signals but **draws nothing**. Opt into a visible surface explicitly: `render: 'dots'` (particles),
`'trails'`, `'streamlines'`, or the warped `grid` overlay. If "nothing is showing," that is the default —
add `render: 'dots'`, or read the `--field-*` variables (which are already live).

## 3. "There are three different `createField`s."

**No — there is one `createField`.** The `@fundamental-engine/core` export is the renderer-agnostic
primitive and **requires `opts.host`**. The `@fundamental-engine/vanilla` export is the *same function*
with `browserHost()` bundled for you (plus a `bounds` option). Use the vanilla door
(`createField(canvas, opts)` or `new FieldField(opts)`) unless you are wiring your own renderer. You do
not need to find a different package because one "needs a host" — that is the core primitive; reach for
vanilla.

## 4. "To scope the field to a component I have to roll my own."

**No — pass `bounds`.** `new FieldField({ bounds: el })`
([#540](https://github.com/zachshallbetter/fundamental-engine/issues/540)) runs a *contained* field whose
bodies and coordinates live inside the element, not the window. Contained is a vanilla option, **not** an
attribute on `<field-root>` (the web component is window-scoped) and **not** `<field-cell>` (that is a
standalone per-force demo pool).

## 5. "I'll poll the particles to read the field state."

**Read the signals, not the particles.** The field's output is the `--field-*` CSS variables on
`[data-feedback]` bodies and the discrete event bus (`field.on('captured' | 'released' | 'enter' | 'exit' | 'met', …)`).
For sampled scalars use `field.sampleScalar(x, y)` / `sampleGradient(x, y)` (these need
`heatmap: true` — they warn in dev if it is off). `readParticles()` exists for renderers, not for reading
state.

## 6. "`attract` is gravity; `absorb` is a token."

**Mind the naming lanes.** Natural Fields (Gravity→importance, Electromagnetic→polarity, Strong→binding,
Weak→transformation) are **concepts**, not tokens. The runtime tokens are `attract`, `gravity`, `charge`,
`sink`, `cohesion`, … — and `attract` is a *designed UI well*, deliberately **not** gravity. `absorb` is
concept language; the token is `sink`. Concepts describe, tokens execute — never mix them. See the naming
canon in [definition-document.md](definition-document.md).

## 7. "I can infer the API from the name."

**Don't infer — the surface is small and documented.** Entry points and the which-`createField` map are
on the [docs overview](https://fundamental-engine.com/docs); every option is in
[/docs/api/options](https://fundamental-engine.com/docs/api/options); the frozen 0.x surface is
`scripts/api-surface.data.mjs` (CI-enforced). If a method or option is not in those, it does not exist —
do not invent it.

## 8. "Reduced motion breaks it."

**No — reduced motion loses motion, not meaning.** The simulation and the `--field-*` signals still
track under `prefers-reduced-motion`; only the CSS easing and the drawn surface drop. Style your reactive
states so they read without animation. See [accessibility](https://fundamental-engine.com/docs/accessibility).

## What not to build

Because the system is expressive, the failure modes are mostly misuse. Don't:

- Use Fundamental as a **decorative particle background** only (it's a behavior/signals layer; particles are optional).
- Make **motion the only carrier of meaning** — it must survive reduced motion (see #8).
- Turn **every relationship into a coupling** — association is not coupling; forces couple, a Field Formation decides which associations become couplings.
- Let a **projection mutate field state** — projections reveal, they never write back (projection purity).
- **Expose body data to agents by default** — `body.data` stays opaque unless deliberately included.
- Say **"formation"** when you mean a *global formation mode* (`wells`/`lanes`/…), or **"Configuration"** when you mean a *Field Formation*.
- Use **"Matter"** when you mean authored behavior.
- Create a **force token for every concept** — most concepts are metrics, dimensions, or projections, not new forces (the recipe/force canon is locked).

## Field failure modes

When a field misbehaves, name the shape of the failure — each has a distinct cause and fix.

1. **Dead field** — no bodies, or no measurable region: nothing is `[data-body]` in bounds, so the field has nothing to measure and emits nothing.
2. **Silent field** — the sim runs but no feedback or projection is attached; signals are written but nothing consumes them (the silent-contract gap). See [causality-and-truth.md](causality-and-truth.md).
3. **Haunted field** — a projection *appears* to change field state because coupling/projection boundaries are unclear; projections reveal, they never write back (projection purity).
4. **Leaky field** — a snapshot or query unexpectedly exposes opaque body data; `body.data` should stay opaque unless deliberately included. See [substrate-api.md](substrate-api.md).
5. **Overcoupled field** — relationships produce dynamics with no declared Field Formation; associations became couplings without a formation deciding they should.
6. **Motion-only field** — meaning disappears under reduced motion because motion was the only carrier (see #8).
7. **Drifting field** — host geometry and field coordinates diverge; the adapter's space no longer matches the field's. See [coordinate-spaces.md](coordinate-spaces.md).
8. **Unstable field** — forces inject energy with no damping, cap, or budget, so the sim heats up unbounded.
9. **Ambiguous field** — a term is used in two lanes at once (e.g. "formation" for both a global formation mode and a Field Formation); pick one lane.

## Field smells

Lint-candidate heuristics — each points at a likely mistake, not a guaranteed one.

1. **Raw force soup** — many force tokens stacked on one body with no Field Formation to organize them.
2. **Metric without provenance** — a metric reported with no trace of where it came from. See [causality-and-truth.md](causality-and-truth.md).
3. **Projection without a reduced-motion / semantic equivalent** — a projection that only reads under animation.
4. **Relationship pretending to be a force** — an association wired as if it couples, with no formation behind it.
5. **Agent overread** — a Software Agent reads more field data than its task needs. See [substrate-api.md](substrate-api.md).
6. **Body without identity** — a body that can't be tracked across snapshots (`FieldBodyIdentity` now addresses this).
7. **Host mismatch** — the adapter supplies a different coordinate space than the projections expect. See [coordinate-spaces.md](coordinate-spaces.md).
