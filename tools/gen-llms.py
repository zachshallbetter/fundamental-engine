#!/usr/bin/env python3
"""
gen-llms.py — Master Agent-First Publishing Architecture & Context Corpus Exporter for Fundamental Engine.

Generates versioned llms index and full codebase corpus files in the top-level `.agents/` directory:
  .agents/llms.txt
  .agents/llms-fe-v<version>.txt
  .agents/llms-full.txt
  .agents/llms-full-fe-v<version>.txt
"""

import os
import sys
import re
import json
import glob
import subprocess
from datetime import datetime

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
AGENTS_DIR = os.path.join(ROOT_DIR, ".agents")
PKG_PATH = os.path.join(ROOT_DIR, "package.json")

def get_git_version():
    try:
        tag = subprocess.check_output(
            ["git", "describe", "--tags", "--abbrev=0"],
            cwd=ROOT_DIR,
            stderr=subprocess.DEVNULL,
            text=True
        ).strip()
        if tag:
            return tag.lstrip("v")
    except Exception:
        pass

    if os.path.exists(PKG_PATH):
        try:
            with open(PKG_PATH, "r", encoding="utf-8") as f:
                pkg = json.load(f)
                if pkg.get("version"):
                    return pkg["version"].lstrip("v")
        except Exception:
            pass

    try:
        git_hash = subprocess.check_output(
            ["git", "rev-parse", "--short", "HEAD"],
            cwd=ROOT_DIR,
            stderr=subprocess.DEVNULL,
            text=True
        ).strip()
        if git_hash:
            return f"0.1.0+{git_hash}"
    except Exception:
        pass

    return "0.1.0"

VERSION = get_git_version()
ABBR = "fe"
DATE = datetime.now().strftime("%Y-%m-%d")

EXCLUDED_DIRS = {
    "_scripts",
    "_references",
    "_production",
    "node_modules",
    ".git",
    ".github",
    ".agents",
    ".vscode",
    ".claude",
    ".vite",
    ".astro",
    "dist",
    "dist-ssr",
    "build",
    "target",
    "pkg",
    "coverage",
    "test-results",
    "playwright-report",
    "blob-report",
    "scripts",
    "tools",
    "tmp",
    "temp",
    "out",
    "public",
    "assets",
    "planning-archive",
}

EXCLUDED_FILE_SUBSTRINGS = {
    "-lock.json",
    ".lock",
    "pnpm-lock.yaml",
    "yarn.lock",
    ".DS_Store",
    ".map",
    ".min.js",
    ".min.css",
    ".snapshot.jsonl",
    ".snapshot.tsv",
    "custom-elements.json",
}

ALLOWED_EXTS = {".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".json", ".md", ".swift", ".java", ".kt", ".astro", ".html", ".css", ".toml", ".yaml", ".yml"}

def read_file(file_path):
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            return f.read()
    except Exception:
        return ""

def is_excluded_file(file_name):
    for sub in EXCLUDED_FILE_SUBSTRINGS:
        if sub in file_name:
            return True
    return False

def normalize_whitespace(text):
    return re.sub(r'\n{3,}', '\n\n', text)

def read_source_files():
    entries = []
    for root, dirs, files in os.walk(ROOT_DIR):
        dirs[:] = [d for d in dirs if d not in EXCLUDED_DIRS and not d.startswith(".")]
        for f in files:
            ext = os.path.splitext(f)[1]
            if ext in ALLOWED_EXTS and not is_excluded_file(f):
                full_path = os.path.join(root, f)
                rel_path = os.path.relpath(full_path, ROOT_DIR)
                content = read_file(full_path)
                entries.append((rel_path, content))
    return sorted(entries, key=lambda x: x[0])

def categorize_files(source_files):
    categories = {
        "Governance, Doctrine & Canonical Specifications": [],
        "Core Engine & Host Adapters (Packages)": [],
        "Multi-Platform Implementations (Swift & Android)": [],
        "Site & Documentation Web Application (Apps)": [],
        "Data & Conformance Recipes": [],
        "Other Repository Modules": []
    }
    for rel, src in source_files:
        line_count = len(src.splitlines())
        size_kib = round(len(src.encode('utf-8')) / 1024, 1)
        item = (rel, line_count, size_kib)
        if rel in ("README.md", "CHANGELOG.md", "CONTRIBUTING.md", "CODE_OF_CONDUCT.md", "SECURITY.md", "SUPPORT.md", "PUBLISHING.md", "RELEASING.md", "CITATION.cff") or rel.startswith("docs/"):
            categories["Governance, Doctrine & Canonical Specifications"].append(item)
        elif rel.startswith("packages/"):
            categories["Core Engine & Host Adapters (Packages)"].append(item)
        elif rel.startswith("swift/") or rel.startswith("android/"):
            categories["Multi-Platform Implementations (Swift & Android)"].append(item)
        elif rel.startswith("apps/"):
            categories["Site & Documentation Web Application (Apps)"].append(item)
        elif rel.startswith("data/") or rel.startswith("examples/"):
            categories["Data & Conformance Recipes"].append(item)
        else:
            categories["Other Repository Modules"].append(item)
    return categories

def main():
    # 1. Ensure .agents/ directory exists & CLEAR PREVIOUS GENERATED FILES
    if os.path.exists(AGENTS_DIR):
        for old_file in glob.glob(os.path.join(AGENTS_DIR, "llms*.txt")):
            try:
                os.remove(old_file)
            except Exception:
                pass
    else:
        os.makedirs(AGENTS_DIR, exist_ok=True)

    # 2. Gather Core Governance Documents & Source Modules
    readme = read_file(os.path.join(ROOT_DIR, "README.md"))
    changelog = read_file(os.path.join(ROOT_DIR, "CHANGELOG.md"))
    contributing = read_file(os.path.join(ROOT_DIR, "CONTRIBUTING.md"))
    publishing = read_file(os.path.join(ROOT_DIR, "PUBLISHING.md"))
    releasing = read_file(os.path.join(ROOT_DIR, "RELEASING.md"))
    security = read_file(os.path.join(ROOT_DIR, "SECURITY.md"))
    support = read_file(os.path.join(ROOT_DIR, "SUPPORT.md"))
    agents_md = read_file(os.path.join(AGENTS_DIR, "AGENTS.md"))

    source_files = read_source_files()
    categorized = categorize_files(source_files)

    total_lines = sum(len(src.splitlines()) for _, src in source_files)

    # 3. Construct High-Value llms.txt Manifest
    manifest_lines = [
        "# Fundamental Engine Ecosystem Master Index",
        f"> Version: v{VERSION} | Generated: {DATE} | Total Modules: {len(source_files)} files | Total Lines: {total_lines:,} lines",
        "",
        "## Ecosystem Doctrine & Core Authority",
        "- [README.md](README.md): Top-level ecosystem architecture overview",
    ]
    if changelog:
        manifest_lines.append("- [CHANGELOG.md](CHANGELOG.md): Ecosystem changelog & release history")
    if contributing:
        manifest_lines.append("- [CONTRIBUTING.md](CONTRIBUTING.md): Contribution guidelines & development workflow")
    if publishing:
        manifest_lines.append("- [PUBLISHING.md](PUBLISHING.md): Publishing & distribution specifications")
    if releasing:
        manifest_lines.append("- [RELEASING.md](RELEASING.md): Release process & policies")
    if security:
        manifest_lines.append("- [SECURITY.md](SECURITY.md): Security policy")
    if support:
        manifest_lines.append("- [SUPPORT.md](SUPPORT.md): Support policy")
    if agents_md:
        manifest_lines.append("- [.agents/AGENTS.md](.agents/AGENTS.md): Master AI Agent & Developer Rules")
    manifest_lines.append("")

    for cat, items in categorized.items():
        if items:
            manifest_lines.append(f"## {cat} ({len(items)} files)")
            for rel, lcnt, size in items:
                manifest_lines.append(f"- [{rel}]({rel}) ({lcnt} lines, {size} KiB)")
            manifest_lines.append("")

    manifest_content = "\n".join(manifest_lines) + "\n"

    # 4. Construct High-Value llms-full.txt Corpus
    sep = "=" * 72
    def banner(title, info=""):
        extra = f" [{info}]" if info else ""
        return f"\n{sep}\n## {title}{extra}\n{sep}\n\n"

    full_parts = [
        f"# FUNDAMENTAL ENGINE ECOSYSTEM: CONSOLIDATED MASTER RESEARCH & CODEBASE CORPUS\n",
        f"Version: v{VERSION} ({DATE}) | Modules: {len(source_files)} | Total Lines: {total_lines:,}\n\n",
        f"TABLE OF CONTENTS & SUBSYSTEM SUMMARY:\n"
    ]

    for cat, items in categorized.items():
        if items:
            full_parts.append(f"  - {cat}: {len(items)} files\n")

    full_parts.append(f"\n{sep}\n\n")

    if readme:
        full_parts.append(banner("FILE: README.md") + readme + "\n")
    if changelog:
        full_parts.append(banner("FILE: CHANGELOG.md") + changelog + "\n")
    if contributing:
        full_parts.append(banner("FILE: CONTRIBUTING.md") + contributing + "\n")
    if publishing:
        full_parts.append(banner("FILE: PUBLISHING.md") + publishing + "\n")
    if releasing:
        full_parts.append(banner("FILE: RELEASING.md") + releasing + "\n")
    if security:
        full_parts.append(banner("FILE: SECURITY.md") + security + "\n")
    if support:
        full_parts.append(banner("FILE: SUPPORT.md") + support + "\n")
    if agents_md:
        full_parts.append(banner("FILE: .agents/AGENTS.md") + agents_md + "\n")

    for cat, items in categorized.items():
        if items:
            full_parts.append(banner(f"SUBSYSTEM: {cat.upper()} ({len(items)} files)"))
            for rel, src in source_files:
                if any(r == rel for r, _, _ in items):
                    lcnt = len(src.splitlines())
                    size_kib = round(len(src.encode('utf-8')) / 1024, 1)
                    full_parts.append(f"--- FILE: {rel} ({lcnt} lines, {size_kib} KiB) ---\n{src}\n\n")

    full_content = normalize_whitespace("".join(full_parts))

    # 5. Write unversioned and versioned outputs to .agents/
    with open(os.path.join(AGENTS_DIR, "llms.txt"), "w", encoding="utf-8") as f:
        f.write(manifest_content)
    with open(os.path.join(AGENTS_DIR, f"llms-{ABBR}-v{VERSION}.txt"), "w", encoding="utf-8") as f:
        f.write(manifest_content)

    with open(os.path.join(AGENTS_DIR, "llms-full.txt"), "w", encoding="utf-8") as f:
        f.write(full_content)
    with open(os.path.join(AGENTS_DIR, f"llms-full-{ABBR}-v{VERSION}.txt"), "w", encoding="utf-8") as f:
        f.write(full_content)

    full_kib = round(len(full_content.encode("utf-8")) / 1024)
    print(
        f"gen-llms: cleared previous & generated .agents/llms.txt, .agents/llms-{ABBR}-v{VERSION}.txt ({len(manifest_content)} bytes) and .agents/llms-full.txt, .agents/llms-full-{ABBR}-v{VERSION}.txt ({full_kib} KiB, {len(source_files)} source files included) [Git Version: v{VERSION}]"
    )

if __name__ == "__main__":
    main()
