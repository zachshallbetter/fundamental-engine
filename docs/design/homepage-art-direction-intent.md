> **Status: reconstruction — not a design proposal.**
> An evidence-based reconstruction of what issue
> [#914](https://github.com/zachshallbetter/fundamental-engine/issues/914) ("Homepage visual
> art-direction pass — the calm-instrument language") was asking for and why, written so the
> maintainer can decide whether it still reflects what he wants. This document proposes no
> visual direction of its own and changes no site code. Where the record is silent, it says so.

# Homepage art direction — reconstructing the intent of #914

## 0. Why this exists

#914 has been open and unstarted since 2026-07-02 (board #24: **Backlog · P2 · size M**). It has
**zero comments**. Asked whether to act on it, the maintainer said: *"I don't know the art
direction, we should identify what the intent was with that."*

So the question this answers is not *what should the homepage look like* but *what did #914 mean,
and does the project still want it*. Every claim below cites the artifact it came from.

---

## 1. What #914 literally asked for

Filed **2026-07-02T05:37Z by @zachshallbetter**, no labels, no comments, still open. The body in
full, quoted:

> ## Context
> The substrate-alignment pass + homepage restructure (PRs #905–#913) delivered the structural,
> copy, and IA work — hero reframe, de-stuff to `/engine-tour`, the 5-verb spine, the live field-
> reading motif. The **deeper visual art-direction** was deliberately deferred (subjective, high-
> rework-risk to guess at).
>
> ## What
> Execute the "calm instrument" visual language from the art-direction brief on the homepage
> (`apps/site/src/pages/index.astro` + `apps/site/src/styles/{manual,landing}.css`):
> - **Two-accent palette**: warm coral/amber (attention/energy) + cyan/electric-blue
>   (signal/query/readout). Color means STATE, not decoration.
> - **Three type modes**: editorial display · readable body · monospace readout.
> - **Instrument cards**: thin borders, soft inner glow, subtle coordinate-grid texture, metric
>   chips — not SaaS-rounded / glassmorphism.
> - **Motion**: slow, bounded, meaningful (state change / attention / readout); no ambient sparkle.
>
> ## Constraints
> - RESTRAINT is the whole thrust — the homepage should read calmer than the Lab. Profile fps/DPR
>   (the field is fill-rate-bound, not particle-bound).
> - Reduced-motion must keep meaning (do not regress).
> - `ManualHero` is shared with `/eli5` — don't break that page.
>
> ## Acceptance
> - Reads as "research lab + live instrument," not particle toy; palette applied as state; type
>   modes distinct.
> - Visual-verified (screenshots) desktop + mobile + dark; reduced-motion intact; homepage idle
>   fps ≥ the perf floor.
>
> **Wants Zach in the loop on palette/type specifics before a full pass.**

Two things to notice about the text itself.

**It is a derivative document.** It says "Execute the 'calm instrument' visual language **from the
art-direction brief**". #914 is a work order against a brief it does not contain. See §5 — that
brief is not in this repository.

**It closes by deferring to Zach.** The last line — *"Wants Zach in the loop on palette/type
specifics before a full pass"* — means the issue was never self-authorizing. It was filed as a
placeholder for a conversation that has not happened. That is consistent with it sitting untouched
for two months with no comments.

### The one surviving quotation from the brief

PR **#913** (merged 2026-07-02T05:39Z, two minutes after #914 was filed) quotes the brief directly:

> The art-direction follow-up from the restructure: the **live field-reading motif** your brief
> asked for — 'these tiny labels make the substrate visible without requiring particles.'

That single sentence — *tiny labels make the substrate visible without requiring particles* — is
the only verbatim fragment of the brief anywhere in the repo, and it is the clearest statement of
the intent underneath the whole issue. It is also the one item that was actually built (§3).

---

## 2. The intent, reconstructed

### The problem the look was meant to solve

The homepage restructure (#909, #913) changed the page's **job** from "show the full engine" to
"prove the substrate, route to proof" (#909: *"change the page's job from 'show the full engine' to
'prove the substrate, route to proof'"*). #909 and #913 delivered that as copy and structure. The
visual layer was still the pre-restructure one. #914 is the gap between a page that now *argues*
"this is an instrument that measures your interface" and a page that still *looked* like a
generic developer landing page with a particle background.

The failure mode being designed against is named repeatedly and identically across the record:
**being read as a particle toy.** #914's acceptance criterion is *"Reads as 'research lab + live
instrument,' not particle toy."* PR #908 rebuilt `/demo` for exactly this reason — *"the substrate
point never landed and it read as a basic particle toy."* The homepage copy still carries the
defense today: *"No particle swarm; the measurement comes back as type and ink"*
(`apps/site/src/pages/index.astro`).

So the intent is best stated as: **make the homepage look like what the engine actually is — an
instrument that measures — rather than like the thing it is most often mistaken for.** "Calm
instrument" is the name for that; "restraint" is the method, because the toy reading comes from
excess.

### The constraints the project had already committed to

These were not invented by #914; it inherits them, and they are stronger now than they were then.

**Signals-first / `render: 'none'`.** #538 made the engine default to drawing nothing. The writing
`render-none-the-invisible-field.md` (2026-06-26) states the doctrine: *"The invisible field is the
baseline. The pixels are the choice."* A homepage art direction cannot lean on pixels the engine
treats as opt-in exceptions.

**Fill-rate is the budget.** `the-field-is-fill-rate-bound.md` and
`the-empty-canvas-that-costs-every-frame.md` (both 2026-06-26) document a real 120→30fps homepage
regression that particle count could not explain: *"A field is fill-rate-bound, not
particle-bound."* Full-viewport canvases, `mix-blend-mode`, and DPR2 are the expensive things —
which is why #914's "soft inner glow" and "coordinate-grid texture" carry a cost warning in the
same breath. Both writings also warn that headless numbers exaggerate fill, so any perf verdict on
this work must come from real hardware.

**The wallpaper rule.** `docs/canonical/wallpaper-rule.md` (established 2026-07-02 — the same day
#914 was filed) makes "the field is a substrate, not wallpaper" operational. Decoration is legal
*only when declared and opt-in*. Its corollary **"Proofs must be produced"** is the sharpest
constraint on an art-direction pass: *"CSS that pretends to be field-driven is wallpaper even when
the values look plausible."* This is why #914 says **"Color means STATE, not decoration"** — a
homepage glow that is merely styled, rather than driven by a real `--field-*` reading, would
violate canon the day it shipped.

**Reduced-motion honesty, and the field as decorative/aria-hidden.** #914 requires reduced-motion
to keep *meaning*, not merely to stop. This matches the shipped lint (#932, reduced-motion lint) and
the shipped page: the decorative field constructs `waves: false` under reduced motion
(`Base.astro`) and the field-driven proof blocks on the homepage are `aria-hidden="true"`
(`.lp-inbox`, `.wedge-field`, `.lp-inspect`). The visual language therefore has to carry its
meaning in **type, ink, and layout** — the parts a screen reader and a reduced-motion user still
get — with the drawn field as an enhancement on top. That is the same conclusion the brief's own
surviving sentence reaches: *labels, not particles*.

**The shared-component constraint is real.** `ManualHero` is imported by `index.astro` and by
`/eli5`; #914's warning still holds.

### The theory of colour underneath it

#914's *"Color means STATE, not decoration"* is not a free-floating slogan. It descends from
`docs/canonical/visual-language-and-geometry.md` §5, which splits colour into channels:

```txt
hue = categorical meaning
saturation = intensity
tone/lightness = hierarchy and depth
alpha = presence/confidence
temperature = heat/cool state
```

Read against canon, #914's two-accent proposal is a claim that the homepage should spend its **hue**
budget on exactly two categories — *attention/energy* (warm coral/amber) and *signal/query/readout*
(cyan/electric-blue) — and express everything else through the state channels. Note that canon
assigns hue to **category**, not state; §4 returns to this, because what shipped went the other way.

---

## 3. What has changed since #914 was filed

Filed 2026-07-02. As of 2026-09-12, five things have moved, and none of them were done as #914.

**a) The homepage got *less* calm, deliberately (#1051, #1052, #1053 — 2026-07-08).** #1051 states
the counter-problem in the maintainer's own framing: *"The homepage had gone thin and static: the
#909 de-stuff cut it 1460→341 lines and 73→24 bodies, and the signals-first default flips left the
field sparse and settling."* The response was to raise particle density 2.4 → 3.6, add an ambient
swirl body, and re-body sections with **force variety** — *"Nine distinct forces now (was ~3)"* —
plus a hands-on "try it" control panel (#1052) and a `--d`-driven colour wash on re-bodied elements
(#1053). This is a real, unremarked tension: **#914 asks for restraint; #1051 diagnosed the same
page as too restrained and added liveliness.** Nothing in the record reconciles the two.

**b) The palette went the opposite way from "two accents."** The design system still declares a
single accent — `--accent: #4da3ff` (`ds-tokens.css`, commented *"the resting field"*). But the
homepage now carries a **per-force categorical palette** via `data-color` / `--cat`: `#4da3ff`
(attract/blue), `#2dd4bf` (teal), `#ffce6b` (amber), `#f0628e` (pink), `#a78bfa` (violet),
`#ff9d5c` (orange) — at least six hues, where hue encodes **which force**, not which state. This is
defensible under canon §5 ("hue = categorical meaning") but it is **not** the two-accent
state-palette #914 asked for. This is the single largest divergence in the record, and it happened
by accretion, not by a decision anyone wrote down.

**c) The page's rhetorical posture was re-cut (#1086 — 2026-07-21).** *"Lead the homepage with the
artifact, not the abstraction."* The kicker and title became *"a physics engine for interfaces"*;
the standfirst became two checkable sentences, the strongest being **"Nothing on this page is
animated"** (shipped as *"Nothing on this page is animated — every motion you can see is the field
resolving"*). A `#shipped` section of four working artifacts was added. This matters to art
direction in two ways: it partly *achieves* #914's "instrument not toy" goal through copy rather
than styling, and it introduces a line the visual layer must now not contradict — any motion the
homepage shows has to be the field resolving, not CSS.

**d) One of #914's four bullets is already built.** #913's live `field-readout` — mono chips
streaming `density · bodies · particles` from `field.query()` at ~4/sec, plus static
`query · projection · policy` facts — is both the **monospace readout** type mode and the **metric
chips** from the instrument-card bullet. It ships on the homepage today. The brief's own sentence
(*tiny labels make the substrate visible without requiring particles*) is therefore **satisfied**.

**e) #1110 (merged 2026-09-12) — and what it does *not* do.** The resting-motion floor landed on
all three planes: `restingMotion: { mode: 'thermal' | 'flow', strength? }`, `<field-root
resting-motion="thermal">`, Swift `FieldOptions.restingMotion`, Kotlin `RestingMotion`. It is
**declared and default-OFF**, contributes exactly nothing under reduced motion (`dt = 0`), draws
nothing, and is measured as `--temperature`. `wallpaper-rule.md` now carries it as canon:
*"Resting liveliness is declared, not painted."*

Assessed against #914's **Motion** bullet — *"slow, bounded, meaningful … no ambient sparkle"* —
#1110 is the correct mechanism and satisfies the *doctrinal* half: idle motion is now a declared,
bounded, reduced-motion-honest, measurable primitive rather than a decorative layer. It does **not**
satisfy the bullet on the homepage, for two reasons stated in the PR itself:

> Swapping the homepage's interim ambient-swirl body (`Base.astro`) for `resting-motion` is a
> visible change to the landing page and should be reviewed by eye; the board item lists it as step
> 4 and it is a one-attribute follow-up once the option is in.

So the homepage still runs the **interim** ambient-swirl hack from #1051, and the swap is an
outstanding one-attribute change gated on a visual review. And #1110 addresses only *idle* motion —
#914's motion bullet also covers state-change, attention, and readout motion, which nothing has
touched.

**Net across #914's four bullets:** the **readout/metric-chip** half of the type and instrument-card
asks shipped in #913; **motion** has its engine mechanism ready (#1110) but unapplied to the page;
**palette** is untouched and has actively drifted away from the ask (six categorical hues, not two
state accents); the **editorial/body type distinction** and the **instrument-card treatment**
(borders, glow, grid texture) are untouched. Separately, #1086 achieved a large part of #914's
underlying *goal* — "instrument, not toy" — through copy rather than styling.

---

## 4. Decisions only Zach can make

Stated as either/or so they can be answered in one pass.

**D1 — Is "calm instrument" still the target, given #1051 and #1086?**
&nbsp;&nbsp;**(a)** Yes — restraint stands; #1051's liveliness additions get re-examined against it.
&nbsp;&nbsp;**(b)** No — #1051's "live, dense, force-varied" posture is the current direction, and
#914's restraint framing is obsolete.
&nbsp;&nbsp;**(c)** Both, split by layer: the *drawn field* stays lively; the *CSS/type/chrome*
goes calm.
*Why it must be answered first: D2–D6 are downstream of it.*

**D2 — Palette: two accents, or the per-force categorical palette?**
&nbsp;&nbsp;**(a)** #914 as written — two accents (warm = attention/energy, cyan = signal/readout),
hue reserved for state; the six `data-color` force hues get reduced or demoted to the Lab/tour pages.
&nbsp;&nbsp;**(b)** Ratify what shipped — hue means *which force* (canon §5's "hue = categorical
meaning"), state rides saturation/tone/alpha; #914's palette bullet is struck.
&nbsp;&nbsp;**(c)** Two accents for page chrome, force hues only inside field-proof blocks.

**D3 — Homepage resting motion: swap to `resting-motion` now, or not?**
&nbsp;&nbsp;**(a)** Swap `Base.astro`'s interim ambient-swirl body for `resting-motion="thermal"`.
&nbsp;&nbsp;**(b)** Swap for `resting-motion="flow"` (divergence-free curl, never settles).
&nbsp;&nbsp;**(c)** Leave the interim swirl until the rest of the art direction is decided.
*Independent of D1–D2; it is a one-attribute change plus a by-eye review, per #1110.*

**D4 — Instrument cards: build the treatment, or drop the bullet?**
&nbsp;&nbsp;**(a)** Build it — thin borders, soft inner glow, coordinate-grid texture — accepting
that glow and texture are fill cost and must be profiled on real hardware, not headless.
&nbsp;&nbsp;**(b)** Build a cheap subset — thin borders and metric chips only, no glow, no texture.
&nbsp;&nbsp;**(c)** Drop it; #913's readout chips plus #1086's artifact-led `#shipped` section
already carry the "instrument" reading.

**D5 — Type: make `--display` and `--body` distinct, or collapse the ask?**
&nbsp;&nbsp;Both tokens currently resolve to Bricolage Grotesque, so the site has two visible type
modes, not three (§5.4).
&nbsp;&nbsp;**(a)** Introduce a distinct editorial display face (a second webfont — costs a font
load).
&nbsp;&nbsp;**(b)** Keep one family, make display distinct by size/weight/tracking only (no new
font load).
&nbsp;&nbsp;**(c)** Collapse the ask — two modes (Bricolage + Martian Mono) is the intended system;
drop `--body` as a redundant alias.

**D6 — Scope: is #914 one issue or several?**
&nbsp;&nbsp;**(a)** Keep it whole and do a single reviewed pass.
&nbsp;&nbsp;**(b)** Split into palette (D2), motion swap (D3), card treatment (D4) and type (D5),
close #914 as the umbrella.
&nbsp;&nbsp;**(c)** Close #914 as overtaken by #913 + #1086 + #1110, and re-file only what survives.

**D7 — Does the art-direction brief still exist anywhere?**
&nbsp;&nbsp;**(a)** Yes — it can be recovered and pasted into the repo, at which point this
reconstruction should be replaced by the real thing.
&nbsp;&nbsp;**(b)** No — this memo plus the decisions above become the record, and #914's body is
the only authority.
*See §5; this is the largest single hole in the evidence.*

---

## 5. What could not be determined

Stated plainly, because the value of this memo is that it does not fill gaps with invention.

1. **The art-direction brief itself is not in this repository.** #914 executes "the art-direction
   brief"; no such file exists. `git log -S"calm instrument"` and `--grep` searches across all
   branches return nothing but #913. Only one sentence of it survives, quoted in #913 (§1). **Every
   specific in §1's bullets — why *coral/amber* and *cyan*, what "three type modes" means
   concretely, what a "coordinate-grid texture" should look like — traces to a document I cannot
   read.** Treat the four bullets as a summary of a richer source, not as the source.

2. **No visual references exist.** No mockups, screenshots, Figma links, swatches, or comparison
   images anywhere in the issue, the PRs, or the repo. There is no way to know what "research lab +
   live instrument" looked like in the author's head.

3. **"Calmer than the Lab" is unquantified.** `/lab` exists (`apps/site/src/pages/lab.astro`,
   `lab.css`), so the comparison has a referent, but nothing states which of the Lab's properties
   the homepage should dial down.

4. **"Three type modes" — the slots exist, but what should fill two of them does not.** The
   design system already declares exactly three type tokens, and has since #147 (2026-06-05,
   a month *before* #914):

   ```css
   --display: 'Bricolage Grotesque', ui-sans-serif, system-ui, sans-serif;
   --body:    'Bricolage Grotesque', ui-sans-serif, system-ui, sans-serif;
   --mono:    'Martian Mono', ui-monospace, 'SF Mono', Menlo, monospace;
   ```

   So #914's "three type modes" is almost certainly not a request for three *tokens* — it is a
   request to make the two that already exist actually **distinct**, since `--display` and `--body`
   resolve to the same typeface and the system therefore has two visible modes, not three. Usage
   confirms which end is developed: `var(--mono)` appears 284 times across the site styles and
   components, `var(--display)` 13, `var(--body)` **once**. The monospace readout mode is real and
   shipped; the editorial/body distinction is a token slot nobody has filled.

   What remains **not recoverable** is what should fill it: whether "editorial display" meant a
   second typeface, a size/weight/tracking tier on the existing one, or only a treatment. The brief
   would have said; the brief is gap #1.

5. **The #914-vs-#1051 tension is never discussed anywhere.** #1051 (add liveliness) neither cites
   nor contradicts #914 (add restraint) — the two simply coexist. I found no comment, commit
   message, or doc reconciling them. D1 exists because the record genuinely does not answer it.

6. **The homepage's own perf floor is not established for this work.** #914's acceptance names
   "homepage idle fps ≥ the perf floor," and RC-7 (perf budgets as gates) is an open, hardware-
   blocked gate in `docs/planning/fundamental-release-gate-spec.md`. I did not measure the
   homepage; no number in this memo is a perf claim.

7. **`Fundamental-homepage-reorg-spec.md` is likewise external.** It is referenced by name as a
   predecessor in the release-gate spec (and is the source of gate RC-10), but the file is not in
   this repo. Its §2.3 claims ledger and §7 install gates are cited by other docs; I could not read
   them. Whatever it says about the homepage's visual intent is unavailable.

8. **No cross-references to #914 exist.** Its GitHub timeline contains only two events — added to
   project #24, and a status change. No issue or PR links to it; it links to none. There is no
   hidden discussion thread I failed to find; there simply is none.
