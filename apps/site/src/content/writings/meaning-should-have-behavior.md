---
title: "Meaning Should Have Behavior"
description: "Interfaces let anything claim importance because claims are free. The argument for making meaning exert consequences — conservation as the law, receipts as the proof."
summary: "The synthesis piece: why display-only meaning inflates until it lies, what a conservation law does about it, and where accountable behavior — receipts, not screenshots — goes next."
date: 2026-07-02
category: note
author: "Zach Shallbetter"
---

# Meaning Should Have Behavior

Look at how software represents meaning. Priority is a number in a column. Trust is a badge.
Recency is a timestamp. Relationship is a link. Risk is a color. Confidence is a tooltip.

Every one of those is a *claim*. The task claims to be urgent. The source claims to be
authoritative. The answer claims to be confident. And in almost every interface ever shipped, the
claim is free: it costs the system nothing to make, nothing arbitrates it, and nothing follows
from it. The red chip does not behave differently from the gray one. It just sits there, red.

That would be fine if claims stayed scarce. They don't. Every team wants its feature noticed,
every alert wants to be seen, every dashboard tile argues for itself — and because emphasis is
free, everything gets some. The interface ends up shouting at uniform volume, which is
indistinguishable from silence. This is not a styling problem. It is an honesty problem:

**Interfaces lie when everything can be emphasized at once.**

## The conservation argument

The fix is not better discipline. Discipline is what we have now, and inflation is the result.
The fix is a mechanism — a law the interface physically cannot break.

Fundamental's homepage states it as: *you can label everything urgent; you cannot make everything
heavy.* In a field, importance is expressed as mass, and mass has consequences — it bends the
shared medium that every other participant lives in. When one body becomes heavier, the field
around everything else changes. Emphasis stops being a per-element property you stack without
limit and becomes a relationship with everything on the page.

The engine's conserved-attention mode is the sharpest form of this, and it's worth being precise
about what it does. When a field runs with attention enabled, redistribution is exact: the total
is normalized every frame, so a boost to one body *is* the starvation of the others — not as a
metaphor, as arithmetic. The [inbox proof](/) runs on it: pin one ask and the rest yield, and the
weights sum to what they summed to before. It is an opt-in mode, not a global default — a field
you create without it has no attention pool at all — but where it runs, the law holds by
mechanism, not by code review.

The same shape shows up in how the engine treats [reduced motion](/docs/accessibility): under
`prefers-reduced-motion` the simulation freezes, so ambient motion stops — but the feedback
signals stay live for direct engagement. Motion is spent; meaning is not. Reduced motion removes
motion, not meaning, and the engine enforces the difference rather than asking every stylesheet to
remember it.

And it's honest to say how far this extends today: the policy surface declares eight budgets —
attention, force, thermal, render, accessibility among them — and enforces two (motion and
privacy). The rest are declared, not yet law. That gradient, *declared → enforced*, is the whole
program in miniature. A budget you declare is a promise. A budget the engine enforces is a
conservation law. The direction of travel is from the first to the second, one budget at a time.

## Behavior invites the question: prove it

Once meaning has consequences, someone will reasonably ask the interface to show its work. Why is
this card heavy? What is pulling attention right now? What changed since I last looked, and what
caused it?

Ordinary interfaces cannot answer these questions, because the answer was never represented — the
emphasis was hand-assigned in a stylesheet three files away. A field substrate can, because the
causes *are* the state. The [read API](/docs/api/handle) — still labeled experimental, but shipped
and running on every plane — answers each one directly: `query()` returns what is acting at a
point, including per-force attribution. `snapshot()` captures what the field was *doing*, not what
it looked like. `diff()` compares two of those. `replay()` turns the difference into an ordered
sequence of causes with plain-language descriptions — *this relationship strengthened, this body's
density rose, this force engaged.*

There is a discipline underneath this that matters more than the API: the causality ladder.
An explanation may be Observed, Attributed, Explained, Replayed, or Predicted — and the rule is
that you quote the highest level your data supports, *and no higher*. An attribution is a faithful
record of what the accumulator summed, not a physical proof of cause. An explainability layer that
overclaims is worse than none at all: it's the interface lying in a new register, with more
authority than a red badge ever had.

## Receipts, not screenshots

Which points at where this goes. A screenshot shows what the interface looked like. It cannot show
what the interface *meant* — what was influencing what, what was hidden by policy, what an agent
was allowed to read, why this element behaved the way it did.

The [plain-language explainer](/eli5) already uses the right word for this: *receipts, not a
mystery box.* Take that word seriously as a design target and you get something like a **field
receipt**: a compact, serializable explanation attached to any body — its signals, the influences
acting on it, the relationships it participates in, the projection that made its state visible,
the policy that redacted what an agent couldn't see, and the causal steps that got it here. Click
the heavy claim in an AI answer and ask *why*; the receipt says: confidence high, three supporting
sources, one of them aging, contradiction low, reviewer notes hidden from this profile.

To be plain about status: receipts are a direction, not a shipped API. Most of the ingredients
exist — identity, readings, attribution, snapshots, diff, replay, projections, redaction profiles
are all in the substrate today. What doesn't exist yet is the assembly, and one genuinely dark
lane: the engine faithfully records everything it *writes*, but nothing yet records who *reads*
it. That lane has a name here — [the silent contract gap](/writings/the-silent-contract-gap) — and
it is the difference between a receipt that ends at "the field wrote density 0.72" and one that
can finish the sentence: "…and this is the rule that turned it into the glow you're looking at." A
receipt is only as trustworthy as its dimmest lane. Closing that lane is the work.

## The one-sentence version

Fundamental turns the meaning inside software into behavior the interface can show, measure, and
explain.

Most interfaces display what matters and hope you notice. The argument of this whole project is
that display is not enough: importance should cost something, relationships should hold, staleness
should decay, confidence should carry its own uncertainty — and when the interface acts on any of
that, it should be able to hand you the receipt.

*Related: [Conserved Attention in Interface Systems](/writings/10-conserved-attention-interface-systems)
formalizes the attention budget; [Explainable Interface Behavior](/writings/08-explainable-interface-behavior)
and [Runtime-Inspectable Interfaces](/writings/13-runtime-inspectable-interfaces) develop the
diagnostics; [AI Interfaces Should Show Support, Not Sources](/writings/29-ai-interfaces-show-support-not-sources)
applies it to model output. The live substrate readout is on the [demo](/demo).*
