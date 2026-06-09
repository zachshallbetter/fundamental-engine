// Snapshot a real slice of OpenAlex (the open research-citation graph) for the /evidence demo.
// One-shot fetch → committed datafile, so the build stays deterministic + offline. Re-run to refresh.
const QUESTIONS = [
  "does exercise improve mental health",
  "do violent video games increase aggression",
];
const MAILTO = "hi@zachshallbetter.com";
const SEL = "id,title,publication_year,cited_by_count,authorships,doi,open_access,referenced_works,primary_topic";

const clean = (w) => ({
  id: w.id.replace("https://openalex.org/", ""),
  title: w.title,
  year: w.publication_year,
  citedBy: w.cited_by_count,
  authors: (w.authorships || []).slice(0, 3).map((a) => a.author?.display_name).filter(Boolean),
  doi: w.doi || null,
  oa: w.open_access?.is_oa ?? false,
  topic: w.primary_topic?.display_name || null,
  refs: (w.referenced_works || []).map((r) => r.replace("https://openalex.org/", "")),
});

const out = [];
for (const q of QUESTIONS) {
  const url = `https://api.openalex.org/works?search=${encodeURIComponent(q)}&per_page=14&select=${SEL}&mailto=${MAILTO}`;
  const r = await fetch(url, { headers: { "User-Agent": `field-ui-demo/0.1 (mailto:${MAILTO})` } });
  const j = await r.json();
  const works = (j.results || []).map(clean).filter((w) => w.title && w.year);
  out.push({ question: q, count: works.length, works });
  console.error(`  "${q}" → ${works.length} works (cites ${Math.min(...works.map(w=>w.citedBy))}–${Math.max(...works.map(w=>w.citedBy))})`);
}
process.stdout.write(JSON.stringify({ source: "OpenAlex (openalex.org)", license: "CC0", topics: out }, null, 2));
