#!/usr/bin/env node
/**
 * Clean-consumer check — installs and builds what a user actually gets, from the packed tarballs.
 *
 * Every other gate checks the workspace: tests import source, check:dist imports the built files in
 * place, check:packaging lints the manifests. None of them is the path a new user takes —
 * `npm create @fundamental-engine`, `npm install`, `npm run build` against published packages — and two
 * defects lived exactly there: the scaffolder's templates pinned an engine two minors old (^0.9.2 on
 * 0.x installs 0.9.x), and `<field-cell>` was tree-shaken out by every bundler because `sideEffects`
 * omitted its module. This gate runs that path end to end:
 *
 *   1. `pnpm pack` every publishable package (workspace:* deps become the real versions, as on npm);
 *   2. scaffold each template with the PACKED `@fundamental-engine/create` CLI, non-interactively;
 *   3. point the scaffolded engine dependency — and, via `overrides`, its engine dependencies — at the
 *      local tarballs, so the app installs this commit rather than whatever is on the registry;
 *   4. `npm install`, `tsc --noEmit` (the template's own tsconfig), `npm run build` (Vite);
 *   5. assert the web-component bundle still registers every custom element the package defines.
 *
 * Needs network (Vite, React, TypeScript come from the registry) and a prior `pnpm -r build`.
 * Wired as `pnpm check:consumer` and its own CI job. Slow (~1–2 min) by design — keep it out of the
 * fast unit loop.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PACKAGES = ['core', 'dom', 'vanilla', 'react', 'elements', 'three', 'create'];
const TEMPLATES = ['vanilla', 'react', 'web-component'];
// every tag @fundamental-engine/elements registers on import; a bundle missing one shipped a broken package
const ELEMENT_TAGS = ['field-root', 'field-field', 'field-cell'];

const work = mkdtempSync(join(tmpdir(), 'fe-consumer-'));
const keep = process.env.KEEP_CONSUMER === '1';
const run = (cmd, args, cwd) => execFileSync(cmd, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' });
const problems = [];

try {
  // 1 · pack
  const tarDir = join(work, 'tarballs');
  const tarball = {};
  for (const p of PACKAGES) {
    const out = run('pnpm', ['pack', '--pack-destination', tarDir], join(root, 'packages', p)).trim().split('\n').at(-1);
    const name = JSON.parse(readFileSync(join(root, 'packages', p, 'package.json'), 'utf8')).name;
    tarball[name] = resolve(out);
  }
  const engine = Object.fromEntries(
    Object.entries(tarball).filter(([n]) => n !== '@fundamental-engine/create').map(([n, f]) => [n, `file:${f}`]),
  );

  for (const t of TEMPLATES) {
    const app = join(work, `app-${t}`);
    // 2 · scaffold with the packed CLI, exactly as `npm create @fundamental-engine` would run it
    run('npm', ['exec', '--yes', `--package=${tarball['@fundamental-engine/create']}`, '--', 'create-fundamental-engine', app, '--template', t], work);
    if (!existsSync(join(app, 'package.json'))) {
      problems.push(`${t}: the packed CLI exited without scaffolding anything (npm runs the bin through a .bin symlink)`);
      continue;
    }

    // 3 · install THIS commit's packages: the direct engine dep and (via overrides) its engine deps
    const pkgPath = join(app, 'package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
    for (const n of Object.keys(pkg.dependencies ?? {})) if (engine[n]) pkg.dependencies[n] = engine[n];
    pkg.overrides = { ...engine };
    writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));

    // 4 · install, typecheck, build
    try {
      run('npm', ['install', '--no-audit', '--no-fund', '--loglevel=error'], app);
      run('npx', ['--no-install', 'tsc', '--noEmit', '-p', '.'], app);
      run('npm', ['run', 'build'], app);
    } catch (e) {
      problems.push(`${t}: ${(e.stderr || e.stdout || e.message).trim().split('\n').slice(-15).join('\n    ')}`);
      continue;
    }

    // 5 · the bundle must still register every element (the sideEffects class of bug)
    if (t === 'web-component') {
      const assets = join(app, 'dist', 'assets');
      const js = readdirSync(assets).filter((f) => f.endsWith('.js')).map((f) => readFileSync(join(assets, f), 'utf8')).join('\n');
      for (const tag of ELEMENT_TAGS) if (!js.includes(`"${tag}"`) && !js.includes(`'${tag}'`)) problems.push(`web-component: the built bundle never registers <${tag}>`);
    }
    console.log(`  ✓ ${t}: scaffolded, installed from tarballs, typechecked, built`);
  }
} finally {
  if (keep) console.log(`  (kept ${work})`);
  else rmSync(work, { recursive: true, force: true });
}

if (problems.length) {
  console.error(`✗ clean-consumer check failed (${problems.length}):`);
  for (const p of problems) console.error(`    ${p}`);
  process.exit(1);
}
console.log(`✓ clean consumer — ${TEMPLATES.length} templates scaffolded by the packed CLI install, typecheck and build against this commit's tarballs.`);
