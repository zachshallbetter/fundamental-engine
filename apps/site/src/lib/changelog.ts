// Build-time reader/parser for the repo's CHANGELOG.md, so /changelog renders the single
// source of truth (no parallel doc to maintain). Runs in Node during the Astro SSG build —
// same repo-file pattern as scripts/gen-llms.mjs (fileURLToPath → repo root).
import { readFileSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url)); // apps/site/src/lib
const root = resolve(here, "../../../.."); // repo root
const raw = readFileSync(join(root, "CHANGELOG.md"), "utf-8");

export interface ChangeSection {
  /** "Added" / "Changed" / "Fixed" / "Documentation" / … */
  title: string;
  /** each item is pre-rendered inline-markdown HTML (our own trusted content). */
  items: string[];
}
export interface ChangeVersion {
  /** "Unreleased" or "0.7.0". */
  version: string;
  /** ISO date for a released version; null for Unreleased. */
  date: string | null;
  unreleased: boolean;
  sections: ChangeSection[];
}

/** Minimal inline markdown → HTML for our OWN changelog text (trusted): escape, then code / bold /
 *  em / links. Order matters: escape first so code/bold operate on escaped text. */
function inline(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(?<![*\w])\*([^*\n]+)\*(?!\*)/g, "<em>$1</em>")
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>');
}

/** Parse the Keep-a-Changelog body into versions → sections → items. Bullets that wrap across
 *  indented continuation lines are re-joined into one item. */
export function parseChangelog(): ChangeVersion[] {
  const lines = raw.split("\n");
  const versions: ChangeVersion[] = [];
  let ver: ChangeVersion | null = null;
  let sec: ChangeSection | null = null;
  let buf: string[] = [];

  const flush = (): void => {
    if (sec && buf.length) sec.items.push(inline(buf.join(" ").trim()));
    buf = [];
  };

  for (const line of lines) {
    const vh = line.match(/^##\s+\[([^\]]+)\](?:\s*[—-]\s*(.+))?\s*$/);
    if (vh) {
      flush();
      const version = vh[1]!.trim();
      ver = {
        version,
        date: vh[2]?.trim() ?? null,
        unreleased: /unreleased/i.test(version),
        sections: [],
      };
      versions.push(ver);
      sec = null;
      continue;
    }
    if (!ver) continue; // skip the title/intro preamble before the first version
    const sh = line.match(/^###\s+(.+?)\s*$/);
    if (sh) {
      flush();
      sec = { title: sh[1]!.trim(), items: [] };
      ver.sections.push(sec);
      continue;
    }
    const item = line.match(/^[-*]\s+(.+)$/);
    if (item) {
      flush();
      buf = [item[1]!];
      continue;
    }
    if (/^\s+\S/.test(line) && buf.length) {
      buf.push(line.trim()); // continuation of the current bullet
      continue;
    }
    if (line.trim() === "") flush();
  }
  flush();
  // drop empty sections / versions with nothing in them
  for (const v of versions) v.sections = v.sections.filter((s) => s.items.length);
  return versions.filter((v) => v.sections.length);
}

/** Current released version = the first non-Unreleased entry. */
export function currentVersion(): string {
  return parseChangelog().find((v) => !v.unreleased)?.version ?? "0.x";
}

/** Hand-curated "recently shipped" highlights — the human-facing top of /changelog, above the full
 *  log. Keep this short and notable; the full log below has everything. */
export interface Highlight {
  title: string;
  blurb: string;
  href?: string;
}
export const HIGHLIGHTS: Highlight[] = [
  {
    title: "Focus / attention substrate — the field reads and writes attention",
    blurb: "New (experimental): operator attention as an input, agent attention as an output, over one shared field. field.focus(target, { source }) deposits source-tagged, decaying focus onto any body by identity; field.focusState() is the ranked, thresholded digest an AI agent can read in a single turn; metrics.salience rides query()/snapshot(); the focus event is the write-back channel; and a focus well gathers the field toward whatever is currently focused. The agent view stays read-only. Signals-first — it runs with nothing drawn.",
    href: "/docs/api/handle",
  },
  {
    title: "“recipe” is now “Pattern”",
    blurb: "The authored composed-arrangement concept is renamed to a Field Pattern, end to end: FieldPattern / compilePattern / applyPattern / FIELD_PATTERNS in the API, mirrored on the Swift + Kotlin ports. Every old recipe-named symbol still works as a deprecation alias (removed at 1.0), so nothing breaks.",
    href: "/docs/api/stability",
  },
  {
    title: "Android — a native Kotlin port",
    blurb: "The engine now runs natively on Android: same package layout, API surface, and physics as the JS and Swift packages, held to the same shared cross-plane golden. Ships a Jetpack Compose host (FieldView + Modifier.fieldBody), an imperative View host, and a desktop FieldLab. In active development on the android branch.",
    href: "/docs/guides/kotlin",
  },
  {
    title: "Warm palette by default",
    blurb: "The field renders on a warm cool→warm ramp out of the box — the same palette across the JS core and the Swift port.",
    href: "/docs/diagnostics",
  },
  {
    title: "Bodies track scroll smoothly",
    blurb: "Attractors no longer snap in 6-frame steps while you scroll — the swarm follows the page continuously, no more pausing.",
  },
  {
    title: "Tag-tint — particles wear their tag's colour",
    blurb: "Any body with data-color now stains the nearby swarm toward its hue at render time, so a tagged region reads in its own colour even on a sparse field.",
  },
  {
    title: "gridWarp — tunable grid distortion",
    blurb: "A new FieldOption (and <field-root grid-warp>) scales the grid overlay's deformation, so the field's bending of the reference lattice can be exaggerated for demos.",
    href: "/docs/diagnostics",
  },
  {
    title: "The homepage is a full narrative now",
    blurb: "Substrate → natural fields → forces → system → gallery, end to end over the live engine — and every concept and all 36 forces link straight to their exact reference.",
    href: "/docs/api/forces",
  },
];
