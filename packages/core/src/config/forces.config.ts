/**
 * The canonical catalog — the single source of truth.
 *
 * Lifted from the prototype's `ds-data.js` (`DS_FORCES` / `DS_FORMATIONS` /
 * `DS_CONDITIONS`), which the design treats as the authority. Force identity
 * **colors are canonical**; disciplines inherit their mapped force's color.
 * See `docs/engine-reference/forces-system.md` §6 (forces), §7 (formations), §5 (conditions),
 * §15 (disciplines).
 *
 * This is the *designed* nine (the implemented prototype set). Extended,
 * physical, and cosmology forces (§20) live in their own modules once built.
 */

import type { Formation } from '../engine/types.ts';

/** The canonical nine force ids (the implemented set). */
export type ForceId =
  | 'attract'
  | 'jet'
  | 'tether'
  | 'wall'
  | 'stream'
  | 'repel'
  | 'viscosity'
  | 'swirl'
  | 'sink';

export interface ForceDef {
  id: ForceId;
  name: string;
  /** canonical identity color (the authority). */
  color: string;
  /** plain-language gloss. */
  does: string;
  /** the discipline this force maps to (§15). */
  discipline: string;
  /** the verb shown on the discipline card. */
  verb: string;
  /** the engine `data-body` tokens that realize it. */
  body: string;
  /** default authoring attributes. */
  attrs: Record<string, string>;
  /** one-line law (see the falloff-accuracy note, §6 — "inverse-square" here
   *  is the prototype's metaphor; the engine falloff is bounded `(1−d/d_max)ⁿ`,
   *  the true `1/d²` law is the `gravity` primitive, §20.10). */
  law: string;
}

export const FORCES: readonly ForceDef[] = [
  {
    id: 'attract',
    name: 'Attract',
    color: '#4da3ff',
    does: 'Pulls matter into a well',
    discipline: 'Product strategy',
    verb: 'gives direction',
    body: 'attract',
    attrs: { 'data-strength': '1', 'data-range': '300' },
    law: 'a soft gravity-like well, bent into a spiral',
  },
  {
    id: 'jet',
    name: 'Jet',
    color: '#a78bfa',
    does: 'Draws matter in, jets it out',
    discipline: 'AI systems',
    verb: 'adapts response',
    body: 'jet',
    attrs: { 'data-angle': '0', 'data-strength': '1', 'data-range': '300' },
    law: 'recycles the field into a stream',
  },
  {
    id: 'tether',
    name: 'Tether',
    color: '#86e57f',
    does: 'Tethers matter to a radius',
    discipline: 'Software architecture',
    verb: 'gives structure',
    body: 'tether',
    attrs: { 'data-strength': '1', 'data-range': '260' },
    law: 'a rest length — a leash, not a drain',
  },
  {
    id: 'wall',
    name: 'Wall',
    color: '#c4b5fd',
    does: 'A surface that bounces — throws sparks',
    discipline: 'Experience design',
    verb: 'the human surface',
    body: 'wall',
    attrs: {},
    law: 'elastic bounce off the bounding box',
  },
  {
    id: 'stream',
    name: 'Stream',
    color: '#7dd3fc',
    does: 'Blows a directional current',
    discipline: 'Motion',
    verb: 'reveals motion',
    body: 'stream',
    attrs: { 'data-angle': '0', 'data-strength': '1', 'data-range': '340' },
    law: 'constant force along a heading',
  },
  {
    id: 'repel',
    name: 'Repel',
    color: '#ff9d5c',
    does: 'Pushes matter away',
    discipline: 'Commerce',
    verb: 'market pressure',
    body: 'repel',
    attrs: { 'data-strength': '1.1', 'data-range': '300' },
    law: 'inverted well — carves a clean void',
  },
  {
    id: 'viscosity',
    name: 'Viscosity',
    color: '#8da2c0',
    does: 'Thickens the medium',
    discipline: 'Physical production',
    verb: 'adds constraint',
    body: 'viscosity',
    attrs: { 'data-strength': '1', 'data-range': '300' },
    law: 'viscosity — bleeds momentum off',
  },
  {
    id: 'swirl',
    name: 'Swirl',
    color: '#2dd4bf',
    does: 'Spins matter into a swirl',
    discipline: 'Creative technology',
    verb: 'spins it together',
    body: 'swirl',
    attrs: { 'data-spin': '1', 'data-strength': '1', 'data-range': '320' },
    law: 'tangential force — circles, never collapses',
  },
  {
    id: 'sink',
    name: 'Sink',
    color: '#ff6e9c',
    does: 'Swallows matter, then pops',
    discipline: 'Attention',
    verb: 'holds, then releases',
    body: 'sink attract',
    // §21.2 naming: the sink's captured count is `b.accreted` (was `b.mass`), its
    // limit is `capacity` (was `maxMass`), and the CSS fill var is `--load`.
    // `data-max` is the authoring alias for capacity.
    attrs: {
      'data-absorb': '64',
      'data-max': '30',
      'data-strength': '0.8',
      'data-range': '360',
    },
    law: 'accretion, then supernova',
  },
] as const;

export const FORCE_BY: Readonly<Record<ForceId, ForceDef>> = Object.fromEntries(
  FORCES.map((f) => [f.id, f])
) as Record<ForceId, ForceDef>;

/** The canonical palette, in force order. Wave/Currents and the accent journey
 *  draw from this — never a separate constant (§24.4). */
export const PALETTE: readonly string[] = FORCES.map((f) => f.color);

/** The site scroll accent journey (§9). */
export const ACCENT_JOURNEY: readonly string[] = [
  '#4da3ff',
  '#2dd4bf',
  '#a78bfa',
  '#ff6e9c',
  '#ff9d5c',
];

// ── Body-token classification (physics workover v0.3 — the modifier contract) ─
//
// `data-body` tokens fall into three application classes, applied in a formalized
// order each frame (workover §"Modifier contract"):
//
//   1. MODIFIERS transform the force context — `spotlight → screen → resonate`.
//   2. Core FORCES apply (everything else, in authored order).
//   3. SOURCES run through the budget lifecycle (the per-body source pass).
//
// This table is data — the parser (`core/scanner.ts`) classifies every body's
// tokens with it, the integrator consumes the classified sets in the documented
// order, and the Lab/docs render it. Unknown tokens classify as plain forces
// (unchanged behavior: the registry simply has no module for them).

/** A `data-body` token's application class. */
export type BodyTokenKind = 'modifier' | 'force' | 'source';

/** Modifier tokens in their formalized application order (`spotlight → screen → resonate`).
 *  The order is part of the contract: authoring `data-body="resonate spotlight attract"`
 *  evaluates the modifiers in THIS order, not authored order. (Today's modifiers compose
 *  commutatively — gates OR, strength multipliers multiply — so the formalization changes
 *  no existing behavior; it pins the contract for modifiers where order will matter.) */
export const MODIFIER_ORDER: readonly string[] = ['spotlight', 'screen', 'resonate'];

/** Class-[S] source tokens — they CREATE matter and must be budgeted: every [S] body
 *  declares at least one of `data-life` / `data-cap` / `data-budget` / `data-sink`,
 *  or the scanner's dev guard warns and applies {@link SOURCE_DEFAULT_LIFE} /
 *  {@link SOURCE_DEFAULT_CAP} (workover §"Source and sink rules"). */
export const SOURCE_TOKENS: readonly string[] = ['spawn'];

/** The safe default budget the source guard applies to an unbudgeted [S] body:
 *  each emitted particle lives this many frames (`data-life="300"`). */
export const SOURCE_DEFAULT_LIFE = 300;
/** …and the body sustains at most this many live particles (`data-cap="120"`);
 *  the emission rate is clamped to `cap / life` per frame. */
export const SOURCE_DEFAULT_CAP = 120;

/** Classify one `data-body` token (unknown tokens are plain forces). */
export function classifyBodyToken(token: string): BodyTokenKind {
  if (MODIFIER_ORDER.includes(token)) return 'modifier';
  if (SOURCE_TOKENS.includes(token)) return 'source';
  return 'force';
}

/** A body's tokens split into the three application classes (workover §"Modifier contract"). */
export interface ClassifiedTokens {
  /** modifier tokens, sorted into the formalized order (`spotlight → screen → resonate`). */
  modifiers: string[];
  /** core force tokens (including unknown tokens — unchanged behavior), authored order. */
  forces: string[];
  /** class-[S] source tokens, authored order. */
  sources: string[];
}

/** Split a body's tokens into `{ modifiers, forces, sources }`. Pure; preserves authored
 *  order within each class except modifiers, which sort into {@link MODIFIER_ORDER}. */
export function classifyBodyTokens(tokens: readonly string[]): ClassifiedTokens {
  const modifiers: string[] = [];
  const forces: string[] = [];
  const sources: string[] = [];
  for (const t of tokens) {
    const kind = classifyBodyToken(t);
    if (kind === 'modifier') modifiers.push(t);
    else if (kind === 'source') sources.push(t);
    else forces.push(t);
  }
  if (modifiers.length > 1) modifiers.sort((a, b) => MODIFIER_ORDER.indexOf(a) - MODIFIER_ORDER.indexOf(b));
  return { modifiers, forces, sources };
}

// ── Formations (§7) ──────────────────────────────────────────────────────────

export type FormationId = 'ambient' | 'wells' | 'lanes' | 'scatter' | 'accretion';

export interface FormationDef {
  id: FormationId;
  name: string;
  /** the page section it backs (the journey, §7.1). */
  section: string;
  color: string;
  cue: string;
  /** the numeric bias preset applied to every free particle (`FORMS`). */
  preset: Formation;
}

export const FORMATIONS: readonly FormationDef[] = [
  {
    id: 'ambient',
    name: 'Ambient',
    section: 'Hero',
    color: '#4da3ff',
    cue: 'resting drift',
    preset: { driftX: 0, wander: 1.0, orbit: 0.1, spread: 0, conv: 0 },
  },
  {
    id: 'wells',
    name: 'Wells',
    section: 'Work',
    color: '#2dd4bf',
    cue: 'matter pools',
    preset: { driftX: 0, wander: 0.7, orbit: 0.85, spread: 0, conv: 0 },
  },
  {
    id: 'lanes',
    name: 'Lanes',
    section: 'Writing',
    color: '#ff9d5c',
    cue: 'a current carries',
    preset: { driftX: 0.55, wander: 0.5, orbit: 0, spread: 0, conv: 0 },
  },
  {
    id: 'scatter',
    name: 'Scatter',
    section: 'Practice',
    color: '#a78bfa',
    cue: 'energy dispersed',
    preset: { driftX: 0, wander: 1.7, orbit: 0, spread: 0.6, conv: 0 },
  },
  {
    id: 'accretion',
    name: 'Accretion',
    section: 'Contact',
    color: '#ffce6b',
    cue: 'everything gathers',
    preset: { driftX: 0, wander: 0.6, orbit: 0.4, spread: 0, conv: 0.6 },
  },
] as const;

export const FORMATION_BY: Readonly<Record<FormationId, FormationDef>> =
  Object.fromEntries(FORMATIONS.map((f) => [f.id, f])) as Record<
    FormationId,
    FormationDef
  >;

/** Section → formation mapping for the scroll journey (§7.1, `SECTION_FORM`). */
export const SECTION_FORM: Readonly<Record<string, FormationId>> = {
  top: 'ambient',
  capabilities: 'scatter',
  work: 'wells',
  writing: 'lanes',
  contact: 'accretion',
};

// ── Conditions (§5) ──────────────────────────────────────────────────────────

export type ConditionId =
  | ''
  | 'active'
  | 'fast'
  | 'slow'
  | 'hot'
  | 'cool'
  | 'scrolling';

export interface ConditionDef {
  id: ConditionId;
  name: string;
  desc: string;
  /** selective gates read each particle (act only on free agents, §5). */
  selective: boolean;
}

export const CONDITIONS: readonly ConditionDef[] = [
  { id: '', name: 'Always', desc: 'Acts on every particle, every frame.', selective: false },
  { id: 'active', name: 'Active', desc: 'Only while the body is engaged.', selective: false },
  { id: 'fast', name: 'Fast', desc: 'Only on fast-moving matter (v² > 0.9).', selective: true },
  { id: 'slow', name: 'Slow', desc: 'Only on calm matter (v² < 0.22).', selective: true },
  { id: 'hot', name: 'Hot', desc: 'Only on energized matter (heat > 0.3).', selective: true },
  { id: 'cool', name: 'Cool', desc: 'Only on calm, un-energized matter (heat < 0.08).', selective: true },
  { id: 'scrolling', name: 'Scrolling', desc: 'Only while the page is scrolling.', selective: false },
] as const;

export const CONDITION_BY: Readonly<Record<ConditionId, ConditionDef>> =
  Object.fromEntries(CONDITIONS.map((c) => [c.id, c])) as Record<
    ConditionId,
    ConditionDef
  >;
