// @ts-check
import { defineConfig } from 'astro/config';

// Static output (default) → apps/site/dist, served by Vercel.
// The live `<forces-field>` element (@forces-ui/elements) plugs in as a
// client-side island once the engine lands (ROADMAP Phase 1).
export default defineConfig({
  site: 'https://forces-ui.com',
});
