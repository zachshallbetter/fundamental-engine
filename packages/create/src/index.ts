#!/usr/bin/env node
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve, basename } from 'node:path';
import { readFileSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout, argv, cwd, exit } from 'node:process';
import { scaffold, isTemplate, TEMPLATES, type Template } from './scaffold.ts';

const here = dirname(fileURLToPath(import.meta.url));
const templatesRoot = join(here, '../templates');

/** Read this package's own version from its package.json (for `--version`). */
function selfVersion(): string {
  try {
    return JSON.parse(readFileSync(join(here, '../package.json'), 'utf8')).version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

const HELP = `create-fundamental-engine — scaffold a Fundamental starter (signals-first).

Usage:
  npm create @fundamental-engine [directory] [-- --template <name>]
  create-fundamental-engine [directory] [--template <name>]

Arguments:
  directory                 target directory (default: my-field-app)

Options:
  -t, --template <name>     one of: ${TEMPLATES.join(', ')} (default: vanilla)
  -h, --help                show this help and exit
  -v, --version             print the version and exit

With no TTY (CI / piped), directory and template must be passed as flags — there is no prompt.`;

export { HELP, selfVersion };

export function parseArgs(args: string[]): { dir?: string; template?: string; help?: boolean; version?: boolean } {
  const out: { dir?: string; template?: string; help?: boolean; version?: boolean } = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i]!;
    if (a === '--help' || a === '-h') out.help = true;
    else if (a === '--version' || a === '-v') out.version = true;
    else if (a === '--template' || a === '-t') out.template = args[++i];
    else if (a.startsWith('--template=')) out.template = a.slice('--template='.length);
    else if (!a.startsWith('-') && out.dir === undefined) out.dir = a;
  }
  return out;
}

async function main(): Promise<void> {
  const args = parseArgs(argv.slice(2));
  if (args.help) {
    console.log(HELP);
    return;
  }
  if (args.version) {
    console.log(selfVersion());
    return;
  }
  let dir = args.dir;
  let template = args.template;
  const interactive = Boolean(stdin.isTTY && stdout.isTTY);
  const rl = interactive && (!dir || !template) ? createInterface({ input: stdin, output: stdout }) : undefined;

  if (!dir) dir = (rl ? (await rl.question('Project directory [my-field-app]: ')).trim() : '') || 'my-field-app';
  if (!template) {
    const ans = rl ? (await rl.question(`Template — ${TEMPLATES.join(' / ')} [vanilla]: `)).trim() : '';
    template = ans || 'vanilla';
  }
  rl?.close();

  if (!isTemplate(template)) {
    console.error(`Unknown template "${template}". Choose one of: ${TEMPLATES.join(', ')}`);
    exit(1);
  }
  const targetDir = resolve(cwd(), dir);
  const name = basename(targetDir);

  try {
    await scaffold({ templatesRoot, template: template as Template, targetDir, name });
  } catch (e) {
    console.error(`✗ ${(e as Error).message ?? e}`);
    exit(1);
  }

  console.log(
    `\n✓ Created ${name} — the ${template} starter (signals-first).\n\n` +
      `Next:\n  cd ${dir}\n  npm install\n  npm run dev\n\n` +
      `The field draws nothing by default — it writes --field-* signals your CSS reads. See src/ for the wiring.\n`,
  );
}

// Run only as the CLI entrypoint, so tests can `import` this module (for parseArgs / HELP) without
// executing the scaffold flow.
if (import.meta.url === `file://${argv[1]}` || argv[1] === fileURLToPath(import.meta.url)) {
  void main();
}
