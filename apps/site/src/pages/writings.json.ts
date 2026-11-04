// JSON feed for the /writings datastore — a machine-readable index of every
// published writing. Mirrors the RSS route (rss.xml.ts): getCollection('writings')
// with drafts filtered, newest first, URL = /writings/{entry.id}/. Statically
// prerendered as /writings.json alongside the rest of the static output.
import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

export const prerender = true;

const SITE = 'https://fundamentalengine.com';

export const GET: APIRoute = async () => {
  const entries = (await getCollection('writings', (e) => !e.data.draft)).sort(
    (a, b) => b.data.date.getTime() - a.data.date.getTime(),
  );

  const writings = entries.map((e) => ({
    slug: e.id,
    title: e.data.title,
    description: e.data.description ?? null,
    url: `${SITE}/writings/${e.id}/`,
    datePublished: e.data.date.toISOString(),
    category: e.data.category,
  }));

  return new Response(JSON.stringify(writings), {
    headers: { 'content-type': 'application/json' },
  });
};
