// The invisible-field example roster — the sidebar on /evidence and its siblings.
// Each example takes a real dataset, makes its records bodies, and lets the field's
// measurements come back as type, ink, and anchor — no particle swarm. Data snapshots
// live in src/data/examples/ (regenerate with scripts/snapshot-examples.mjs).

export interface InvisibleField {
  slug: string;
  name: string;
  /** the one-line concept mapping shown under the name */
  hook: string;
  href: string;
  /** the correlation, made explicit (the per-page explainer band + the overview index):
   *  what the field READS (the data quantity), what that BECOMES in the field, which CSS
   *  variables it WRITES, what you SEE, and what you'd otherwise hand-build INSTEAD. Every
   *  line traces to behavior live on the page — the truth gate applies. */
  reads: string;
  becomes: string;
  writes: string[];
  see: string;
  instead: string;
  /** the four data-honesty facts for this page (DataHonesty component). Every example is a
   *  committed snapshot of REAL data (src/data/examples/<slug>.json, stamped snapshotAt by
   *  scripts/snapshot-examples.mjs) that upgrades to live in the browser via wireLiveChip. */
  honesty: {
    /** what the data IS — the real source + license, from the snapshot header. */
    source: string;
    /** how snapshotting works / when captured. */
    snapshot: string;
    /** whether/how it live-refreshes. */
    liveRefresh: string;
    /** what the field does NOT assert — the truth boundary for THIS mapping. */
    notClaimed: string;
  };
}

// Shared honesty facts — every invisible-field example follows the same pipeline: a committed
// snapshot of real data that upgrades to live in the browser. Only `source` and `notClaimed`
// differ per page, so the snapshot/live lines are factored here.
const SNAPSHOT =
  "Committed snapshot in src/data/examples/, stamped snapshotAt on refresh via scripts/snapshot-examples.mjs — the build never fetches, so it is deterministic.";
const LIVE_REFRESH =
  "Upgrades to live in the browser: a polite poll (wireLiveChip) that skips hidden tabs and retires after failures. The committed snapshot is the SSR baseline and the no-JS truth.";

export const INVISIBLE_FIELDS: InvisibleField[] = [
  {
    slug: "evidence",
    name: "Evidence",
    hook: "citations are mass — trust you can feel in the type",
    href: "/evidence",
    reads: "OpenAlex citation counts per paper",
    becomes: "log-normalized trust → each paper's mass",
    writes: ["--w", "--d", "--field-attention"],
    see: "heavier-cited work sits heavier in the type — weight, ink, and an anchor that deepens with consensus",
    instead: "a relevance score column and a sort you re-run",
    honesty: {
      source: "Real OpenAlex citation counts (openalex.org, CC0) — a curated set of works per topic.",
      snapshot: SNAPSHOT,
      liveRefresh: LIVE_REFRESH,
      notClaimed:
        "The field reads citation count as mass — a consensus proxy. It does not judge whether any paper is correct, nor rank the science; it only makes the counts legible as weight.",
    },
  },
  {
    slug: "inbox",
    name: "Inbox",
    hook: "urgency is mass; attention is one finite budget; old asks decay toward quiet",
    href: "/evidence/inbox",
    reads: "Stack Overflow's unanswered questions",
    becomes: "urgency (recency · votes · views) → mass inside ONE conserved budget",
    writes: ["--w", "--field-attention"],
    see: "fresh asks read bold and sink as they age; brightening one literally dims the rest",
    instead: "priority tiers, a scoring scheme, and a re-sort on every change",
    honesty: {
      source:
        "Real Stack Exchange data (stackoverflow.com API) — unanswered [javascript] questions, CC BY-SA 4.0.",
      snapshot: SNAPSHOT,
      liveRefresh: LIVE_REFRESH,
      notClaimed:
        "The field reads recency, votes, and views as urgency inside one conserved attention budget. It does not decide which question actually matters most — it makes a chosen urgency signal legible.",
    },
  },
  {
    slug: "market",
    name: "Market",
    hook: "market cap is mass; the day's move polarizes; correlated assets thread",
    href: "/evidence/market",
    reads: "CoinGecko market caps and the day's moves",
    becomes: "cap → mass (area + ink); the move → polarity",
    writes: ["--w", "--cat"],
    see: "big caps take more page; direction is hue, magnitude is intensity",
    instead: "a treemap library plus a color scale you maintain",
    honesty: {
      source: "Real CoinGecko market data (coingecko.com API) — market caps and 24h moves.",
      snapshot: SNAPSHOT,
      liveRefresh: LIVE_REFRESH,
      notClaimed:
        "The field reads market cap as mass and the day's move as polarity. It is not financial advice and makes no claim about value or direction — it only renders the numbers as size and hue.",
    },
  },
  {
    slug: "backlog",
    name: "Backlog",
    hook: "priority is mass; references bind; the cycle is a sink with capacity",
    href: "/evidence/backlog",
    reads: "this repo's live issues and PRs",
    becomes: "activity + recency → mass; references bind items",
    writes: ["--w", "--field-attention"],
    see: "active work reads heavy; referenced items move together; the cycle fills like a vessel",
    instead: "a priority field, a linked-issues query, and a sprint board",
    honesty: {
      source:
        "Real GitHub API data — this repo's (zachshallbetter/fundamental-engine) open issues and pull requests, public repository data.",
      snapshot: SNAPSHOT,
      liveRefresh: LIVE_REFRESH,
      notClaimed:
        "The field reads activity and recency as mass and references as binding. It does not prioritize the work or assert what should ship next — it makes the repo's own signals legible.",
    },
  },
  {
    slug: "calendar",
    name: "Calendar",
    hook: "the next launch pulls hardest; imminence ramps the weight in real time",
    href: "/evidence/calendar",
    reads: "Launch Library's T\u22120 times",
    becomes: "imminence → mass, recomputed every second",
    writes: ["--w"],
    see: "the next launch literally gains weight as T\u22120 approaches — time itself drives the field",
    instead: "a countdown per row and a cron that re-sorts",
    honesty: {
      source:
        "Real Launch Library 2 data (thespacedevs.com) — upcoming rocket launches with T−0 times, free API (attribution).",
      snapshot: SNAPSHOT,
      liveRefresh:
        "Upgrades to live in the browser; additionally, imminence (mass) is recomputed every second in-page as T−0 approaches. The committed snapshot is the SSR baseline.",
      notClaimed:
        "The field reads imminence as mass. It does not predict whether a launch will happen on time or succeed — it makes the countdown drive weight in real time.",
    },
  },
  {
    slug: "threads",
    name: "Threads",
    hook: "votes are mass; controversy is charge; reply chains bind and heat",
    href: "/evidence/threads",
    reads: "a Hacker News discussion tree",
    becomes: "subtree size → mass; reply tempo → hue",
    writes: ["--w", "--cat"],
    see: "big subthreads loom in the type; fast exchanges run warm, slow ones cool",
    instead: "comment scores plus a collapse heuristic",
    honesty: {
      source: "Real Hacker News discussion tree via the Algolia API (hn.algolia.com).",
      snapshot: SNAPSHOT,
      liveRefresh: LIVE_REFRESH,
      notClaimed:
        "The field reads subtree size as mass and reply tempo as hue. It does not evaluate the quality or truth of any comment — it makes the shape of the conversation legible.",
    },
  },
  {
    slug: "dependencies",
    name: "Dependencies",
    hook: "downloads are mass; staleness decays; one advisory charges the graph",
    href: "/evidence/dependencies",
    reads: "npm weekly downloads + OSV advisories",
    becomes: "downloads → mass; an advisory → charge",
    writes: ["--w", "--cat"],
    see: "core dependencies read heavy; one advisory turns its line red and the graph feels it",
    instead: "a dashboard query and alert rules",
    honesty: {
      source:
        "Real npm registry + api.npmjs.org weekly downloads + OSV.dev advisories, over this monorepo's actual package.json files — public registry data.",
      snapshot: SNAPSHOT,
      liveRefresh: LIVE_REFRESH,
      notClaimed:
        "The field reads downloads as mass and an advisory as charge. It does not assess whether a dependency is safe to use — surfacing an advisory is not a security verdict.",
    },
  },
  {
    slug: "fleet",
    name: "Fleet",
    hook: "services carry traffic; incidents accrete their updates; impact is heat",
    href: "/evidence/fleet",
    reads: "GitHub's live status feed",
    becomes: "incident involvement → mass; severity → heat",
    writes: ["--w", "--cat"],
    see: "troubled services swell and warm; quiet ones recede to gray",
    instead: "a status table with severity badges",
    honesty: {
      source: "Real GitHub status feed (githubstatus.com API) — components and active incidents.",
      snapshot: SNAPSHOT,
      liveRefresh: LIVE_REFRESH,
      notClaimed:
        "The field reads incident involvement as mass and severity as heat. It does not diagnose or predict outages — it reflects the published status feed as weight and warmth.",
    },
  },
  {
    slug: "catalog",
    name: "Catalog",
    hook: "review consensus is mass — the evidence trust math, retargeted at a shelf",
    href: "/evidence/catalog",
    reads: "Open Library's ratings for a shelf",
    becomes: "review consensus → mass — the Evidence math, retargeted",
    writes: ["--w", "--cat"],
    see: "well-attested books carry weight; each subject tints its spine",
    instead: "star-sort plus genre filters",
    honesty: {
      source: "Real Open Library data (openlibrary.org search API) — ratings for a shelf, open data.",
      snapshot: SNAPSHOT,
      liveRefresh: LIVE_REFRESH,
      notClaimed:
        "The field reads review consensus as mass — the same math as Evidence, retargeted. It does not judge whether a book is good; it makes attestation legible as weight.",
    },
  },
  {
    slug: "library",
    name: "Library",
    hook: "listens are mass; the queue accretes and releases",
    href: "/evidence/library",
    reads: "ListenBrainz's top recordings",
    becomes: "listens → mass; the queue is a sink with capacity 8",
    writes: ["--w", "--bar", "--load"],
    see: "popular tracks read heavy; the queue visibly fills, saturates, and releases",
    instead: "a play-count sort and a queue-length check",
    honesty: {
      source:
        "Real ListenBrainz sitewide statistics (listenbrainz.org) — top recordings, CC0 / open data.",
      snapshot: SNAPSHOT,
      liveRefresh: LIVE_REFRESH,
      notClaimed:
        "The field reads listens as mass and the queue as a sink with capacity 8. It does not recommend music or rank taste — it renders popularity as weight and the queue as fill.",
    },
  },
  {
    slug: "memory",
    name: "Memory",
    hook: "the forgetting curve is decay; frequency anchors; review re-binds",
    href: "/evidence/memory",
    reads: "word frequency + your own reviews",
    becomes: "the forgetting curve → decaying mass; review re-binds",
    writes: ["--w"],
    see: "unreviewed words fade in real time; a review springs the word back",
    instead: "a spaced-repetition scheduler and its timers",
    honesty: {
      source:
        "Real word-frequency data (Google Web Trillion Word Corpus, norvig.com/ngrams) plus your own in-page reviews — research data.",
      snapshot: SNAPSHOT,
      liveRefresh:
        "The frequency data is a committed snapshot; the forgetting curve and your reviews are computed live in-page (unreviewed words decay in real time). No committed reviews — they exist only for your session.",
      notClaimed:
        "The field reads the forgetting curve as decaying mass and a review as re-binding. It is a demonstration of decay, not a real memory model of what you actually know.",
    },
  },
  {
    slug: "newsroom",
    name: "Newsroom",
    hook: "pageviews are mass; the cycle's rise and fall polarizes",
    href: "/evidence/newsroom",
    reads: "Wikipedia's most-read pages",
    becomes: "pageviews → mass (placement + weight); day-over-day → polarity",
    writes: ["--w", "--cat"],
    see: "the lead earns its slot; risers run warm, fallers cool, new entries gray",
    instead: "an editor reordering the page every morning",
    honesty: {
      source:
        "Real Wikimedia pageviews API — en.wikipedia most-read pages with a day-over-day trend, CC0.",
      snapshot: SNAPSHOT,
      liveRefresh: LIVE_REFRESH,
      notClaimed:
        "The field reads pageviews as mass and the day-over-day change as polarity. It does not judge newsworthiness — it reflects attention already spent, not what deserves it.",
    },
  },
];
