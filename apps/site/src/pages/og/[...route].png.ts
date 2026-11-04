/**
 * /og/<route>.png — build-time Open Graph card generator.
 *
 * Renders a 1200×630 social card per page with satori (JSX-free element tree) →
 * SVG, then rasterises to PNG with resvg. The routes come from the shared list in
 * src/lib/og-cards.ts (curated pages) plus every writing in the content
 * collection, so og:image in Base.astro (which uses the same list) always points
 * at a card that exists. Prerendered — no runtime cost.
 */
import type { APIRoute, GetStaticPaths } from 'astro';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { getCollection } from 'astro:content';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { STATIC_OG_CARDS, type OgCardProps } from '../../lib/og-cards';

export const prerender = true;

// The brand face, as a static TTF (satori can't read the site's woff2). Reused
// from the contour-generation assets so no new binary is added to the repo.
const fontData = readFileSync(
  fileURLToPath(new URL('../../../scripts/assets/bricolage-grotesque-variable.ttf', import.meta.url)),
);

export const getStaticPaths: GetStaticPaths = async () => {
  const staticCards = STATIC_OG_CARDS.map((c) => ({
    params: { route: c.route },
    props: { eyebrow: c.eyebrow, title: c.title } satisfies OgCardProps,
  }));
  const writings = await getCollection('writings', (e) => !e.data.draft);
  const writingCards = writings.map((e) => ({
    params: { route: `writings/${e.id}` },
    props: {
      eyebrow: e.data.category ? String(e.data.category) : 'Writings',
      title: e.data.title,
    } satisfies OgCardProps,
  }));
  return [...staticCards, ...writingCards];
};

/** Build the satori element tree for one card. Only styles satori reliably
 *  supports are used (flex, sizing, color, spacing). */
function card({ eyebrow, title }: OgCardProps) {
  const text = (content: string, style: Record<string, unknown>) => ({
    type: 'div',
    props: { style: { display: 'flex', ...style }, children: content },
  });
  return {
    type: 'div',
    props: {
      style: {
        width: '1200px',
        height: '630px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '72px 80px',
        backgroundColor: '#04050a',
        backgroundImage:
          'linear-gradient(135deg, rgba(77,163,255,0.14), rgba(167,139,250,0.10) 45%, rgba(45,212,191,0.10))',
        color: '#f3f6fc',
        fontFamily: 'Bricolage Grotesque',
      },
      children: [
        // accent bar
        {
          type: 'div',
          props: { style: { display: 'flex', width: '96px', height: '8px', backgroundColor: '#4da3ff', borderRadius: '999px' } },
        },
        text(eyebrow.toUpperCase(), {
          fontSize: 30,
          fontWeight: 700,
          letterSpacing: 4,
          color: '#7cc7de',
        }),
        text(title, {
          fontSize: title.length > 48 ? 64 : 74,
          fontWeight: 700,
          lineHeight: 1.05,
          letterSpacing: -1,
          maxWidth: 1040,
        }),
        text('fundamentalengine.com', { fontSize: 28, color: '#9fb0d0', letterSpacing: 1 }),
      ],
    },
  };
}

export const GET: APIRoute = async ({ props }) => {
  const svg = await satori(card(props as OgCardProps), {
    width: 1200,
    height: 630,
    fonts: [
      { name: 'Bricolage Grotesque', data: fontData, weight: 400, style: 'normal' },
      { name: 'Bricolage Grotesque', data: fontData, weight: 700, style: 'normal' },
    ],
  });
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } }).render().asPng();
  return new Response(new Uint8Array(png), {
    headers: {
      'content-type': 'image/png',
      'cache-control': 'public, max-age=31536000, immutable',
    },
  });
};
