// Convert the Fundamental research paper family (markdown) → LaTeX (.tex) and, when a TeX engine is
// available, → PDF, under docs/research/build/ (gitignored). Source of truth is the existing markdown
// in docs/research/0N-*.md — this script only *converts* it, it never authors content.
//
// Pipeline: pandoc (GFM → standalone LaTeX) per paper; then a TeX engine (pdflatex/xelatex/tectonic
// via latexmk when present, else a direct engine run) turns each .tex into a .pdf. Pandoc is required;
// a TeX engine is optional — without one the script still emits every .tex and prints a clear,
// actionable message about installing TeX to get PDFs.
//
// Usage:  pnpm gen:papers            (build all papers found)
//         node scripts/papers-to-latex.mjs --tex-only      (skip PDF step)
//         node scripts/papers-to-latex.mjs 01 03           (only those numbered papers)
//
// Requires: pandoc (`pandoc --version`). For PDFs: a LaTeX engine (MacTeX/TeX Live/tectonic).

import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const RESEARCH_DIR = join(ROOT, "docs", "research");
const BUILD_DIR = join(RESEARCH_DIR, "build");

const args = process.argv.slice(2);
const TEX_ONLY = args.includes("--tex-only");
const onlyNumbers = args.filter((a) => /^\d{1,2}$/.test(a)).map((n) => n.padStart(2, "0"));

const die = (msg) => {
  console.error(`\n[papers-to-latex] ${msg}\n`);
  process.exit(1);
};

// --- dependency detection -------------------------------------------------
const has = (cmd, probeArg = "--version") => {
  try {
    const r = spawnSync(cmd, [probeArg], { stdio: "ignore" });
    return r.status === 0 || r.status === null ? r.error == null : false;
  } catch {
    return false;
  }
};

if (!has("pandoc")) {
  die(
    [
      "pandoc is not installed — it is required to convert the markdown papers to LaTeX.",
      "",
      "Install it, then re-run `pnpm gen:papers`:",
      "  macOS:    brew install pandoc",
      "  Debian:   sudo apt-get install pandoc",
      "  other:    https://pandoc.org/installing.html",
      "",
      "For PDF output you also need a LaTeX engine (optional):",
      "  macOS:    brew install --cask mactex-no-gui   (or `brew install tectonic`)",
      "  Debian:   sudo apt-get install texlive-full",
    ].join("\n"),
  );
}

// Detect a TeX engine. The papers are Unicode-heavy (⇄ → ⁿ …), so we need a Unicode-native engine
// (xelatex/lualatex) — pdflatex chokes on those characters. Prefer latexmk driving xelatex (it handles
// multi-pass TOC/refs), then tectonic (xetex-based), then a raw xelatex/lualatex. pdflatex is a last
// resort and will likely fail on the Unicode glyphs.
const UNICODE_FIRST = ["xelatex", "lualatex"];
const texEngine = (() => {
  const unicodeEngine = UNICODE_FIRST.find((e) => has(e)) ?? null;
  if (has("latexmk") && unicodeEngine) return { kind: "latexmk", unicodeEngine };
  if (has("tectonic")) return { kind: "tectonic" };
  if (unicodeEngine) return { kind: unicodeEngine };
  if (has("latexmk")) return { kind: "latexmk", unicodeEngine: null };
  if (has("pdflatex")) return { kind: "pdflatex" };
  return null;
})();

// --- discover papers ------------------------------------------------------
const paperFiles = readdirSync(RESEARCH_DIR)
  .filter((f) => /^\d{2}-.*\.md$/.test(f))
  .sort()
  .filter((f) => onlyNumbers.length === 0 || onlyNumbers.includes(f.slice(0, 2)));

if (paperFiles.length === 0) {
  die(`No papers matched under ${RESEARCH_DIR} (expected NN-*.md files).`);
}

mkdirSync(BUILD_DIR, { recursive: true });

// --- conversion -----------------------------------------------------------
const results = [];

for (const file of paperFiles) {
  const src = join(RESEARCH_DIR, file);
  const stem = file.replace(/\.md$/, "");
  const tex = join(BUILD_DIR, `${stem}.tex`);
  const pdf = join(BUILD_DIR, `${stem}.pdf`);

  // GFM → standalone LaTeX. Numbered sections + a TOC make the preprint navigable; pandoc's default
  // article class is fine for a draft. `--wrap=preserve` keeps diffs sane.
  const pandocArgs = [
    src,
    "--from=gfm+tex_math_dollars",
    "--to=latex",
    "--standalone",
    "--number-sections",
    "--toc",
    "--wrap=preserve",
    "-V",
    "geometry:margin=1in",
    "-V",
    "linkcolor:blue",
    "-V",
    "urlcolor:blue",
    "-o",
    tex,
  ];

  try {
    execFileSync("pandoc", pandocArgs, { stdio: ["ignore", "ignore", "inherit"] });
  } catch (err) {
    console.error(`[papers-to-latex] pandoc failed on ${file}: ${err.message}`);
    results.push({ file, tex: false, pdf: false });
    continue;
  }
  console.log(`  tex  ✓  ${stem}.tex`);

  let pdfOk = false;
  if (!TEX_ONLY && texEngine) {
    pdfOk = buildPdf(tex, pdf, stem);
  }
  results.push({ file, tex: true, pdf: pdfOk });
}

// --- PDF build helper -----------------------------------------------------
function buildPdf(tex, pdf, stem) {
  let cmd, cmdArgs;
  switch (texEngine.kind) {
    case "latexmk": {
      cmd = "latexmk";
      // Drive a Unicode-native engine when we have one; -pdfxe/-pdflua pick xelatex/lualatex.
      const driver =
        texEngine.unicodeEngine === "lualatex" ? "-pdflua" : texEngine.unicodeEngine === "xelatex" ? "-pdfxe" : "-pdf";
      cmdArgs = [driver, "-interaction=nonstopmode", "-halt-on-error", `-outdir=${BUILD_DIR}`, tex];
      break;
    }
    case "tectonic":
      cmd = "tectonic";
      cmdArgs = ["--outdir", BUILD_DIR, tex];
      break;
    default:
      cmd = texEngine.kind; // pdflatex / xelatex / lualatex
      cmdArgs = ["-interaction=nonstopmode", "-halt-on-error", `-output-directory=${BUILD_DIR}`, tex];
  }
  // A raw engine needs two passes for the TOC/refs; latexmk and tectonic handle that themselves.
  const passes = texEngine.kind === "latexmk" || texEngine.kind === "tectonic" ? 1 : 2;
  try {
    for (let i = 0; i < passes; i++) {
      execFileSync(cmd, cmdArgs, { cwd: BUILD_DIR, stdio: ["ignore", "ignore", "ignore"] });
    }
  } catch {
    console.error(`  pdf  ✗  ${stem}.pdf (TeX engine '${texEngine.kind}' failed — see ${stem}.log)`);
    return false;
  }
  if (existsSync(pdf)) {
    console.log(`  pdf  ✓  ${stem}.pdf`);
    return true;
  }
  return false;
}

// --- summary --------------------------------------------------------------
const texCount = results.filter((r) => r.tex).length;
const pdfCount = results.filter((r) => r.pdf).length;

console.log(`\n[papers-to-latex] ${texCount}/${results.length} .tex written to docs/research/build/`);

if (TEX_ONLY) {
  console.log("[papers-to-latex] --tex-only: skipped PDF step.");
} else if (!texEngine) {
  console.log(
    [
      "[papers-to-latex] No LaTeX engine found — wrote .tex only, no PDFs.",
      "  Install one to get PDFs, then re-run `pnpm gen:papers`:",
      "    macOS:  brew install --cask mactex-no-gui   (or `brew install tectonic`)",
      "    Debian: sudo apt-get install texlive-full",
    ].join("\n"),
  );
} else {
  console.log(`[papers-to-latex] ${pdfCount}/${results.length} .pdf built with '${texEngine.kind}'.`);
}

// Non-zero exit only if nothing converted at all (pandoc present but every paper failed).
if (texCount === 0) process.exit(1);
