import { cp, readFile, writeFile, readdir, rename } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

/** The starter variants. All three are signals-first; vanilla is contained (field scoped to a list). */
export const TEMPLATES = ['vanilla', 'react', 'web-component'] as const;
export type Template = (typeof TEMPLATES)[number];

export function isTemplate(t: string): t is Template {
  return (TEMPLATES as readonly string[]).includes(t);
}

/**
 * Copy a template into `targetDir` and stamp the project name into its package.json. Throws if the
 * template is unknown or the target exists and is non-empty. Pure file IO — no prompts, so it tests
 * directly.
 */
export async function scaffold(opts: {
  templatesRoot: string;
  template: Template;
  targetDir: string;
  name: string;
}): Promise<void> {
  const { templatesRoot, template, targetDir, name } = opts;
  const src = join(templatesRoot, template);
  if (!existsSync(src)) throw new Error(`unknown template: ${template}`);
  if (existsSync(targetDir) && (await readdir(targetDir)).length > 0)
    throw new Error(`target directory is not empty: ${targetDir}`);

  await cp(src, targetDir, { recursive: true });

  // npm strips a `.gitignore` from published packages, so templates ship it as `_gitignore`; restore it.
  const ignore = join(targetDir, '_gitignore');
  if (existsSync(ignore)) await rename(ignore, join(targetDir, '.gitignore'));

  // stamp the chosen project name into the scaffolded package.json
  const pkgPath = join(targetDir, 'package.json');
  if (existsSync(pkgPath)) {
    const pkg = JSON.parse(await readFile(pkgPath, 'utf8'));
    pkg.name = name;
    await writeFile(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
  }
}
