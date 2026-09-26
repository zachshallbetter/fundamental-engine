#!/usr/bin/env node
/**
 * gen:parity-matrix — the cross-platform capability support matrix (docs-refactor Phase 0, §3/§5).
 *
 * The guides used to imply the three platforms (JS · Swift · Kotlin) offer the same surface. They do
 * not — Swift is the high-water mark, Kotlin lags. This generator makes that divergence a MACHINE-
 * CHECKABLE fact: it enumerates each plane's public symbols from the port sources plus the shared
 * cross-plane conformance golden, and emits `data/parity-matrix.json` — the data behind the §3 table.
 *
 * Because the three ports have no shared reflection surface, each plane gets a LIGHTWEIGHT
 * public-symbol extractor (a scoped regex parse of its FieldHandle + force + render vocabulary):
 *   - JS      : the `FieldHandle`/`FieldOptions` interfaces + the three force-source files + the
 *               `RenderMode`/`OverlayMode`-equivalent vocab (core/types.ts, forces/*, passport.ts),
 *               reusing the same scoping the check:docs gate already trusts, plus the frozen public
 *               values from scripts/api-surface.data.mjs.
 *   - Swift   : the `public protocol FieldHandle` block + the `RenderMode`/`OverlayMode` enums +
 *               the force catalogs (swift/Sources/FundamentalCore/**).
 *   - Kotlin  : the `class FieldHandle` block + the `enum class RenderMode`/`OverlayMode` +
 *               the force catalogs (android/fundamental-core/src/main/**).
 * Shared      : the conformance golden's force list (the ports are proven equal on it at depth:0).
 * Palette     : the multi-hue palette capability at the option / declarative-host / imperative-host
 *               layers (#1091) — colour was the one dimension the matrix never tracked, which is how
 *               the Compose single-accent collapse (#1090) reached an app before any gate.
 *
 * TWO EXTRACTION BUGS FIXED IN PHASE 3 (#998), both of the same class Phase 2 found in the render
 * vocabulary — a plane's column was produced by something other than that plane's real surface:
 *   1. `field-handle-methods` compared APPLES TO ORANGES. The Swift extractor swept up the protocol's
 *      `var` requirements alongside its `func`s; the JS and Kotlin ones took callables only. So
 *      `policy`, `projections` and `overlayRegistry` — members ALL THREE planes have — rendered as
 *      Swift-only, inventing two gaps on the exact dimension the imperative reference documents.
 *      Methods are now callables on every plane, and the property surface is its own dimension.
 *   2. `field-options` claimed KOTLIN SUPPORTS NOTHING. Its plane set was a literal `new Set()` — a
 *      hand-written support claim, which is the one thing this generator exists to prevent. Kotlin
 *      configures at `createField(host, …)` and through the handle's setters; that surface is now
 *      extracted and collapsed onto the option names the same way `data-body` collapses to `tokens`.
 *
 * A capability that is an IDIOM difference (DOM scan vs `.fieldBody()` vs `Modifier.fieldBody`) is an
 * equivalent, not a gap; a capability genuinely absent (a method missing from a port's handle) is a
 * gap. The matrix records, per capability row, the raw support set on each plane so downstream (the
 * check:docs gate, the docs support rows) can render `JS ✓ · Swift ✓ · Kotlin ✗` honestly.
 *
 *   pnpm gen:parity-matrix    # regenerate data/parity-matrix.json after a port surface change
 *   pnpm check:docs           # CI gate: regenerates the matrix and fails if the committed copy drifted
 *
 * Lives in scripts/ (plain JS, node:fs) alongside the other generators; the ports are parsed as text,
 * so nothing here compiles Swift/Kotlin — a grep/parse of the public surface is the v1 contract (§11).
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(resolve(root, p), 'utf8');
const readIf = (p) => (existsSync(resolve(root, p)) ? read(p) : '');

// ── generic scoping helper ──────────────────────────────────────────────────────────────────────

/** Slice a source from the first line containing `header` to the first subsequent column-0 `}` —
 *  the same block-scoping the check:docs gate uses so we never pick up a sibling type's members. */
function blockAfter(src, header) {
  const start = src.indexOf(header);
  if (start < 0) return '';
  const rest = src.slice(start);
  const endRel = rest.search(/\n\}/);
  return endRel < 0 ? rest : rest.slice(0, endRel);
}

/** Slice a source from `header` to the matching close of the parenthesis it opens — for a Kotlin
 *  primary constructor (`class BodySpec(` … `\n)`) or a multi-line Swift/Kotlin function signature,
 *  neither of which ends at a column-0 `}`. Depth-counted so a nested `(` in a default value
 *  (`rect: () -> Box`) does not close the block early. */
function parenBlockAfter(src, header) {
  const at = src.indexOf(header);
  if (at < 0) return '';
  const open = src.indexOf('(', at);
  if (open < 0) return '';
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '(') depth++;
    else if (src[i] === ')') {
      depth--;
      if (depth === 0) return src.slice(open + 1, i);
    }
  }
  return '';
}

/** Parameter/property names in a Swift or Kotlin signature block — every `name:` at paren depth 0,
 *  so a closure parameter's own label (`(_ view: AnyObject, …)`) is not mistaken for a parameter. */
function paramNames(block) {
  const set = new Set();
  let depth = 0;
  let token = '';
  for (let i = 0; i < block.length; i++) {
    const c = block[i];
    if (c === '(' || c === '[' || c === '<') depth++;
    else if (c === ')' || c === ']' || c === '>') depth--;
    else if (depth === 0 && c === ':') {
      const m = token.match(/([A-Za-z_]\w*)\s*$/);
      if (m) set.add(m[1]);
      token = '';
      continue;
    } else if (depth === 0 && (c === ',' || c === '\n')) {
      token = '';
      continue;
    }
    if (depth === 0) token += c;
  }
  return set;
}

const sortedArr = (set) => [...set].sort();

/** Canonicalize a render/overlay mode id to kebab-case so pure idiom differences (`fieldLines` on
 *  Swift/Kotlin vs `field-lines` on JS, `none_`/`NONE` vs `none`) collapse to ONE symbol — they are
 *  equivalents, not gaps. Naming-lane spelling is not a capability divergence. */
const kebab = (s) => s.replace(/_+$/, '').replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
const kebabSet = (set) => new Set([...set].map(kebab));

// ── JS (reference) extractors ─────────────────────────────────────────────────────────────────────

const jsTypes = read('packages/core/src/engine/types.ts');
const jsPassport = read('packages/core/src/contracts/passport.ts');

/** CALLABLE members of the JS `FieldHandle` — `name(` / `name<`. Properties are a separate dimension
 *  (see {@link jsHandleProperties}); mixing the two is what made this dimension incomparable before
 *  Phase 3 (the Swift extractor collected `var`s, the JS and Kotlin ones did not — see the header). */
function jsHandleMethods() {
  const set = new Set();
  const block = blockAfter(jsTypes, 'export interface FieldHandle');
  for (const m of block.matchAll(/\n\s{2}([a-zA-Z][\w]*)\s*[(<]/g)) set.add(m[1]);
  return set;
}

/** NON-callable members of the JS `FieldHandle` — `readonly name: T` / `name: T` on the interface.
 *  Four today: `version`, `guarantees`, `policy`, `projections`. */
function jsHandleProperties() {
  const set = new Set();
  const block = blockAfter(jsTypes, 'export interface FieldHandle');
  for (const m of block.matchAll(/\n\s{2}(?:readonly\s+)?([a-zA-Z][\w]*)\s*:/g)) set.add(m[1]);
  return set;
}

function jsOptions() {
  const set = new Set();
  const block = blockAfter(jsTypes, 'interface FieldOptions');
  for (const m of block.matchAll(/\n\s{2}([a-zA-Z][\w]*)\??:/g)) set.add(m[1]);
  return set;
}

function jsForceTokens() {
  const set = new Set();
  for (const f of [
    'packages/core/src/forces/index.ts',
    'packages/core/src/forces/natural.ts',
    'packages/core/src/forces/extended.ts',
  ]) {
    for (const m of read(f).matchAll(/token:\s*'([a-z][a-z-]+)'/g)) set.add(m[1]);
  }
  return set;
}

/** The UNDERLAY render vocabulary — `RenderModeName`, the one declaration `FieldHandle.setRender`,
 *  `FieldOptions.render` and `<field-root render>` all take (#1218). This is the set the Swift/Kotlin
 *  `RenderMode` enums mirror, so it is the only JS set they can honestly be compared against.
 *
 *  NOT `passport.ts`'s `RenderMode` union, which this extractor used to read (fixed in Phase 2): that
 *  is the visualization TAXONOMY vocabulary — it carries `field-lines` and `heatmap` (an OVERLAY
 *  reading and `setHeatmap`, neither accepted by `setRender`) and omits the five modes JS actually
 *  gained since (`flow`, `knockout`, `redshift`, `blackbody`, `depth`). Comparing it to the ports'
 *  host enums both invented two JS render modes that do not exist and HID the real five-mode gap. */
function jsRenderModes() {
  const set = new Set();
  // Reads the `RenderModeName` TYPE declaration (#1218). `setRender` used to carry the union inline
  // and this extractor scoped to its signature; the vocabulary now has one declaration and the
  // signature is just `(mode: RenderModeName)`, which has no string literals to find — scoping to it
  // would silently yield an EMPTY set and report JS as having no render modes at all.
  //
  // Reading the declaration rather than `RENDER_MODE_LIST` is deliberate, as in check-docs.mjs: the
  // list is what the code derives from, and the exhaustiveness assertion in types.ts already proves
  // the two agree, so the generator keeps an independent source.
  const at = jsTypes.indexOf('export type RenderModeName');
  if (at < 0) throw new Error('gen:parity-matrix: could not find RenderModeName in core/types.ts');
  const block = jsTypes.slice(at, jsTypes.indexOf(';', at));
  for (const m of block.matchAll(/'([a-z][\w-]*)'/g)) set.add(m[1]);
  return set;
}

// ── the DECLARATIVE authoring surface (Phase 2, #997) ────────────────────────────────────────────
//
// The body contract is the surface most authors touch, and it is the one the three planes express
// most differently: a DOM attribute scan on JS, a SwiftUI view modifier on Swift, a Compose modifier
// on Kotlin. Those are IDIOM differences — so each plane's raw parameter name is canonicalized to one
// shared CONCEPT id (`data-body` → `tokens`, `angleDeg` → `angle`, `tint` → `color`,
// `onFeedback` → `feedback`) exactly the way `kebab()` already collapses `fieldLines`/`field-lines`.
// What survives the collapse is a genuine capability delta: Compose's `Modifier.fieldBody` really
// does take no feedback callback, and `authority` really is JS-only.

/** Raw per-plane spelling → the shared concept id. Naming-lane collapse only; never a support claim. */
const BODY_CONCEPT_ALIASES = {
  body: 'tokens',                 // JS: `data-body` carries the token list
  'angle-deg': 'angle',           // Kotlin: `angleDeg`
  tint: 'color',                  // Kotlin: `tint`
  'on-feedback': 'feedback',      // JS/Swift: `onFeedback` callback == the feedback opt-in
  'field-role': 'role',           // JS: `data-field-role`
  'field-boundary': 'boundary',   // JS: `data-field-boundary` (engine-set ownership marker)
};
const bodyConcept = (raw) => {
  const k = kebab(raw);
  return BODY_CONCEPT_ALIASES[k] ?? k;
};
const bodyConceptSet = (names) => new Set([...names].map(bodyConcept));

/** Body attribute suffixes (after `data-`) the DOM scanner recognizes — the same four parser paths the
 *  check:docs gate reads, so the matrix and the coverage gate can never disagree about the JS set. */
function jsBodyAttrs() {
  const set = new Set();
  const src = read('packages/core/src/engine/scanner.ts');
  for (const m of src.matchAll(/a\.(?:get|has)\('([\w-]+)'\)/g)) set.add(m[1]);
  for (const m of src.matchAll(/num\('([\w-]+)',/g)) set.add(m[1]);
  for (const m of src.matchAll(/getAttribute\('data-([\w-]+)'\)/g)) set.add(m[1]);
  for (const m of src.matchAll(/\[data-([\w-]+)\]/g)) set.add(m[1]);
  if (src.includes('dataset.color')) set.add('color');
  return set;
}

/** Fields of the programmatic `BodySpec` on each plane — `rect` (the position source) is dropped: it is
 *  the host seam every plane must have, not an authoring capability. */
function jsBodySpec() {
  const set = new Set();
  for (const m of blockAfter(jsTypes, 'export interface BodySpec').matchAll(/\n\s{2}([a-zA-Z]\w*)\??:/g)) set.add(m[1]);
  set.delete('rect');
  return set;
}
function swiftBodySpec() {
  const set = new Set();
  for (const m of blockAfter(swiftHandleSrc, 'public struct BodySpec').matchAll(/\bpublic\s+var\s+([a-zA-Z]\w*)\s*:/g)) set.add(m[1]);
  set.delete('rect');
  return set;
}
function kotlinBodySpec() {
  const set = paramNames(parenBlockAfter(ktHandleSrc, 'class BodySpec'));
  set.delete('rect');
  return set;
}

/** The DECLARATIVE host's body-attachment surface on each plane: SwiftUI `.fieldBody(...)` and
 *  Compose `Modifier.fieldBody(...)`. (JS's is the DOM scan — `jsBodyAttrs()` above.) */
function swiftDeclarativeBody() {
  return paramNames(parenBlockAfter(swiftUiViewSrc, 'func fieldBody('));
}
function kotlinDeclarativeBody() {
  return paramNames(parenBlockAfter(ktComposeViewSrc, 'fun Modifier.fieldBody('));
}

/** Per-body feedback CHANNELS — the plain-data record every plane produces each frame. The DELIVERY
 *  differs (CSS custom properties · `onFeedback` closure · `FeedbackSink`/`StateRegistry`); the record
 *  itself is the capability, so it is what this dimension compares. */
function jsFeedbackChannels() {
  const set = new Set();
  for (const m of blockAfter(jsTypes, 'export interface FeedbackChannels').matchAll(/\n\s{2}([a-zA-Z]\w*)\??:/g)) set.add(m[1]);
  return set;
}
function swiftFeedbackChannels() {
  const set = new Set();
  for (const m of blockAfter(swiftHandleSrc, 'public struct FeedbackChannels').matchAll(/\bpublic\s+var\s+([a-zA-Z]\w*)\s*:/g)) set.add(m[1]);
  return set;
}
function kotlinFeedbackChannels() {
  return paramNames(parenBlockAfter(ktRegistriesSrc, 'data class FeedbackChannels'));
}

/** The render modes each plane's DECLARATIVE HOST actually DRAWS — the layer a capability can be lost
 *  at without any engine symbol going missing. This is the render-surface analogue of the palette
 *  dimension (#1091): the Kotlin CORE declares a `RenderMode` enum of seven, and the Compose host that
 *  paints the canvas used to declare its own four-case enum — so `metaballs`, `voronoi` and
 *  `streamlines` could not even be EXPRESSED from a Compose app (#1158, closed: the host now takes the
 *  core enum and draws every mode).
 *  JS has no separate host renderer (the engine owns the underlay draw), so its host set IS the
 *  `setRender` vocabulary. */
function jsRenderHostModes() {
  const set = new Set(jsRenderModes());
  set.delete('none');
  return set;
}
function swiftRenderHostModes() {
  const set = new Set();
  const src = readIf('swift/Sources/FundamentalVanilla/CoreGraphicsRenderer.swift');
  const at = src.indexOf('switch frame.mode');
  for (const m of src.slice(at, src.indexOf('\n            }', at)).matchAll(/case\s+\.([a-zA-Z]\w*)\s*:/g)) set.add(m[1]);
  set.delete('none_');
  return set;
}
function kotlinRenderHostModes() {
  // The modes the Compose `Canvas` actually PAINTS, read from the `when (renderMode)` branches in
  // FieldView.kt. Until #1158 this read a host-local `enum class RenderMode` of four cases; the host
  // no longer declares one — it takes the engine's `RenderMode`, and the `when` is an exhaustive
  // expression over it, so the branch set IS the honest draw surface (and a new core mode breaks the
  // host build rather than silently drawing nothing). `NONE` is dropped, as it is on the other planes:
  // this dimension counts modes that DRAW.
  const set = new Set();
  const at = ktComposeViewSrc.indexOf('when (renderMode)');
  if (at < 0) return set;
  const block = ktComposeViewSrc.slice(at, ktComposeViewSrc.indexOf('\n            }', at));
  for (const m of block.matchAll(/RenderMode\.([A-Z][A-Z0-9_]*)\s*->/g)) set.add(m[1].toLowerCase());
  set.delete('none');
  return set;
}

/** `data-when` gate ids — the built-in condition registry on each plane. */
function jsConditions() {
  const set = new Set();
  const block = blockAfter(read('packages/core/src/engine/conditions.ts'), 'export const conditions');
  for (const m of block.matchAll(/\n\s{2}([a-z]\w*):/g)) set.add(m[1]);
  return set;
}
function swiftConditions() {
  const set = new Set();
  const block = blockAfter(readIf('swift/Sources/FundamentalCore/Engine/Conditions.swift'), 'public func builtinConditions');
  for (const m of block.matchAll(/"([a-z]\w*)":/g)) set.add(m[1]);
  return set;
}
function kotlinConditions() {
  const set = new Set();
  const src = readIf('android/fundamental-core/src/main/kotlin/com/fundamental/core/engine/Conditions.kt');
  const at = src.indexOf('fun builtinConditions');
  for (const m of src.slice(at).matchAll(/"([a-z]\w*)"\s+to\b/g)) set.add(m[1]);
  return set;
}

/** Global formation preset ids (`setFormation` / `<field-root formation>`). */
function jsFormations() {
  const set = new Set();
  const src = read('packages/core/src/config/forces.config.ts');
  const at = src.indexOf('export const FORMATIONS');
  for (const m of src.slice(at, src.indexOf('] as const;', at)).matchAll(/\bid:\s*'([a-z]\w*)'/g)) set.add(m[1]);
  return set;
}
function swiftFormations() {
  const set = new Set();
  for (const m of readIf('swift/Sources/FundamentalCore/Engine/Formations.swift').matchAll(/FormationDef\(id:\s*"([a-z]\w*)"/g)) set.add(m[1]);
  return set;
}
function kotlinFormations() {
  const set = new Set();
  for (const m of readIf('android/fundamental-core/src/main/kotlin/com/fundamental/core/engine/Formations.kt').matchAll(/FormationDef\(\s*"([a-z]\w*)"/g)) set.add(m[1]);
  return set;
}

/** Overlay reading vocab — the `OverlayMode` string union in core/types.ts. */
function jsOverlayModes() {
  const set = new Set();
  const start = jsTypes.indexOf('export type OverlayMode');
  if (start >= 0) {
    const block = jsTypes.slice(start, jsTypes.indexOf(';', start));
    for (const m of block.matchAll(/'([a-zA-Z][\w-]*)'/g)) set.add(m[1]);
  }
  return set;
}

/** Frozen public value exports (createField, browserHost, bindData, …) from the api-surface data. */
async function jsFrozenValues() {
  const mod = await import(resolve(root, 'scripts/api-surface.data.mjs'));
  return new Set(mod.PROTECTED_VALUES.map((v) => v.name));
}

// ── Swift extractors ──────────────────────────────────────────────────────────────────────────────

const swiftHandleSrc = readIf('swift/Sources/FundamentalCore/Engine/FieldHandle.swift');
const swiftForceFiles = [
  'swift/Sources/FundamentalCore/Forces/CoreForces.swift',
  'swift/Sources/FundamentalCore/Forces/NaturalForces.swift',
  'swift/Sources/FundamentalCore/Forces/ExtendedForces.swift',
];

/** CALLABLE requirements of the `public protocol FieldHandle` — `func name(` only.
 *  (Until Phase 3 this also swept up the protocol's `var` requirements, so `policy`, `projections` and
 *  `overlayRegistry` sat in the METHOD set on Swift and nowhere else — see {@link swiftHandleProperties}.) */
function swiftHandleMethods() {
  const set = new Set();
  const block = blockAfter(swiftHandleSrc, 'public protocol FieldHandle');
  for (const m of block.matchAll(/\bfunc\s+([a-zA-Z]\w*)\s*[(<]/g)) set.add(m[1]);
  return set;
}

/** NON-callable requirements of the Swift protocol — `var name: T { get }`. */
function swiftHandleProperties() {
  const set = new Set();
  const block = blockAfter(swiftHandleSrc, 'public protocol FieldHandle');
  for (const m of block.matchAll(/\bvar\s+([a-zA-Z]\w*)\s*:/g)) set.add(m[1]);
  return set;
}

function swiftOptions() {
  const set = new Set();
  const block = blockAfter(swiftHandleSrc, 'public struct FieldOptions');
  for (const m of block.matchAll(/\bpublic\s+var\s+([a-zA-Z]\w*)\s*:/g)) set.add(m[1]);
  return set;
}

function swiftForceTokens() {
  const set = new Set();
  for (const f of swiftForceFiles) {
    // `public let token = "attract"` — the per-force declaration in the Swift catalogs.
    for (const m of readIf(f).matchAll(/\btoken\s*=\s*"([a-z][a-z-]+)"/g)) set.add(m[1]);
  }
  return set;
}

/** Enum-case names of a Swift `enum Name: String { case a, b, c }` (single or multi-line). */
function swiftEnumCases(src, enumName) {
  const set = new Set();
  const block = blockAfter(src, `enum ${enumName}`);
  for (const line of block.split('\n')) {
    const m = line.match(/^\s*case\s+(.+)$/);
    if (!m) continue;
    for (const raw of m[1].split(',')) {
      // drop an associated-value list `(…)` AND a raw-value assignment `= "bug-report"`, then the
      // trailing underscore Swift uses to escape a keyword case (`public_`).
      const name = raw.trim().replace(/\(.*$/, '').replace(/=.*$/, '').trim().replace(/_+$/, '').trim();
      if (name && /^[a-zA-Z]/.test(name)) set.add(name);
    }
  }
  return set;
}

const swiftRenderModes = () => swiftEnumCases(swiftHandleSrc, 'RenderMode');
const swiftOverlayModes = () => swiftEnumCases(swiftHandleSrc, 'OverlayMode');

// ── Kotlin extractors ───────────────────────────────────────────────────────────────────────────

const ktHandleSrc = readIf('android/fundamental-core/src/main/kotlin/com/fundamental/core/runtime/FieldHandle.kt');
const ktForceFiles = [
  'android/fundamental-core/src/main/kotlin/com/fundamental/core/forces/CoreForces.kt',
  'android/fundamental-core/src/main/kotlin/com/fundamental/core/forces/NaturalForces.kt',
  'android/fundamental-core/src/main/kotlin/com/fundamental/core/forces/ExtendedForces.kt',
];

function kotlinHandleMethods() {
  const set = new Set();
  const block = blockAfter(ktHandleSrc, 'class FieldHandle');
  // Public functions are the default visibility in Kotlin (`fun name(`); skip `private`/`internal`.
  for (const m of block.matchAll(/\n\s*(?:@\w+\s+)*(?!private|internal)fun\s+([a-zA-Z]\w*)\s*\(/g)) set.add(m[1]);
  return set;
}

/** NON-callable public members of the Kotlin `FieldHandle` — top-level `val`/`var` on the class body
 *  (4-space indent), excluding the `private`/`internal` backing fields. Kotlin is the read-back-richest
 *  plane here: it exposes a getter for nearly every setter (`accent`, `renderMode`, `qualityTier`, …)
 *  where JS and Swift are write-only. That is a real, if minor, capability delta and the row says so. */
function kotlinHandleProperties() {
  const set = new Set();
  const block = blockAfter(ktHandleSrc, 'class FieldHandle');
  for (const m of block.matchAll(/\n {4}(?:@\w+\s+)*(?:val|var)\s+([a-zA-Z]\w*)\s*:/g)) set.add(m[1]);
  return set;
}

function kotlinForceTokens() {
  const set = new Set();
  // `override val token = "attract"` — the per-force declaration in the Kotlin catalogs.
  for (const f of ktForceFiles) {
    for (const m of readIf(f).matchAll(/\btoken\s*=\s*"([a-z][a-z-]+)"/g)) set.add(m[1]);
  }
  return set;
}

/** Enum-entry names of a Kotlin `enum class Name(...) { A("a"), B("b") }`. */
function kotlinEnumCases(src, enumName) {
  const set = new Set();
  const block = blockAfter(src, `enum class ${enumName}`);
  for (const m of block.matchAll(/\b([A-Z][A-Z0-9_]*)\s*\(\s*"([a-z][\w-]*)"/g)) set.add(m[2]);
  return set;
}

/** Entry names of a BARE Kotlin enum (no constructor): `enum class FieldEvent { TICK, BODY_ADD }`.
 *  SCREAMING_SNAKE has no lower→upper transition for `kebab()` to split on, so the snake case is
 *  lowered to kebab HERE — that is what makes Kotlin's `BODY_ADD`, Swift's `bodyAdd` and a JS
 *  `body-add` collapse to one concept instead of reading as three separate capabilities. */
function kotlinBareEnumEntries(src, enumName) {
  const set = new Set();
  const at = src.indexOf(`enum class ${enumName}`);
  if (at < 0) return set;
  const open = src.indexOf('{', at);
  const close = src.indexOf('}', open);
  if (open < 0 || close < 0) return set;
  for (const raw of src.slice(open + 1, close).split(',')) {
    const name = raw.trim();
    if (/^[A-Z][A-Z0-9_]*$/.test(name)) set.add(name.toLowerCase().replace(/_/g, '-'));
  }
  return set;
}

/** `setAccent` → `accent`: the SETTER lane of a configuration name, collapsed onto the name itself.
 *  A constructor field and a live setter are two idioms for ONE capability — "can this plane
 *  configure X" — so this is the same naming-lane collapse `data-body` → `tokens` already uses. It is
 *  applied to ALL THREE planes so the resulting column comparison stays symmetric. */
const settersToNames = (methods) => {
  const set = new Set();
  for (const m of methods) {
    const hit = /^set([A-Z]\w*)$/.exec(m);
    if (hit) set.add(hit[1].charAt(0).toLowerCase() + hit[1].slice(1));
  }
  return set;
};

/** Kotlin's CONSTRUCTION-time vocabulary — the `createField(…)` parameters of both overloads. The
 *  plane has no `FieldOptions` struct, so this plus its setters (above) is its configuration surface.
 *
 *  Until Phase 3 this plane's column was a HAND-WRITTEN `new Set()` ("Kotlin uses setters"), which
 *  rendered as *supports nothing* on every option row — a support claim nobody had checked and that
 *  was simply false: `createField(host, …)` takes `seed` / `identify` / `policy` / `integrator` /
 *  `restingMotion` at construction, and the handle carries a setter for most of the rest. */
function kotlinCreateFieldParams() {
  const set = new Set();
  for (let at = ktHandleSrc.indexOf('fun createField('); at >= 0; at = ktHandleSrc.indexOf('fun createField(', at + 1)) {
    for (const p of paramNames(parenBlockAfter(ktHandleSrc.slice(at), 'fun createField('))) set.add(p);
  }
  return set;
}

const jsConfiguration = () => new Set([...jsOptions(), ...settersToNames(jsHandleMethods())]);
const swiftConfiguration = () => {
  const set = new Set([...swiftOptions(), ...settersToNames(swiftHandleMethods())]);
  // Swift keeps the HOST seam out of `FieldOptions` and takes it as its own constructor argument
  // (`FieldField(host:options:)`), the way Kotlin takes it on `createField`. Same capability, another
  // idiom — probe for it rather than letting a struct-only read report a gap that does not exist.
  if (/\binit\(host:\s*any FieldHost/.test(swiftVanillaSrc)) set.add('host');
  return set;
};
const kotlinConfiguration = () => new Set([...kotlinCreateFieldParams(), ...settersToNames(kotlinHandleMethods())]);

// ── the imperative/observable surface (Phase 3, #998) ───────────────────────────────────────────
//
// The half of the engine you reach from CODE rather than markup: the event bus, the agent-view
// capability grant, the snapshot profiles, the policy budgets, and the body handle. Each is a small
// closed vocabulary on all three planes, so each is extracted the same way the declarative ones are.

/** Discrete event ids on the `on(...)` bus. JS keys a map; the ports use an enum, so the ids are
 *  kebabed (`bodyAdd` / `BODY_ADD` → `body-add`) before comparing. The divergence here runs BOTH
 *  ways: the ports carry lifecycle events (`tick`, `body-add`, `body-remove`) JS does not expose on
 *  this bus, and JS carries the proximity trio + `focus` the ports have not ported. */
function jsFieldEvents() {
  const set = new Set();
  const block = blockAfter(read('packages/core/src/engine/events.ts'), 'export interface FieldEventMap');
  for (const m of block.matchAll(/\n\s{2}([a-zA-Z]\w*)\s*:/g)) set.add(m[1]);
  return set;
}
const swiftFieldEvents = () => swiftEnumCases(swiftHandleSrc, 'FieldEvent');
const kotlinFieldEvents = () => kotlinBareEnumEntries(ktHandleSrc, 'FieldEvent');

/** `AgentCapability` grants for `forAgent` — the `read:*` tokens. Every plane spells the TOKEN
 *  literally (JS as the union member, Swift as the enum's raw value, Kotlin as the entry's `token`),
 *  so the token itself is the concept id and no aliasing is needed. */
const readTokens = (src, from) => {
  const set = new Set();
  const at = from ? src.indexOf(from) : 0;
  if (at < 0) return set;
  const rest = src.slice(at);
  const block = from ? rest.slice(0, rest.search(/\n\}/) + 1) : rest;
  for (const m of block.matchAll(/'read:([\w-]+)'|"read:([\w-]+)"/g)) set.add(`read:${m[1] ?? m[2]}`);
  return set;
};
const jsAgentCapabilities = () => readTokens(jsTypes, 'export type AgentCapability');
const swiftAgentCapabilities = () => readTokens(readIf('swift/Sources/FundamentalCore/Engine/AgentPermissions.swift'));
const kotlinAgentCapabilities = () =>
  readTokens(readIf('android/fundamental-core/src/main/kotlin/com/fundamental/core/runtime/AgentPermissions.kt'));

/** `SnapshotProfile` ids. Kebabed so Swift's `bugReport`/`public_` and Kotlin's `BUG_REPORT`/`PUBLIC`
 *  collapse onto the JS `'bug-report'` / `'public'` strings. */
function jsSnapshotProfiles() {
  const set = new Set();
  const at = jsTypes.indexOf('export type SnapshotProfile');
  if (at < 0) return set;
  for (const m of jsTypes.slice(at, jsTypes.indexOf(';', at)).matchAll(/'([a-z][\w-]*)'/g)) set.add(m[1]);
  return set;
}
const swiftSnapshotProfiles = () =>
  swiftEnumCases(readIf('swift/Sources/FundamentalCore/Engine/AgentPermissions.swift'), 'SnapshotProfile');
const kotlinSnapshotProfiles = () =>
  kotlinBareEnumEntries(readIf('android/fundamental-core/src/main/kotlin/com/fundamental/core/runtime/AgentPermissions.kt'), 'SnapshotProfile');

/** `FieldBudgets` lanes — the consumable-resource caps a `FieldPolicy` carries. */
function jsBudgets() {
  const set = new Set();
  for (const m of blockAfter(jsTypes, 'export interface FieldBudgets').matchAll(/\n\s{2}([a-zA-Z]\w*)\??:/g)) set.add(m[1]);
  return set;
}
function swiftBudgets() {
  const set = new Set();
  const src = readIf('swift/Sources/FundamentalCore/Engine/FieldPolicy.swift');
  for (const m of blockAfter(src, 'public struct FieldBudgets').matchAll(/\bpublic\s+var\s+([a-zA-Z]\w*)\s*:/g)) set.add(m[1]);
  return set;
}
function kotlinBudgets() {
  const src = readIf('android/fundamental-core/src/main/kotlin/com/fundamental/core/engine/Policy.kt');
  return paramNames(parenBlockAfter(src, 'data class FieldBudgets'));
}

/** `BodyHandle` members — what `addBody` hands back. The naming lane collapses Kotlin's `angleDeg`/
 *  `tint` the same way the body-spec dimension does; the position-source seam (`bodyRef`) is dropped
 *  for the same reason `rect` is dropped there (a host seam, not an authoring capability). */
function jsBodyHandle() {
  const set = new Set();
  for (const m of blockAfter(jsTypes, 'export interface BodyHandle').matchAll(/\n\s{2}(?:readonly\s+)?([a-zA-Z]\w*)\s*[(:]/g)) set.add(m[1]);
  return set;
}
function swiftBodyHandle() {
  const set = new Set();
  const block = blockAfter(swiftHandleSrc, 'public struct BodyHandle');
  for (const m of block.matchAll(/\bpublic\s+(?:let|var)\s+([a-zA-Z]\w*)\s*:/g)) set.add(m[1]);
  for (const m of block.matchAll(/\bpublic\s+func\s+([a-zA-Z]\w*)\s*\(/g)) set.add(m[1]);
  set.delete('bodyRef');
  return set;
}
function kotlinBodyHandle() {
  const set = new Set();
  const at = ktHandleSrc.indexOf('class BodyHandle');
  const block = ktHandleSrc.slice(at, ktHandleSrc.indexOf('\n}', at));
  for (const m of block.matchAll(/\n\s*(?!.*\b(?:private|internal)\b)(?:val|var)\s+([a-zA-Z]\w*)\s*:/g)) set.add(m[1]);
  for (const m of block.matchAll(/\n\s*(?:@\w+\s+)*(?!private|internal)fun\s+([a-zA-Z]\w*)\s*\(/g)) set.add(m[1]);
  return set;
}

const kotlinRenderModes = () => kotlinEnumCases(ktHandleSrc, 'RenderMode');
const kotlinOverlayModes = () => kotlinEnumCases(ktHandleSrc, 'OverlayMode');

// ── palette / colour (#1091) ────────────────────────────────────────────────────────────────────
// #1090 shipped a Compose host that collapsed a multi-hue palette to one accent, and nothing here
// caught it: the matrix tracked handle methods, options, forces and modes — never COLOUR. This
// dimension tracks the palette capability at each layer where a hue can be lost:
//   palette-option     the engine accepts a multi-hue palette (`FieldOptions.palette` on JS/Swift;
//                      the `setPalette` setter idiom on Kotlin, which has no options struct)
//   palette-host       the plane's declarative host applies it (`<field-root palette>` / SwiftUI
//                      `FieldView` / Compose `FieldView(palette:)`)
//   palette-view-host  the plane's imperative host applies it (vanilla `FieldField.setPalette` /
//                      Swift `FundamentalVanilla.FieldField.setPalette` / Android `FieldFieldView`)
// A port that supports one accent where another supports a palette array now shows as a parity
// delta instead of passing silently.

const jsElementsSrc = readIf('packages/elements/src/index.ts');
const jsVanillaSrc = readIf('packages/vanilla/src/field.ts');
const swiftUiViewSrc = readIf('swift/Sources/FundamentalSwiftUI/FieldView.swift');
const swiftVanillaSrc = readIf('swift/Sources/FundamentalVanilla/FieldField.swift');
const ktComposeViewSrc = readIf('android/fundamental-compose/src/main/kotlin/com/fundamental/compose/FieldView.kt');
const ktAndroidViewSrc = readIf('android/fundamental-android/src/main/kotlin/com/fundamental/android/FieldFieldView.kt');
// FeedbackChannels / FeedbackSink / OverlayMode live in the Kotlin PLATFORM module — the core port of
// Swift's FieldHandle.swift does not carry them yet (see that file's own TODO(parity)).
const ktRegistriesSrc = readIf('android/fundamental-platform/src/main/kotlin/com/fundamental/platform/Registries.kt');

function jsPalette() {
  const set = new Set();
  if (jsOptions().has('palette')) set.add('palette-option');
  if (/attr:\s*'palette'/.test(jsElementsSrc)) set.add('palette-host');
  if (/\bsetPalette\s*\(/.test(jsVanillaSrc)) set.add('palette-view-host');
  return set;
}

function swiftPalette() {
  const set = new Set();
  if (swiftOptions().has('palette')) set.add('palette-option');
  if (/\bsetPalette\s*\(/.test(swiftUiViewSrc)) set.add('palette-host');
  if (/\bsetPalette\s*\(/.test(swiftVanillaSrc)) set.add('palette-view-host');
  return set;
}

function kotlinPalette() {
  const set = new Set();
  if (/\bfun\s+setPalette\s*\(/.test(ktHandleSrc)) set.add('palette-option');
  // the Compose host takes a multi-hue list (`palette: List<Color>`, #1095); a single `accent` alone
  // is the #1090 collapse and does NOT count.
  if (/\bpalette\s*:\s*List<Color>/.test(ktComposeViewSrc)) set.add('palette-host');
  if (/\bpalette\s*:\s*List<|\bsetPalette\s*\(/.test(ktAndroidViewSrc)) set.add('palette-view-host');
  return set;
}

// ── shared conformance golden ─────────────────────────────────────────────────────────────────────

function goldenForces() {
  const g = JSON.parse(read('swift/Tests/FundamentalCoreTests/Fixtures/conformance-golden.json'));
  return new Set(g.forces ?? []);
}

// ── build the matrix ───────────────────────────────────────────────────────────────────────────

/** A capability dimension enumerated on each plane. `union` is every symbol seen on any plane; each
 *  plane lists which it supports, plus the count. A symbol present on JS but absent on Kotlin is a
 *  documented gap; the docs render the per-plane sets into a support row. */
function dimension(id, label, js, swift, kotlin, idiom) {
  const union = sortedArr(new Set([...js, ...swift, ...kotlin]));
  return {
    id,
    label,
    // How each plane SPELLS this capability (DOM scan vs `.fieldBody()` vs `Modifier.fieldBody`).
    // Descriptive only — a label the docs render beside the row; never a support claim. The ✓/✗ below
    // is always computed from the extracted symbol sets.
    ...(idiom ? { idiom } : {}),
    union,
    counts: { js: js.size, swift: swift.size, kotlin: kotlin.size },
    planes: {
      js: sortedArr(js),
      swift: sortedArr(swift),
      kotlin: sortedArr(kotlin),
    },
    // Per-symbol support triple — the honest ✓/✗ the §3 table renders.
    support: union.map((sym) => ({
      symbol: sym,
      js: js.has(sym),
      swift: swift.has(sym),
      kotlin: kotlin.has(sym),
    })),
  };
}

export async function buildParityMatrix() {
  const dims = [
    dimension('field-handle-methods', 'FieldHandle methods (callable members)', jsHandleMethods(), swiftHandleMethods(), kotlinHandleMethods()),
    // Kotlin has no FieldOptions struct — it configures at `createField(...)` and through the handle's
    // setters. That idiom is collapsed mechanically (see kotlinOptions), so the column is EXTRACTED
    // rather than hand-declared empty, which is what it was until Phase 3 (#998).
    dimension(
      'field-options',
      'Field configuration — what a plane can set, at construction or live',
      jsConfiguration(),
      swiftConfiguration(),
      kotlinConfiguration(),
      {
        js: 'the `FieldOptions` object (plus the handle’s `setX(…)` setters)',
        swift: 'the `FieldOptions` struct (plus the protocol’s `setX(_:)` requirements)',
        kotlin: '`createField(host, …)` arguments plus the handle’s `setX(…)` setters',
      },
    ),

    // ── the imperative / observable surface (Phase 3, #998) ──────────────────────────────────────
    dimension(
      'field-handle-properties',
      'FieldHandle properties (the non-callable members of the handle)',
      jsHandleProperties(),
      swiftHandleProperties(),
      kotlinHandleProperties(),
      {
        js: '`readonly x: T` on the `FieldHandle` interface',
        swift: '`var x: T { get }` on the `public protocol FieldHandle`',
        kotlin: '`val x: T` on the `FieldHandle` class — a getter for nearly every setter',
      },
    ),
    dimension(
      'field-events',
      'Discrete events on the `on(...)` bus',
      kebabSet(jsFieldEvents()),
      kebabSet(swiftFieldEvents()),
      kebabSet(kotlinFieldEvents()),
      {
        js: '`field.on(\'captured\', cb)` → an unsubscribe fn',
        swift: '`field.on(.captured) { … }` → a `Subscription`',
        kotlin: '`field.on(FieldEvent.CAPTURED) { … }` → a `Subscription`',
      },
    ),
    dimension(
      'agent-capabilities',
      'Agent-view capability grants (`forAgent`) — the read allow-list',
      jsAgentCapabilities(),
      swiftAgentCapabilities(),
      kotlinAgentCapabilities(),
      {
        js: '`forAgent({ capabilities: [\'read:metrics\'] })`',
        swift: '`forAgent(AgentViewOptions(capabilities: [.metrics]))`',
        kotlin: '`forAgent(setOf(AgentCapability.READ_METRICS))`',
      },
    ),
    dimension(
      'snapshot-profiles',
      'Snapshot inclusion profiles (`snapshot({ profile })`)',
      kebabSet(jsSnapshotProfiles()),
      kebabSet(swiftSnapshotProfiles()),
      kebabSet(kotlinSnapshotProfiles()),
    ),
    dimension(
      'field-budgets',
      'Policy budgets (`FieldPolicy.budgets`) — the consumable-resource caps',
      jsBudgets(),
      swiftBudgets(),
      kotlinBudgets(),
    ),
    dimension(
      'body-handle',
      'Body handle (`addBody(…)` → the live handle) members',
      bodyConceptSet(jsBodyHandle()),
      bodyConceptSet(swiftBodyHandle()),
      bodyConceptSet(kotlinBodyHandle()),
      {
        js: '`{ data, channels, set(), remove() }`',
        swift: '`BodyHandle` struct — `data`, `set`, `remove`, `load`, `drain`',
        kotlin: '`BodyHandle` class — `data`, `set`, `remove`, `identity`, `load`, `drain`',
      },
    ),
    dimension('force-tokens', 'Force tokens', jsForceTokens(), swiftForceTokens(), kotlinForceTokens()),
    dimension('render-modes', 'Render modes', kebabSet(jsRenderModes()), kebabSet(swiftRenderModes()), kebabSet(kotlinRenderModes())),
    dimension('overlay-modes', 'Overlay readings', kebabSet(jsOverlayModes()), kebabSet(swiftOverlayModes()), kebabSet(kotlinOverlayModes())),
    // colour is a capability too (#1091): the multi-hue palette at the option, declarative-host, and
    // imperative-host layers — the layer #1090 fell through.
    dimension('palette', 'Palette / colour (option · declarative host · imperative host)', jsPalette(), swiftPalette(), kotlinPalette()),

    // ── the declarative authoring surface (Phase 2, #997) ────────────────────────────────────────
    dimension(
      'declarative-body',
      'Declarative body contract (the parameters an author sets on the element itself)',
      bodyConceptSet(jsBodyAttrs()),
      bodyConceptSet(swiftDeclarativeBody()),
      bodyConceptSet(kotlinDeclarativeBody()),
      {
        js: '`data-*` attributes on any element, found by the DOM scan',
        swift: 'the SwiftUI `.fieldBody(tokens:…)` view modifier',
        kotlin: 'the Compose `Modifier.fieldBody(tokens, …)` modifier',
      },
    ),
    dimension(
      'body-spec',
      'Programmatic body spec (`addBody`) — the same contract for a body with no backing element',
      bodyConceptSet(jsBodySpec()),
      bodyConceptSet(swiftBodySpec()),
      bodyConceptSet(kotlinBodySpec()),
      {
        js: '`BodySpec` object literal',
        swift: '`BodySpec` struct',
        kotlin: '`BodySpec` class',
      },
    ),
    dimension(
      'feedback-channels',
      'Feedback channels — the per-body readings the field writes back each frame',
      jsFeedbackChannels(),
      swiftFeedbackChannels(),
      kotlinFeedbackChannels(),
      {
        js: 'CSS custom properties on the element (`--d`, `--load`, …), or a `feedbackSink`',
        swift: 'the `onFeedback: (FeedbackChannels) -> Void` closure, or a `FeedbackSink`',
        kotlin: 'a `FeedbackSink` / the `StateRegistry` (no per-body callback on `Modifier.fieldBody`)',
      },
    ),
    dimension(
      'render-host-modes',
      'Render modes the declarative HOST draws (the layer a mode can be silently lost at)',
      kebabSet(jsRenderHostModes()),
      kebabSet(swiftRenderHostModes()),
      kebabSet(kotlinRenderHostModes()),
      {
        js: 'the engine owns the underlay draw — no separate host renderer',
        swift: '`CoreGraphicsRenderer.draw(in:)` (Metal hybrid for dots/trails/links)',
        kotlin: 'the Compose `FieldView` `Canvas`, driven by the engine\'s `RenderMode` (an exhaustive `when`)',
      },
    ),
    dimension(
      'conditions',
      'Conditional gates (`data-when`) — the built-in condition registry',
      jsConditions(),
      swiftConditions(),
      kotlinConditions(),
      {
        js: '`data-when="fast"`',
        swift: '`Body.when`, resolved against `builtinConditions()`',
        kotlin: '`Body.when`, resolved against `builtinConditions()`',
      },
    ),
    dimension(
      'formations',
      'Global formation presets (`setFormation` / `<field-root formation>`)',
      jsFormations(),
      swiftFormations(),
      kotlinFormations(),
      {
        js: '`<field-root formation="wells">` or `field.setFormation(\'wells\')`',
        swift: '`FORMATIONS` / `formation(named:)`',
        kotlin: '`FORMATIONS` / `formation(named)`',
      },
    ),
  ];

  const golden = goldenForces();
  const frozenValues = await jsFrozenValues();

  return {
    generated: 'scripts/gen-parity-matrix.mjs',
    note:
      'Cross-platform capability support matrix (docs-refactor §3/§5). Regenerate with `pnpm gen:parity-matrix`; ' +
      'check:docs fails if a port gains/loses a symbol without regenerating. Symbol sets are extracted by a ' +
      'lightweight per-port parse of the public FieldHandle/force/render surface — an idiom difference is an ' +
      'equivalent, a missing symbol is a gap.',
    planes: ['js', 'swift', 'kotlin'],
    conformanceGolden: {
      note: 'The shared cross-plane golden the ports reproduce at depth:0 — the proof the force math matches.',
      forces: sortedArr(golden),
      count: golden.size,
    },
    frozenPublicValues: sortedArr(frozenValues),
    dimensions: dims,
  };
}

/** The committed artifact path, exported so check:docs compares against the same file. */
export const PARITY_MATRIX_PATH = resolve(root, 'data/parity-matrix.json');

/** Serialize the matrix exactly as it is written to disk (stable 2-space JSON + trailing newline). */
export function serializeParityMatrix(matrix) {
  return JSON.stringify(matrix, null, 2) + '\n';
}

// Run as a script (`node scripts/gen-parity-matrix.mjs`) → regenerate + write. On import, do nothing.
if (import.meta.url === `file://${process.argv[1]}`) {
  const matrix = await buildParityMatrix();
  writeFileSync(PARITY_MATRIX_PATH, serializeParityMatrix(matrix));

  console.log('gen:parity-matrix — cross-platform capability support (js · swift · kotlin)\n');
  for (const d of matrix.dimensions) {
    const { js, swift, kotlin } = d.counts;
    console.log(`  ${d.label}: JS ${js} · Swift ${swift} · Kotlin ${kotlin}  (union ${d.union.length})`);
  }
  console.log(`\n  conformance golden: ${matrix.conformanceGolden.count} forces at depth:0`);
  console.log(`\nwrote ${PARITY_MATRIX_PATH.replace(root + '/', '')}`);
}
