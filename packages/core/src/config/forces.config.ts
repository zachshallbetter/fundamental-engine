/**
 * The canonical catalog — the single source of truth.
 *
 * Lifted from the prototype's `ds-data.js` (`DS_FORCES` / `DS_FORMATIONS` /
 * `DS_CONDITIONS`), which the design treats as the authority. Force identity
 * **colours are canonical**; disciplines inherit their mapped force's colour.
 * See `docs/forces-system.md` §6 (forces), §7 (formations), §5 (conditions),
 * §15 (disciplines).
 *
 * This is the *designed* nine (the implemented prototype set). Extended,
 * physical, and cosmology forces (§20) live in their own modules once built.
 */

import type { Formation } from '../core/types.ts';

/** The canonical nine force ids (the implemented set). */
export type ForceId =
  | 'attract'
  | 'emitter'
  | 'spring'
  | 'reflect'
  | 'stream'
  | 'repel'
  | 'drag'
  | 'vortex'
  | 'absorb';

export interface ForceDef {
  id: ForceId;
  name: string;
  /** canonical identity colour (the authority). */
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
    id: 'emitter',
    name: 'Emitter',
    color: '#a78bfa',
    does: 'Draws matter in, jets it out',
    discipline: 'AI systems',
    verb: 'adapts response',
    body: 'emitter',
    attrs: { 'data-angle': '0', 'data-strength': '1', 'data-range': '300' },
    law: 'recycles the field into a stream',
  },
  {
    id: 'spring',
    name: 'Spring',
    color: '#86e57f',
    does: 'Tethers matter to a radius',
    discipline: 'Software architecture',
    verb: 'gives structure',
    body: 'spring',
    attrs: { 'data-strength': '1', 'data-range': '260' },
    law: 'a rest length — a leash, not a drain',
  },
  {
    id: 'reflect',
    name: 'Reflect',
    color: '#c4b5fd',
    does: 'A surface that bounces — throws sparks',
    discipline: 'Experience design',
    verb: 'the human surface',
    body: 'reflect',
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
    id: 'drag',
    name: 'Drag',
    color: '#8da2c0',
    does: 'Thickens the medium',
    discipline: 'Physical production',
    verb: 'adds constraint',
    body: 'drag',
    attrs: { 'data-strength': '1', 'data-range': '300' },
    law: 'viscosity — bleeds momentum off',
  },
  {
    id: 'vortex',
    name: 'Vortex',
    color: '#2dd4bf',
    does: 'Spins matter into a whirlpool',
    discipline: 'Creative technology',
    verb: 'spins it together',
    body: 'vortex',
    attrs: { 'data-spin': '1', 'data-strength': '1', 'data-range': '320' },
    law: 'tangential force — circles, never collapses',
  },
  {
    id: 'absorb',
    name: 'Absorb',
    color: '#ff6e9c',
    does: 'Swallows matter, then pops',
    discipline: 'Attention',
    verb: 'holds, then releases',
    body: 'absorb attract',
    // §21.2 naming: the absorber's captured count is `b.accreted` (was `b.mass`), its
    // limit is `capacity` (was `maxMass`), and the CSS fill var is `--load` (alias
    // `--mass`). `data-max` is the authoring alias for capacity.
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
