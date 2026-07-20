/**
 * Observatory integrity — Phase O10.
 *
 * These tests do not check that the Observatory looks right. They check that it CANNOT become a source
 * of findings: that every registry section is passed through verbatim, that every citation resolves,
 * that pending work stays pending, and that neither the capture layer nor the UI carries a hardcoded
 * discovery, Ω_sys, or episode grouping.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { captureBundle } from './capture.ts';
import { BUNDLE_SCHEMA } from './evidence-log.ts';
import { corpus, corpusLedger } from '../conformance/corpus.ts';
import { discoveries } from '../conformance/discoveries.ts';
import { predictions, predictionAccuracy } from '../conformance/predictions.ts';
import { negativeResults } from '../conformance/negative-results.ts';
import { projectionClaims, projectionEvidenceProfile } from '../projection/evidence-profile.ts';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..', '..', '..', '..');
const appDir = join(repoRoot, 'apps', 'observatory');

const bundle = captureBundle({ commit: 'test', coreVersion: '0.0.0-test' });

// ───────────────────────────────────────────────────────── the runtime remains authoritative

test('O10: every registry section is the LIVE registry, passed through verbatim', () => {
  assert.deepEqual(bundle.registries.corpus, corpus());
  assert.deepEqual(bundle.registries.corpusLedger, corpusLedger());
  assert.deepEqual(bundle.registries.discoveries, discoveries());
  assert.deepEqual(bundle.registries.predictions, predictions());
  assert.deepEqual(bundle.registries.predictionAccuracy, predictionAccuracy());
  assert.deepEqual(bundle.registries.negativeResults, negativeResults());
  assert.deepEqual(bundle.registries.projectionClaims, projectionClaims());
  assert.deepEqual(bundle.registries.projectionProfile, projectionEvidenceProfile());
});

test('O10: the Observatory cannot show a discovery the runtime does not hold', () => {
  const shown = bundle.evidence.filter((n) => n.kind === 'discovery').map((n) => n.id).sort();
  const held = discoveries().map((d) => d.id).sort();
  assert.deepEqual(shown, held);
});

test('O10: pending corpus entries produce NO run and are reported as pending', () => {
  const captured = new Set(bundle.runs.map((r) => r.substrate));
  for (const entry of corpus().filter((e) => e.status === 'pending')) {
    assert.equal(captured.has(entry.substrate), false, `${entry.substrate} must not have a fabricated run`);
    assert.ok(bundle.pendingSubstrates.includes(entry.substrate), `${entry.substrate} must appear as pending`);
  }
  assert.equal(bundle.pendingSubstrates.length, 4);
});

test('O10: every captured run corresponds to an ADAPTED corpus entry', () => {
  const adapted = new Set(corpus().filter((e) => e.status === 'adapted').map((e) => e.substrate));
  for (const run of bundle.runs) assert.ok(adapted.has(run.substrate), `${run.substrate} is adapted`);
  assert.equal(bundle.runs.length, 4);
});

// ──────────────────────────────────────────────────────────────── every claim traces to evidence

test('O2: every evidence id referenced anywhere in the bundle resolves', () => {
  const ids = new Set(bundle.evidence.map((n) => n.id));
  for (const run of bundle.runs) {
    for (const t of run.transitions) {
      for (const id of t.evidenceIds) assert.ok(ids.has(id), `transition cites ${id}`);
    }
  }
  for (const p of bundle.projections) {
    for (const id of p.evidenceIds) assert.ok(ids.has(id), `projection cites ${id}`);
  }
  for (const d of bundle.detections) assert.ok(ids.has(d.evidenceId), `detection cites ${d.evidenceId}`);
});

test('O2: every evidence edge resolves — the DAG has no dangling citation', () => {
  const ids = new Set(bundle.evidence.map((n) => n.id));
  for (const node of bundle.evidence) {
    for (const from of node.derivedFrom) assert.ok(ids.has(from), `${node.id} derives from missing ${from}`);
  }
});

test('O2: every evidence node names the runtime function that produced it', () => {
  for (const node of bundle.evidence) {
    assert.ok(node.origin.length > 0, `${node.id} has provenance`);
    assert.match(node.origin, /\(\)|\.advance$/, `${node.id} origin names a function, not a UI label`);
  }
});

test('O2: evidence ids are unique — a citation cannot be ambiguous', () => {
  const ids = bundle.evidence.map((n) => n.id);
  assert.equal(new Set(ids).size, ids.length);
});

// ────────────────────────────────────────────────────────────────── faithful, not embellished

test('O4: state visibility is sourced from the runtime, and nothing is INFERRED', () => {
  const all = bundle.runs.flatMap((r) => r.stateFacts);
  assert.ok(all.length > 0);
  assert.equal(all.filter((f) => f.visibility === 'inferred').length, 0,
    'the runtime never infers state; a non-zero count would mean the capture layer invented one');
  for (const f of all) assert.ok(f.basis.length > 0, `${f.key} states why it carries its visibility`);
  // the field's lossy constructs are carried through as unavailable, from structuralCoverage()
  const field = bundle.runs.find((r) => r.substrate === 'FieldRuntime')!;
  assert.ok(field.stateFacts.some((f) => f.visibility === 'unavailable' && /structuralCoverage/.test(f.basis)));
});

test('O4: a substrate that cannot declare its law has no law in the bundle', () => {
  for (const run of bundle.runs) {
    if (run.capabilities.declareTransitionLaw) assert.ok(run.transitionLaw, `${run.substrate} declares a law`);
    else assert.equal(run.transitionLaw, undefined, `${run.substrate} must not be given one`);
  }
  // both cases are actually present, or this test proves nothing
  assert.ok(bundle.runs.some((r) => r.transitionLaw));
  assert.ok(bundle.runs.some((r) => !r.transitionLaw));
});

test('O4: alternate episode groupings are all retained — none overwrites another', () => {
  assert.ok(bundle.detections.length >= 3, 'several parameterizations recorded');
  const labels = new Set(bundle.detections.map((d) => d.label));
  assert.equal(labels.size, bundle.detections.length, 'each parameterization is kept separately');
  for (const d of bundle.detections) {
    assert.equal(d.result.conditional, true, 'detection findings are conditional, and shown as such');
  }
});

test('O8: ablations come from the executed harness, with every field populated', () => {
  assert.ok(bundle.ablations.length > 0);
  for (const a of bundle.ablations) {
    assert.ok(a.observed.length > 0, `${a.element}/${a.form} records an observed result`);
    assert.ok(a.evidence.length > 0);
    assert.ok(a.classification.length > 0);
  }
});

test('O3: replay input is deterministic — capturing twice yields identical transitions', () => {
  const again = captureBundle({ commit: 'test', coreVersion: '0.0.0-test' });
  assert.deepEqual(
    again.runs.map((r) => r.transitions),
    bundle.runs.map((r) => r.transitions),
    'a recorded run must replay identically, or the Observatory is not reproducible',
  );
});

test('O2: the bundle declares its schema', () => {
  assert.equal(bundle.revision.bundleSchema, BUNDLE_SCHEMA);
});

// ─────────────────────────────────────────────────────── no findings authored in capture or UI

const FORBIDDEN_LITERALS: readonly RegExp[] = [
  /['"`]D-\d{3}['"`]/, // a hardcoded discovery id
  /['"`]N-\d{3}['"`]/, // a hardcoded negative result
  /['"`]P-\d{3}['"`]/, // a hardcoded prediction
  /generalized-with-refinement/,
  /non-substitutable|derived-complete|derived-conditional/, // ablation classifications
];

test('O10: the capture layer authors no findings — it only records what the runtime returned', () => {
  const src = readFileSync(join(here, 'capture.ts'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  for (const p of FORBIDDEN_LITERALS) {
    assert.ok(!p.test(src), `capture.ts must not contain ${p} — findings come from the registries`);
  }
});

test('O10: the Observatory UI derives nothing — no hardcoded findings, no runtime decisions', () => {
  if (!existsSync(appDir)) return; // app not present in this checkout
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      // `test/` is calibration code, not shipped UI: its fixtures legitimately name ids to prove
      // instrument events cannot collide with subject evidence ids.
      if (entry.name === 'node_modules' || entry.name === 'bundle.json' || entry.name === 'test') continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(js|mjs|html)$/.test(entry.name)) files.push(full);
    }
  };
  walk(appDir);
  assert.ok(files.length > 0, 'the app has source to check');

  for (const file of files) {
    const src = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    for (const p of FORBIDDEN_LITERALS) {
      assert.ok(!p.test(src), `${file} must not contain ${p} — the UI renders the bundle, it does not know findings`);
    }
    // the UI must not re-implement runtime derivation
    for (const p of [/evaluateOpportunity/, /detectEpisodes/, /runAblations/, /\bproject\s*\(/]) {
      assert.ok(!p.test(src), `${file} must not call or reimplement a runtime derivation (${p})`);
    }
  }
});

test('O10: the same capture path serves every substrate — no per-substrate special cases', () => {
  const src = readFileSync(join(here, 'capture.ts'), 'utf8');
  // recordRun is generic and used for all four; there is no branch on substrate identity inside it
  const body = src.slice(src.indexOf('function recordRun'), src.indexOf('// ────', src.indexOf('function recordRun')));
  for (const name of ['FiniteStateMachine', 'SearchPlanner', 'QualityGovernor', 'FieldRuntime']) {
    assert.ok(!body.includes(name), `recordRun must not mention ${name}`);
  }
});
