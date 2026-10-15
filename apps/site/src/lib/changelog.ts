// Build-time reader/parser for the repo's CHANGELOG.md, so /changelog renders the single
// source of truth (no parallel doc to maintain). Runs in Node during the Astro SSG build —
// same repo-file pattern as scripts/gen-llms.mjs (fileURLToPath → repo root).
import { readFileSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { engineVersion } from "./build-info";

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

/** Current released version — the published core package's version, the same source the footer and
 *  llms.txt use (it used to be the first CHANGELOG heading, which could disagree with the package
 *  between a CHANGELOG cut and the version bump). */
export function currentVersion(): string {
  return engineVersion;
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
    title: "0.11.1 — `npm create @fundamental-engine` works again",
    blurb: "From 0.9.3 to 0.11.0 the scaffolder exited without creating anything (npm runs a bin through a symlink the entry check never matched). It now scaffolds a vanilla, React, or web-component starter on the current engine — and a new release gate scaffolds, installs and builds all three from the packed tarballs before anything is published.",
    href: "/docs/getting-started",
  },
  {
    title: "0.11.1 — sturdier on real pages",
    blurb: "Elements removed by a page swap no longer linger as invisible bodies; destroy() from inside a field callback really stops the field; the mobile address bar no longer resets the swarm; the quality governor runs on the display's real frame rate (a 30 Hz screen isn't held at reduced quality); and an unchanged overlay isn't redrawn every frame.",
  },
  {
    title: "Rust — a fourth, headless plane",
    blurb: "An experimental f64, seeded, zero-dependency Rust crate for servers and data pipelines, where a body is a data record: 36 of the 37 forces, solve() to equilibrium, deterministic snapshot + causal replay, and a reading layer (scores, clusters, relations). Not yet published to crates.io.",
    href: "/docs/implementations",
  },
  {
    title: "Height-aware fields — `relief`",
    blurb: "The 37th force: a host-declared scalar channel (addField) becomes a potential the swarm descends — terrain as a cause, on JS, Swift and Kotlin.",
    href: "/docs/api/forces",
  },
  {
    title: "The reproducibility envelope is queryable",
    blurb: "FieldHandle.guarantees states what a run promises — which paths are deterministic and what isn't — and agent read scopes (read:snapshots, read:diagnostics, a fractional agentRead budget) are enforced, not just declared.",
    href: "/docs/api/handle",
  },
  {
    title: "Native ports, kept in step",
    blurb: "Swift and Kotlin track the JS engine — the shared cross-plane golden pins the six canonical deterministic forces within a stated tolerance, and FIELD_VERSION moves in lockstep across JS, Swift, Kotlin and Rust.",
    href: "/docs/api/parity",
  },
  {
    title: "Focus / attention substrate",
    blurb: "Operator attention as an input, agent attention as an output: field.focus(target, { source }) deposits decaying, source-tagged focus; field.focusState() is the ranked digest an agent reads; metrics.salience rides query()/snapshot().",
    href: "/docs/api/handle",
  },
];
