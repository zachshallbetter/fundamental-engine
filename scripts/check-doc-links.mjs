/**
 * Internal doc-link integrity: every relative markdown link in the repo's tracked docs
 * resolves to a real file. External (http/https/mailto) links and pure #anchors are out
 * of scope — this guards the class of breakage refactors cause (a doc moves, ten links rot).
 *
 * Scanned: every *.md at the repo root, docs/ (recursively), and the package READMEs.
 * Run: `pnpm check:links` (wired into pr-checks.yml).
 */
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');

// Collect markdown files: root-level, docs/ (recursive), and each package README.
const files = [];
for (const entry of readdirSync(root)) {
  if (entry.endsWith('.md')) files.push(join(root, entry));
}
const walk = (dir) => {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) walk(path);
    else if (entry.endsWith('.md')) files.push(path);
  }
};
walk(join(root, 'docs'));
for (const pkg of readdirSync(join(root, 'packages'))) {
  const readme = join(root, 'packages', pkg, 'README.md');
  if (existsSync(readme)) files.push(readme);
}

// Relative links only: [text](target) where target is not a URL scheme or a bare anchor.
// Reference-style definitions ([id]: target) are matched separately.
const INLINE = /\[[^\]]*\]\(((?!(?:[a-z][a-z0-9+.-]*:)|#|\/\/)[^)\s]+)\)/g;
const REFDEF = /^\[[^\]]+\]:\s+((?!(?:[a-z][a-z0-9+.-]*:)|#|\/\/)\S+)\s*$/gm;

let broken = 0;
for (const file of files) {
  const content = readFileSync(file, 'utf8');
  const targets = [
    ...[...content.matchAll(INLINE)].map((m) => m[1]),
    ...[...content.matchAll(REFDEF)].map((m) => m[1]),
  ];
  for (const raw of targets) {
    const path = raw.split('#')[0];
    if (!path) continue; // pure anchor
    const target = resolve(dirname(file), decodeURIComponent(path));
    if (!existsSync(target)) {
      console.error(`BROKEN LINK  ${file.slice(root.length + 1)}  ->  ${raw}`);
      broken++;
    }
  }
}

if (broken) {
  console.error(`\n${broken} broken internal link(s).`);
  process.exit(1);
}
console.log(`doc links ok — ${files.length} markdown files checked`);
