#!/usr/bin/env node
/**
 * Single-source force catalog codegen.
 * Reads passport.ts + forces.config.ts → emits data/forces-catalog.json
 * and swift/Sources/FieldLabKit/GeneratedForceCatalog.swift.
 * Run: node scripts/gen-force-catalog.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// Read both source files
const passportSrc = readFileSync(join(ROOT, 'packages/core/src/contracts/passport.ts'), 'utf8');
const forcesCfgSrc = readFileSync(join(ROOT, 'packages/core/src/config/forces.config.ts'), 'utf8');

// ---------------------------------------------------------------------------
// Parse passport.ts ROWS array
//
// Each row looks like:
//   { token: 'attract', label: 'Attract', family: C, klass: 'A', truthMode: 'designed', ... }
// where family is a const C/N/E abbreviation.
// We extract: token, label, family (C→canonical/N→natural/E→extended), klass, truthMode
// ---------------------------------------------------------------------------

// Map const aliases to family strings (C/N/E are declared at module level)
const FAMILY_ALIASES = { C: 'canonical', N: 'natural', E: 'extended' };

// Extract ROWS block — everything between "const ROWS: Row[] = [" and the matching "];"
const rowsBlockMatch = passportSrc.match(/const ROWS:\s*Row\[\]\s*=\s*\[([\s\S]*?)\];\s*\n\s*\/\*\*/);
if (!rowsBlockMatch) {
  console.error('ERROR: Could not locate ROWS block in passport.ts');
  process.exit(1);
}
const rowsBlock = rowsBlockMatch[1];

// Parse each row object STRUCTURALLY, not by a fixed-order regex.
//
// The previous parser required token/label/family/klass/truthMode to appear in that exact order with
// nothing between them. Any row that reordered a field, or inserted a new one — which is what happens
// the next time `Row` grows a property — simply did not match, and was dropped in silence. The only
// guard was `catalog.length < 30`, so at 37 rows SEVEN could disappear on a green run (measured: an
// injected property in 7 rows yields 30 parsed and exits 0; the 8th trips the guard).
//
// Instead: split the block into brace-balanced objects, then read each field by name, in any order.
// A row missing a required field is a hard error naming the row, never a silent drop.
function splitRowObjects(block) {
  const objs = [];
  let depth = 0, start = -1, inStr = null;
  for (let i = 0; i < block.length; i++) {
    const c = block[i];
    if (inStr) {                                   // never count braces inside a string literal
      if (c === '\\') { i++; continue; }
      if (c === inStr) inStr = null;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') { inStr = c; continue; }
    if (c === '{') { if (depth === 0) start = i; depth++; }
    else if (c === '}') { depth--; if (depth === 0 && start >= 0) { objs.push(block.slice(start, i + 1)); start = -1; } }
  }
  return objs;
}

const field = (obj, name) => {
  const m = obj.match(new RegExp(`\\b${name}\\s*:\\s*(?:'([^']*)'|"([^"]*)"|([A-Za-z_$][\\w$]*))`));
  return m ? (m[1] ?? m[2] ?? m[3]) : undefined;
};

const rowObjects = splitRowObjects(rowsBlock);
const passportRows = [];
for (const obj of rowObjects) {
  const token = field(obj, 'token');
  if (!token) continue;                            // not a Row (a nested object literal)
  const row = {
    token,
    label: field(obj, 'label'),
    family: field(obj, 'family'),
    klass: field(obj, 'klass'),
    truthMode: field(obj, 'truthMode'),
  };
  const missing = Object.entries(row).filter(([, v]) => v === undefined).map(([k]) => k);
  if (missing.length) {
    console.error(`ERROR: passport row '${token}' is missing ${missing.join(', ')}. A row is never dropped silently.`);
    process.exit(1);
  }
  row.family = FAMILY_ALIASES[row.family] ?? row.family;
  passportRows.push(row);
}

// The count check that matters: every brace-balanced row carrying a `token` must have parsed. A magic
// floor cannot tell 37-of-37 from 30-of-37; this can.
const tokenBearing = rowObjects.filter((o) => /\btoken\s*:/.test(o)).length;
if (passportRows.length !== tokenBearing) {
  console.error(`ERROR: parsed ${passportRows.length} of ${tokenBearing} passport rows — ${tokenBearing - passportRows.length} dropped.`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Parse forces.config.ts FORCES array for canonical colors (canonical nine only)
//
// Each entry: { id: 'attract', ..., color: '#4da3ff', ... }
// ---------------------------------------------------------------------------
const cfgColorRegex = /\bid:\s*'([a-z][a-z-]*)'\s*,[^}]*?color:\s*'(#[0-9a-fA-F]{3,8})'/gs;
const configColors = {};
for (const m of forcesCfgSrc.matchAll(cfgColorRegex)) {
  configColors[m[1]] = m[2];
}

// ---------------------------------------------------------------------------
// Parse LAB_FORCE_COLORS from ForceCatalog.swift (non-canonical colors)
//
// This gives us colors for natural + extended forces.
// ---------------------------------------------------------------------------
const labColorsSrc = readFileSync(
  join(ROOT, 'swift/Sources/FieldLabKit/ForceCatalog.swift'),
  'utf8',
);
const labColorRegex = /"([a-z][a-z-]*)"\s*:\s*"(#[0-9a-fA-F]{3,8})"/g;
const labColors = {};
for (const m of labColorsSrc.matchAll(labColorRegex)) {
  labColors[m[1]] = m[2];
}

// ---------------------------------------------------------------------------
// Build catalog entries — passport.ts is authoritative for token/label/family/klass/truthMode;
// colors come from forces.config.ts (canonical nine) then LAB_FORCE_COLORS (rest).
// ---------------------------------------------------------------------------
const catalog = passportRows.map((row) => ({
  token: row.token,
  label: row.label,
  family: row.family,
  class: row.klass,
  truthMode: row.truthMode,
  color: configColors[row.token] ?? labColors[row.token] ?? null,
}));

// ---------------------------------------------------------------------------
// Emit data/forces-catalog.json
// ---------------------------------------------------------------------------
mkdirSync(join(ROOT, 'data'), { recursive: true });

const catalogJson = JSON.stringify(
  {
    version: 1,
    generatedFrom: [
      'packages/core/src/contracts/passport.ts',
      'packages/core/src/config/forces.config.ts',
    ],
    forces: catalog,
  },
  null,
  2,
);
writeFileSync(join(ROOT, 'data/forces-catalog.json'), catalogJson);
console.log(`✓ data/forces-catalog.json — ${catalog.length} forces`);

// ---------------------------------------------------------------------------
// Emit swift/Sources/FieldLabKit/GeneratedForceCatalog.swift
// ---------------------------------------------------------------------------
const swiftEntries = catalog
  .map((f) => {
    const colorLit = f.color ? `"${f.color}"` : 'nil';
    return `    CatalogForceEntry(token: "${f.token}", label: "${f.label}", family: "${f.family}", cls: "${f.class}", truthMode: "${f.truthMode}", color: ${colorLit})`;
  })
  .join(',\n');

const swiftSrc = `// GeneratedForceCatalog.swift — AUTO-GENERATED by scripts/gen-force-catalog.mjs
// DO NOT EDIT. Run \`node scripts/gen-force-catalog.mjs\` (or \`pnpm gen:force-catalog\`) to regenerate.
// Source of truth: packages/core/src/contracts/passport.ts + packages/core/src/config/forces.config.ts

/// A force entry from the canonical catalog (auto-generated).
public struct CatalogForceEntry: Identifiable, Codable {
    public var id: String { token }
    public let token: String
    public let label: String
    public let family: String
    public let cls: String
    public let truthMode: String
    public let color: String?
}

/// All ${catalog.length} forces in the canonical catalog, single-sourced from the JS engine.
public let GENERATED_FORCE_CATALOG: [CatalogForceEntry] = [
${swiftEntries}
]
`;

writeFileSync(
  join(ROOT, 'swift/Sources/FieldLabKit/GeneratedForceCatalog.swift'),
  swiftSrc,
);
console.log(
  `✓ swift/Sources/FieldLabKit/GeneratedForceCatalog.swift — ${catalog.length} entries`,
);

// ---------------------------------------------------------------------------
// Validate count
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Emit android/lab/src/main/kotlin/com/fundamental/lab/GeneratedForceCatalog.kt
//
// The third plane. Until now this file did not exist: `gen-force-catalog.mjs` generated the JSON
// catalog and the Swift one, and Kotlin's copy was maintained by hand — which is why `relief` was
// absent from it after the force landed on three planes, and why `fieldflow` had drifted to the
// label "Field Flow". Neither was visible to any gate (#1186, the third leg of #549).
//
// ONLY the structural fields are generated. The lab's per-force `blurb` is independent editorial
// prose — of the tokens present in both, none matches the JS `meta.desc` text — so it stays
// hand-written in Catalog.kt and is joined here by token. A blurb that is missing, or left behind
// for a token that no longer exists, fails CatalogCoverageTest rather than silently disappearing.
// ---------------------------------------------------------------------------
const ktEntries = catalog
  .map((f) => {
    const group = f.family.charAt(0).toUpperCase() + f.family.slice(1);
    return `    GeneratedForce("${f.token}", "${f.label.replace(/"/g, '\\"')}", "${group}")`;
  })
  .join(',\n');

const ktSrc = `// GeneratedForceCatalog.kt — AUTO-GENERATED by scripts/gen-force-catalog.mjs
// DO NOT EDIT. Run \`node scripts/gen-force-catalog.mjs\` (or \`pnpm gen:force-catalog\`) to regenerate.
// Source of truth: packages/core/src/contracts/passport.ts + packages/core/src/config/forces.config.ts
package com.fundamental.lab

/** A force's structural identity, generated from the JS passport. Blurbs live in Catalog.kt. */
class GeneratedForce(val token: String, val label: String, val group: String)

/** All ${catalog.length} forces in the canonical catalog, single-sourced from the JS engine. */
val GENERATED_FORCES: List<GeneratedForce> = listOf(
${ktEntries}
)
`;

const ktPath = join(ROOT, 'android/lab/src/main/kotlin/com/fundamental/lab/GeneratedForceCatalog.kt');
mkdirSync(dirname(ktPath), { recursive: true });
writeFileSync(ktPath, ktSrc);
console.log(`\u2713 android/lab/.../GeneratedForceCatalog.kt \u2014 ${catalog.length} entries`);

if (catalog.length !== passportRows.length) {
  console.error(
    `ERROR: catalog has ${catalog.length} entries but passport parsed ${passportRows.length} rows — they must agree.`,
  );
  process.exit(1);
}
if (catalog.length < 30) {
  console.error(
    `ERROR: only ${catalog.length} forces found — expected at least 30. Check source parsing.`,
  );
  process.exit(1);
}
console.log(`✓ catalog count = ${catalog.length}`);
