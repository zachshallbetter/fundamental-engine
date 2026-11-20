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
import { renderOgHeroField, OG_HERO_LAYOUT, OG_W, OG_H } from '../../lib/og-hero-field';

export const prerender = true;

// The brand face, as a static TTF (satori can't read the site's woff2). Reused
// from the contour-generation assets so no new binary is added to the repo.
const fontData = readFileSync(
  fileURLToPath(new URL('../../../scripts/assets/bricolage-grotesque-variable.ttf', import.meta.url)),
);

export const getStaticPaths: GetStaticPaths = async () => {
  const staticCards = STATIC_OG_CARDS.map((c) => ({
    params: { route: c.route },
    props: { eyebrow: c.eyebrow, title: c.title, layout: c.layout, line: c.line } satisfies OgCardProps,
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

/** The homepage hero as a card: the kicker label, the headline and the thesis line over a frame of
 *  the live field (og-hero-field.ts runs the hero's own bodies headlessly). No nav, standfirst or
 *  buttons; 60px safe margins; the text positions come from OG_HERO_LAYOUT, the same numbers the
 *  field's bodies are placed at. */
function heroCard({ eyebrow, title, line }: OgCardProps) {
  const L = OG_HERO_LAYOUT;
  const frame = renderOgHeroField();
  const fieldSvg = frame.svg;
  // the word's glow is the site's .hero-mass text-shadow (landing.css), driven by the same --d
  // reading: blur 6px + d·40px, the accent at 20% + d·70%.
  const d = frame.massDensity;
  const massGlow = `0 0 ${Math.round(6 + d * 40)}px rgba(77,163,255,${(0.2 + d * 0.7).toFixed(2)})`;
  const abs = (style: Record<string, unknown>, children: unknown) => ({
    type: 'div',
    props: { style: { display: 'flex', position: 'absolute', ...style }, children },
  });
  // split the headline so its last word takes the accent, as the hero's "mass" does
  const words = title.split(' ');
  const last = words.pop() ?? '';
  const head = words.join(' ');
  const dot = last.endsWith('.') ? '.' : '';
  const word = dot ? last.slice(0, -1) : last;
  return {
    type: 'div',
    props: {
      style: {
        width: `${OG_W}px`,
        height: `${OG_H}px`,
        display: 'flex',
        position: 'relative',
        backgroundColor: '#04050a',
        color: '#f3f6fc',
        fontFamily: 'Bricolage Grotesque',
      },
      children: [
        {
          type: 'img',
          props: {
            src: `data:image/svg+xml;base64,${Buffer.from(fieldSvg).toString('base64')}`,
            width: OG_W,
            height: OG_H,
            style: { position: 'absolute', left: 0, top: 0 },
          },
        },
        // a soft scrim under the thesis so the small line stays legible over the lattice
        abs({ left: 0, top: 420, width: `${OG_W}px`, height: `${OG_H - 420}px`, backgroundImage: 'linear-gradient(180deg, rgba(4,5,10,0), rgba(4,5,10,0.6) 45%)' }, []),
        abs(
          { left: L.margin, top: L.labelTop, fontSize: 26, fontWeight: 700, letterSpacing: 6, color: '#9fb0d0' },
          eyebrow.toUpperCase(),
        ),
        abs(
          { left: L.margin, top: L.titleTop, flexDirection: 'column', fontSize: L.titleSize, fontWeight: 700, lineHeight: L.titleLine, letterSpacing: -5 },
          [
            { type: 'div', props: { style: { display: 'flex' }, children: head } },
            {
              type: 'div',
              props: {
                style: { display: 'flex' },
                children: [
                  { type: 'span', props: { style: { color: '#4da3ff', textShadow: massGlow }, children: word } },
                  { type: 'span', props: { style: { color: '#ff9d5c' }, children: dot } },
                ],
              },
            },
          ],
        ),
        abs(
          { left: L.margin, top: L.thesisTop, flexDirection: 'column', fontSize: L.thesisSize, fontWeight: 400, lineHeight: 1.3, color: '#f3f6fc', borderLeft: '4px solid #4da3ff', paddingLeft: 24 },
          // one sentence per line: a deliberate break, and both lines stay inside the 60px margin
          (line ?? '').split(/(?<=\.)\s+/).map((s) => ({ type: 'div', props: { style: { display: 'flex' }, children: s } })),
        ),
      ],
    },
  };
}

export const GET: APIRoute = async ({ props }) => {
  const p = props as OgCardProps;
  const svg = await satori((p.layout === 'hero' ? heroCard(p) : card(p)) as Parameters<typeof satori>[0], {
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
