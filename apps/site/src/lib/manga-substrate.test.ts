import { test } from 'node:test';
import assert from 'node:assert/strict';
import { 
  MANGA_WORKS, 
  getWorkZScore, 
  computeEditionDiff, 
  exportSubstrateDna 
} from './manga-substrate-engine.ts';

test('Relational Substrate Engine — Ingestion Expectation Suite', async (t) => {
  const findWork = (id: string) => {
    const w = MANGA_WORKS.find((item) => item.id === id);
    assert.ok(w, `Corpus must contain work with ID: ${id}`);
    return w;
  };

  await t.test('BLAME! must land top-decile environmental scale and bottom-decile dialogue density', () => {
    const blame = findWork('work_blame');
    const z = getWorkZScore(blame);

    assert.ok(
      z.environmentalScale >= 1.28,
      `BLAME! z.environmentalScale (${z.environmentalScale.toFixed(2)}) must be >= +1.28 (top decile)`
    );
    assert.ok(
      z.dialogueDensity <= -1.28,
      `BLAME! z.dialogueDensity (${z.dialogueDensity.toFixed(2)}) must be <= -1.28 (bottom decile)`
    );
  });

  await t.test('Chainsaw Man must land top-decile SFX area and rotation entropy', () => {
    const csm = findWork('work_chainsaw_man');
    const z = getWorkZScore(csm);

    assert.ok(
      z.sfxDensity >= 1.28,
      `Chainsaw Man z.sfxDensity (${z.sfxDensity.toFixed(2)}) must be >= +1.28 (top decile)`
    );
  });

  await t.test('Goodnight Punpun must exhibit top-decile negative space paired with high dialogue density', () => {
    const punpun = findWork('work_goodnight_punpun');
    const z = getWorkZScore(punpun);

    assert.ok(
      z.negativeSpace >= 1.0,
      `Punpun z.negativeSpace (${z.negativeSpace.toFixed(2)}) must be >= +1.0`
    );
    assert.ok(
      z.dialogueDensity >= 0.80,
      `Punpun z.dialogueDensity (${z.dialogueDensity.toFixed(2)}) must be >= +0.80`
    );
  });

  await t.test('Uzumaki must exhibit high ink density with moderate panel count', () => {
    const uzumaki = findWork('work_uzumaki');
    const z = getWorkZScore(uzumaki);

    assert.ok(
      z.inkCoverage >= 1.0,
      `Uzumaki z.inkCoverage (${z.inkCoverage.toFixed(2)}) must be >= +1.0`
    );
    assert.ok(
      z.panelDensity <= 0.5,
      `Uzumaki z.panelDensity (${z.panelDensity.toFixed(2)}) must be <= +0.5 (moderate panel count)`
    );
  });

  await t.test('Cross-Format Support: Dune (prose) and 2001 (screenplay) must ingest raw vectors correctly', () => {
    const dune = findWork('work_dune');
    const script = findWork('work_2001_script');

    assert.equal(dune.mediaFormat, 'prose-novel');
    assert.equal(script.mediaFormat, 'screenplay');

    const zDune = getWorkZScore(dune);
    const zScript = getWorkZScore(script);

    assert.ok(zDune.environmentalScale >= 1.25, 'Dune Arrakis chapters must have top-decile scale');
    assert.ok(zScript.dialogueDensity <= -1.5, '2001 Star Gate screenplay must be virtually wordless');
  });

  await t.test('Edition Diff Comparator: AKIRA revision split must compute measured z-score deltas', () => {
    const akira = findWork('work_akira');
    const diff = computeEditionDiff(akira);

    assert.ok(diff.editionA);
    assert.ok(diff.editionB);
    assert.ok(diff.zDelta);
  });

  await t.test('Substrate DNA Exporter: Must generate valid JSON fingerprint', () => {
    const blame = findWork('work_blame');
    const dnaJson = exportSubstrateDna(blame.rawVector);
    const parsed = JSON.parse(dnaJson);

    assert.equal(parsed.provenance, 'fundamental-engine/substrate-v4');
    assert.ok(parsed.zScores.environmentalScale);
  });
});
