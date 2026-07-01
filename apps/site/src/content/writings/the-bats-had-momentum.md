---
title: "The Bats Had Momentum: What Fundamental's Field Is Missing"
description: "In 1992, Reynolds' boids gave Batman Returns its swarming bats and its army of penguins. Fundamental descends from the same model — but it's missing the thing that made those creatures feel like matter: momentum. Here's the idea to add it, and what we'd expect."
summary: "Fundamental flocks like a boid but doesn't move like one — bodies push matter without recoiling, so momentum leaks. A proposal for first-class mass and Newtonian reaction, and the results we'd expect from it."
date: 2026-06-29
category: note
author: "Zach Shallbetter"
draft: false
---

# The Bats Had Momentum: What Fundamental's Field Is Missing

In *Batman Returns* (1992), the bats that pour through Gotham and the regiment of penguins that march
on the city were not hand-animated. They were **boids** — a modified version of Craig Reynolds' 1987
distributed behavioral model, one of its first big-screen outings. Each bat saw only its neighbors and
followed a few small rules, and the swarm fell out of the interaction. It was one of the earliest times
a film audience watched emergence do an animator's job, and it worked because the creatures didn't just
*arrange* themselves — they *moved* like things with weight. They carried momentum. A bat that banked
hard kept going; the flock had inertia you could feel.

Fundamental is a descendant of that 1992 swarm. It's a relational field runtime — it lets the elements
of a web page become bodies in an invisible physics field — and, as it happens, it flocks. Its forces
for spacing, aligning, and grouping particles are even named, in the source, after Reynolds' three
rules. Drop an autonomous agent into the field and a murmuration emerges with no code that says "flock."

But watch it closely and something the bats had is missing. **Fundamental flocks like a boid, but it
doesn't move like one.** And the reason is a single word: momentum.

## Where the momentum leaks

Two facts about how the engine works today.

First, **bodies don't recoil.** When a body in the field pushes a particle — attracts it, repels it,
swirls it — the particle moves, but the body doesn't move back. The body is an immovable source. In the
real world, and in Reynolds' bats, every push has an equal and opposite push; that's how a flock's
total momentum stays put while individuals trade it back and forth. In Fundamental, the push goes one
way and the bookkeeping never balances.

Second, **mass is nominal.** By default every particle behaves as if it weighs exactly one unit — the
engine advances velocity by simply adding the force (`v += F`), not by dividing force by mass
(`a = F/m`). So "heavier elements swing wider, lighter ones dart" is, right now, a thing the field
*can't express* by default. There's an opt-in for real mass, but the recipes are all tuned around unit
weight, so almost nothing uses it.

Add a dab of friction every frame — which the engine does deliberately, to keep interfaces calm — and
the result is a field that is **driven and damped** rather than one that *conserves*. Momentum doesn't
circulate through it the way it circulates through a flock of bats. It leaks.

This isn't a bug. It's a design that optimized for a calm, legible interface and got one. But it leaves
a real capability on the table, and — interestingly — the capability is the one most aligned with
Fundamental's own headline idea.

## The idea: give bodies reaction, give matter mass

The proposal is two linked changes, both opt-in.

**1. First-class mass.** Make `a = F/m` available as a real default for a field, with a body's mass
deriving from something physical — its rendered area, say. A heading becomes heavy; a tag becomes
light. The machinery already exists in the engine; what's missing is making it the basis of a field's
motion rather than a rarely-used flag.

**2. Newtonian reaction.** When a force acts on matter, apply the equal-and-opposite impulse back to the
source body. Not a new force — a *property* that existing forces opt into: when `attract` pulls a
particle in, the body feels a small tug toward the particle in return. Bodies stop being immovable
sources and become participants that can be moved by what they move.

You can't have the second without the first — you can't recoil an infinite-mass body, so reaction needs
bodies to have finite, real mass. The two changes are one change. And the engine team has already
half-seen the hole: the wall primitive "does not yet recoil," and collision recoil onto the DOM is
already filed as proposed. This would generalize that instinct across the whole force set.

## What we'd expect from it

This is a proposal, not a shipped feature, so the right register is *expected results* — hypotheses, not
findings. Here is what adding momentum should do.

**Reciprocity becomes physical, not just bookkeeping.** Fundamental's whole thesis is reciprocal:
bodies bend the field, and the field bends them back. But today that "back" is a *feedback* loop — the
field writes a CSS variable onto the element and a style rule reacts. With reaction, the loop also
closes through *motion*: a body that throws its weight around gets pushed by the matter it disturbs.
The headline becomes literally true at the level of physics, not only of styling. This is the single
most thesis-aligned upgrade available.

**Weight becomes legible.** A massive element should settle slowly and overshoot; a light one should
snap. Importance could read as inertia, not just size — a heavier body resists being shoved aside by a
crowd of lighter ones. That's a new expressive channel that costs no new vocabulary.

**Momentum can be conserved on purpose.** With reaction in place and friction turned off, a field
becomes a closed system: total momentum is preserved, the way it is in a real flock. That's an opt-in
"physics-truth" mode for the cases that want it (a simulation, a teaching demo) sitting alongside the
calm, damped default for the cases that don't.

**The clump might ease — but we should test, not assume.** Today, opposing forces can cancel and
friction freezes the leftover into a stalled clump. Real mass changes those dynamics: matter carries
through a balance point instead of stopping dead at it. We'd *expect* momentum to soften the clump, but
the honest move is to measure it, because it could equally introduce new oscillation. Reaction adds
energy paths that didn't exist before.

**And there are costs worth naming.** Momentum makes things bouncier, and bounciness is exactly what
the calm-interface default was protecting against — so this has to be opt-in, not a global flip. Every
recipe is tuned for unit mass, so a mass-on field needs recalibration. And the moment bodies can be
moved by matter, layout stability becomes something the system has to actively defend rather than get
for free. None of these is disqualifying; all of them are real.

## Why this one

Of everything on Fundamental's list of honest limitations, momentum is the one a single, clean mechanism
would resolve — and the one that pays the system's own story back the most. Most of the others are
deliberate (energy decay keeps things calm; designed forces are kept distinct from natural laws on
purpose) or aren't the engine's job at all (whether any of this *helps a user* still needs studies that
haven't been run). Momentum is different. It's a capability the field almost has, that the recipes
don't yet use, that the roadmap already gestures at, and that would make the reciprocity at the heart of
the whole project something you could feel in the motion — the way you could feel it in a swarm of bats
over Gotham.

## The first domino

Here's the part that makes momentum more than a feature. You can't add it cleanly without touching the
floor of the engine — and that turns out to be the point.

To give bodies recoil, the integrator has to stop being a quick `v += F` with a hard speed cap and become
something that actually conserves (a symplectic, fixed-timestep solver — the kind of thing d3-force has
used for graph layout for years). To give matter mass, bodies and particles stop being two different
kinds of thing — an immovable source and a weightless dot — and become one kind of *matter* that can both
push and be pushed. And for any of it to be measurable, forces have to *produce* forces instead of
secretly editing velocity, so the integrator can do the physics in one place.

None of that is momentum, exactly. It's the foundation momentum needs. And it's the same foundation a
serious substrate needs anyway — which is why the right way to read this isn't "add bounciness," it's
**momentum is the first domino.** Knock it over deliberately and the engine stops being a calm decoration
that reads the page and starts being a small physics that the page is one view of.

What that unlocks is already written down. Fundamental's possibility space has long described matter that
isn't particles — fluid that pools, fabric that sags under a heavy heading, sand that piles where
attention accretes. It describes the field as something an AI agent could *query* instead of scraping the
DOM, and as a shared space where a room full of readers' attention sums into a visible weather. Almost all
of it is waiting on the same thing: a field whose physics is real enough, and independent enough of the
browser's layout loop, to carry that weight. Momentum is where you start paying that down.

The bats had it in 1992. It's time the field did too.

## Update — the first domino is falling (2026-07-01)

Written above as a proposal; since then, most of the *foundation* it argues for has actually shipped in
the `0.9.x` substrate line. The three prerequisites this note names —

- *"forces have to **produce** forces instead of secretly editing velocity, so the integrator can do the
  physics in one place"* → shipped as the **dimension-aware impulse accumulator**: every force's
  contribution now flows through one canonical capture path (`applyAndRecord`) and is attributable per
  force, across five channels (linear, thermal, angular, temporal, semantic).
- *"a symplectic, fixed-timestep solver"* → shipped as an **opt-in fixed-timestep integrator**
  (`createField({ integrator: 'fixed' })`) — the frame-rate-correct path, alongside the calm `v += F`
  default (partial progress on [#658](https://github.com/zachshallbetter/fundamental-engine/issues/658);
  [#659](https://github.com/zachshallbetter/fundamental-engine/issues/659) velocity-Verlet is still open).
- *bodies that can be "**pushed** by the matter it disturbs"* → shipped as **body-authority modes**: a
  `data-authority="dynamic"` body is engine-owned and recoils under the net field (there's a live
  wiring of it, plus a reading of it as agent-consumable JSON, on the `/demo` page).

So the "first domino" is no longer a proposal — it's largely knocked over. What remains genuinely
*unshipped* is **momentum proper**: the specific **Newtonian own-emission reaction** (a body recoiling
from what *it* emits, not just from other bodies' fields) and **first-class mass by rendered area**. A
dynamic body already moves under the field; making it feel the equal-and-opposite of its *own* pushes,
and giving it real inertia, is the next push — and it's the one this note was really about. The
foundation is built; the reciprocity-in-motion payoff is what's left to claim.

---

*The full comparison this grew out of — Fundamental against Reynolds' Boids, with the per-axis verdict
and the explainability-vs-arbitration result — is in the research paper
[Substrate, Not Spectacle: Behavioral Models After Boids](https://github.com/zachshallbetter/fundamental-engine/blob/main/docs/research/31-behavioral-models-after-boids.md).
The **original argument below the update was written 2026-06-29 as a proposal**; momentum *proper*
(own-emission reaction + first-class mass) is still unshipped, and everything framed as "expected
results" remains a hypothesis, not a measurement.*
