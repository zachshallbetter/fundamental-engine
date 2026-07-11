// RSS 2.0 feed for the /writings datastore — hand-rolled XML (no @astrojs/rss dependency,
// keeping the site dependency-light). Mirrors the writings route: getCollection('writings')
// with drafts filtered, newest first, URL = /writings/{entry.id}. Linked from every page's
// <head> via `<link rel="alternate" type="application/rss+xml">` in Base.astro.
import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

const SITE = 'https://fundamental-engine.com';

const esc = (s: string): string =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

export const GET: APIRoute = async () => {
  const entries = (await getCollection('writings', (e) => !e.data.draft)).sort(
    (a, b) => b.data.date.getTime() - a.data.date.getTime(),
  );

  const items = entries
    .map((e) => {
      const url = `${SITE}/writings/${e.id}/`;
      const desc = e.data.description ? `\n      <description>${esc(e.data.description)}</description>` : '';
      const cat = (e.data as { category?: string }).category
        ? `\n      <category>${esc((e.data as { category?: string }).category as string)}</category>`
        : '';
      return `    <item>
      <title>${esc(e.data.title)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <pubDate>${e.data.date.toUTCString()}</pubDate>
      <dc:creator>Zach Shallbetter</dc:creator>${cat}${desc}
    </item>`;
    })
    .join('\n');

  const lastBuild = entries[0]?.data.date.toUTCString() ?? new Date(0).toUTCString();

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>Fundamental — Writings</title>
    <link>${SITE}/writings</link>
    <atom:link href="${SITE}/rss.xml" rel="self" type="application/rss+xml" />
    <description>Research, releases, features, and notes on Fundamental — the platform-native relational field runtime.</description>
    <language>en-us</language>
    <lastBuildDate>${lastBuild}</lastBuildDate>
    <managingEditor>hi@zachshallbetter.com (Zach Shallbetter)</managingEditor>
    <webMaster>hi@zachshallbetter.com (Zach Shallbetter)</webMaster>
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
