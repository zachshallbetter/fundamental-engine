#!/usr/bin/env node
/**
 * Silent-contract-gap report — the CI side of the recurring "charged but reads nothing" bug.
 *
 * The engine writes feedback channels (`--d` / `--load` / `--field-*`) onto every `[data-feedback]`
 * body, but nothing forces a CSS consumer to read them. When a body should visibly react and the CSS
 * never reads its channel, the body changes *invisibly* — a silent contract gap. `lintPlatform` already
 * detects this at runtime (`feedback-vars-unwritten`, `feedback-writes-unread`, `feedback-reads-unwritten`,
 * `sink-without-feedback`); this script runs that same detection over the BUILT site pages in a real
 * browser (real CSSOM — the stylesheet-coupled rules need it) and emits a per-page, per-code count.
 *
 * Usage:
 *   node scripts/check-silent-contract.mjs                 # report counts (always exits 0)
 *   node scripts/check-silent-contract.mjs --out head.json # also write the report JSON
 *   node scripts/check-silent-contract.mjs --baseline base.json [--fail-on-new]
 *                                                          # diff against a prior report; with
 *                                                          # --fail-on-new, exit 1 if any page's
 *                                                          # total grew (a NEW gap was introduced)
 *
 * Prereqs: the site must be BUILT first (`pnpm --filter @fundamental-engine/site build`) and the dom
 * package's dist present (`pnpm --filter @fundamental-engine/dom build`) — this script reads the
 * canonical rule bodies straight out of `packages/dom/dist/lint.js` and injects them into each page,
 * so there is a single source of truth for the detection. It boots its own `astro preview` server and
 * drives it with headless Playwright (the same engine the e2e suite uses), then tears the server down.
 *
 * Initial posture is WARN/REPORT: without `--fail-on-new` it never fails the build. The workflow
 * (.github/workflows/pr-checks.yml) runs it base-vs-head and surfaces a diff; flip `--fail-on-new` on
 * once the head counts are at or below baseline to make it a hard gate.
 */
import { spawn } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import net from "node:net";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const SITE = resolve(ROOT, "apps/site");
const LINT_DIST = resolve(ROOT, "packages/dom/dist/lint.js");

// The four rules that constitute the silent-contract-gap family. Each is a pure function over a
// ParentNode and (for the stylesheet-coupled pair) document.styleSheets — no other dependencies — so
// they can be lifted verbatim from the compiled module and run in the page. Keep this list in sync
// with the silent-contract subset of lint.ts; the rest of lintPlatform needs a live FieldPlatform.
const RULES = [
  "lintSinkFeedback",
  "lintFeedbackVarReads",
  "lintFeedbackWritesUnread",
  "lintFeedbackReadsUnwritten",
];

// Representative built pages: a field-heavy homepage, a clean docs page, and the invisible-fields
// example family — the surfaces where feedback bodies actually live.
const PAGES = ["/", "/eli5", "/docs", "/evidence", "/evidence/library", "/evidence/market"];

const PORT = 4392; // off the e2e suite's 4399 so the two never collide

function arg(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const hasFlag = (name) => process.argv.includes(name);

/**
 * Pull a top-level `export function <name>(...) { ... }` out of the compiled lint module by
 * brace-matching from its opening brace. The compiled JS is plain ES (no TS types), so the extracted
 * text runs as-is in the browser. Returns the function source minus the `export` keyword.
 */
function extractFunction(src, name) {
  const sig = `export function ${name}(`;
  const start = src.indexOf(sig);
  if (start < 0) throw new Error(`could not find ${name} in ${LINT_DIST} — did the dom package build?`);
  let i = src.indexOf("{", start);
  if (i < 0) throw new Error(`malformed ${name}: no opening brace`);
  let depth = 0;
  for (; i < src.length; i++) {
    const ch = src[i];
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        return src.slice(start + "export ".length, i + 1);
      }
    }
  }
  throw new Error(`malformed ${name}: unbalanced braces`);
}

/** Build the in-page bootstrap: the shared const + the four rules, exposed on window. */
async function buildInjection() {
  const src = await readFile(LINT_DIST, "utf8");
  // FEEDBACK_VAR_READS is the only shared dependency of the four rules.
  const constMatch = src.match(/const FEEDBACK_VAR_READS = \[[^\]]*\];/);
  if (!constMatch) throw new Error("could not find FEEDBACK_VAR_READS in compiled lint.js");
  const fns = RULES.map((name) => extractFunction(src, name)).join("\n");
  return `
    ${constMatch[0]}
    ${fns}
    window.__silentContractRules = {
      ${RULES.map((r) => `${r}: ${r}`).join(",\n      ")}
    };
  `;
}

function findOpenPort(start) {
  return new Promise((res) => {
    const srv = net.createServer();
    srv.once("error", () => res(findOpenPort(start + 1)));
    srv.once("listening", () => {
      const p = srv.address().port;
      srv.close(() => res(p));
    });
    srv.listen(start, "127.0.0.1");
  });
}

async function waitForServer(url, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(url, { method: "HEAD" });
      if (r.ok || r.status === 404) return; // server is up (404 = routing works)
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`preview server did not come up at ${url} within ${timeoutMs}ms`);
}

async function main() {
  if (!existsSync(LINT_DIST)) {
    console.error(`✗ ${LINT_DIST} missing — run \`pnpm --filter @fundamental-engine/dom build\` first.`);
    process.exit(2);
  }
  if (!existsSync(resolve(SITE, "dist"))) {
    console.error(`✗ ${resolve(SITE, "dist")} missing — run \`pnpm --filter @fundamental-engine/site build\` first.`);
    process.exit(2);
  }

  // Playwright is a devDependency of the site package — import its ESM entry from there (the .js
  // entry is CJS and exposes only a default export when imported, so reach for index.mjs).
  let chromium;
  try {
    ({ chromium } = await import(resolve(SITE, "node_modules/@playwright/test/index.mjs")));
  } catch {
    ({ chromium } = await import("@playwright/test"));
  }
  if (!chromium) throw new Error("could not load Playwright's chromium — is @playwright/test installed?");

  const injection = await buildInjection();
  const port = await findOpenPort(PORT);
  const base = `http://localhost:${port}`;

  console.log(`• starting astro preview on ${base} …`);
  const server = spawn("pnpm", ["preview", "--port", String(port)], {
    cwd: SITE,
    stdio: ["ignore", "ignore", "inherit"],
    env: process.env,
  });
  const killServer = () => { try { server.kill("SIGTERM"); } catch { /* already gone */ } };
  process.on("exit", killServer);

  const report = { pages: {}, total: 0, byCode: {} };
  let browser;
  try {
    await waitForServer(base + "/");
    browser = await chromium.launch();
    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    for (const path of PAGES) {
      try {
        await page.goto(base + path, { waitUntil: "networkidle", timeout: 45_000 });
      } catch (e) {
        console.warn(`  ! ${path}: navigation failed (${e.message}) — recording as unreachable`);
        report.pages[path] = { unreachable: true };
        continue;
      }
      // Give the field a chance to boot so feedback bodies carry their attributes; the rules are
      // pure DOM/CSSOM reads so a fully-seeded platform isn't required, but bodies are present in the
      // server-rendered HTML regardless. A short settle is enough.
      await page.waitForTimeout(1500);
      await page.addScriptTag({ content: injection });

      const counts = await page.evaluate(() => {
        const r = window.__silentContractRules;
        const out = {};
        let total = 0;
        for (const [name, fn] of Object.entries(r)) {
          const warns = fn(document.body) || [];
          for (const w of warns) {
            out[w.code] = (out[w.code] || 0) + 1;
            total++;
          }
        }
        return { byCode: out, total };
      });

      report.pages[path] = counts;
      report.total += counts.total;
      for (const [code, n] of Object.entries(counts.byCode)) {
        report.byCode[code] = (report.byCode[code] || 0) + n;
      }
      const summary = Object.entries(counts.byCode)
        .map(([c, n]) => `${c}:${n}`)
        .join(", ") || "clean";
      console.log(`  ${counts.total === 0 ? "✓" : "•"} ${path.padEnd(22)} ${counts.total} (${summary})`);
    }
  } finally {
    if (browser) await browser.close();
    killServer();
  }

  console.log(`\nTotal silent-contract-gap warnings: ${report.total}`);
  if (Object.keys(report.byCode).length) {
    console.log("By code: " + Object.entries(report.byCode).map(([c, n]) => `${c}=${n}`).join("  "));
  }

  const out = arg("--out");
  if (out) {
    await writeFile(resolve(process.cwd(), out), JSON.stringify(report, null, 2) + "\n");
    console.log(`Report written to ${out}`);
  }

  const baselinePath = arg("--baseline");
  if (baselinePath) {
    if (!existsSync(resolve(process.cwd(), baselinePath))) {
      console.log(`\nNo baseline at ${baselinePath} — skipping diff (first run / new branch).`);
      return;
    }
    const baseline = JSON.parse(await readFile(resolve(process.cwd(), baselinePath), "utf8"));
    const regressions = [];
    for (const path of PAGES) {
      const headTotal = report.pages[path]?.total ?? 0;
      const baseTotal = baseline.pages?.[path]?.total ?? 0;
      if (headTotal > baseTotal) regressions.push({ path, baseTotal, headTotal });
    }
    if (regressions.length === 0) {
      console.log("\n✓ No new silent-contract-gap warnings vs baseline.");
    } else {
      console.log("\n⚠ NEW silent-contract-gap warnings introduced:");
      for (const r of regressions) {
        console.log(`  ${r.path}: ${r.baseTotal} → ${r.headTotal} (+${r.headTotal - r.baseTotal})`);
      }
      if (hasFlag("--fail-on-new")) {
        console.error("\n✗ Failing: a PR introduced new silent-contract-gap warnings (--fail-on-new).");
        process.exit(1);
      }
      console.log("\n(report-only — pass --fail-on-new to make this a hard gate)");
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
