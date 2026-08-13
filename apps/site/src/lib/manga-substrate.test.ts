import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MANGA_WORKS, getWorkZScore } from './manga-substrate-engine.ts';

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
});
