// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import remarkMermaid from './src/lib/remark-mermaid.mjs';

// Static output (default) → apps/site/dist, served by Vercel.
// The live `<field-root>` element (@fundamental-engine/elements) runs the engine.
export default defineConfig({
  site: 'https://field-ui.com',
  integrations: [
    // sitemap-index.xml + per-chunk sitemaps; referenced from public/robots.txt.
    // The redirect stubs below carry noindex — keep them out of the sitemap too.
    sitemap({
      filter: (page) =>
        !page.includes('/reference/') &&
        !page.includes('/research/') &&
        !page.includes('/docs/guides/vanilla/'),
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
  // The Field Manual became the home page; keep the old URL working.
  redirects: {
    '/reference': '/',
    // The core-engine guide moved off the ambiguous "vanilla" slug (it collided
    // with the @fundamental-engine/vanilla package, documented under /typescript).
    '/docs/guides/vanilla': '/docs/guides/core',
    // The research papers moved into the /writings datastore (research is a category).
    '/research': '/writings',
    '/research/[...slug]': '/writings/[...slug]',
  },
});
