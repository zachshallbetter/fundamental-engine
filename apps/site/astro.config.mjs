// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import remarkMermaid from './src/lib/remark-mermaid.mjs';
import { redirectMap, LEGACY_REDIRECTS } from './src/lib/docs-redirects.mjs';

// The retired docs routes as sitemap path fragments (Astro emits each stub at `<route>/index.html`,
// so the sitemap sees `<route>/`).
const RETIRED_SITEMAP_PATHS = Object.keys(redirectMap());

// Static output (default) → apps/site/dist, served by Vercel.
// The live `<field-root>` element (@fundamental-engine/elements) runs the engine.
export default defineConfig({
  site: 'https://fundamental-engine.com',
  integrations: [
    // sitemap-index.xml + per-chunk sitemaps; referenced from public/robots.txt.
    // The redirect stubs below carry noindex — keep them out of the sitemap too.
    // /design and /resting-tuner are internal reference/prototype surfaces, not
    // public docs — they carry noindex and stay out of the sitemap (in lockstep).
    sitemap({
      filter: (page) =>
        !page.includes('/reference/') &&
        !page.includes('/research/') &&
        !page.includes('/recipes/') &&
        !page.includes('/docs/guides/vanilla/') &&
        !page.includes('/design/') &&
        !page.includes('/resting-tuner/') &&
        !page.includes('/perf-bench/') &&
        // the Phase 6 retirements (docs-refactor #1001) — stubs, not pages
        !RETIRED_SITEMAP_PATHS.some((p) => page.includes(`${p}/`)),
    }),
  ],
  // The /writings datastore (and the research papers under it) carry rich markdown:
  //  • LaTeX math      → remark-math + rehype-katex (KaTeX stylesheet imported by WritingLayout)
  //  • Mermaid diagrams → remark-mermaid emits <pre class="mermaid">, rendered client-side
  //  • Code            → Shiki with an editor-grade theme ("intellisense" color)
  markdown: {
    remarkPlugins: [remarkMath, remarkMermaid],
    rehypePlugins: [rehypeKatex],
    shikiConfig: { theme: 'one-dark-pro', wrap: false },
  },
  // Every URL this site has ever served still resolves. The Field Manual became the home page and
  // several routes were renamed (below); docs-refactor Phase 6 (#1001) then retired ten docs pages
  // into the consolidated references, and `src/lib/docs-redirects.mjs` is the single source of truth
  // for those — spread in here, asserted by `src/lib/docs-redirects.test.ts`, and served-checked by
  // `e2e/redirects.spec.ts`. Never delete a page without adding its entry there.
  redirects: {
    ...LEGACY_REDIRECTS,
    ...redirectMap(),
  },
});
