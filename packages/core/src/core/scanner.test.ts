import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseBodyParams, expandPreset, type BodyAttrs } from './scanner.ts';
import { PRESETS } from '../config/presets.ts';
import { coreForces } from '../forces/index.ts';
import { naturalForces } from '../forces/natural.ts';
import { extendedForces } from '../forces/extended.ts';

const attrs = (map: Record<string, string>): BodyAttrs => ({
  get: (name) => (name in map ? map[name] : null),
  has: (name) => name in map,
});

test('applies defaults when attributes are absent', () => {
  const b = parseBodyParams(attrs({ body: 'attract' }));
  assert.deepEqual(b.tokens, ['attract']);
  assert.equal(b.strength, 0.5);
  assert.equal(b.range, 280);
  assert.equal(b.absorbR, 64);
  assert.equal(b.capacity, 60);
  assert.equal(b.spin, 1);
  assert.equal(b.when, '');
  assert.equal(b.feedback, false);
});

test('parses composed tokens, numbers, angle, and feedback', () => {
  const b = parseBodyParams(
    attrs({
      body: 'absorb attract',
      strength: '0.8',
      range: '360',
      absorb: '74',
      max: '44',
      angle: '90',
      when: 'hot',
      feedback: '',
    })
  );
  assert.deepEqual(b.tokens, ['absorb', 'attract']);
  assert.equal(b.strength, 0.8);
  assert.equal(b.range, 360);
  assert.equal(b.absorbR, 74);
  assert.equal(b.capacity, 44);
  assert.equal(b.when, 'hot');
  assert.equal(b.feedback, true);
  assert.ok(Math.abs(b.angle - Math.PI / 2) < 1e-9);
  assert.ok(Math.abs(b.ux - 0) < 1e-9);
  assert.ok(Math.abs(b.uy - 1) < 1e-9);
  // source mass M mirrors strength (k_g = 1)
  assert.equal(b.M, 0.8);
});

test('expandPreset: blackhole → well + frame-drag + horizon + lens, each own-tuned (§20.9)', () => {
  const vb = expandPreset('blackhole');
  assert.equal(vb.length, 4);
  assert.deepEqual(
    vb.map((b) => b.tokens),
    [['attract'], ['vortex'], ['absorb'], ['lens']],
  );
  // the well and the horizon carry independent parameters (the one blocker §20.9 fixes)
  assert.equal(vb[0]!.strength, 1.4);
  assert.equal(vb[0]!.range, 340);
  assert.equal(vb[1]!.spin, 1);
  assert.equal(vb[2]!.absorbR, 42); // absorb's own capture radius
  assert.equal(vb[2]!.capacity, 60);
  assert.equal(vb[3]!.range, 380); // lens reaches past the well
});

test('expandPreset: star composes the natural primitives gravity ⇄ thermal (§20.10)', () => {
  const vb = expandPreset('star');
  assert.deepEqual(
    vb.map((b) => b.tokens),
    [['gravity'], ['thermal']],
  );
  assert.equal(vb[0]!.M, 300); // GM source scalar mirrors strength
  assert.equal(vb[1]!.range, 220);
});

test('expandPreset: whitehole stream heading parses to a unit vector', () => {
  const vb = expandPreset('whitehole');
  const stream = vb[1]!;
  assert.deepEqual(stream.tokens, ['stream']);
  assert.ok(Math.abs(stream.ux - 1) < 1e-9); // angle 0° → (1, 0)
  assert.ok(Math.abs(stream.uy - 0) < 1e-9);
});

test('expandPreset: virtual bodies inherit the parser defaults', () => {
  const vb = expandPreset('blackhole');
  for (const b of vb) {
    assert.equal(b.feedback, false); // presets don't opt into feedback
    assert.equal(b.when, ''); // ungated
  }
});

test('expandPreset: an unknown preset contributes no bodies', () => {
  assert.deepEqual(expandPreset('not-a-preset'), []);
  assert.deepEqual(expandPreset(''), []);
});

test('every preset entry names a single token', () => {
  for (const entries of Object.values(PRESETS)) {
    for (const e of entries) assert.ok(e.body && !e.body.includes(' '), e.body);
  }
});

test('every preset entry names a registered force (no dangling tokens)', () => {
  const known = new Set(
    [...coreForces, ...naturalForces, ...extendedForces].map((f) => f.token),
  );
  for (const [name, entries] of Object.entries(PRESETS)) {
    for (const e of entries) assert.ok(known.has(e.body), `${name} → unknown token ${e.body}`);
  }
});

test('expandPreset: quasar adds polar jets to the black hole (§20.9)', () => {
  const vb = expandPreset('quasar');
  assert.deepEqual(
    vb.map((b) => b.tokens),
    [['attract'], ['vortex'], ['absorb'], ['lens'], ['emitter'], ['emitter']],
  );
  // the two jets point along opposite headings (north/south poles)
  assert.ok(Math.abs(vb[4]!.uy - -1) < 1e-9); // angle −90° → (0, −1)
  assert.ok(Math.abs(vb[5]!.uy - 1) < 1e-9); // angle 90° → (0, 1)
});

test('expandPreset: galaxy/nebula/tornado compose implemented atoms', () => {
  assert.deepEqual(
    expandPreset('galaxy').map((b) => b.tokens[0]),
    ['attract', 'vortex', 'drag', 'lens'],
  );
  assert.deepEqual(
    expandPreset('nebula').map((b) => b.tokens[0]),
    ['thermal', 'drag', 'buoyancy'],
  );
  assert.deepEqual(
    expandPreset('tornado').map((b) => b.tokens[0]),
    ['vortex', 'stream', 'drag'],
  );
});
