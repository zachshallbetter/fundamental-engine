import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseArgs, HELP, selfVersion } from './index.ts';

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
