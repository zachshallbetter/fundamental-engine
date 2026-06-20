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

// Relative links: [text](target), target not a URL scheme. CROSS-FILE links may carry a #fragment,
// validated against the target file's headings — this guards the refactor-breakage class (a section
// is renamed, the link into it from another doc rots). Same-file ToC anchors are NOT validated here:
// they're authored against the site's renderer slug convention (keeps unicode, doesn't collapse
// spaces), not GitHub's, so a GitHub-style slugger would false-positive on them.
const INLINE = /\[[^\]]*\]\(((?!(?:[a-z][a-z0-9+.-]*:)|#|\/\/)[^)\s]+)\)/g;
const REFDEF = /^\[[^\]]+\]:\s+((?!(?:[a-z][a-z0-9+.-]*:)|#|\/\/)\S+)\s*$/gm;

// GitHub-style heading slug + the set of valid anchors in a markdown file (headings + html id/name).
// Extra slugs (e.g. a `#` line inside a code fence) only make the set more permissive, never failing.
const anchorCache = new Map();
const slugify = (text) =>
  text
    .replace(/`+/g, '')
    .replace(/\*\*|__|\*|_/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // [label](url) -> label
    .replace(/<[^>]+>/g, '')
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N} \-]/gu, '')
    .replace(/ /g, '-'); // GitHub maps each space to a hyphen and does NOT collapse runs
const anchorsOf = (mdFile) => {
  let set = anchorCache.get(mdFile);
  if (set) return set;
  set = new Set();
  const content = readFileSync(mdFile, 'utf8');
  const seen = new Map();
  for (const m of content.matchAll(/^#{1,6}\s+(.+?)\s*#*\s*$/gm)) {
    let slug = slugify(m[1]);
    if (!slug) continue;
    const n = seen.get(slug);
    if (n === undefined) seen.set(slug, 0);
    else { seen.set(slug, n + 1); slug = `${slug}-${n + 1}`; } // GitHub disambiguates dupes with -1, -2…
    set.add(slug);
  }
  for (const m of content.matchAll(/(?:id|name)="([^"#]+)"/g)) set.add(m[1].toLowerCase());
  anchorCache.set(mdFile, set);
  return set;
};

let broken = 0;
const report = (file, raw, why) => {
  console.error(`${why}  ${file.slice(root.length + 1)}  ->  ${raw}`);
  broken++;
};
for (const file of files) {
  const content = readFileSync(file, 'utf8');
  const crossLinks = [
    ...[...content.matchAll(INLINE)].map((m) => m[1]),
    ...[...content.matchAll(REFDEF)].map((m) => m[1]),
  ];
  for (const raw of crossLinks) {
    const hash = raw.indexOf('#');
    const path = hash === -1 ? raw : raw.slice(0, hash);
    const frag = hash === -1 ? '' : raw.slice(hash + 1);
    const target = resolve(dirname(file), decodeURIComponent(path));
    if (!existsSync(target)) { report(file, raw, 'BROKEN LINK  '); continue; }
    if (frag && target.endsWith('.md') && !anchorsOf(target).has(decodeURIComponent(frag).toLowerCase())) {
      report(file, raw, 'BROKEN ANCHOR');
    }
  }
}

if (broken) {
  console.error(`\n${broken} broken internal link/anchor(s).`);
  process.exit(1);
}
console.log(`doc links ok — ${files.length} markdown files checked`);
