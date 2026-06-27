---
title: "Your Design System Already Has Four Forces"
description: "Every interface already runs on four dynamics — importance, polarity, belonging, and change — and Fundamental just makes them explicit and programmable instead of leaving them implied."
summary: "The four Natural Fields aren't new ideas you adopt; they're the relationships your interface already has but never names."
date: 2026-06-26
category: feature
author: "Zach Shallbetter"
draft: false
---

# Your Design System Already Has Four Forces

Open any design system you've shipped. Somewhere in it, four things are happening — whether you
named them or not.

Some elements matter more than others. Some elements oppose each other. Some elements belong
together. And some elements are in the middle of becoming something else. You've been designing
those four dynamics your whole career. You just expressed them as a pile of unrelated tokens —
a font weight here, a color there, a border-radius, a transition — and hoped the user would
reassemble the relationship from the parts.

Fundamental's claim is small and a little uncomfortable: your interface already has four forces.
You've been faking them by hand. The engine just makes them explicit.

## The four you already use

Physics has a compact language for exactly these relationships. Fundamental borrows the language,
not the literal physics, and maps it onto interface meaning. [Four fields](/docs/natural-fields):

**Gravity is importance.** What matters pulls. A primary button, a hero headline, the one number
on the dashboard that decides whether today was good — they all sit at the bottom of a well, and
everything else arranges itself around them. You already build this. You build it with size,
weight, contrast, and whitespace. Gravity is the name for what all of those were trying to say.

**Electromagnetism is polarity and signal.** Difference, opposition, direction. Destructive-red
versus safe-gray. The "from" and the "to" of a flow. A citation pointing back at its source. You
build polarity every time you set up a contrast and direction every time you imply a path through
the page.

**The strong force is belonging.** What holds together. The fields inside one fieldset, the cards
in one cluster, the tag and the thing it tags. You build belonging with proximity, shared borders,
a background that wraps a group. It's the glue that says *these are one thing.*

**The weak force is change.** What's becoming. A row that's saving. A status mid-transition. A
draft decaying toward stale. An item being released or handed off. You build this with spinners,
fades, and "saving…" labels — the visual vocabulary of *not done yet.*

Importance, polarity, belonging, change. Four fields. You have all four on the screen right now.

## What "explicit and programmable" actually means

Here's the part that's easy to miss. The point isn't that Fundamental invents these dynamics. It's
that today they live only in your head and in a scatter of disconnected CSS. The relationship
between the primary button and everything around it isn't *written down anywhere* — it's an
emergent property of six tokens that don't know about each other.

Fundamental gives the relationship a place to live. You declare an element a body in the field:

```html
<button data-body="gravity">Publish</button>
```

Now "this matters" is a fact the runtime holds, not a coincidence of styling. The field computes
the consequences — how this body bends the space around it, how nearby bodies respond — and writes
that state back onto the DOM [as live signals your CSS can read](/docs/field-channels). The importance becomes a value, not
a vibe.

That's the whole reframe. The four dynamics go from *implied by your tokens* to *declared and
computed*, which means they can be measured, inspected, and composed — instead of re-derived by
hand on every screen.

## The discipline that keeps it honest

This is where Fundamental gets pedantic on purpose, and the pedantry is worth understanding because
it's what keeps the system from collapsing into "physics-flavored effects."

**Natural fields are not tokens; tokens are translations.** The four fields are [conceptual](/docs/concepts) — they
describe what's going on. The engine's actual primitives are the translations of those concepts
into runnable verbs. Gravity-the-field is the *idea* of importance; `gravity`-the-token is one
implemented expression of it. The concept describes; the token executes. They never share a word
by accident.

The sharpest example: **`attract` is not gravity.** `attract` is a designed UI well — a verb you
reach for when you want bodies to pull toward a point because that's the effect you want. Gravity
is a *semantic claim* that something is important. They can look identical on screen and mean
completely different things. One is a behavior you chose; the other is a statement about meaning.
Keeping them in separate lanes is what lets you say what you mean instead of just producing motion.

Under the hood this rigor goes further — Fundamental ships 36 forces across nine canonical verbs,
the eight natural-field expressions, and nineteen extended ones, and every one of them carries a
"truth mode" declaring whether it's making a physical claim, a designed one, a diagnostic one, or
a poetic one. You don't need to hold all of that to use the four fields. You just need to know the
system is keeping itself honest about which lane each thing is in, so the meaning never quietly
drifts into decoration.

## The cost, stated plainly

A field is the wrong tool for a lot of interfaces, and pretending otherwise would be exactly the
kind of dishonest design this project exists to replace.

If your screen is a two-field login form, you do not have a relationship problem. You have an email
and a password and a button, and they relate in the one obvious way the layout already shows. Wiring
that to a relational field runtime is over-engineering — you'd be paying for a computation layer to
express a relationship nobody could possibly miss. Use a form. Ship it. Move on.

There's a subtler cost too. The engine faithfully computes all four dynamics and writes them onto
your bodies as live signals every frame — but nothing forces your CSS to actually *read* them. So a
body can be reacting hard, its importance swinging, its belonging shifting, and look completely
inert on screen because no rule downstream consumed the signal. The field isn't broken; it's
[reacting invisibly](/writings/the-silent-contract-gap), which is great until it's the bug you can't see. Making the four forces explicit
also makes them your responsibility to express. Linting catches half of that gap. Discipline catches
the rest.

Where a field earns its keep is the opposite of the login form: interfaces where the relationships
are *already rich and already going unexpressed.* A long document whose sections should know what's
been read. An evidence page where claims point at sources and the support structure is invisible. A
dashboard where urgency should have actual weight instead of just a red badge. In all of those, the
four forces are present and straining against tokens that can't quite carry them. That's the gap
Fundamental fills.

## The frame

The pitch isn't "add physics to your UI." It's quieter and more honest than that. Every interface
already has importance, polarity, belonging, and change. You've been hand-building those four
relationships out of unrelated parts for as long as you've been designing. Physics already has a
clean language for them; Fundamental [translates that language into DOM behavior](/writings/the-interface-is-a-field-not-a-screen) so the relationships
can finally be declared instead of merely implied.

Four fields. Many expressions. One DOM runtime. You already have the forces. The engine just lets
you say so.

## Related reading

- [The Interface is a Field, Not a Screen](/writings/the-interface-is-a-field-not-a-screen) — the full thesis behind making relationships first-class.
- [render: 'none' — The Invisible Field Is the Baseline](/writings/render-none-the-invisible-field) — why the four forces run even when nothing is drawn.
- [The Silent Contract Gap](/writings/the-silent-contract-gap) — the bug class when your CSS never reads the signals the field writes.
- [The Field Translation Runtime](/writings/01-field-translation-runtime) — the flagship paper on translating physics into interface meaning.
- [Fundamental Explained Simply](/writings/fundamental-explained-simply) — the plain-language companion for non-physicists.
- [Natural Fields](/docs/natural-fields) — the canon for the four fields and their token translations.
