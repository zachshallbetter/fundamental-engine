/**
 * The refuted-argument guard — the regression half of caveat-canon §7 (docs/research/README.md).
 *
 * Adversarial review of the research family refuted three tempting defenses of a force-based
 * system. Fundamental must never lean on them:
 *
 *   1. the IMPOSSIBILITY argument — "no fixed-timestep integrator can be symplectic and conserve
 *      energy and momentum, so our non-conservation is unavoidable" (false: semi-implicit
 *      symplectic Euler exists; we choose non-conservation for plausibility — Dinev/Liu/Kavan 2018);
 *   2. the CUBIC argument — "force-directed layout is O(n³)" (false: Barnes-Hut / multilevel
 *      schemes are near-linearithmic);
 *   3. the "unbounded repulsion" / "t-force" framing (describes a competing force model, not
 *      Fundamental's bounded (1 − d/r)ⁿ designed forces).
 *
 * The two canon files that STATE the refutations are allowlisted; every other prose surface (the
 * canonical + engine + research docs, the READMEs, the site's pages, essays and runtime copy) fails
 * this test if one of the banned framings reappears. A positive check keeps the patterns honest:
 * each one must still match the canon sentence it exists to guard.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const SITE_SRC = join(dirname(fileURLToPath(import.meta.url)), "..");
const REPO = join(SITE_SRC, "..", "..", "..");

/** The canon that states the refutations, in the negative — allowed to name the banned arguments. */
const CANON = ["docs/canonical/stability-and-convergence.md", "docs/research/README.md"];

const BANNED: Array<{ name: string; pattern: RegExp }> = [
  {
    name: "impossibility argument (symplectic + conservation is unavoidable/impossible)",
    pattern: /(?:unavoidabl\w*|impossib\w*)[^.\n]{0,80}(?:symplectic|conserv)|(?:symplectic|conserv)\w*[^.\n]{0,80}(?:unavoidabl\w*|impossib\w*)|no (?:fixed[- ]timestep )?integrator can/i,
  },
  {
    name: "cubic argument (force-directed layout is O(n³))",
    pattern: /force[- ]directed[^.\n]{0,60}(?:\bcubic\b(?!-bezier)|O\(n\^?3\)|O\(n³\)|\bn\^3\b|\bn³\b)|(?:\bcubic\b(?!-bezier)|O\(n\^?3\)|O\(n³\)|\bn\^3\b|\bn³\b)[^.\n]{0,60}force[- ]directed/i,
  },
  {
    name: "unbounded-repulsion / t-force framing",
    pattern: /unbounded[- ]repulsion|\bt-force\b/i,
  },
];

const PROSE_EXT = new Set([".md", ".mdx", ".astro", ".ts", ".tsx", ".mjs"]);
const SKIP_DIRS = new Set(["node_modules", "dist", "build", ".astro", "test-results", "playwright-report"]);

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if ([...PROSE_EXT].some((e) => name.endsWith(e)) && !name.endsWith(".test.ts")) out.push(p);
  }
  return out;
}

/** Every prose surface the guard covers: the docs tree, the READMEs, and the site's source. */
const surfaces = (): string[] => [
  ...walk(join(REPO, "docs")),
  join(REPO, "README.md"),
  join(REPO, "CONTRIBUTING.md"),
  join(REPO, "swift", "README.md"),
  join(REPO, "android", "README.md"),
  ...readdirSync(join(REPO, "packages")).map((p) => join(REPO, "packages", p, "README.md")),
  ...walk(SITE_SRC),
];

const rel = (p: string): string => relative(REPO, p);

test("the three refuted arguments do not appear outside the canon that refutes them", () => {
  const offenders: string[] = [];
  for (const file of surfaces()) {
    const path = rel(file);
    if (CANON.includes(path)) continue;
    let text: string;
    try {
      text = readFileSync(file, "utf8");
    } catch {
      continue; // a package without a README — nothing to scan
    }
    for (const { name, pattern } of BANNED) {
      const m = pattern.exec(text);
      if (m) offenders.push(`${path}: ${name} — "${m[0].slice(0, 90)}"`);
    }
  }
  assert.deepEqual(offenders, [], "a refuted argument was reintroduced — see docs/research/README.md caveat canon §7");
});

test("each banned pattern still matches the canon sentence it guards (the regexes are not dead)", () => {
  const canon = CANON.map((p) => readFileSync(join(REPO, p), "utf8")).join("\n");
  for (const { name, pattern } of BANNED) {
    assert.ok(pattern.test(canon), `pattern for "${name}" no longer matches the canon — the guard would pass vacuously`);
  }
});
