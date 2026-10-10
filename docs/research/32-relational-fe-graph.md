# Relational Field Reading over a Household Evidence Graph: Who, What, Where, When and Why, per Viewer

> **Status: research draft (preprint, work in progress).** Paper 32 of the Fundamental family, an
> applied paper: the Fundamental kernels used outside the DOM, as a reading layer over a household
> evidence graph. Every claim was checked against the implementation at titan-node `90cd6af4`
> (2026-10-10), and every number is from that code, with its test named. The implementation is in a
> private household system (titan-node); the kernels it reads with are public
> (`@fundamental-engine/core`). See the [series index](README.md) and *the caveat canon* therein.
> This is a preprint draft, not canonical product documentation; where the code and a claim
> disagree, the code wins.

**Author:** Zach Shallbetter
**Series:** Fundamental Research Papers, Paper 32 (applied)
**Companion papers:** [Data as Field Participants](07-data-as-field-participants.md) (records as
bodies), [Evidence Graphs and AI Trust Calibration](12-evidence-graphs-ai-trust-calibration.md)
(provenance and support), and [Interface Memory](24-interface-memory.md) (decay over world time).

## Abstract

A household assistant holds a family's mail, texts, calendars, notes, bills, places and tasks. A
question such as "what are we doing Saturday, and who's coming?" needs an answer assembled across those
sources, for the person who asked, with the reasons shown. Retrieval over items returns passages, not
answers. It also can't tell which passages the asker may see once facts are derived and combined.

We describe a **relational field graph**, which has four parts:
- **A projection, not a new store:** one graph built over the assistant's existing stores, in which
  every edge carries its sources, an epistemic state, a causality rung and a templated reason.
- **Field reading:** Fundamental's world-time kernels rank what matters now: today, freshness,
  imminence and a top-*k*. Retention, relationship strength and pressure are ported but not yet
  applied.
- **Answering:** a deterministic resolver fills who/what/where/when/why slots and returns `unknown` or
  `contested` rather than a guess.
- **Read-time visibility:** every node and edge is checked for each viewer, through audience, sharing
  overrides and fences, with an edge's sources checked as well.

**The claim:** privacy holds by construction, and answer accuracy is governed by anchoring and by the
data the graph holds, not by the model.
- On a fictional household's 41 tuned questions, the resolver answers 32, with **0 leaks** across every
  viewer (admin, adult, kid, shared screen).
- On 17 held-out questions written without access to the resolver's rules, it answers 11, again with
  **0 leaks**.
- The 9 tuned misses are data the graph doesn't yet hold, not rule errors.

## 1. Introduction

### 1.1 Problem

The system this comes from missed two things on one day.
- **A plan agreed in texts.** A proposal, an agreement, a place, and who was coming: two adults and
  their kids. No single item held all of it, so nothing proposed an event or a departure time.
- **A meeting.** It produced decisions, and afterwards nothing could say what was decided or who agreed.

Both needed facts joined across sources (people, a place, a time, a commitment) and answered for one
person in particular. The data was all present. What was missing was the **relation**.

### 1.2 Answer

Relate everything once, in code, as a typed graph whose edges remember why they exist. Read it per
viewer, so visibility is decided at the moment of reading and never baked into a stored answer. Rank it
with Fundamental's world-time kernels, so recent and imminent things come first. Fill named slots
deterministically, so a missing fact is reported as missing.

### 1.3 Contributions

1. **A projection design:** an evidence graph over heterogeneous, individually-owned stores that stores
   only viewer-independent rows. Anything that depends on the viewer (threads, obligation state, fences)
   is computed at read time, so one viewer's view can't leak into another's (§4).
2. **An edge model** with two planes (typed or measured), four states (verified, accepted, candidate,
   rejected), a causality rung, supplied confidence, provenance and a templated reason (§4.2).
3. **Visibility with source checking:** an edge is visible only when both ends **and every source**
   pass the viewer's audience, sharing overrides and fences. That closes a derived-fact leak that
   checking the endpoints alone allows (§6).
4. **Fundamental's kernels, ported to a non-DOM host:** freshness, imminence, retention, relationship
   dynamics, pressure and conserved attention, held to the original by golden vectors. Freshness and
   imminence already rank answers (§5.1).
5. **A measured evaluation** that separates privacy (which generalises by construction) from anchoring
   (which doesn't yet), using a held-out set written blind (§7).

## 2. Background

- **Retrieval-augmented answering** returns ranked passages. Scores near 0.45 separate relevant from
  irrelevant poorly in this system's own logs, and a stale fact can outrank a fresh one.
- **Knowledge graphs** give structure, but typically one global view and no per-viewer reading.
- **Fundamental** (the series flagship) models relations as bodies in a field: influence, density,
  memory and decay, read out as metrics. Its headless host already accepts records rather than DOM
  elements (Paper 7).

This work keeps Fundamental's *reading* (world-time kernels, relationship dynamics and the causality
ladder) and drops its *simulation*. No particles are integrated: a household graph of about 10³ nodes
needs ranking, not motion.

## 3. Setting

The deployment is one household of five people, two of them kids, on one home server and the members'
devices. Each item has an **owner** and an **audience** (private, adults, household, or a list of
people). **Fences** hide specific items or attributes from named people even within their audience. A
**sharing override** table wins over source metadata. Kids and shared screens see household items only,
and never edges between two other people.

## 4. Model

### 4.1 Nodes

The node kinds are person, org, place, item, event, obligation and scenario. Each node keeps its store's
id. Events (`event:<item>`, `event:ep-<sig>`), obligations (`obligation:<account>:<cycle>`) and world
entities (`<bubble>:<entity>`) are namespaced, and the others keep their native ids. A **cross-walk**
maps every store's native id to its node (`scripts/graph_sync.py`). Fusion makes one node from several
records of the same thing, in code, and never by name alone:
- **People:** a world person fuses into a household member only through its `person_id`.
- **Organisations:** an org in a person's private bubble fuses into a household org only with a shared
  alias **and** a shared hard key (a domain, phone, email or address).
- **Addresses:** keyed member addresses *resolve* an edge's end to a member; they don't fuse nodes.
- **Places** come from a registry of named places, with no coordinates.
- **Events aren't fused:** a calendar event and a plan proposal stay separate nodes (§8).

The first live build (node code only, 2026-10-10 04:59Z) holds:

| Kind | Count |
|---|---|
| person | 5 |
| org | 15 |
| place | 0 (the registry is empty until it's seeded) |
| item | 746 |
| event | 168 |
| obligation | 22 |
| scenario | 1 |

Its cross-walk has 1,006 rows. A dry run of the edge code over the same stores gave 141 edges in all
states; live edges arrive with the next deploy. A full dry run of the nodes takes 0.23 s.

### 4.2 Edges

An edge is

$$e = (a,\ \tau,\ b,\ \text{plane},\ \text{state},\ \text{rung},\ c,\ t_{from},\ t_{to},\ \text{owner},\ \text{audience},\ \text{why},\ P)$$

- $\tau$ is a typed relation (`graph_edges.TYPES`): `from`, `to`, `mentions`, `about`, `replies_to`,
  `attends`, `organises`, `at`, `located_at`, `member_of`, `parent_of`, `knows`, `sees`, `depends_on`,
  `related`, `decided`. Paid and owed aren't stored edges (they're read-time obligation state), and
  merges aren't edges (§4.3).
- **plane** separates *typed* edges, declared by data (a header, an attendee list), from *measured*
  ones, inferred by a linker. They're scored apart, and a measured edge never upgrades itself.
- **state** is verified, accepted, candidate or rejected. A person's statement ("not related") outranks
  the linker and is kept, so a rejected edge never returns.
- **rung** is Fundamental's causality ladder: observed, attributed, explained or predicted. An answer
  reports its weakest rung.
- $c$ is **supplied** confidence, set per producer:
  - 1.0 for an exact match;
  - 0.8 for a world claim or a mention;
  - 0.5 for a name-only attendee;
  - a proposal's own confidence;
  - for a linker edge, mapped from its state: verified 1, accepted 0.7, candidate 0.3, rejected 0.
  As in Fundamental, the engine never computes confidence from evidence
  (`packages/dom/src/metrics.ts`).
- $P$ is the provenance list: (source, ref, extractor, observed\_at, owner, audience, item, fence).

### 4.3 What is stored

`graph.db` holds nodes, the cross-walk, edges with their provenance, `fused` (merges, told on read
only to the merged record's owner) and `meta` (hash, counts, build time): **viewer-independent rows
only**.
- **Read time:** these are computed when read, because each depends on what the viewer can see:
  - threads (connected components of strong edges);
  - obligation state (open or paid; "overdue" is a reading of the bill lens, not a stored state);
  - an item's link to its obligation;
  - paid and owed.
- **Kept stores:** people's decisions ("same", "not related", a confirmed place) live in stores the
  household reset keeps. The graph only reads them, so wiping the graph loses nothing.
- **Incremental update:** the projection builds in memory and is written only when its content digest
  differs from the stored one. That makes it identical to a full rebuild by construction
  (`graph_sync --since`). A fence or a person's statement about a bill changes no graph row, so nothing
  is written, yet the answer changes at once, because both are applied at read time
  (`scripts/test_graph_since.py`).

## 5. Answering

`situation(query, viewer, role)` (`scripts/situation.py`) runs four steps.

1. **Anchor.** Mentions in the query are resolved to nodes in code:
   - names, first names and aliases;
   - "I/me" as the viewer, and family words ("my kids", "my parents");
   - place kinds;
   - a private record's name merged into a node (told only to its owner);
   - time phrases in the household's zone.
2. **Expand.** A breadth-first walk from the anchors over the viewer's visible subgraph takes typed
   edges first, then accepted measured edges. It stops at depth 3 or a budget of 60 nodes. Candidate
   edges are never used.
3. **Read the field.** The candidates are every visible event, obligation, scenario or dated item.
   Reachability from the anchors weights them: an unreached candidate's score is halved when the query
   has anchors. Each candidate is scored as relevance (anchors touched, content words matched, the time
   window) × timing, and the top-*k* (3) is kept (§5.1). Some question shapes have direct readers before
   this generic path: bills, decisions, relations (same, parents, "related"), tasks, current location and
   "who is".
4. **Fill the slots.**
   - **who** comes from `attends`, from `organises` (when the question asks who set something up, or
     there are no attendees), from `parent_of` (for a parents question), from the merged record
     (`same_as`), from an item's `from` org, or is the viewer ("what am I on the hook for").
   - **what** is the event, obligation or decision.
   - **where** comes from `at` and `located_at`, resolved to a place. Otherwise it's the event's own
     location text, or a place named in an item's summary.
   - **when** is the household-zone time: an event's start, an obligation's due date, or a place event's
     time.
   - **why** is the chain of edges, each with its rung.
   - A slot with no supported value is `unknown`.
   - `contested` is implemented for one attribute so far, an event's start time. It applies when two
     supported values disagree, lists both chains, and only ever asks.

### 5.1 Field kernels

These are ported from Fundamental's TypeScript (`packages/core/src/engine/temporal.ts`,
`agents/relationship.ts`, `packages/dom/src/metrics.ts`). The Python port (`scripts/fe_reading.py`)
is held to **163 golden vectors and a 7-step relationship history generated by Fundamental's own built
core**, to $10^{-12}$ (`scripts/test_fe_reading.py`).

$$\text{freshness}(t) = 2^{-\Delta t / h}$$

$$\text{imminence}(t) = 1 - \frac{\ln(u/H + 1)}{\ln(\text{horizon}/H + 1)}$$

$$\text{retention}(a, t) = a\, e^{-t/\tau(a)},\quad \tau(a) = 4 + 56a \text{ days}$$

$$\text{entropy} = r_c + \tfrac12 (1 - r_r),\qquad \text{pressure} = 0.6\,\text{entropy} + 0.4\,(1-\text{recency})$$

$$d_i = N\, \frac{m_i}{\sum_j m_j} \quad\text{(conserved attention)}$$

**What `situation()` applies today:**
- imminence, with a 14-day horizon;
- freshness, with a 7-day half-life;
- top-*k*.

The timing factor is $0.5 + 0.5\cdot\max(\text{imminence}, \text{freshness})$. **Ported and tested,
but not yet applied:** retention, relationship strength and pressure, which would keep recurring
relations warm and lift contested or stale-but-open nodes.

## 6. Privacy

An edge is visible to viewer $v$ iff

$$\text{vis}_v(a) \wedge \text{vis}_v(b) \wedge \forall p \in P:\ \text{vis}_v(p) \;\wedge\; \neg(\text{role}_v \in \{\text{kid},\text{screen}\} \wedge \text{kind}(a)=\text{kind}(b)=\text{person} \wedge v \notin \{a,b\})$$

$\text{vis}_v$ of a source $p$ means all of these:
- $p$ passes the audience rule on its own owner and audience;
- if $p$ belongs to an item that is a node, that item is among the viewer's visible nodes (audience
  with the sharing override, then fences);
- if $p$ belongs to an item that isn't a node, the item passes the fences;
- a world claim's source passes the fences for its attribute's classes, its entity and its subject.

**Source checking is the substantive part.** Checking only the two endpoints leaks derived facts. Two
examples from review:
- **A fenced source.** In a test case, an edge "Ava sees Summit Dental" is built by hand with its only
  source a health note fenced from one adult. (The extractor makes `sees` from world claims, not
  notes.) Both endpoints are visible to that adult, and only checking the source hides the edge.
- **No sources.** An edge with no sources would pass a vacuous "all sources visible" check, so such
  edges are refused at write and never shown.

Both cases are tests (`scripts/test_graph_sync.py`); disabling either check fails its test.

**Place events** (a person arrived or left somewhere) produce `located_at` edges carrying the person's
own audience: the person alone, plus their parents when the person is a kid. They never carry the
place's household audience.

## 7. Evaluation

### 7.1 The household and question sets

The evaluation household is fictional throughout (`scripts/graph_golden/household.json`). It has five
people, six organisations (one of them a private alias that fuses), places, 23 items across mail,
texts, calendars, a meeting, notes and bills, 3 meeting-decision items, and 69 expected edges, plus
hooks, links, statements, fences and a scenario. Its traps:
- two people who share a name, one of whom must never surface for the other's viewer;
- a merge by alias plus hard key;
- a contested appointment time;
- a fenced health note;
- a surprise visible to one adult only.

There are two question sets:
- **Tuned:** 41 who/what/where/when/why questions, asked as each viewer (`5w.json`). The resolver's
  rules were developed against these.
- **Held-out:** 17 questions written by a different author **without seeing the rules**
  (`5w_holdout.json`). They're reported only in aggregate, so they can't be tuned against.

Leaks (any id or string in a case's `lacks` list appearing anywhere in the answer bundle) are hard
failures on both sets. Two more checks are hard failures too:
- a property check asserts that no bundle names a node its viewer can't see;
- 6 privacy probes outside the 41, in which a viewer names something they can't see, must each resolve
  to nothing.

### 7.2 Results

Measured on the real projection, with graph\_sync building from the fixture loaded into the system's
own stores (`scripts/test_situation.py`, at titan-node `bfebfdf5`):

| Set | Cases | Checks | Leaks |
|---|---|---|---|
| Tuned | 32/41 | 84/102 | **0** |
| Held-out | 11/17 | 19/28 | **0** |

The tuned set's 9 misses are all data the graph doesn't hold yet, rather than resolver errors:
- **5 need text bodies**, which by design stay on the owner's device;
- **2 need meeting dates as events;**
- **2 need note text at answer time.**

The held-out results by slot:

| Slot | Passed |
|---|---|
| lacks (privacy) | 6/6 |
| via | 4/5 |
| what | 4/6 |
| when | 3/5 |
| where | 2/4 |
| who | 0/2 |

### 7.3 What this shows

1. **Privacy generalises; anchoring doesn't, yet.** Zero leaks held on phrasings the rules never saw,
   because visibility is decided by the subgraph, not by the resolver. Answer accuracy dropped from
   78% to 65% held-out (checks: 82% to 68%), because anchoring is rule-based and was tuned on the first
   set.
2. **Unknown is a real answer.** On the tuned set, the resolver says it doesn't know where an adult is
   now when there's no place event, even though their home is a visible `located_at` edge. Only a place
   event answers "where is X now".
3. **The model isn't in the loop.** Every number above comes from code alone. A language model only
   narrates the bundle afterwards, which is evaluated separately: the live A/B (§8.3) needs judges.

## 8. Limitations

1. **One household.** All results are on a single fictional household of five. Real households differ
   in size, language and sources.
2. **Rule-based anchoring.** The held-out drop is the measure of it. Synonyms, possessives and pronouns
   are partly handled, and *who* questions are the weakest.
3. **Names without coordinates.** Places are names and aliases, with no geography. "Near" isn't
   answerable.
4. **Data gaps are by design.** Text bodies stay on the member's device, so text-derived facts reach the
   graph only as hooks and claims.
5. **Heuristic extractors.** Edges are only as good as the hooks and linkers that produce them.
6. **No event fusion yet.** A calendar event and the plan proposal it came from are separate nodes;
   fusing them by thread reference or by organiser, day and place is designed, not built.
7. **The kernel port.** It's verified against Fundamental's TypeScript by golden vectors, not by
   formal equivalence.
8. **No user study.** The live A/B harness, comparing turns with the graph on and off in a sandbox,
   is built (titan-node `fe-situation-tool`) but not yet run. Its agreement score is measured against
   the graph's own answer, so the readout still needs independent judges.

## 9. Discussion

The graph is a **reading** of the household's stores, not a new source of truth. That choice decides
almost everything else:
- **Nothing to migrate.** No store's data moves into the graph.
- **Rebuildable.** Deleting the graph loses nothing.
- **Privacy at the moment of use.** Viewer-dependent state is never stored, so visibility can be
  decided when the graph is read, for the person asking.

Fundamental's contribution is the present tense: what is fresh, what is imminent, what keeps recurring,
and what is contested. That turns a correct but flat set of facts into an ordered answer.

## 10. Conclusion

A provenance-carrying relational graph, read per viewer with Fundamental's world-time kernels, answers
who/what/where/when/why deterministically and says why. In this evaluation it never once showed a
viewer anything they couldn't see, including on questions written blind. Accuracy is the open problem,
and it sits where the design predicted: in anchoring and in which data a household chooses to share.

## Appendix A: Reproducibility

Everything runs offline over the fictional household, with no network and no model:

```
python3 scripts/test_fe_reading.py      # the kernels against Fundamental's golden vectors
python3 scripts/test_graph_golden.py    # fixture consistency and the reference visibility model
python3 scripts/test_graph_sync.py      # the projection, edges and visibility (fences on sources)
python3 scripts/test_graph_since.py     # the incremental update equals a full rebuild
python3 scripts/test_situation.py       # the 5W evaluation, tuned and held-out (aggregate only)
```

The golden vectors are regenerated from Fundamental's built core with
`FE_DIST=<fundamental-engine>/packages/core/dist node scripts/fe_golden/generate.mjs`.
