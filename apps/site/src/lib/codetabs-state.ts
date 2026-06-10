// CodeTabs (CodeTabs.astro) framework-tab state, shared by the two delegated click
// handlers (DocsLayout + examples). Picking a framework once applies it to every
// CodeTabs instance on the page, persists across pages (localStorage), and reflects
// into the URL (?code=react) so the choice is shareable / deep-linkable.

const KEY = "fieldui-code-tab";

/** Only the framework choice is sticky/shareable — language tabs (ts/html/css) stay per-page. */
const FRAMEWORKS = new Set(["vanilla", "web-component", "react"]);

export const isFrameworkTab = (slug: string): boolean => FRAMEWORKS.has(slug);

export const slugifyLabel = (s: string): string =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/** Switch every .code-tabs instance that has a tab matching `slug`. Returns how many matched. */
export function applyCodeTab(slug: string): number {
  let matched = 0;
  document.querySelectorAll<HTMLElement>(".code-tabs").forEach((wrap) => {
    const tabs = [...wrap.querySelectorAll<HTMLButtonElement>(".ct-tab")];
    const hit = tabs.find((t) => slugifyLabel(t.textContent || "") === slug);
    if (!hit) return;
    matched++;
    tabs.forEach((t) => t.setAttribute("aria-selected", String(t === hit)));
    wrap.querySelectorAll<HTMLElement>(".ct-body").forEach((b) => {
      b.hidden = b.dataset.i !== hit.dataset.i;
    });
  });
  return matched;
}

/** Persist a chosen framework tab and reflect it into the URL without a history entry. */
export function rememberCodeTab(slug: string): void {
  if (!isFrameworkTab(slug)) return;
  try {
    localStorage.setItem(KEY, slug);
  } catch {
    /* private mode — the in-page sync still works */
  }
  const url = new URL(location.href);
  url.searchParams.set("code", slug);
  history.replaceState(history.state, "", url);
}

/** On page load: restore from ?code= (shareable link wins) or the persisted choice. */
export function restoreCodeTab(): void {
  let slug = new URL(location.href).searchParams.get("code");
  if (!slug) {
    try {
      slug = localStorage.getItem(KEY);
    } catch {
      /* ignore */
    }
  }
  if (!slug) return;
  const s = slugifyLabel(slug);
  if (isFrameworkTab(s)) applyCodeTab(s);
}
