/**
 * Catalog-count drift guard (closes #710).
 *
 * The force COUNT and its family breakdown ("36 forces", "9 canonical / 8 natural / 19 extended") are
 * hand-written into the current-truth docs — and they drift: the count was hand-fixed repeatedly
 * (34→35→36, #262/#263, the 0.8.1 truth-pass). The existing forces-tests-doc guard only checks token
 * *existence*, not counts. This derives the truth from the catalog (config/manual.ts — `MANUAL_FORCES`,
 * grouped by `family`) and fails CI if any current-truth doc states a different total or family count.
 *
 * Scope: only the **current-truth** docs are scanned. Point-in-time records (docs/release-notes) and
 * frozen history (docs/planning-archive) are deliberately excluded — they're allowed to quote the count
 * that was true when written. The SITE copy already derives these counts from core at build time, so it
 * can't drift; the hand-written markdown here is the surface that does.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { MANUAL_FORCES } from '../config/manual.ts';

// ── derive the truth from the catalog ──────────────────────────────────────────────────────────
const TOTAL = MANUAL_FORCES.length;
const FAMILY: Record<string, number> = {};
for (const f of MANUAL_FORCES) FAMILY[f.family] = (FAMILY[f.family] ?? 0) + 1;

// ── current-truth docs to scan (NOT release-notes / planning-archive) ──────────────────────────
const dirURL = (d: string) => new URL(`../../../../${d}/`, import.meta.url);
const mdIn = (d: string) =>
  readdirSync(dirURL(d))
    .filter((f) => f.endsWith('.md'))
    .map((f) => ({ rel: `${d}/${f}`, text: readFileSync(new URL(f, dirURL(d)), 'utf8') }));
// Optional: a repo-root doc may be absent in some checkouts (e.g. CLAUDE.md is a local agent file,
// not committed — so it isn't present in CI). Tolerate that rather than crashing the guard.
const rootFile = (f: string): { rel: string; text: string } | null => {
  try {
    return { rel: f, text: readFileSync(new URL(`../../../../${f}`, import.meta.url), 'utf8') };
  } catch {
    return null;
  }
};

const files = [
  ...mdIn('docs/canonical'),
  ...mdIn('docs/engine-reference'),
  rootFile('ROADMAP.md'),
  rootFile('BACKLOG.md'),
  rootFile('README.md'),
].filter((x): x is { rel: string; text: string } => x !== null);

test('catalog self-consistency: families sum to the total force count', () => {
  const sum = Object.values(FAMILY).reduce((a, b) => a + b, 0);
  assert.equal(sum, TOTAL, `family counts ${JSON.stringify(FAMILY)} must sum to MANUAL_FORCES.length (${TOTAL})`);
});

test('docs: bare "N forces" total claims (N ≥ 30) match the catalog total', () => {
  // Sub-counts elsewhere (test-tier rosters like "20 forces") sit well under 30; a number ≥ 30 next to
  // "forces" is a total claim, so it must equal the catalog total — catches drift like "33 forces".
  const re = /\b(\d+)\s+forces\b/gi;
  const wrong: string[] = [];
  let statedTotal = false;
  for (const { rel, text } of files)
    for (const m of text.matchAll(re)) {
      const n = Number(m[1]);
      if (n < 30) continue;
      if (n === TOTAL) statedTotal = true;
      else wrong.push(`${rel}: "${m[0].trim()}" — expected ${TOTAL}`);
    }
  assert.deepEqual(wrong, [], `stale total force-count claim(s):\n  ${wrong.join('\n  ')}`);
  assert.ok(statedTotal, `the total force count (${TOTAL}) is never stated in the current-truth docs — guard is vacuous`);
});

// Note: a per-family guard ("9 canonical / 8 natural / 19 extended") was tried and dropped — the family
// words collide with section numbering (§20.4 Extended conditions, §20.10 natural primitives, …), so a
// prose regex can't tell a force-count from a heading. The total guard above is the high-value, drift-
// prone surface; the catalog's own family→total self-consistency is covered by the first test.
