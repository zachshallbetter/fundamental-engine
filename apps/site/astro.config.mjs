// @ts-check
import { defineConfig } from 'astro/config';

// Static output (default) → apps/site/dist, served by Vercel.
// The live `<forces-field>` element (@forces-ui/elements) runs the engine.
export default defineConfig({
  site: 'https://forces-ui.com',
  // The Field Manual became the home page; keep the old URL working.
  redirects: {
    '/reference': '/',
  },
});
