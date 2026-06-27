---
title: "The Silent Contract Gap — Bugs That Don't Throw"
description: "The engine writes a body's feedback channels every frame, but nothing makes a CSS rule read them — so a body can react hard and look completely dead, and nothing errors."
summary: "A whole bug class on CSS custom properties: faithful writes, no enforced reader, zero exceptions — and the discipline that closes the loop."
date: 2026-06-26
category: feature
author: "Zach Shallbetter"
draft: false
---

# The Silent Contract Gap — Bugs That Don't Throw

Most bugs announce themselves. A `null` dereferences. A promise rejects. A type check goes red.
The system has an opinion about correctness and it tells you when you've violated it.

This is not that kind of bug. This is a bug where every line of code does exactly what it was
written to do, every value is correct, nothing throws — and the feature is still broken on screen.

It comes from a contract that has a writer, a reader, and no enforcement that the two ever meet.

## The shape of it

Fundamental's feedback loop runs across two languages. The engine — TypeScript — computes a body's
state and writes it onto the element as [CSS custom properties](/docs/field-channels): `--load`, `--d`, `--field-density`,
`--field-attention`, and the rest. CSS — a different language, owned by a different file, often a
different person — reads those properties and turns them into something you can see.

```css
/* the reader. the engine writes --field-density; this turns it into a glow. */
.hero-mass {
  box-shadow: 0 0 calc(var(--field-density, 0) * 40px) rgba(120, 180, 255, 0.5);
}
```

The handoff is a string. The engine sets a property whose name it chose; the stylesheet reads a
property whose name it chose; they agree only by convention. CSS custom properties are designed to
fail soft — read a variable nobody set and you don't get an error, you get the fallback. `var(--d,
0)` is `0`. The cascade shrugs and moves on.

That soft failure is the whole problem. The contract has no compiler. Misspell the variable, forget
the rule entirely, scope it to the wrong selector, and the only signal is the absence of motion —
which looks identical to "the physics isn't firing."

## What it looks like when it bites

A body is marked `data-feedback`. The engine measures it, resolves its forces, and writes its
channels every frame. Open devtools and the custom properties are *right there on the element*,
swinging frame to frame. The density is climbing. The attention is spiking.

And the button looks completely inert.

Not subtly wrong — dead. So you go hunting in the wrong place. You instrument the force solver. You
check that the body registered. You log `particleCount()`. Everything is healthy, because everything
*is* healthy. The engine is doing its job perfectly and writing the answer to a channel no rule
reads. The field isn't broken. It's reacting invisibly — which, if you squint, is exactly what
[`render: 'none'`](/writings/render-none-the-invisible-field) promises. You just didn't mean it here.

This exact gap shipped more than once. It hit `.btn`. It hit `.hero-mass`. It was the original sin
behind the `data-feedback` lint rule. A body that declared it wanted feedback, got feedback, and
showed nothing — because the consumer half of the contract was never written.

## Why signals-first makes it *more* likely

The engine default is [`render: 'none'`](/writings/render-none-the-invisible-field). A field runs the full simulation and draws nothing unless
you opt into pixels. That's the right default — but it removes the one thing that used to catch this
class of bug for free.

In a visible-first system, the drawing *is* the feedback. If the particles move, the field works; if
they don't, you see that instantly. The canvas is an always-on integration test for "are the signals
flowing." Turn the canvas off and you lose that witness. The signals still flow — into channels that
may have no reader, with no pixels anywhere to reveal the gap.

So the cost of invisible-first isn't abstract. It's this: you traded automatic legibility for
portability and calm, and the bill comes due as silent contract gaps. The more of your field is
signals-only, the more carefully you have to verify that someone, somewhere, is actually consuming
each channel you care about.

## What the linter can and can't do

`lintPlatform` ships rules aimed squarely at this gap, from both directions. They live in
`packages/dom/src/lint.ts`.

The easy half is the **producer** side — a body that styles itself from a feedback var it never
opted into. `lintFeedbackVarReads` walks every `[data-body]` whose inline style reads `var(--d…)`,
`var(--load…)`, or `var(--field-…)` but carries no `data-feedback`: it's reading a channel that will
never be written for it. That's a pure function over the DOM. It's cheap, it's exact, it can't
false-positive.

The hard half is the **consumer** side — the body in the story above: it *has* `data-feedback`, the
engine *is* writing, and no rule reads it. `lintFeedbackWritesUnread` goes after exactly that. But
look at what it has to do:

```ts
// collect the selectors of rules that read a feedback var — the consumer side.
for (const sheet of Array.from(document.styleSheets)) {
  let rules; try { rules = sheet.cssRules; } catch { continue; } // cross-origin → unreadable, skip
  for (const rule of Array.from(rules ?? [])) {
    const r = rule as CSSStyleRule;
    if (r.selectorText && FEEDBACK_VAR_READS.some((v) => r.cssText.includes(v)))
      consumerSelectors.push(r.selectorText);
  }
}
```

To prove a written channel is *unread*, the linter has to enumerate every stylesheet, find every
rule that reads a feedback var, strip pseudo-classes off the selectors, and test whether each
`data-feedback` body matches one. That only works in a browser with same-origin, readable
stylesheets. Under SSR, in a test runner, behind a cross-origin sheet — `document.styleSheets` is
empty or `cssRules` throws, and the rule no-ops.

Which means the consumer-side rule is, by construction, **allowed to under-report and forbidden to
false-positive.** It would rather miss a real gap than flag a working body. That's the right call for
a linter you leave on — but it's also an admission. The producer half is a theorem. The consumer half
is a best-effort heuristic that goes quiet exactly where you build and test, and only speaks up in a
live browser with cooperative stylesheets. The hard half is hard because *proving a negative across
two languages and a string handoff is not something a pure function gets to do.*

## The cost, stated plainly

There is no version of this contract that the type system closes. The writer is TypeScript, the
reader is CSS, and the wire between them is a property name that neither side can verify the other
honors. The custom-property cascade's greatest feature — fail soft, never throw — is precisely what
makes the gap silent. You can have a perfectly correct engine, a perfectly correct stylesheet, and a
broken feature, with nothing red anywhere.

The linter catches the producer side cleanly and takes a real, honest swing at the consumer side. It
does not — cannot — guarantee the consumer side. So the last line of defense isn't a tool. It's a
habit:

**When a body is supposed to visibly react, confirm the CSS actually reads the var.** Not "the
engine writes it" — you can see that in devtools and it tells you nothing about whether anyone's
listening. Open the computed style of the thing that should move. Find the rule. Watch the value it
consumes change as the body changes — this is what the [diagnostics](/docs/diagnostics) and [inspector](/docs/inspector)
surfaces are for: they make the invisible reaction legible. If you can't point at the reader, you
don't have a feature; you have a channel broadcasting to no one.

This is the price of building reactive systems on CSS custom properties — anywhere, not just here.
The variable is a shared name with no schema, no import, no compiler keeping the two ends in sync. It
will let you ship a writer with no reader, forever, without a single error. The discipline is to
treat every channel as a contract with two signatures, and to never count one side as done until
you've seen the other side sign.

The engine doesn't throw when the loop is open. That's exactly why you have to close it yourself.
The deeper bet — that [the interface is a field, not a screen](/writings/the-interface-is-a-field-not-a-screen) —
only pays off when every channel you broadcast has someone reading it back.

## Related reading

- [render: 'none' — The Invisible Field Is the Baseline](/writings/render-none-the-invisible-field) — the default that removes the canvas witness and makes this gap more likely.
- [The Interface is a Field, Not a Screen](/writings/the-interface-is-a-field-not-a-screen) — the reciprocal-DOM thesis these channels serve.
- [Explainable Interface Behavior](/writings/08-explainable-interface-behavior) — the diagnostics paper: how a field accounts for what it's doing.
- [Field channels reference](/docs/field-channels) — the `--field-*` / `--load` / `--d` channels, named and specified.
- [Diagnostics](/docs/diagnostics) and [Inspector](/docs/inspector) — the surfaces that make an invisible reaction visible.
