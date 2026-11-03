// Build provenance — which engine version, which commit, and when this site was built. Rendered in
// the footer (every page) and written into llms.txt, so a reader or a crawler can tell exactly what
// a page describes. The version is the published core package's; the commit comes from Vercel's
// build env, falling back to git for local builds.
import { execSync } from 'node:child_process';
import corePkg from '@fundamental-engine/core/package.json';

export const engineVersion: string = corePkg.version;

function resolveCommit(): string {
  const fromEnv = process.env.VERCEL_GIT_COMMIT_SHA;
  if (fromEnv) return fromEnv.slice(0, 7);
  try {
    return execSync('git rev-parse --short=7 HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return '';
  }
}

export const buildCommit: string = resolveCommit();
export const builtOn: string = new Date().toISOString().slice(0, 10);
export const commitUrl = (sha: string): string => `https://github.com/zachshallbetter/fundamental-engine/commit/${sha}`;
