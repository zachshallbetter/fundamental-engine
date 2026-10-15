import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm, symlink, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseArgs, HELP, selfVersion, isEntrypoint } from './index.ts';

const cli = join(import.meta.dirname, 'index.ts');

// Run the CLI as a child process, non-interactively (no TTY, so no prompt). Returns the result.
function run(args: string[], cwd?: string) {
  return spawnSync(process.execPath, [cli, ...args], {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

test('parseArgs: flags, positional dir, and --template forms', () => {
  assert.deepEqual(parseArgs(['my-app']), { dir: 'my-app' });
  assert.deepEqual(parseArgs(['my-app', '-t', 'react']), { dir: 'my-app', template: 'react' });
  assert.deepEqual(parseArgs(['--template=web-component', 'x']), { dir: 'x', template: 'web-component' });
  assert.equal(parseArgs(['--help']).help, true);
  assert.equal(parseArgs(['-h']).help, true);
  assert.equal(parseArgs(['--version']).version, true);
  assert.equal(parseArgs(['-v']).version, true);
});

test('--help prints usage and exits 0', () => {
  const r = run(['--help']);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /Usage:/);
  assert.match(r.stdout, /--template/);
  assert.ok(HELP.includes('Usage:'));
});

test('--version prints the package version and exits 0', () => {
  const r = run(['--version']);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout.trim(), selfVersion());
  assert.match(r.stdout.trim(), /^\d+\.\d+\.\d+/);
});

test('unknown --template exits non-zero with a helpful message', () => {
  const r = run(['some-dir', '--template', 'svelte']);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr + r.stdout, /Unknown template/);
});

test('non-interactive scaffold: no TTY, flags drive it, real files land', async () => {
  const base = await mkdtemp(join(tmpdir(), 'fe-create-cli-'));
  const r = run(['app', '--template', 'vanilla'], base);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /Created app/);
  const files = await readdir(join(base, 'app'));
  assert.ok(files.includes('package.json'), 'package.json scaffolded');
  assert.ok(files.includes('.gitignore'), '_gitignore restored');
  const pkg = JSON.parse(await readFile(join(base, 'app', 'package.json'), 'utf8'));
  assert.equal(pkg.name, 'app', 'project name stamped');
  // template deps are pinned, not "latest"
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  for (const [name, range] of Object.entries(deps)) {
    if (name.startsWith('@fundamental-engine/')) assert.notEqual(range, 'latest', `${name} must be a bounded range`);
  }
  await rm(base, { recursive: true, force: true });
});

// A 0.x caret range only spans one minor (`^0.9.2` = `<0.10.0`), so a template range that lags this
// package's minor scaffolds an engine older than the one the docs describe. Pin every template to
// `^<this minor>.0` — a minor release that forgets the templates fails here, not in a user's app.
test('every template installs the engine minor this package ships', async () => {
  const [major, minor] = selfVersion().split('.');
  const expected = `^${major}.${minor}.0`;
  const root = join(import.meta.dirname, '..', 'templates');
  const templates = await readdir(root);
  assert.ok(templates.length > 0, 'templates found');
  for (const t of templates) {
    const pkg = JSON.parse(await readFile(join(root, t, 'package.json'), 'utf8'));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    const engine = Object.entries(deps).filter(([name]) => name.startsWith('@fundamental-engine/'));
    assert.ok(engine.length > 0, `${t} depends on an engine package`);
    for (const [name, range] of engine) assert.equal(range, expected, `${t}: ${name}`);
  }
});

// npm runs a package bin through a node_modules/.bin/ symlink. The entrypoint guard compared argv[1]
// (the link) with import.meta.url (the real file), so under npm — `npm create @fundamental-engine` —
// main() never ran: exit 0, no output, no project (0.9.3–0.11.0). Every test above spawns the file
// directly, which is why none of them saw it.
test('run through a .bin-style symlink (how npm runs it), the CLI still scaffolds', async () => {
  const base = await mkdtemp(join(tmpdir(), 'fe-create-link-'));
  const binDir = join(base, 'node_modules', '.bin');
  await mkdir(binDir, { recursive: true });
  const link = join(binDir, 'create-fundamental-engine');
  await symlink(cli, link);
  const r = spawnSync(process.execPath, [link, 'linked-app', '--template', 'vanilla'], {
    cwd: base,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /Created linked-app/, 'main() ran through the symlink');
  assert.ok((await readdir(join(base, 'linked-app'))).includes('package.json'), 'the project was written');
  await rm(base, { recursive: true, force: true });
});

test('isEntrypoint: resolves symlinks, rejects other files and a missing argv[1]', async () => {
  const base = await mkdtemp(join(tmpdir(), 'fe-create-entry-'));
  const link = join(base, 'bin');
  await symlink(cli, link);
  const url = new URL(`file://${cli}`).href;
  assert.equal(isEntrypoint(cli, url), true, 'the file itself');
  assert.equal(isEntrypoint(link, url), true, 'a symlink to it');
  assert.equal(isEntrypoint(join(base, 'nope.js'), url), false, 'a path that does not exist');
  assert.equal(isEntrypoint(undefined, url), false, 'no argv[1] (e.g. node -e)');
  await rm(base, { recursive: true, force: true });
});
