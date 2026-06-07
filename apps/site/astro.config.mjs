// @ts-check
import { defineConfig } from 'astro/config';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

// Static output (default) → apps/site/dist, served by Vercel.
// The live `<field-root>` element (@field-ui/elements) runs the engine.
export default defineConfig({
  site: 'https://field-ui.com',
  // Research papers (/research) carry LaTeX math; render it with KaTeX at build time.
  // The KaTeX stylesheet is imported by ResearchLayout so it ships only on those pages.
  markdown: {
    remarkPlugins: [remarkMath],
    rehypePlugins: [rehypeKatex],
  },
  // The Field Manual became the home page; keep the old URL working.
  redirects: {
    '/reference': '/',
    // The core-engine guide moved off the ambiguous "vanilla" slug (it collided
    // with the @field-ui/vanilla package, documented under /typescript).
    '/docs/guides/vanilla': '/docs/guides/core',
  },
});
