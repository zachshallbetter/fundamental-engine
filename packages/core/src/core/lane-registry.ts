// Canonical word→lane registry + the `field/no-word-in-two-lanes` lint (substrate governance 05; the
// governance module names this as a planned rule). The naming canon's core invariant — "Concepts
// describe. Tokens execute. Metrics measure. Diagnostics explain. Conditions activate. … No word lives
// in two lanes." — is, until now, enforced only by review. This indexes the engine's *shipped* vocabulary
// by lane, drawn straight from the source-of-truth catalogs (not a hand-written list), and the lint
// reports any word that appears in two lanes.
//
// DESIGN NOTES (flagged for review — these are the judgment calls):
//   - Lanes covered: `force` (the 36 force tokens), `formation` (the 5 field-shape modes), `condition`
//     (the data-when keywords), `visualization` (the 16 render+diagnostic modes). These four have clean,
//     single source-of-truth catalogs and are disjoint by construction, so the lint reports nothing today
//     — its job is to guard future drift (a new force token that collides with a formation id, etc.).
//   - `render` and `diagnostic` are kept as ONE `visualization` lane on purpose: the canon splits them
//     ("Diagnostics explain"), but there is no clean catalog boundary — `heatmap`/`contours`/`energy`
//     straddle the README's render-vs-diagnostic line — so splitting here would invent a contested rule.
//   - `metric` is NOT yet a lane: the engine has no single catalog of metric names (they are `--field-*`
//     vars scattered across feedback/atoms). Indexing it cleanly is a follow-up. This is why a word like
//     `memory` (a force token AND a relationship-warmth metric) does not yet trip the lint.

import { PASSPORTS } from '../contracts/passport.ts';
import { FORMATIONS, CONDITIONS } from '../config/forces.config.ts';
import { RENDER_MODES } from '../visual/visualization.ts';
import type { GovernanceWarning } from './types.ts';

/** The vocabulary lanes this registry indexes (a conservative subset of the full naming canon — see the
 *  design notes above for why `render`/`diagnostic` are merged and `metric` is deferred). */
export type WordLane = 'force' | 'formation' | 'condition' | 'visualization';

/** The shipped vocabulary, indexed by lane, drawn from each lane's source-of-truth catalog. */
export const LANE_WORDS: Readonly<Record<WordLane, readonly string[]>> = Object.freeze({
  force: Object.keys(PASSPORTS),
  formation: FORMATIONS.map((f) => f.id),
  condition: CONDITIONS.map((c) => c.id).filter((id) => id !== ''), // '' = "Always" (no keyword)
  visualization: RENDER_MODES.map((m) => m.mode),
});

/** Look up the lane a word belongs to, or undefined if it is not a known engine word. */
export function laneOf(word: string): WordLane | undefined {
  for (const lane of Object.keys(LANE_WORDS) as WordLane[]) {
    if (LANE_WORDS[lane].includes(word)) return lane;
  }
  return undefined;
}

/** Lint the registry for the canon's "no word lives in two lanes" rule: report every word that appears
 *  in more than one lane (substrate governance 05 — `field/no-word-in-two-lanes`). Pure; runs in CI,
 *  devtools, or a docs check with no live field. With the shipped catalogs it returns `[]` — the lane
 *  separation holds — so a non-empty result is a real regression. */
export function lintWordLanes(words: Readonly<Record<string, readonly string[]>> = LANE_WORDS): GovernanceWarning[] {
  const seen = new Map<string, string[]>(); // word → lanes it appears in
  for (const [lane, list] of Object.entries(words)) {
    for (const word of list) {
      const lanes = seen.get(word) ?? [];
      if (!lanes.includes(lane)) lanes.push(lane);
      seen.set(word, lanes);
    }
  }
  const out: GovernanceWarning[] = [];
  for (const [word, lanes] of seen) {
    if (lanes.length > 1) {
      out.push({
        rule: 'field/no-word-in-two-lanes',
        severity: 'error',
        subject: word,
        message: `"${word}" appears in ${lanes.length} lanes (${lanes.join(', ')}); a word must live in exactly one lane.`,
      });
    }
  }
  return out;
}
