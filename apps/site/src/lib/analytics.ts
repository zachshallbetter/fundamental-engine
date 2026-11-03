/**
 * analytics.ts — Google Analytics 4 behaviour layer.
 *
 * The gtag.js loader + `config` live inline in Base.astro's <head> (PROD only) so
 * collection starts on the critical path. This module adds the *behaviour* on top:
 * SPA-correct page_views and a single delegated interaction tracker that piggybacks
 * on the existing DOM — no per-component wiring. It is imported from one bundled
 * <script> in Base.astro and runs once per full load (then persists across
 * ClientRouter view-transition navigations, like the engine-boot script).
 *
 * Reserved GA4 auto event names (e.g. `click` for outbound, `page_view`) are only
 * used where we own them deliberately (page_view). Everything else uses our own
 * names (`link_click`, `ui_click`, `field_toggle`, `form_submit`) so reports stay
 * clean and don't collide with Enhanced Measurement. page_view is sent manually on
 * every navigation; the <head> config sets `send_page_view: false`, so disable
 * "Page changes based on browser history events" in the GA property's Enhanced
 * Measurement to avoid double counting SPA navigations.
 */

type Gtag = (...args: unknown[]) => void;

declare global {
  interface Window {
    gtag?: Gtag;
    dataLayer?: unknown[];
  }
}

const MAX_TEXT = 100;
const MEASUREMENT_ID = 'G-M22BZ4PNB6';

function gtag(...args: unknown[]): void {
  // gtag is defined by the inline loader; guard so the module is a no-op if it
  // hasn't loaded (dev, blocked by an ad blocker, or before the snippet runs).
  window.gtag?.(...args);
}

/** Trimmed, length-capped accessible label for an element. */
function labelFor(el: Element): string {
  const aria = el.getAttribute('aria-label');
  const text = (aria ?? (el as HTMLElement).innerText ?? el.textContent ?? '').replace(/\s+/g, ' ').trim();
  if (text) return text.slice(0, MAX_TEXT);
  const title = el.getAttribute('title');
  if (title) return title.slice(0, MAX_TEXT);
  return '';
}

/** Name of the page region the element lives in (nav, header, footer, main, …). */
function regionFor(el: Element): string {
  const landmark = el.closest('nav, header, footer, aside, main, [data-region]');
  if (!landmark) return 'body';
  return (
    landmark.getAttribute('data-region') ||
    landmark.id ||
    landmark.tagName.toLowerCase()
  );
}

/** First class name, if any (handy context without dumping the whole list). */
function firstClass(el: Element): string | undefined {
  return (el as HTMLElement).classList?.[0] || undefined;
}

function trackPageView(): void {
  gtag('event', 'page_view', {
    page_location: location.href,
    page_path: location.pathname + location.search,
    page_title: document.title,
  });
}

/** One delegated, capture-phase click handler for the whole document. */
function handleClick(ev: MouseEvent): void {
  const start = ev.target as Element | null;
  if (!start) return;

  // The one interactive ancestor we attribute the click to. Decorative clicks
  // (e.g. the field canvas) match nothing here and are ignored.
  const el = start.closest<HTMLElement>(
    'a[href], button, [role="button"], summary, input[type="submit"], input[type="button"], [data-track]',
  );
  if (!el) return;

  const region = regionFor(el);
  const label = labelFor(el);

  // The site's field on/off switch is a named behaviour, not a generic click.
  if (el.closest('.sn-field-btn, [data-field-toggle]')) {
    // Read the resulting state after the toggle's own handler runs.
    setTimeout(() => {
      gtag('event', 'field_toggle', {
        state: document.documentElement.dataset.field === 'off' ? 'off' : 'on',
        region,
      });
    }, 0);
    return;
  }

  const anchor = el instanceof HTMLAnchorElement ? el : null;
  if (anchor && anchor.href) {
    let outbound = false;
    let link_domain = '';
    try {
      const url = new URL(anchor.href, location.href);
      link_domain = url.hostname;
      outbound = url.hostname !== location.hostname && /^https?:$/.test(url.protocol);
    } catch {
      /* non-navigational href (mailto:, #, javascript:) — leave defaults */
    }
    gtag('event', 'link_click', {
      link_url: anchor.href,
      link_domain,
      link_text: label,
      link_id: anchor.id || undefined,
      link_classes: firstClass(anchor),
      outbound,
      region,
    });
    return;
  }

  // Buttons and other controls.
  gtag('event', 'ui_click', {
    label,
    element: el.tagName.toLowerCase(),
    element_id: el.id || undefined,
    element_classes: firstClass(el),
    region,
  });
}

function handleSubmit(ev: SubmitEvent): void {
  const form = ev.target as HTMLFormElement | null;
  if (!form) return;
  gtag('event', 'form_submit', {
    form_id: form.id || undefined,
    form_name: form.getAttribute('name') || undefined,
    form_classes: firstClass(form),
    region: regionFor(form),
  });
}

// Site search (Pagefind / any search input), debounced so we log the query, not
// each keystroke. GA4's `search` is a recommended event (search_term param).
let searchTimer: number | undefined;
function handleSearchInput(ev: Event): void {
  const input = ev.target as HTMLElement | null;
  if (!(input instanceof HTMLInputElement)) return;
  const isSearch =
    input.type === 'search' ||
    input.closest('.pagefind-ui, [data-search], #search') !== null;
  if (!isSearch) return;
  const term = input.value.trim();
  if (!term) return;
  window.clearTimeout(searchTimer);
  searchTimer = window.setTimeout(() => {
    gtag('event', 'search', { search_term: term.slice(0, MAX_TEXT) });
  }, 1000);
}

/**
 * Wire everything. Idempotent: listeners are attached to `document`, which
 * survives ClientRouter swaps, so this runs exactly once per full load.
 */
export function initAnalytics(): void {
  if (typeof document === 'undefined') return;

  // page_view on initial load and after every view-transition navigation.
  // astro:page-load fires in both cases.
  document.addEventListener('astro:page-load', trackPageView);

  // Capture phase so we still see clicks whose handlers call stopPropagation().
  document.addEventListener('click', handleClick, { capture: true });
  document.addEventListener('submit', handleSubmit, { capture: true });
  document.addEventListener('input', handleSearchInput, { capture: true });
}

/** Resolve the GA client_id so server-side events stitch to the same user/session. */
function getClientId(): Promise<string | undefined> {
  return new Promise((resolve) => {
    if (typeof window.gtag !== 'function') return resolve(undefined);
    let done = false;
    const finish = (id?: string) => {
      if (done) return;
      done = true;
      resolve(id);
    };
    try {
      window.gtag('get', MEASUREMENT_ID, 'client_id', (id: unknown) =>
        finish(typeof id === 'string' ? id : undefined),
      );
    } catch {
      finish(undefined);
    }
    // gtag's get callback can silently never fire (blocked, not yet loaded) — cap it.
    setTimeout(() => finish(undefined), 1000);
  });
}

/**
 * Send an event through the server-side Measurement Protocol endpoint
 * (/api/collect), which holds the MP API secret. Use this only for events the
 * client-side gtag does NOT already send — deliberate server-validated
 * conversions or events fired without gtag — otherwise you double-count.
 *
 * No-ops in dev (no gtag → no client_id) and swallows all failures: analytics
 * must never break the page.
 */
export async function sendServerEvent(
  name: string,
  params: Record<string, unknown> = {},
): Promise<void> {
  const client_id = await getClientId();
  if (!client_id) return;
  try {
    await fetch('/api/collect', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ client_id, events: [{ name, params }] }),
      keepalive: true,
    });
  } catch {
    /* analytics is best-effort */
  }
}
