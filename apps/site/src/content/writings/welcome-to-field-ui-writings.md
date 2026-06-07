---
title: "Welcome to field-ui writings"
description: "A home for what we are building and thinking about — features, releases, and research — written in markdown."
summary: "What this section is, and a quick tour of how it renders diagrams, math, and code."
date: 2026-06-07
category: note
author: "Zach Shallbetter"
---

# Welcome to field-ui writings

This is **writings** — where we discuss what we are building and thinking about: new **features**,
**releases**, and longer-form **research**. Everything here is plain markdown in a content datastore,
so a new piece is one file. The first things going in are the [research papers](/writings) on the
ideas behind field-ui.

It renders three things well, on purpose.

## Diagrams (Mermaid)

The frame scheduler runs six ordered phases so reads never thrash against writes:

```mermaid
flowchart LR
  discover --> read --> compute --> state --> write --> render
  render -. next frame .-> discover
  classDef phase fill:#0b1020,stroke:#4da3ff,color:#dfe8ff;
  class discover,read,compute,state,write,render phase
```

## Math (LaTeX)

A *body* radiates structure that is separate from the force it applies. Gravity, for instance, is a
softened inverse-square field — finite at the core, real $1/d^2$ far out:

$$
g = -\,\frac{G\,M\,\hat{r}}{d^2 + \varepsilon^2}, \qquad F = m\,g
$$

and reading leaves a decaying memory, $M(x, y, t{+}\Delta t) = M(x, y, t)\cdot\text{decay} + \text{deposit}$.

## Code (editor-grade highlighting)

Marking an element as a body is one attribute — the same markup works in plain HTML, React, Svelte, or
Astro:

```ts
import { FieldField } from '@field-ui/react';

export function Headline() {
  // density returns to the element through --field-density; CSS reads it back
  return (
    <FieldField density={1}>
      <h1 data-body="attract" data-strength={1.2} data-feedback>
        Mass
      </h1>
    </FieldField>
  );
}
```

That's the whole idea of this section: write it in markdown, and the diagrams, math, and code come out
legible. Start with the [research](/writings).
