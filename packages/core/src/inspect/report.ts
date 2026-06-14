/**
 * System report (testing-and-conformance, "agent report" / productization). Aggregates the whole
 * field-ui model into one inspectable object: how many contracts, force passports, conformance
 * experiments, agent types, and recipes the build ships — and whether every force is both
 * passported and conformance-covered. A productization artifact: a build can print it, a CI can
 * assert on it, an Inspector can render it.
 */
import { CONTRACTS } from '../contracts/index.ts';
import { PASSPORTS } from '../contracts/passport.ts';
import { AGENT_CONTRACTS } from '../agents/index.ts';
import { VISUAL_CONTRACTS } from '../visual/index.ts';
import { RECIPE_CONTRACTS, FIELD_RECIPES } from '../recipes/index.ts';
import { EXPERIMENTS } from '../conformance/experiments.ts';
import { allForces } from '../conformance/run.ts';

export interface SystemReport {
  forces: number;
  passports: number;
  conformanceExperiments: number;
  contracts: number;
  agentTypes: number;
  recipes: number;
  /** force tokens registered but missing a passport (should be empty). */
  forcesMissingPassport: string[];
  /** force tokens missing a conformance experiment (should be empty). */
  forcesMissingConformance: string[];
}

/** Build the system report from the live registry + catalogs. */
export function systemReport(): SystemReport {
  const registry = allForces();
  const tokens = Object.keys(registry);
  const experimented = new Set(EXPERIMENTS.map((e) => e.scenario.force));
  return {
    forces: tokens.length,
    passports: Object.keys(PASSPORTS).length,
    conformanceExperiments: EXPERIMENTS.length,
    contracts: CONTRACTS.length + AGENT_CONTRACTS.length + VISUAL_CONTRACTS.length + RECIPE_CONTRACTS.length,
    agentTypes: AGENT_CONTRACTS.length,
    recipes: FIELD_RECIPES.length,
    forcesMissingPassport: tokens.filter((t) => !PASSPORTS[t]),
    forcesMissingConformance: tokens.filter((t) => !experimented.has(t)),
  };
}

/** Render the system report as a short Markdown summary. */
export function reportText(r: SystemReport = systemReport()): string {
  const ok = (xs: string[]): string => (xs.length ? `⚠ ${xs.join(', ')}` : '✓ none');
  return [
    '# Fundamental system report',
    '',
    `- Forces: **${r.forces}** (passports: ${r.passports}, conformance experiments: ${r.conformanceExperiments})`,
    `- Contracts: **${r.contracts}** (agent types: ${r.agentTypes})`,
    `- Field recipes: **${r.recipes}**`,
    `- Forces missing a passport: ${ok(r.forcesMissingPassport)}`,
    `- Forces missing conformance: ${ok(r.forcesMissingConformance)}`,
  ].join('\n');
}
