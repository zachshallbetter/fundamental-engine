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
}

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
  },
  {
    slug: "ai-evidence",
    name: "AI Evidence",
    hook: "claims and sources are bodies; citations bind; an agent reads the field, not the DOM",
    href: "/ai-evidence",
    reads: "claims, sources, and citation edges over one question",
    becomes: "support → cohesion; confidence → mass; contradiction → charge; staleness → decay",
    writes: ["--d", "--field-attention", "agent-json"],
    see: "well-sourced claims anchor and brighten; a live JSON panel shows the SAME field read as structured data",
    instead: "an agent scraping the rendered DOM to recover the evidence graph",
  },
];
