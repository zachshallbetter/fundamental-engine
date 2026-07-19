# M1.5-02 — Participant admission

**Status:** proposed (awaiting ratification)

## Decision
A candidate qualifies as an **interaction participant** only when the declared model assigns it an
**independently attributable interaction role** involving **one or more** of:

- state carried across the episode;
- observation;
- operation (action production);
- mediation;
- authority (exercised or held);
- constraint application;
- consequence reception or propagation.

**Mere causal relevance is insufficient.** A passive physical condition remains *environment* (record 03,
and the `environment ⊆ world` terminology) unless the explanatory model specifically treats it as a
bounded system in the coupling with an attributable role above.

## Alternatives considered
- Implementation-typed admission (user / service / device / agent). Rejected: classifies by surface, not
  by interaction role — the participant-as-interaction-type move the program rests on.
- Admit any causally relevant component. Rejected: makes almost everything a participant; empties the
  category.

## Reason
Typed participation (define an entity by what it can sense, change, be changed by, be permitted, and leave
as evidence) is the analogue of identifying particles by the interactions they enter. It also keeps
`Entities` in `K` from silently absorbing the whole environment.

## Operational consequences
- Feeds kernel `Entities`: an entity admitted here is a first-class participant with attributable state;
  everything else is environment.
- The admission predicate is checkable at world declaration and is required before F1.1 hosting.
- A participant must expose at least one attributable role or the world declaration is rejected.

## Falsification conditions
- A phenomenon everyone agrees is interaction requires a participant that satisfies none of the seven
  roles (the role set is incomplete).
- Two declarations disagree on admission for the same entity with no role-based ground to decide
  (the test is under-determined).

## Open questions
- Is "authority held but never exercised" sufficient alone? Provisional: yes, if independently
  attributable (it constrains others' opportunity).
- Collective participants (institutions) — admitted as single participants or as composed sub-worlds?
  Provisional: either, declared explicitly; nesting handled by the world model.

## Ratification
Proposed. Ratify as the canonical participant-admission rule (also C1.7 in the CompInt corpus).
