// Docs shell runtime. The documentation is its own best demo — every docs page runs as an
// INVISIBLE field, with the restraint a reading surface demands:
//   · Headings as bodies — at init (never in page markup) every h2/h3 becomes a gentle
//     attract body with engine feedback (data-hot, data-feedback), and a scoped render-less
//     recipe (the established idiom: recipeById("evidence-field") + applyRecipe's
//     { renderless, extraMetrics: ["attention"] }) measures per-section attention each
//     frame as --field-attention.
//   · The attention TOC — one rAF loop mirrors each heading's --field-attention onto its
//     "On this page" link as --att; CSS turns that into ink and weight. The scroll-spy's
//     .active class stays the discrete signal; attention is the continuous one.
//   · Reference integrity, self-measured — the page scans its own internal anchors at init
//     and reports honestly in a provenance chip: "references · N/N resolve". Same-page
//     #anchors must hit a real id; site routes are checked against DOCS_NAV + ROUTE_FAMILIES.
//     (Same-page reference EDGES need no declaration here: the platform's
//     RelationshipRegistry discovers a[href^="#"] natively, so data-field-relation spans
//     would be redundant — the chip carries the honesty.)
//   · Search — Pagefind, loaded lazily from the built output on first open; the dialog is
//     native, keyboard-first, and honest in dev (the index only exists in a built site).
// Everything the field writes is felt, not loud, and ALL of it is gated behind
// prefers-reduced-motion and the persisted sidebar toggle (main[data-field-docs="off"]).
import { recipeById } from "@field-ui/core";
import { applyRecipe } from "@field-ui/platform";
import { DOCS_NAV, ROUTE_FAMILIES } from "../lib/docs-nav.ts";
import { pageRuntime } from "../lib/page-runtime.ts";
import { persisted } from "../lib/persisted.ts";

const LEGACY_FIELD_KEY = "fieldui-docs-field";
const fieldPref = persisted<boolean>("docs-field", true, { legacyKeys: [LEGACY_FIELD_KEY] });
// The legacy slot stored a RAW "on"/"off" string (pre-JSON helper), which the helper's
// JSON-based legacy migration can't parse — migrate it by hand, once, so returning
// visitors keep their choice. Idempotent: the legacy key is removed either way.
const migrateLegacyFieldPref = (): void => {
  try {
    const legacy = localStorage.getItem(LEGACY_FIELD_KEY);
    if (legacy === null) return;
    if (localStorage.getItem("fui:docs-field") === null) fieldPref.set(legacy !== "off");
    localStorage.removeItem(LEGACY_FIELD_KEY);
  } catch {
    /* storage unavailable — the default (on) stands */
  }
};

const reduceMotion = (): boolean =>
  typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

// ── feature 1 + 2: the page as an invisible field, mirrored into the TOC ────
const BODY_ATTRS: Record<string, string> = {
  "data-body": "attract",
  "data-feedback": "",
  "data-hot": "",
  "data-strength": "0.8",
  "data-range": "220",
};

interface FieldBits {
  destroy(): void;
}

function startField(main: HTMLElement, toc: HTMLElement | null): FieldBits | null {
  const heads = [...main.querySelectorAll<HTMLElement>("h2, h3")];
  if (!heads.length) return null;

  // headings become bodies at runtime init — content pages ship no field markup. The
  // persisted page engine (the visible underlay) picks them up on rescan: data-hot wires
  // hover/focus engagement, data-feedback opts into the engine's --d writeback.
  for (const h of heads) {
    for (const [k, v] of Object.entries(BODY_ATTRS)) h.setAttribute(k, v);
  }
  const fieldRoot = document.querySelector("field-root") as
    | (HTMLElement & { rescan?: () => void })
    | null;
  fieldRoot?.rescan?.();

  // the scoped, render-less recipe pipeline: metrics gain "attention", so the platform
  // writes an eased --field-attention (engagement + center proximity + visibility) onto
  // every heading each frame. Nothing is drawn — the TOC's ink is the render surface.
  let applied: { destroy(): void } | null = null;
  try {
    const base = recipeById("evidence-field");
    if (base) {
      applied = applyRecipe(main, base, {
        bodies: heads,
        annotateBodies: false,
        renderless: true,
        extraMetrics: ["attention"],
      });
    }
  } catch {
    /* the page engine's --d still flows; the TOC simply stays at rest */
  }

  // one rAF mirror loop (~30 links max, write-on-change only): heading --field-attention
  // → TOC link --att. Both are inline styles, so reading el.style costs no style recalc.
  const links = toc ? [...toc.querySelectorAll<HTMLElement>("a[data-for]")] : [];
  const pairs = links
    .map((a) => ({ a, h: document.getElementById(a.dataset.for || "") }))
    .filter((p): p is { a: HTMLElement; h: HTMLElement } => p.h instanceof HTMLElement);
  const last = new Map<HTMLElement, string>();
  let raf = 0;
  const mirror = (): void => {
    for (const { a, h } of pairs) {
      const v = h.style.getPropertyValue("--field-attention") || "0";
      if (last.get(a) !== v) {
        last.set(a, v);
        a.style.setProperty("--att", v);
      }
    }
    raf = requestAnimationFrame(mirror);
  };
  if (pairs.length && applied) raf = requestAnimationFrame(mirror);

  return {
    destroy() {
      cancelAnimationFrame(raf);
      applied?.destroy();
      for (const h of heads) {
        for (const k of Object.keys(BODY_ATTRS)) h.removeAttribute(k);
      }
      links.forEach((a) => a.style.removeProperty("--att"));
      fieldRoot?.rescan?.(); // the engine drops the heading bodies — off is honest
    },
  };
}

// ── feature 3: reference integrity, self-measured ───────────────────────────
function checkIntegrity(main: HTMLElement): void {
  const chip = document.querySelector<HTMLElement>("[data-docs-integrity]");
  if (!chip) return;
  const known = new Set<string>();
  for (const g of DOCS_NAV)
    for (const i of g.items) known.add(i.href.replace(/\/$/, "") || "/");

  // route + fragment references only: file assets (/llms.txt, images, …) carry an
  // extension and are outside what a route manifest can vouch for — excluded.
  const anchors = [
    ...main.querySelectorAll<HTMLAnchorElement>('a[href^="/"], a[href^="#"]'),
  ].filter((a) => !/\.[a-z0-9]+$/i.test((a.getAttribute("href") || "").split(/[#?]/)[0]!));
  if (!anchors.length) {
    chip.hidden = true;
    return;
  }
  const broken: string[] = [];
  for (const a of anchors) {
    const href = a.getAttribute("href") || "";
    if (href.startsWith("#")) {
      // same-page anchor — must resolve to a real element id
      let id = href.slice(1);
      try {
        id = decodeURIComponent(id);
      } catch {
        /* keep the raw fragment */
      }
      if (!id || !document.getElementById(id)) broken.push(href);
      continue;
    }
    // site-internal route — exact against the nav tree, or a known-good family prefix
    const route = (href.split("#")[0]!.split("?")[0] || "/").replace(/\/$/, "") || "/";
    const ok =
      route === "/" ||
      known.has(route) ||
      ROUTE_FAMILIES.some((f) => route === f || route.startsWith(`${f}/`));
    if (!ok) broken.push(href);
  }
  const resolved = anchors.length - broken.length;
  chip.hidden = false;
  chip.dataset.state = broken.length ? "warn" : "ok";
  chip.textContent = `references · ${resolved}/${anchors.length} resolve`;
  if (broken.length) chip.title = `unresolved: ${[...new Set(broken)].join(", ")}`;
  else chip.removeAttribute("title");
}

// ── feature 4: search (Pagefind, built output only, custom UI) ───────────────
interface PagefindSubResult {
  url: string;
  title: string;
  excerpt: string;
}
interface PagefindDoc {
  url: string;
  excerpt: string;
  meta?: { title?: string };
  sub_results?: PagefindSubResult[];
}
interface PagefindModule {
  init?: () => void;
  search: (q: string) => Promise<{ results: Array<{ data: () => Promise<PagefindDoc> }> }>;
}

const DEV_MESSAGE = "search index builds with the site — run the built preview";

function wireSearch(shell: HTMLElement, sig: AbortSignal): void {
  const dialog = document.querySelector<HTMLDialogElement>("dialog[data-docs-search]");
  const openBtn = shell.querySelector<HTMLButtonElement>("[data-docs-search-open]");
  const input = dialog?.querySelector<HTMLInputElement>("[data-docs-search-input]");
  const status = dialog?.querySelector<HTMLElement>("[data-docs-search-status]");
  const results = dialog?.querySelector<HTMLElement>("[data-docs-search-results]");
  if (!dialog || !openBtn || !input || !status || !results) return;

  // platform-correct shortcut hint
  const kbd = openBtn.querySelector("kbd");
  if (kbd && !/Mac|iPhone|iPad/.test(navigator.platform)) kbd.textContent = "Ctrl K";

  // lazy module — /pagefind/pagefind.js exists only in built output; detect via HEAD so
  // dev shows the honest message instead of a broken import. The specifier is a runtime
  // string (not a literal) so neither TS nor the bundler tries to resolve it at build.
  const PAGEFIND_URL = "/pagefind/pagefind.js";
  let pf: PagefindModule | null = null;
  let missing = false;
  const ensure = async (): Promise<PagefindModule | null> => {
    if (pf || missing) return pf;
    try {
      const head = await fetch(PAGEFIND_URL, { method: "HEAD" });
      if (!head.ok) throw new Error(String(head.status));
      pf = (await import(/* @vite-ignore */ PAGEFIND_URL)) as PagefindModule;
      pf.init?.();
    } catch {
      missing = true;
      status.textContent = DEV_MESSAGE;
    }
    return pf;
  };

  // keyboard-walkable results (aria-activedescendant pattern)
  let sel = -1;
  const options = (): HTMLElement[] => [...results.querySelectorAll<HTMLElement>("[role=option]")];
  const select = (i: number): void => {
    const opts = options();
    sel = opts.length ? Math.max(0, Math.min(i, opts.length - 1)) : -1;
    opts.forEach((o, n) => o.setAttribute("aria-selected", String(n === sel)));
    const cur = sel >= 0 ? opts[sel] : null;
    if (cur) {
      input.setAttribute("aria-activedescendant", cur.id);
      cur.scrollIntoView({ block: "nearest" });
    } else {
      input.removeAttribute("aria-activedescendant");
    }
  };

  let seq = 0;
  const run = async (): Promise<void> => {
    const q = input.value.trim();
    const mine = ++seq;
    if (!q) {
      results.replaceChildren();
      status.textContent = missing ? DEV_MESSAGE : "";
      select(-1);
      return;
    }
    const mod = await ensure();
    if (!mod || mine !== seq) return;
    const res = await mod.search(q);
    if (mine !== seq) return;
    const pages = await Promise.all(res.results.slice(0, 6).map((r) => r.data()));
    if (mine !== seq) return;
    results.replaceChildren();
    let n = 0;
    for (const p of pages) {
      const group = document.createElement("div");
      group.className = "ds-group";
      group.setAttribute("role", "group");
      const head = document.createElement("span");
      head.className = "ds-page";
      head.textContent = p.meta?.title || p.url;
      group.appendChild(head);
      const subs = p.sub_results?.length
        ? p.sub_results.slice(0, 4)
        : [{ url: p.url, title: p.meta?.title || p.url, excerpt: p.excerpt }];
      for (const s of subs) {
        const a = document.createElement("a");
        a.className = "ds-hit";
        a.href = s.url;
        a.id = `ds-opt-${n++}`;
        a.setAttribute("role", "option");
        a.setAttribute("aria-selected", "false");
        const t = document.createElement("b");
        t.textContent = s.title;
        const ex = document.createElement("span");
        ex.className = "ds-excerpt";
        ex.innerHTML = s.excerpt; // pagefind's own excerpt markup (<mark> highlights)
        a.append(t, ex);
        group.appendChild(a);
      }
      results.appendChild(group);
    }
    status.textContent = pages.length
      ? `${pages.length} page${pages.length === 1 ? "" : "s"}`
      : "no matches";
    select(pages.length ? 0 : -1);
  };

  let deb = 0;
  input.addEventListener(
    "input",
    () => {
      window.clearTimeout(deb);
      deb = window.setTimeout(() => void run(), 120);
    },
    { signal: sig },
  );

  input.addEventListener(
    "keydown",
    (e) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        select(sel + 1);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        select(sel - 1);
      } else if (e.key === "Enter") {
        e.preventDefault();
        const cur = sel >= 0 ? options()[sel] : options()[0];
        if (cur instanceof HTMLAnchorElement) {
          dialog.close();
          window.location.assign(cur.href);
        }
      }
    },
    { signal: sig },
  );

  const open = (): void => {
    if (dialog.open) return;
    dialog.showModal(); // native focus trap; Esc closes
    input.select();
    void ensure(); // first open loads the module (or states the dev truth)
  };
  openBtn.addEventListener("click", open, { signal: sig });
  dialog
    .querySelector("[data-docs-search-close]")
    ?.addEventListener("click", () => dialog.close(), { signal: sig });
  dialog.addEventListener(
    "click",
    (e) => {
      if (e.target === dialog) dialog.close(); // backdrop click
    },
    { signal: sig },
  );
  // a click on a result navigates (default anchor behavior) — close behind it
  results.addEventListener(
    "click",
    (e) => {
      if ((e.target as HTMLElement | null)?.closest("a")) dialog.close();
    },
    { signal: sig },
  );
  dialog.addEventListener("close", () => openBtn.focus(), { signal: sig });

  window.addEventListener(
    "keydown",
    (e) => {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        open();
        return;
      }
      if (e.key === "/" && !e.metaKey && !e.ctrlKey && !e.altKey && !dialog.open) {
        const t = e.target as HTMLElement | null;
        if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable))
          return;
        e.preventDefault();
        open();
      }
    },
    { signal: sig },
  );
}

// ── init / lifecycle ─────────────────────────────────────────────────────────
function initDocsShell(shell: HTMLElement): () => void {
  const main = shell.querySelector<HTMLElement>("main.docs-content");
  if (!main) return () => {};
  const ac = new AbortController();
  const toc = document.getElementById("docsToc");
  let bits: FieldBits | null = null;

  // the docs-field toggle — default ON, persisted; reduced motion forces the field off
  // (the preference is kept, honored if the OS setting changes on a later visit).
  migrateLegacyFieldPref();
  let on = fieldPref.get();
  const toggle = shell.querySelector<HTMLButtonElement>("[data-docs-field-toggle]");
  const stateEl = shell.querySelector<HTMLElement>("[data-docs-field-state]");
  const apply = (): void => {
    bits?.destroy();
    bits = null;
    const active = on && !reduceMotion();
    main.dataset.fieldDocs = active ? "on" : "off";
    toggle?.setAttribute("aria-checked", String(on));
    if (stateEl) stateEl.textContent = on ? "on" : "off";
    if (active) bits = startField(main, toc);
  };
  apply();
  toggle?.addEventListener(
    "click",
    () => {
      on = !on;
      fieldPref.set(on);
      apply();
    },
    { signal: ac.signal },
  );

  checkIntegrity(main); // not motion — the chip reports whether the field is on or off
  wireSearch(shell, ac.signal);

  return () => {
    ac.abort();
    bits?.destroy();
    const dialog = document.querySelector<HTMLDialogElement>("dialog[data-docs-search]");
    if (dialog?.open) dialog.close();
  };
}

pageRuntime(".docs-shell", initDocsShell);
