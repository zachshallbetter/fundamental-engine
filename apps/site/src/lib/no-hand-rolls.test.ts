/**
 * The extraction lock — the ratchet made structural (docs/engineering-practices.md §1).
 *
 * Two extraction rounds converted the example family's repeated hand-rolls into named
 * primitives (core: logNormalize/logNormalizeBetween/weightToStrength/temporal kernels/
 * allocateAttention; platform: withFlip/threadOverlay/createFieldPerf/applyRecipe options;
 * site lib: pageRuntime/persisted/fmt/controls/palette/reading-pace). This test greps the
 * family's sources and FAILS if a hand-roll reappears — a regression here means someone
 * reimplemented a primitive instead of importing it. Allowlists are explicit and carry the
 * reason; shrink them when the exception retires, never grow them silently.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..");

/** the example family + the docs runtime — the converted surface this lock protects */
const familyFiles = (): string[] => {
  const files: string[] = [];
  for (const f of readdirSync(join(SRC, "components/examples")))
    if (f.endsWith(".ts") && !f.endsWith(".test.ts")) files.push(join(SRC, "components/examples", f));
  files.push(join(SRC, "components/EvidenceRuntime.ts"), join(SRC, "components/DocsRuntime.ts"));
  files.push(join(SRC, "pages/evidence.astro"));
  for (const f of readdirSync(join(SRC, "pages/evidence")))
    if (f.endsWith(".astro")) files.push(join(SRC, "pages/evidence", f));
  return files;
};

/** nav + home layer — the three files fixed in #624; same renderless anti-pattern guard */
const navHomeFiles = (): string[] => [
  join(SRC, "components/SiteNav.astro"),
  join(SRC, "components/SiteFooter.astro"),
  join(SRC, "components/home/HomeRuntime.ts"),
];

/** source minus comment lines — migrations and docs may NAME the old patterns */
const codeOf = (path: string): string =>
  readFileSync(path, "utf8")
    .split("\n")
    .filter((l) => {
      const t = l.trim();
      return !t.startsWith("//") && !t.startsWith("*") && !t.startsWith("/*") && !t.startsWith("<!--");
    })
    .join("\n");

const offenders = (pattern: RegExp, files: string[], allow: Map<string, string>): string[] =>
  files
    .filter((f) => pattern.test(codeOf(f)))
    .filter((f) => ![...allow.keys()].some((a) => f.endsWith(a)))
    .map((f) => f.slice(SRC.length + 1));

test("lifecycle blocks live in lib/page-runtime.ts, nowhere else in the family", () => {
  assert.deepEqual(offenders(/astro:before-swap/, familyFiles(), new Map()), []);
});

test("storage goes through lib/persisted.ts (one-shot raw-legacy migrations excepted)", () => {
  const allow = new Map([
    ["examples/calendar-runtime.ts", "one-shot bare-value → JSON upgrade of fui:cal-view"],
    ["components/DocsRuntime.ts", "one-shot raw-string legacy migration (fieldui-docs-field)"],
  ]);
  assert.deepEqual(offenders(/localStorage\./, familyFiles(), allow), []);
});

test("scroll velocity is read via lib/reading-pace.ts only", () => {
  assert.deepEqual(
    offenders(/getPropertyValue\(["']--field-scroll-v/, familyFiles(), new Map()),
    [],
  );
});

test("the weight→strength pair (0.4 + w·1.6) has ONE definition — core's weightToStrength", () => {
  assert.deepEqual(offenders(/0\.4\s*\+[^;\n]*\*\s*1\.6/, familyFiles(), new Map()), []);
});

test("log normalization is imported from core, not reimplemented", () => {
  const allow = new Map([
    // inbox ships its normalization constants server→client (data-ix-norm) so live
    // arrivals score on the snapshot's absolute scale — a cross-boundary contract,
    // not a reimplementation. Retire this when the contract moves to raw min/max.
    ["examples/inbox-runtime.ts", "shipped-norm contract (data-ix-norm)"],
    ["pages/evidence/inbox.astro", "shipped-norm contract (data-ix-norm)"],
  ]);
  assert.deepEqual(offenders(/Math\.log\(/, familyFiles(), allow), []);
});

test("the lens palette has ONE home — lib/palette.ts", () => {
  assert.deepEqual(offenders(/FIELD_PALETTE\s*=\s*\[/, familyFiles(), new Map()), []);
});

test("scoped fields use applyRecipe's renderless option, not the render:[] spread", () => {
  assert.deepEqual(offenders(/render:\s*\[\]\s*as\s*never/, familyFiles(), new Map()), []);
});

test("nav/home layer: scoped fields use renderless, not the render:[] spread (fixed in #624)", () => {
  assert.deepEqual(offenders(/render:\s*\[\]\s*as\s*never/, navHomeFiles(), new Map()), []);
});

test("nav/home layer: field-root method calls use optional chaining (pre-upgrade safety)", () => {
  // setOverlay/setHeatmap/setRender must be called with ?. so a pre-upgrade HTMLElement doesn't throw
  assert.deepEqual(offenders(/\.(setOverlay|setHeatmap|setRender)\((?!\?)/, navHomeFiles(), new Map()), []);
});
