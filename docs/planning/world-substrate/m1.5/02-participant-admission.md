# M1.5-02 — Participant admission

**Status:** ratified (2026-07-19), with the two-level distinction below

## Decision
Admission is **two-level**. A candidate qualifies through the seven-role test — an **independently
attributable role** via one or more of: state carried, observation, operation, mediation, authority,
constraint application, consequence reception/propagation — but the *level* it qualifies at depends on
**where** that role is materially involved:

- **World participant** — the role is attributable within the declared **world**. Feeds kernel `Entities`.
- **Episode participant** — a world participant whose state, operation, observation, authority, constraint,
  mediation, or consequence is **materially involved within a declared episode boundary**. Feeds F1.3
  interaction detection.

**Mere causal relevance is insufficient** at either level. A passive physical condition remains
*environment* (the `environment ⊆ world` terminology) unless the model treats it as a bounded system with
an attributable role.

**Authority, specifically:**
- held but never exercised or operationally relevant → may qualify a **world** participant, **not** an episode participant;
- that constrains, enables, denies, delegates, or otherwise changes possible **episode** trajectories → qualifies an **episode** participant;
- entirely irrelevant to the episode → does **not** qualify an episode participant.

This stops every latent administrator, regulator, policy owner, or upstream institution from entering
every episode merely by possessing theoretical authority.

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
- **World** admission feeds kernel `Entities` (checkable at world declaration; a candidate exposing no
  attributable role is rejected). **Episode** admission is evaluated by F1.3 against the declared boundary.
- An entity may be a world participant without being an episode participant in a given episode.
- Everything not admitted at either level is environment.

## Falsification conditions
- A phenomenon everyone agrees is interaction requires a participant that satisfies none of the seven
  roles (the role set is incomplete).
- Two declarations disagree on admission for the same entity with no role-based ground to decide
  (the test is under-determined).

## Open questions
- Collective participants (institutions) — admitted as single participants or as composed sub-worlds?
  Provisional: either, declared explicitly; nesting handled by the world model.

## Ratification
**Ratified 2026-07-19** with the world/episode two-level distinction (authority held-but-unexercised
qualifies a *world* participant only). Applies as C1.7 in the CompInt canonical corpus.
