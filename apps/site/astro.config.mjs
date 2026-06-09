// @ts-check
import { defineConfig } from 'astro/config';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import remarkMermaid from './src/lib/remark-mermaid.mjs';

// Static output (default) → apps/site/dist, served by Vercel.
// The live `<field-root>` element (@field-ui/elements) runs the engine.
export default defineConfig({
  site: 'https://field-ui.com',
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
    // with the @field-ui/vanilla package, documented under /typescript).
    '/docs/guides/vanilla': '/docs/guides/core',
    // The research papers moved into the /writings datastore (research is a category).
    '/research': '/writings',
    '/research/[...slug]': '/writings/[...slug]',
  },
});
