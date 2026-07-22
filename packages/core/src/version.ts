/**
 * The running engine version — exposed so a consumer (or an AI agent introspecting the field) can
 * read which build it is on, and so a CDN/bundled copy can be identified at runtime. Kept in lockstep
 * with `packages/core/package.json` by `version.test.ts` (the build fails if they drift), so the
 * release bump is the single source of truth.
 */
export const FIELD_VERSION = '0.10.1';
