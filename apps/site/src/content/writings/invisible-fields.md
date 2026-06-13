---
title: "The invisible fields"
description: "Twelve ordinary page types run as fields over real data — no particle swarm; the measurement comes back as type, ink, and anchor."
summary: "Twelve real-data examples where the field never shows a particle — what they are, why the data is honest, and what they taught me."
date: 2026-06-10
category: feature
author: "Zach Shallbetter"
---

# The invisible fields

The homepage makes a spectacle of the field — particles drifting behind the manual, gathering on
whatever you engage. It earns that spectacle: it's the page that teaches the physics. But it also
sets a trap. If the first thing you see is a swarm, it's reasonable to conclude that the swarm *is*
the product, and that turning it off turns the product off.

So I built twelve pages where the field never shows a particle.

They live at [/evidence](/evidence) and its siblings — an inbox, a market, a backlog, a calendar, a
comment thread, a dependency graph, a fleet dashboard, a catalog, a library, a memory deck, a front
page. Ordinary page types, each over real data. On every one of them the field runs exactly as it
does on the homepage — bodies, strengths, relationships, the recipe pipeline — but the only output
channels are **type, ink, and anchor**: font weight and optical size, how dark the text sits, how
hard a border or a bar leans into its accent. The field is a substrate, not wallpaper. Take away
the wallpaper and the substrate is what's left.

## The data is honest, and says so

Each page ships a **committed snapshot** — a JSON file checked into the repo, rendered into the
HTML at build time. That snapshot is the no-JS truth: with scripts off, you still get the full
page, weighted and ranked, because the weights were computed at build. In the browser, the page
then upgrades itself to current data when the source is reachable — and **says which mode it's
in**, with a little status chip that flips from `snapshot` to live. Counts that moved carry a
quiet "+N since snapshot" delta, and the new numbers re-settle through the same weighting math
that built the page.

How often a page asks is part of the honesty. The evidence page asks OpenAlex **once per visit**,
because citation counts move slowly — polling them would be theater. The newsroom checks for a
newer Wikipedia pageviews edition once, because the API publishes each finished day exactly once.
The market re-polls CoinGecko every minute, because markets actually move. The cadence matches the
source instead of performing liveness.

## Four of the twelve

**The inbox** treats attention as a conserved budget. The asks are real unanswered `[javascript]`
questions from Stack Overflow, and the page holds a fixed attention total split across them by
urgency. Because the total is fixed, brightening one ask literally dims the rest — pin one and it
moves to a focus pane holding a full unit, while you watch the stream fade by exactly that much.

**The market** runs a CoinGecko snapshot as a mosaic where mass is *area*: market cap decides how
much page an asset takes, and the day's move polarizes — direction is color, magnitude is
intensity. Toggle the field off and it collapses to a uniform grid, every asset the same size, the
same ink.

**The backlog** is the repo measuring itself: Fundamental's own issues and pull requests, with
activity as mass and references threading each item to the work it builds on. The cards drag —
hand-rolled pointer events, no library — but the page is explicit that it's a local triage
sandbox: the arrangement saves to `localStorage`, and GitHub is never written.

**The newsroom** shapes one day of English Wikipedia's most-read articles into a front page —
pageviews as weight and placement, the day-over-day swing as temperature. While I was building it,
it found a newer pageviews day on load and advanced itself an edition: same shaping rules, same
markup, same field, new dateline.

## What they taught me

The recurring lesson: **the field doesn't care about the layout; it measures whatever geometry you
give it.** A ranked list, a tiled mosaic, a two-lane board, a newspaper front page — the engine
never knew the difference. Each page hands it boxes and strengths; it hands back densities and
metrics; CSS decides what the measurement looks like. The trust math from the evidence page
retargeted at a product shelf is the catalog; retargeted at attention, it's the newsroom. Same
substrate, different geometry.

The twelve:

- [Evidence](/evidence) — citations are mass; trust you can feel in the type
- [Inbox](/evidence/inbox) — attention as one conserved budget
- [Market](/evidence/market) — market cap as area; the day's move polarizes
- [Backlog](/evidence/backlog) — the repo measuring itself
- [Calendar](/evidence/calendar) — imminence ramps the weight in real time
- [Threads](/evidence/threads) — votes are mass; reply chains bind and heat
- [Dependencies](/evidence/dependencies) — downloads are mass; one advisory charges the graph
- [Fleet](/evidence/fleet) — services carry traffic; incidents accrete
- [Catalog](/evidence/catalog) — review consensus, retargeted at a shelf
- [Library](/evidence/library) — listens are mass; the queue accretes and releases
- [Memory](/evidence/memory) — the forgetting curve as decay
- [Newsroom](/evidence/newsroom) — pageviews are mass; the cycle polarizes
