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
      body: 'sink attract',
      strength: '0.8',
      range: '360',
      absorb: '74',
      max: '44',
      angle: '90',
      when: 'hot',
      feedback: '',
    })
  );
  assert.deepEqual(b.tokens, ['sink', 'attract']);
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
    [['attract'], ['swirl'], ['sink'], ['lens']],
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
    [['attract'], ['swirl'], ['sink'], ['lens'], ['jet'], ['jet']],
  );
  // the two jets point along opposite headings (north/south poles)
  assert.ok(Math.abs(vb[4]!.uy - -1) < 1e-9); // angle −90° → (0, −1)
  assert.ok(Math.abs(vb[5]!.uy - 1) < 1e-9); // angle 90° → (0, 1)
});

test('expandPreset: galaxy/nebula/tornado compose implemented atoms', () => {
  assert.deepEqual(
    expandPreset('galaxy').map((b) => b.tokens[0]),
    ['attract', 'swirl', 'viscosity', 'lens'],
  );
  assert.deepEqual(
    expandPreset('nebula').map((b) => b.tokens[0]),
    ['thermal', 'viscosity', 'buoyancy'],
  );
  assert.deepEqual(
    expandPreset('tornado').map((b) => b.tokens[0]),
    ['swirl', 'stream', 'viscosity'],
  );
});

// ── the modifier contract + the source-budget guard (workover v0.3) ─────────────────────

test('the parser classifies tokens into {modifiers, forces, sources} on the body', () => {
  const b = parseBodyParams(attrs({ body: 'resonate attract spawn screen' }));
  assert.deepEqual(b.classified?.modifiers, ['screen', 'resonate']); // contract order, not authored
  assert.deepEqual(b.classified?.forces, ['attract']);
  assert.deepEqual(b.classified?.sources, ['spawn']);
});

test('parses the source budget: data-life / data-cap numbers, budgeted from any of the four attrs', () => {
  const b = parseBodyParams(attrs({ body: 'spawn', life: '120', cap: '40' }));
  assert.equal(b.life, 120);
  assert.equal(b.cap, 40);
  assert.equal(b.budgeted, true);
  // each of the four attrs alone satisfies the contract
  for (const k of ['life', 'cap', 'budget', 'sink']) {
    assert.equal(parseBodyParams(attrs({ body: 'spawn', [k]: '60' })).budgeted, true, `data-${k}`);
  }
  assert.equal(parseBodyParams(attrs({ body: 'spawn' })).budgeted, false);
  // garbage numbers don't become budgets (presence still satisfies the contract)
  const junk = parseBodyParams(attrs({ body: 'spawn', life: 'soon' }));
  assert.equal(junk.life, undefined);
  assert.equal(junk.budgeted, true);
});

test('parses data-screen-min for screen quiet zones (default 0)', () => {
  assert.equal(parseBodyParams(attrs({ body: 'screen' })).screenMin, 0);
  assert.equal(parseBodyParams(attrs({ body: 'screen', 'screen-min': '0.3' })).screenMin, 0.3);
});

test('guardSourceBudget: an unbudgeted [S] body warns (dev) and gets the safe defaults', async () => {
  const { guardSourceBudget } = await import('./scanner.ts');
  const { SOURCE_DEFAULT_LIFE, SOURCE_DEFAULT_CAP } = await import('../config/forces.config.ts');
  const { setContractChecks, contractChecksEnabled } = await import('../contracts/guards.ts');

  const sb = parseBodyParams(attrs({ body: 'spawn' }));
  const warnings: string[] = [];
  const origWarn = console.warn;
  console.warn = (msg: string) => void warnings.push(String(msg));
  const origChecks = contractChecksEnabled();
  try {
    setContractChecks(true);
    guardSourceBudget(sb, '<div#fountain>');
  } finally {
    console.warn = origWarn;
    setContractChecks(origChecks);
  }
  assert.equal(sb.life, SOURCE_DEFAULT_LIFE);
  assert.equal(sb.cap, SOURCE_DEFAULT_CAP);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0]!, /UNBUDGETED_SOURCE/);
  assert.match(warnings[0]!, /<div#fountain>/); // names the element
  assert.match(warnings[0]!, /data-life \/ data-cap \/ data-budget \/ data-sink/); // names the contract
});

test('guardSourceBudget: budgeted sources and non-sources are untouched and silent', async () => {
  const { guardSourceBudget } = await import('./scanner.ts');
  const { setContractChecks, contractChecksEnabled } = await import('../contracts/guards.ts');
  const warnings: string[] = [];
  const origWarn = console.warn;
  console.warn = (msg: string) => void warnings.push(String(msg));
  const origChecks = contractChecksEnabled();
  try {
    setContractChecks(true);
    const budgeted = parseBodyParams(attrs({ body: 'spawn', life: '90' }));
    guardSourceBudget(budgeted, '<div>');
    assert.equal(budgeted.life, 90); // authored budget kept, no default override
    assert.equal(budgeted.cap, undefined);
    const plain = parseBodyParams(attrs({ body: 'attract' }));
    guardSourceBudget(plain, '<div>');
    assert.equal(plain.life, undefined);
  } finally {
    console.warn = origWarn;
    setContractChecks(origChecks);
  }
  assert.equal(warnings.length, 0);
});

test('guardSourceBudget: still applies the safe cap with checks off (prod) — silently', async () => {
  const { guardSourceBudget } = await import('./scanner.ts');
  const { SOURCE_DEFAULT_LIFE } = await import('../config/forces.config.ts');
  const { setContractChecks, contractChecksEnabled } = await import('../contracts/guards.ts');
  const sb = parseBodyParams(attrs({ body: 'spawn' }));
  const warnings: string[] = [];
  const origWarn = console.warn;
  console.warn = (msg: string) => void warnings.push(String(msg));
  const origChecks = contractChecksEnabled();
  try {
    setContractChecks(false);
    guardSourceBudget(sb, '<div>');
  } finally {
    console.warn = origWarn;
    setContractChecks(origChecks);
  }
  assert.equal(sb.life, SOURCE_DEFAULT_LIFE); // the safety net is not dev-only
  assert.equal(warnings.length, 0); // …but the noise is
});

test('the fountain preset declares its source budget explicitly (life 90 — the historical look)', () => {
  const vb = expandPreset('fountain');
  const spawnBody = vb.find((b) => b.tokens.includes('spawn'));
  assert.ok(spawnBody, 'fountain has a spawn entry');
  assert.equal(spawnBody!.life, 90);
  assert.equal(spawnBody!.budgeted, true);
});
