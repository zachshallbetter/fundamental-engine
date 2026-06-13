// Snapshot the real datasets behind the invisible-field examples → src/data/examples/<slug>.json.
// Same convention as src/data/evidence.json (OpenAlex): committed snapshots with a source +
// license header, so builds are deterministic and no page fetches at runtime.
//
//   node apps/site/scripts/snapshot-examples.mjs            # all sources
//   node apps/site/scripts/snapshot-examples.mjs market …   # named sources only
//
// Mind the rate limits (Launch Library is 15 req/hour) — this script makes ONE request per
// source where possible.
import { writeFileSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, 'src/data/examples');
mkdirSync(OUT, { recursive: true });

const UA = { 'User-Agent': 'field-ui.com snapshot script (hi@zachshallbetter.com)' };
const get = async (url, init = {}) => {
  const res = await fetch(url, { ...init, headers: { ...UA, ...(init.headers ?? {}) } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
};
const write = (slug, data) => {
  writeFileSync(resolve(OUT, `${slug}.json`), JSON.stringify(data, null, 2) + '\n');
  console.log(`✓ ${slug}.json`);
};
const downsample = (arr, n) => {
  if (!arr || arr.length <= n) return arr ?? [];
  const out = [];
  for (let i = 0; i < n; i++) out.push(arr[Math.round((i * (arr.length - 1)) / (n - 1))]);
  return out;
};

const SOURCES = {
  // ── Evidence — refresh the flagship's own baseline (src/data/evidence.json) ─────────
  // Keeps the same topics/works and refreshes each work's citation count from OpenAlex
  // (batched, one request per topic), stamping snapshotAt so the page's provenance chip
  // can show a real date. The works themselves are curated — this never adds or removes.
  async evidence() {
    const path = resolve(ROOT, 'src/data/evidence.json');
    const data = JSON.parse(readFileSync(path, 'utf8'));
    for (const topic of data.topics) {
      const ids = topic.works.map((w) => w.id).join('|');
      const res = await get(
        `https://api.openalex.org/works?filter=ids.openalex:${ids}&per-page=50&select=id,cited_by_count`,
      );
      const counts = new Map(res.results.map((w) => [w.id.split('/').pop(), w.cited_by_count]));
      for (const w of topic.works) {
        const fresh = counts.get(w.id);
        if (typeof fresh === 'number') w.citedBy = fresh;
      }
    }
    data.snapshotAt = new Date().toISOString();
    writeFileSync(path, JSON.stringify(data, null, 2) + '\n');
    console.log('✓ evidence.json (citation counts refreshed in place)');
  },

  // ── Inbox — Stack Overflow's unanswered-question stream ─────────────────────────────
  async inbox() {
    const base =
      'https://api.stackexchange.com/2.3/questions/no-answers?site=stackoverflow&tagged=javascript&filter=default';
    const recent = await get(`${base}&order=desc&sort=creation&pagesize=28`);
    const voted = await get(`${base}&order=desc&sort=votes&pagesize=14`);
    const seen = new Set();
    const items = [...recent.items, ...voted.items]
      .filter((q) => (seen.has(q.question_id) ? false : seen.add(q.question_id)))
      .map((q) => ({
        id: q.question_id,
        title: q.title,
        tags: q.tags.slice(0, 4),
        score: q.score,
        views: q.view_count,
        askedAt: q.creation_date, // unix seconds
        author: q.owner?.display_name ?? '—',
        reputation: q.owner?.reputation ?? 0,
        link: q.link,
      }));
    write('inbox', {
      source: 'Stack Exchange API (stackoverflow.com) — unanswered [javascript] questions',
      license: 'CC BY-SA 4.0',
      snapshotAt: new Date().toISOString(),
      items,
    });
  },

  // ── Market — CoinGecko top assets ────────────────────────────────────────────────────
  async market() {
    const rows = await get(
      'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=24&sparkline=true&price_change_percentage=24h,7d',
    );
    write('market', {
      source: 'CoinGecko API (coingecko.com)',
      license: 'CoinGecko free API terms (attribution)',
      snapshotAt: new Date().toISOString(),
      assets: rows.map((c) => ({
        id: c.id,
        symbol: c.symbol,
        name: c.name,
        price: c.current_price,
        cap: c.market_cap,
        rank: c.market_cap_rank,
        volume: c.total_volume,
        change24h: c.price_change_percentage_24h_in_currency ?? 0,
        change7d: c.price_change_percentage_7d_in_currency ?? 0,
        spark: downsample(c.sparkline_in_7d?.price, 32).map((v) => +v.toPrecision(6)),
      })),
    });
  },

  // ── Backlog — this repo's real issues (open queue + recently shipped) ────────────────
  async backlog() {
    // this repo tracks most work as PRs, so the real work stream is issues + PRs together.
    // PR volume dwarfs issues — fetch deep enough to catch every actual issue, then merge.
    const gh = (page) =>
      get(
        `https://api.github.com/repos/zachshallbetter/fundamental-engine/issues?state=all&per_page=100&sort=updated&page=${page}`,
        { headers: { Accept: 'application/vnd.github+json' } },
      );
    const pages = [await gh(1), await gh(2), await gh(3)];
    const seen = new Set();
    const batch = [
      ...pages[0].slice(0, 48), // the live stream (mostly PRs)
      ...pages.flat().filter((i) => !i.pull_request), // every real issue
    ].filter((i) => (seen.has(i.number) ? false : seen.add(i.number)));
    write('backlog', {
      source: 'GitHub API — zachshallbetter/fundamental-engine work items (issues + pull requests)',
      license: 'public repository data',
      snapshotAt: new Date().toISOString(),
      items: batch.slice(0, 64).map((i) => ({
        number: i.number,
        title: i.title,
        kind: i.pull_request ? 'pr' : 'issue',
        state: i.pull_request?.merged_at ? 'merged' : i.state,
        labels: i.labels.map((l) => (typeof l === 'string' ? l : l.name)),
        comments: i.comments,
        createdAt: i.created_at,
        updatedAt: i.updated_at,
        closedAt: i.closed_at,
        author: i.user?.login ?? '—',
        // cross-references in the body ("#123") thread items to what they build on
        refs: [...new Set([...(i.body ?? '').matchAll(/#(\d{1,5})\b/g)].map((m) => +m[1]))].slice(0, 8),
        url: i.html_url,
      })),
    });
  },

  // ── Calendar — upcoming rocket launches (ONE request: 15/hr limit) ──────────────────
  async calendar() {
    const data = await get('https://ll.thespacedevs.com/2.2.0/launch/upcoming/?limit=30');
    write('calendar', {
      source: 'Launch Library 2 (thespacedevs.com)',
      license: 'free API (attribution)',
      snapshotAt: new Date().toISOString(),
      launches: data.results.map((l) => ({
        id: l.id,
        name: l.name,
        provider: l.launch_service_provider?.name ?? '—',
        vehicle: l.rocket?.configuration?.full_name ?? l.rocket?.configuration?.name ?? '—',
        pad: l.pad?.name ?? '—',
        location: l.pad?.location?.name ?? '—',
        windowStart: l.window_start,
        windowEnd: l.window_end,
        net: l.net,
        status: l.status?.abbrev ?? '—',
        statusName: l.status?.name ?? '—',
        mission: l.mission?.name ?? null,
        orbit: l.mission?.orbit?.abbrev ?? null,
      })),
    });
  },

  // ── Threads — one real HN discussion, full comment tree ─────────────────────────────
  async threads() {
    const search = await get(
      'https://hn.algolia.com/api/v1/search?tags=story&numericFilters=points%3E400,num_comments%3E200&hitsPerPage=8',
    );
    const story = search.hits.sort((a, b) => b.num_comments - a.num_comments)[0];
    const tree = await get(`https://hn.algolia.com/api/v1/items/${story.objectID}`);
    const flat = [];
    const walk = (node, parent, depth) => {
      if (!node) return;
      if (node.type === 'comment' && node.text) {
        flat.push({
          id: node.id,
          parent,
          depth,
          author: node.author ?? '—',
          createdAt: node.created_at_i,
          points: node.points ?? null,
          // strip tags, keep it short — the field is about shape, not full prose
          text: node.text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 360),
          replies: (node.children ?? []).length,
        });
      }
      for (const c of node.children ?? []) walk(c, node.id, node.type === 'comment' ? depth + 1 : 0);
    };
    walk(tree, null, 0);
    write('threads', {
      source: 'Hacker News via Algolia API (hn.algolia.com)',
      license: 'Y Combinator HN API terms',
      snapshotAt: new Date().toISOString(),
      story: {
        id: tree.id,
        title: tree.title,
        url: tree.url,
        points: tree.points,
        author: tree.author,
        createdAt: tree.created_at_i,
        comments: story.num_comments,
        hn: `https://news.ycombinator.com/item?id=${tree.id}`,
      },
      comments: flat.slice(0, 160),
    });
  },

  // ── Dependencies — the monorepo's real npm deps + advisories ────────────────────────
  async dependencies() {
    const pkgDirs = ['packages/core', 'packages/platform', 'packages/elements', 'packages/vanilla', 'packages/react', 'apps/site'];
    const internal = new Set(['@fundamental-engine/core', '@fundamental-engine/platform', '@fundamental-engine/elements', '@fundamental-engine/vanilla', '@fundamental-engine/react', '@fundamental-engine/kit']);
    const usedBy = new Map(); // external dep → [workspace pkgs]
    for (const dir of pkgDirs) {
      const pj = JSON.parse(readFileSync(resolve(ROOT, '../../', dir, 'package.json'), 'utf8'));
      const short = dir.split('/')[1];
      for (const name of Object.keys({ ...(pj.dependencies ?? {}), ...(pj.devDependencies ?? {}) })) {
        if (internal.has(name) || name.startsWith('@fundamental-engine/')) continue;
        usedBy.set(name, [...(usedBy.get(name) ?? []), short]);
      }
    }
    const deps = [];
    for (const [name, consumers] of usedBy) {
      try {
        // the full packument is needed for `time` (the /latest endpoint omits it)
        const [dl, doc] = await Promise.all([
          get(`https://api.npmjs.org/downloads/point/last-week/${encodeURIComponent(name)}`),
          get(`https://registry.npmjs.org/${encodeURIComponent(name)}`),
        ]);
        const latest = doc['dist-tags']?.latest;
        const meta = {
          version: latest,
          description: doc.description ?? doc.versions?.[latest]?.description ?? '',
          time: { modified: doc.time?.[latest] ?? doc.time?.modified ?? null },
        };
        let advisories = 0;
        try {
          const osv = await fetch('https://api.osv.dev/v1/query', {
            method: 'POST',
            headers: UA,
            body: JSON.stringify({ package: { name, ecosystem: 'npm' } }),
          }).then((r) => r.json());
          advisories = (osv.vulns ?? []).length;
        } catch { /* advisory count stays 0 */ }
        deps.push({
          name,
          weeklyDownloads: dl.downloads ?? 0,
          version: meta.version,
          // staleness = days since the latest publish
          publishedAt: meta?.time?.modified ?? null,
          description: (meta.description ?? '').slice(0, 120),
          advisories,
          usedBy: consumers,
        });
      } catch (e) {
        console.warn(`  dependencies: skipped ${name} (${e.message})`);
      }
    }
    write('dependencies', {
      source: 'npm registry + api.npmjs.org downloads + OSV.dev advisories, over this monorepo’s real package.json files',
      license: 'public registry data',
      snapshotAt: new Date().toISOString(),
      workspace: [
        { name: 'core', deps: [] },
        { name: 'platform', deps: ['core'] },
        { name: 'elements', deps: ['platform', 'vanilla', 'core'] },
        { name: 'vanilla', deps: ['platform', 'core'] },
        { name: 'react', deps: ['vanilla', 'core'] },
        { name: 'site', deps: ['elements', 'core', 'platform'] },
      ],
      deps: deps.sort((a, b) => b.weeklyDownloads - a.weeklyDownloads),
    });
  },

  // ── Fleet — GitHub's real status page: components + incident history ────────────────
  async fleet() {
    const [components, incidents] = await Promise.all([
      get('https://www.githubstatus.com/api/v2/components.json'),
      get('https://www.githubstatus.com/api/v2/incidents.json'),
    ]);
    // Editorial exclusions by id: incidents about partner/upstream providers rather than
    // GitHub's own infrastructure — off-topic for the fleet example.
    const EXCLUDED_INCIDENT_IDS = new Set(['71hv2q6tk693']);
    write('fleet', {
      source: 'GitHub status page API (githubstatus.com)',
      license: 'public status data',
      snapshotAt: new Date().toISOString(),
      components: components.components
        .filter((c) => !c.group)
        .map((c) => ({ id: c.id, name: c.name, status: c.status, description: c.description ?? '' })),
      incidents: incidents.incidents
        .filter((i) => !EXCLUDED_INCIDENT_IDS.has(i.id))
        .slice(0, 30)
        .map((i) => ({
          id: i.id,
          name: i.name,
          impact: i.impact,
          status: i.status,
          createdAt: i.created_at,
          resolvedAt: i.resolved_at,
          updates: i.incident_updates.map((u) => ({
            status: u.status,
            at: u.created_at,
            body: u.body.replace(/\s+/g, ' ').slice(0, 280),
          })),
          components: i.components.map((c) => c.name),
        })),
    });
  },

  // ── Catalog — Open Library science-fiction shelf ────────────────────────────────────
  async catalog() {
    const data = await get(
      'https://openlibrary.org/search.json?q=subject:%22science%20fiction%22&fields=key,title,author_name,first_publish_year,ratings_count,ratings_average,want_to_read_count,currently_reading_count,edition_count,subject&limit=60',
    );
    const books = data.docs
      .filter((d) => (d.ratings_count ?? 0) > 0 && d.author_name?.length)
      .sort((a, b) => (b.ratings_count ?? 0) - (a.ratings_count ?? 0))
      .slice(0, 28)
      .map((d) => ({
        key: d.key,
        title: d.title,
        author: d.author_name[0],
        year: d.first_publish_year ?? null,
        ratings: d.ratings_count ?? 0,
        stars: d.ratings_average ? +d.ratings_average.toFixed(2) : null,
        wantToRead: d.want_to_read_count ?? 0,
        editions: d.edition_count ?? 0,
        subjects: (d.subject ?? []).slice(0, 6),
        url: `https://openlibrary.org${d.key}`,
      }));
    write('catalog', {
      source: 'Open Library search API (openlibrary.org)',
      license: 'Open Library (open data)',
      snapshotAt: new Date().toISOString(),
      books,
    });
  },

  // ── Library — ListenBrainz sitewide top recordings (real listen counts) ─────────────
  async library() {
    const data = await get('https://api.listenbrainz.org/1/stats/sitewide/recordings?range=month&count=30');
    write('library', {
      source: 'ListenBrainz sitewide statistics (listenbrainz.org)',
      license: 'CC0 / open data',
      snapshotAt: new Date().toISOString(),
      range: 'month',
      tracks: data.payload.recordings.map((r, i) => ({
        rank: i + 1,
        track: r.track_name,
        artist: r.artist_name,
        release: r.release_name ?? null,
        listens: r.listen_count,
        mbid: r.recording_mbid ?? null,
      })),
    });
  },

  // ── Memory — real word-frequency data (Google trillion-word corpus, via Norvig) ─────
  async memory() {
    const txt = await fetch('https://norvig.com/ngrams/count_1w.txt', { headers: UA }).then((r) => r.text());
    const rows = txt.trim().split('\n').map((l) => {
      const [word, count] = l.split('\t');
      return { word, count: +count };
    });
    // mid-frequency vocabulary makes believable study cards; sample bands so anchored-vs-fading
    // contrast is visible (every 7th word from rank 1500).
    const cards = [];
    for (let r = 1500; r < 1500 + 7 * 110 && r < rows.length; r += 7) {
      const { word, count } = rows[r];
      if (word.length < 4) continue;
      cards.push({ word, rank: r + 1, count, zipf: +Math.log10(count).toFixed(2) });
    }
    write('memory', {
      source: 'Google Web Trillion Word Corpus frequencies (norvig.com/ngrams)',
      license: 'research data (Norvig/Google)',
      snapshotAt: new Date().toISOString(),
      cards: cards.slice(0, 96),
    });
  },

  // ── Newsroom — Wikipedia's most-read articles, two days for the trend ───────────────
  async newsroom() {
    const day = (offset) => {
      const d = new Date(Date.now() - offset * 86400e3);
      return `${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${String(d.getUTCDate()).padStart(2, '0')}`;
    };
    const skip = /^(Main_Page|Special:|Wikipedia:|Portal:|Help:|File:|Talk:|User:)/;
    const [today, prior] = await Promise.all([
      get(`https://wikimedia.org/api/rest_v1/metrics/pageviews/top/en.wikipedia/all-access/${day(2)}`),
      get(`https://wikimedia.org/api/rest_v1/metrics/pageviews/top/en.wikipedia/all-access/${day(3)}`),
    ]);
    const priorViews = new Map(today && prior.items[0].articles.map((a) => [a.article, a.views]));
    const articles = today.items[0].articles
      .filter((a) => !skip.test(a.article))
      .slice(0, 30)
      .map((a) => ({
        title: a.article.replace(/_/g, ' '),
        slug: a.article,
        views: a.views,
        rank: a.rank,
        priorViews: priorViews.get(a.article) ?? null,
        url: `https://en.wikipedia.org/wiki/${a.article}`,
      }));
    write('newsroom', {
      source: `Wikimedia pageviews API — en.wikipedia most-read, ${day(2)} (trend vs ${day(3)})`,
      license: 'CC0',
      snapshotAt: new Date().toISOString(),
      day: day(2),
      articles,
    });
  },
};

const picked = process.argv.slice(2);
const run = picked.length ? picked : Object.keys(SOURCES);
for (const slug of run) {
  if (!SOURCES[slug]) {
    console.error(`unknown source: ${slug}`);
    continue;
  }
  try {
    await SOURCES[slug]();
  } catch (e) {
    console.error(`✗ ${slug}: ${e.message}`);
    process.exitCode = 1;
  }
}
