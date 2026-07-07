// IndexNow submission — notifies participating search engines (Bing, Yandex, Seznam, …)
// that URLs have changed, for near-instant (re)indexing. The IndexNow protocol:
// https://www.bing.com/indexnow/getstarted
//
// Ownership is proven by a key file served at the site root
// (public/<key>.txt, containing <key>); the engine fetches `keyLocation` to verify.
// So this only works once that file is LIVE on production — run it AFTER a deploy.
//
//   node scripts/indexnow-submit.mjs                 # submit every URL in the live sitemap
//   node scripts/indexnow-submit.mjs <url> <url> …   # submit specific URLs
//   DRY_RUN=1 node scripts/indexnow-submit.mjs       # print the payload, don't send
//
// One shared endpoint (api.indexnow.org) fans the submission out to all participating
// engines, so a single call covers Bing + the rest.

const HOST = 'fundamental-engine.com';
const KEY = 'e11f6a0750ae4fc0b26a5072e0453a55';
const KEY_LOCATION = `https://${HOST}/${KEY}.txt`;
const ENDPOINT = 'https://api.indexnow.org/indexnow';
const SITEMAP_INDEX = `https://${HOST}/sitemap-index.xml`;

const locs = (xml) => [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());

async function sitemapUrls() {
  const index = await fetch(SITEMAP_INDEX).then((r) => {
    if (!r.ok) throw new Error(`sitemap index ${r.status} — is the site deployed?`);
    return r.text();
  });
  const children = locs(index);
  const urls = [];
  for (const child of children) {
    const xml = await fetch(child).then((r) => (r.ok ? r.text() : ''));
    urls.push(...locs(xml));
  }
  return [...new Set(urls)];
}

const args = process.argv.slice(2);
const urlList = args.length ? args : await sitemapUrls();
if (!urlList.length) {
  console.error('IndexNow: no URLs to submit.');
  process.exit(1);
}

const payload = { host: HOST, key: KEY, keyLocation: KEY_LOCATION, urlList };

if (process.env.DRY_RUN) {
  console.log(`IndexNow DRY_RUN — would submit ${urlList.length} URLs:`);
  console.log(JSON.stringify(payload, null, 2));
  process.exit(0);
}

const res = await fetch(ENDPOINT, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify(payload),
});
// IndexNow: 200 = accepted, 202 = accepted/pending validation, 4xx = key/URL problem.
console.log(`IndexNow: submitted ${urlList.length} URLs → HTTP ${res.status} ${res.statusText}`);
if (!res.ok) {
  console.error(await res.text());
  process.exit(1);
}
