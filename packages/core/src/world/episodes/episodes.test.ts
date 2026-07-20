/**
 * F1.7 — candidate-episode detection tests. The 8 preregistered adversarial cases + 6 additional cases.
 * The detector returns CONDITIONAL findings under a declared contract; alternate parameterizations are
 * reported, not treated as errors; coupling is distinguished from shared cause; world-participant vs
 * episode-participant is preserved.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorldEnvelope } from '../envelope.ts';
import { detectEpisodes } from './episodes.ts';
import type { DetectionContract, Transition } from './episodes.ts';

const ALL = ['A', 'B', 'C', 'M', 'X', 'Y', 'admin'];

function contract(o: Partial<DetectionContract> = {}): DetectionContract {
  return {
    boundary: { participants: ALL, start: 0, end: 100 },
    timescale: 1,
    coupling: { kind: 'direct-influence', minInfluence: 1 },
    recurrenceWindow: 5,
    minimumInfluence: 1,
    ...o,
  };
}
function tx(step: number, from: string, to: string, influence = 5): Transition {
  return { step, from, to, operation: 'op', influence };
}
function memberSets(r: ReturnType<typeof detectEpisodes>): string[] {
  return r.episodes.map((e) => e.participants.join('|')).sort();
}

// ── 8 preregistered adversarial cases ────────────────────────────────────────

test('F1.7-1 unilateral effect: no episode', () => {
  const r = detectEpisodes([tx(1, 'A', 'B')], contract(), ALL);
  assert.equal(r.episodes.length, 0);
  assert.equal(r.determinacy, 'none');
  assert.ok(r.failureReasons.some((f) => f.includes('no-reciprocity')));
});

test('F1.7-2 delayed response within window: reciprocal episode', () => {
  const r = detectEpisodes([tx(1, 'A', 'B'), tx(4, 'B', 'A')], contract(), ALL);
  assert.deepEqual(memberSets(r), ['A|B']);
  assert.equal(r.episodes[0]?.basis, 'reciprocal');
});

test('F1.7-3 timeout: no episode under the window, alternate reported', () => {
  const r = detectEpisodes([tx(1, 'A', 'B'), tx(20, 'B', 'A')], contract(), ALL);
  assert.equal(r.episodes.length, 0);
  assert.ok(r.alternateSegmentations.some((a) => a.participants.join('|') === 'A|B'), 'wider window reported');
  assert.equal(r.determinacy, 'multiple-defensible');
});

test('F1.7-4 retry: one recurrent episode, not two', () => {
  const r = detectEpisodes([tx(1, 'A', 'B'), tx(2, 'A', 'B')], contract(), ALL);
  assert.equal(r.episodes.length, 1);
  assert.equal(r.episodes[0]?.basis, 'recurrent');
});

test('F1.7-5 nested/overlapping: two episodes sharing a participant', () => {
  const r = detectEpisodes([tx(1, 'A', 'B'), tx(2, 'B', 'A'), tx(3, 'B', 'C'), tx(4, 'C', 'B')], contract(), ALL);
  assert.deepEqual(memberSets(r), ['A|B', 'B|C']);
});

test('F1.7-6 one-shot no reply: no episode', () => {
  const r = detectEpisodes([tx(1, 'A', 'B')], contract(), ALL);
  assert.equal(r.episodes.length, 0);
});

test('F1.7-7 asynchronous reply outside window: no episode, alternate reported', () => {
  const r = detectEpisodes([tx(1, 'A', 'B'), tx(30, 'B', 'A')], contract(), ALL);
  assert.equal(r.episodes.length, 0);
  assert.ok(r.alternateSegmentations.length > 0);
});

test('F1.7-8 shared environmental cause: no coupled episode (C→A, C→B, no A↔B)', () => {
  const r = detectEpisodes([tx(1, 'C', 'A'), tx(1, 'C', 'B')], contract(), ALL);
  assert.equal(r.episodes.length, 0, 'shared cause is not a coupled episode');
  assert.deepEqual(r.episodeParticipants, []);
});

// ── 6 additional cases ───────────────────────────────────────────────────────

test('F1.7-9 latent authority holder: world participant, NOT an episode participant', () => {
  const r = detectEpisodes([tx(1, 'A', 'B'), tx(2, 'B', 'A')], contract(), ALL);
  assert.deepEqual(r.episodeParticipants, ['A', 'B']);
  assert.ok(r.worldParticipants.includes('admin'));
  assert.ok(!r.episodeParticipants.includes('admin'));
});

test('F1.7-10 mediator materially involved without originating', () => {
  const r = detectEpisodes([tx(1, 'A', 'M'), tx(2, 'M', 'B'), tx(3, 'B', 'A')], contract(), ALL);
  assert.ok(r.episodes.some((e) => e.basis === 'mediated' && e.participants.includes('M')));
  assert.ok(r.episodeParticipants.includes('M'));
});

test('F1.7-11 one world participant in two overlapping episodes', () => {
  const r = detectEpisodes([tx(1, 'A', 'B'), tx(2, 'B', 'A'), tx(3, 'A', 'C'), tx(4, 'C', 'A')], contract(), ALL);
  assert.deepEqual(memberSets(r), ['A|B', 'A|C']);
  assert.equal(r.episodes.filter((e) => e.participants.includes('A')).length, 2, 'A is in both overlapping episodes');
});

test('F1.7-12 changing boundary alters episode membership', () => {
  const trace = [tx(1, 'A', 'B'), tx(2, 'B', 'A'), tx(3, 'A', 'C'), tx(4, 'C', 'A')];
  const wide = detectEpisodes(trace, contract({ boundary: { participants: ['A', 'B', 'C'], start: 0, end: 100 } }), ALL);
  const narrow = detectEpisodes(trace, contract({ boundary: { participants: ['A', 'B'], start: 0, end: 100 } }), ALL);
  assert.notDeepEqual(wide.episodeParticipants, narrow.episodeParticipants);
  assert.ok(!narrow.episodeParticipants.includes('C'));
});

test('F1.7-13 raising minimum influence removes a weakly coupled participant', () => {
  const trace = [tx(1, 'A', 'B', 5), tx(2, 'B', 'A', 5), tx(3, 'A', 'C', 1), tx(4, 'C', 'A', 1)];
  const low = detectEpisodes(trace, contract({ minimumInfluence: 1 }), ALL);
  const high = detectEpisodes(trace, contract({ minimumInfluence: 3 }), ALL);
  assert.ok(low.episodeParticipants.includes('C'));
  assert.ok(!high.episodeParticipants.includes('C'));
});

test('F1.7-14 identical timing but no coupling path: no episode', () => {
  const r = detectEpisodes([tx(1, 'X', 'A'), tx(1, 'Y', 'B')], contract(), ALL);
  assert.equal(r.episodes.length, 0);
});

test('F1.7 evidence: results are conditional and retain the envelope', () => {
  const env = createWorldEnvelope('epi-world');
  const r = detectEpisodes([tx(1, 'A', 'B'), tx(2, 'B', 'A')], contract(), ALL, env);
  assert.equal(r.conditional, true);
  assert.equal(r.evidence.envelope?.worldInstance, 'epi-world');
  assert.equal(r.boundaryUsed.participants.length, ALL.length);
});
