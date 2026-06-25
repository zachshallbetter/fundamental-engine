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

// Parse each row object. Rows span one line each in the source.
// Pattern: { token: 'X', label: 'Y', family: F, klass: 'K', truthMode: 'T', ... }
const rowRegex = /\{\s*token:\s*'([a-z][a-z-]*)'\s*,\s*label:\s*'([^']+)'\s*,\s*family:\s*([CNE])\s*,\s*klass:\s*'([^']+)'\s*,\s*truthMode:\s*'([a-z]+)'/g;

const passportRows = [];
for (const m of rowsBlock.matchAll(rowRegex)) {
  passportRows.push({
    token: m[1],
    label: m[2],
    family: FAMILY_ALIASES[m[3]] ?? m[3],
    klass: m[4],
    truthMode: m[5],
  });
}

if (passportRows.length === 0) {
  console.error('ERROR: No rows parsed from passport.ts ROWS block.');
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
    return `    ForceEntry(token: "${f.token}", label: "${f.label}", family: "${f.family}", cls: "${f.class}", truthMode: "${f.truthMode}", color: ${colorLit})`;
  })
  .join(',\n');

const swiftSrc = `// GeneratedForceCatalog.swift — AUTO-GENERATED by scripts/gen-force-catalog.mjs
// DO NOT EDIT. Run \`node scripts/gen-force-catalog.mjs\` (or \`pnpm gen:force-catalog\`) to regenerate.
// Source of truth: packages/core/src/contracts/passport.ts + packages/core/src/config/forces.config.ts

/// A force entry from the canonical catalog (auto-generated).
public struct ForceEntry: Identifiable, Codable {
    public var id: String { token }
    public let token: String
    public let label: String
    public let family: String
    public let cls: String
    public let truthMode: String
    public let color: String?
}

/// All ${catalog.length} forces in the canonical catalog, single-sourced from the JS engine.
public let GENERATED_FORCE_CATALOG: [ForceEntry] = [
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
if (catalog.length < 30) {
  console.error(
    `ERROR: only ${catalog.length} forces found — expected 36. Check source parsing.`,
  );
  process.exit(1);
}
console.log(`✓ catalog count = ${catalog.length} (expected 36)`);
