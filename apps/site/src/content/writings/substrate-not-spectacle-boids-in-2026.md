---
title: "Substrate, Not Spectacle: Reading Boids in 2026"
description: "Fundamental already flocks — its align, cohesion, and separation forces are named after Reynolds' 1987 rules. But it sums forces where Boids prioritized them, and that one choice is the whole story: it buys explainability and costs robustness."
summary: "What the founding paper of behavioral animation looks like from a field runtime that flocks by accident, sums where Boids arbitrated, and runs the whole model while drawing nothing."
date: 2026-06-29
category: research
author: "Zach Shallbetter"
draft: false
---

# Substrate, Not Spectacle: Reading Boids in 2026

In 1987 Craig Reynolds wrote down how a flock works. Not the flock — the *bird*. Give each simulated
bird a localized view of its neighbors and three small urges — don't collide, match their heading,
stay near the group — and the flock falls out of the interaction. Nobody choreographs it. Reynolds
called this *behavioral animation*, and he described the animator's new job with unusual honesty: you
design behavior, then you are *surprised* by the motion. "These darn boids," he wrote, "seem to have
a mind of their own."

Fundamental is a relational field runtime for the DOM — it lets the elements of a web page become
bodies in an invisible physics field so a page's *meaning* becomes something you can see and inspect.
It sounds nothing like a flock of starlings. But open the source and the resemblance is uncanny: the
force that matches a neighbor's heading is documented, in the code, as "boids alignment." The force
that pulls toward the group is "boids cohesion." The plain-language explainer on the site teaches
emergence with Reynolds' exact three rules and the caption *"Three rules, and it flocks."*

So the obvious question — can this thing do Boids? — has a boring answer. Yes, almost for free. The
interesting question is the one Reynolds' own paper makes possible: it flocks, but is its version
*better*, *worse*, or *something else*? We wrote the long answer as a research paper. This is the
short one.

## It flocks by accident, and that's the tell

Here is what makes the comparison worth writing. Fundamental wasn't built to flock. It was built to
express interface meaning — importance, relation, contradiction, staleness — as forces over semantic
HTML. The flocking is a side effect of having the right primitives lying around: a force that spaces
particles out, a force that aligns their headings, a force that pulls them together, all reading from
a *local* neighborhood. Drop an autonomous agent into the field and it feels all three. A starling
murmuration emerges with no code that says "flock."

That's the same move Reynolds made, and the same one his paper warns is dangerous: emergence is
delightful right up until it looks *wrong*, and then it's a debugging nightmare with no stack trace.
Which is why Fundamental's engineering rule is to *look at* every field change, never trust the green
test. The two systems share a method, not just a vocabulary.

## The one difference that is the whole story

Reynolds' sharpest engineering claim is about how the three urges combine. He is emphatic: do **not**
average them. If "fly north" and "fly east" are both good ideas, "fly northeast" is a bad one —
average two urges pointing opposite ways and they cancel, the bird makes a tiny turn, and flies
straight into the obstacle. His fix is *prioritized allocation*: give each bird a fixed budget of
acceleration and spend it by strict priority, most urgent first. Collision avoidance wins; group
cohesion goes hungry in a crisis. That arbitration is what makes Boids robust.

Fundamental does the thing Reynolds rejected. It **sums**. Every force adds its little nudge to one
velocity, and the result is whatever the vectors total. There is no priority and no budget.

And you can watch it fail in exactly the way he predicted. Pull particles toward a point while a
repulsion pushes them apart, and they don't settle into a tidy ring — they *clump and freeze*,
because the opposing nudges cancel and friction bleeds the leftover to zero. That is "fly northeast,"
rendered as a bug. On this axis, Boids is simply better.

So why does Fundamental sum? Not laziness — it's load-bearing. Because forces add up linearly, the
engine can take any motion and *decompose it*: "this moved 0.61 because of attraction, 0.24 because
of the swirl, 0.15 because of the magnetic field." That per-force explanation is one of the system's
whole reasons for existing — an interface that can show its work. And it exists *only because the
forces sum*. Attribution is just a sum split back into its parts. Adopt Reynolds' arbitration and the
sum is gone, and so is the explanation: in a crisis the low-priority force contributed *zero*, and
"it moved 0.24 because of the swirl" no longer means anything.

This is the part worth sitting with. **The clump bug and the explainability are the same coin.** You
cannot fix the one by importing Reynolds' arbitration without losing the other. (There's a narrow
escape — a force that *scales* its siblings instead of replacing the sum — but that's the paper's
problem, not this essay's.)

## The same lesson, rediscovered: brakes vs. routes

One more echo, because it's a nice one. Reynolds also compared two ways to avoid an obstacle. A radial
"force field" that pushes straight back from the obstacle, he found, is the worse option: a bird
heading right at it just gets *braked*, with no sideways push to actually steer around. "The worst
reaction to an impending collision is to fail to turn."

Fundamental is, structurally, a field of forces — and almost all of its avoidance is radial, the very
thing Reynolds called inferior. But here's the quiet vindication: the project's own fix for clumping,
discovered independently and years later, is to use a *swirl* — a sideways, tangential push — instead
of a stronger radial shove. That's Reynolds' insight, re-derived from scratch. We've since written it
into the canon as a principle: **radial forces brake; tangential forces route.**

## Substrate, not spectacle

Here is where 2026 actually changes the question, and why this is a new paper rather than a history
lesson.

In 1987, the motion *was* the product. A behavioral model existed to make frames of a flock. That was
the whole point — the picture.

Fundamental's default is `render: 'none'`. A field with no render mode runs the *entire* simulation —
every force, every neighbor query, the full reciprocal loop — and draws *nothing*. The motion is one
*representation* of the field's state, chosen above the physics, not the physics itself. A headless
renderer, an accessibility layer that turns density into text, a server pre-computing a layout, an
autonomous agent probing the field for where to go — they all consume the *same* state, with no
animation at all.

Reynolds couldn't have framed a behavioral model this way, because in his world rendering was the
deliverable. In ours it's one surface among several. The behavioral model has become a *computation
substrate* — a running, inspectable state that motion merely visualizes. That shift, from spectacle
to substrate, is the most consequential thing that happens to behavioral animation when you move it
off the screen and into the meaning of an interface.

## So: better, worse, or something else?

Honestly? On arbitration and obstacle-avoidance, Boids is better — and it isn't close on the thing
that matters most: Boids is *validated*. Forty years of films, games, and agreement with real flock
statistics. Fundamental has run zero user studies. Every claim about whether its fields *help anyone*
is, today, a hypothesis. A fair reading keeps that asymmetry in full view.

But Fundamental is more honest about its force laws (it ships both the designed and the natural
versions and refuses to pretend they're the same), it's *reciprocal* where Boids is one-directional
(the field bends the bodies and the bodies bend the field back), and it can *explain itself*, which
Boids never could.

The honest verdict is the third option. Not better, not worse — *something else*: a behavioral model
repurposed from making pictures into carrying meaning, which inherits Boids' rules, declines its
arbitration, and pays the exact price Reynolds named in exchange for something he never reached for.

---

*The full argument — every claim cited to source, the per-axis verdict table, and the
explainability-vs-arbitration result stated formally — is in the research paper
[Substrate, Not Spectacle: Behavioral Models After Boids](https://github.com/zachshallbetter/fundamental-engine/blob/main/docs/research/31-behavioral-models-after-boids.md)
(Paper 31 of the Fundamental research family).*
