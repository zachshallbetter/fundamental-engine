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
}

export const INVISIBLE_FIELDS: InvisibleField[] = [
  {
    slug: "evidence",
    name: "Evidence",
    hook: "citations are mass — trust you can feel in the type",
    href: "/evidence",
  },
  {
    slug: "inbox",
    name: "Inbox",
    hook: "urgency is mass; attention is one finite budget; old asks decay toward quiet",
    href: "/evidence/inbox",
  },
  {
    slug: "market",
    name: "Market",
    hook: "market cap is mass; the day's move polarizes; correlated assets thread",
    href: "/evidence/market",
  },
  {
    slug: "backlog",
    name: "Backlog",
    hook: "priority is mass; references bind; the cycle is a sink with capacity",
    href: "/evidence/backlog",
  },
  {
    slug: "calendar",
    name: "Calendar",
    hook: "the next launch pulls hardest; imminence ramps the weight in real time",
    href: "/evidence/calendar",
  },
  {
    slug: "threads",
    name: "Threads",
    hook: "votes are mass; controversy is charge; reply chains bind and heat",
    href: "/evidence/threads",
  },
  {
    slug: "dependencies",
    name: "Dependencies",
    hook: "downloads are mass; staleness decays; one advisory charges the graph",
    href: "/evidence/dependencies",
  },
  {
    slug: "fleet",
    name: "Fleet",
    hook: "services carry traffic; incidents accrete their updates; impact is heat",
    href: "/evidence/fleet",
  },
  {
    slug: "catalog",
    name: "Catalog",
    hook: "review consensus is mass — the evidence trust math, retargeted at a shelf",
    href: "/evidence/catalog",
  },
  {
    slug: "library",
    name: "Library",
    hook: "listens are mass; the queue accretes and releases",
    href: "/evidence/library",
  },
  {
    slug: "memory",
    name: "Memory",
    hook: "the forgetting curve is decay; frequency anchors; review re-binds",
    href: "/evidence/memory",
  },
  {
    slug: "newsroom",
    name: "Newsroom",
    hook: "pageviews are mass; the cycle's rise and fall polarizes",
    href: "/evidence/newsroom",
  },
];
