#!/usr/bin/env node
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve, basename } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout, argv, cwd, exit } from 'node:process';
import { scaffold, isTemplate, TEMPLATES, type Template } from './scaffold.ts';

const templatesRoot = join(dirname(fileURLToPath(import.meta.url)), '../templates');

function parseArgs(args: string[]): { dir?: string; template?: string } {
  const out: { dir?: string; template?: string } = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i]!;
    if (a === '--template' || a === '-t') out.template = args[++i];
    else if (a.startsWith('--template=')) out.template = a.slice('--template='.length);
    else if (!a.startsWith('-') && out.dir === undefined) out.dir = a;
  }
  return out;
}

async function main(): Promise<void> {
  const args = parseArgs(argv.slice(2));
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

void main();
