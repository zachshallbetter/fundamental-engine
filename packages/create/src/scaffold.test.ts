import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { scaffold, TEMPLATES, isTemplate } from './scaffold.ts';

const templatesRoot = join(import.meta.dirname, '../templates');

test('isTemplate gates the known variants', () => {
  for (const t of TEMPLATES) assert.ok(isTemplate(t));
  assert.equal(isTemplate('svelte'), false);
});

test('every template ships a package.json and the entry the README/CLI promise', async () => {
  for (const t of TEMPLATES) {
    const files = await readdir(join(templatesRoot, t));
    assert.ok(files.includes('package.json'), `${t}: package.json`);
    assert.ok(files.includes('_gitignore'), `${t}: _gitignore (becomes .gitignore on scaffold)`);
    assert.ok(files.includes('index.html'), `${t}: index.html`);
  }
});

test('scaffold copies a template, stamps the name, and restores .gitignore', async () => {
  const base = await mkdtemp(join(tmpdir(), 'fe-create-'));
  const target = join(base, 'my-app');
  await scaffold({ templatesRoot, template: 'vanilla', targetDir: target, name: 'my-app' });
  const files = await readdir(target);
  assert.ok(files.includes('package.json'));
  assert.ok(files.includes('.gitignore'), '_gitignore restored to .gitignore');
  assert.ok(!files.includes('_gitignore'), 'the _gitignore placeholder is gone');
  const pkg = JSON.parse(await readFile(join(target, 'package.json'), 'utf8'));
  assert.equal(pkg.name, 'my-app', 'project name stamped into package.json');
  await rm(base, { recursive: true, force: true });
});

test('scaffold refuses a non-empty target directory', async () => {
  const base = await mkdtemp(join(tmpdir(), 'fe-create-'));
  await writeFile(join(base, 'existing.txt'), 'x');
  await assert.rejects(
    () => scaffold({ templatesRoot, template: 'vanilla', targetDir: base, name: 'x' }),
    /not empty/,
  );
  await rm(base, { recursive: true, force: true });
});
