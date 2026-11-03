/**
 * /api/collect — GA4 Measurement Protocol forwarder (Vercel Edge Function).
 *
 * The site is static (apps/site/dist), so the Measurement Protocol API secret —
 * which must never ship to the browser — has no home in the client bundle. This
 * endpoint is that home: it accepts a small JSON event payload from first-party
 * code, attaches the secret server-side, and forwards it to GA4's MP endpoint.
 *
 * It is NOT wired to mirror the client-side gtag events (that would double-count).
 * Use it for events gtag can't send — deliberate server-validated conversions, or
 * events fired from contexts without gtag. The browser helper is
 * `sendServerEvent()` in apps/site/src/lib/analytics.ts.
 *
 * Config (Vercel → Project → Settings → Environment Variables; never committed):
 *   GA_API_SECRET       required — the Measurement Protocol API secret.
 *   GA_MEASUREMENT_ID   optional — defaults to the site's G-M22BZ4PNB6.
 *
 * If GA_API_SECRET is unset the endpoint is a silent no-op (204), so a missing
 * secret never breaks the client.
 *
 * Debug: POST with ?debug=1 forwards to GA's /debug/mp/collect, which validates
 * the payload (and does NOT record the hit) and returns its validationMessages.
 */

export const config = { runtime: 'edge' };

const DEFAULT_MEASUREMENT_ID = 'G-M22BZ4PNB6';

// First-party origins allowed to post. Same-origin fetches often omit Origin, so
// a missing Origin is allowed; a present one must be on this list.
const ALLOWED_HOST = /(^|\.)fundamentalengine\.com$|^localhost(:\d+)?$|^127\.0\.0\.1(:\d+)?$/;

const MAX_BODY_BYTES = 8 * 1024; // event payloads are tiny; cap abuse.
const MAX_EVENTS = 25;
const MAX_NAME = 40;

function noContent() {
  return new Response(null, { status: 204 });
}

function originAllowed(req) {
  const origin = req.headers.get('origin');
  if (!origin) return true; // same-origin requests may omit it
  try {
    return ALLOWED_HOST.test(new URL(origin).host);
  } catch {
    return false;
  }
}

/** Keep only well-formed events: { name: string, params?: object }. */
function sanitizeEvents(input) {
  if (!Array.isArray(input)) return [];
  return input
    .slice(0, MAX_EVENTS)
    .map((e) => {
      if (!e || typeof e.name !== 'string') return null;
      const name = e.name.slice(0, MAX_NAME).replace(/[^a-zA-Z0-9_]/g, '_');
      if (!name) return null;
      const params =
        e.params && typeof e.params === 'object' && !Array.isArray(e.params) ? e.params : {};
      return { name, params };
    })
    .filter(Boolean);
}

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405, headers: { allow: 'POST' } });
  }
  if (!originAllowed(req)) return new Response('Forbidden', { status: 403 });

  const secret = process.env.GA_API_SECRET;
  const measurementId = process.env.GA_MEASUREMENT_ID || DEFAULT_MEASUREMENT_ID;
  // No secret configured → accept and drop, so the client never sees an error.
  if (!secret) return noContent();

  // Read the body with a hard size cap.
  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) return new Response('Payload Too Large', { status: 413 });

  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    return new Response('Bad Request', { status: 400 });
  }

  const client_id = typeof body.client_id === 'string' ? body.client_id : undefined;
  if (!client_id) return new Response('Bad Request: client_id required', { status: 400 });

  const events = sanitizeEvents(body.events);
  if (events.length === 0) return new Response('Bad Request: no valid events', { status: 400 });

  const payload = { client_id, events };
  if (typeof body.user_id === 'string') payload.user_id = body.user_id;
  if (body.user_properties && typeof body.user_properties === 'object') {
    payload.user_properties = body.user_properties;
  }

  const debug = new URL(req.url).searchParams.get('debug') === '1';
  const base = debug
    ? 'https://www.google-analytics.com/debug/mp/collect'
    : 'https://www.google-analytics.com/mp/collect';
  const endpoint = `${base}?measurement_id=${encodeURIComponent(
    measurementId,
  )}&api_secret=${encodeURIComponent(secret)}`;

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    // The debug endpoint returns validation JSON — pass it back to the caller.
    if (debug) {
      const text = await res.text();
      return new Response(text, {
        status: res.status,
        headers: { 'content-type': 'application/json' },
      });
    }
    // Production MP returns 2xx with an empty body; mirror success as 204.
    return res.ok ? noContent() : new Response('Upstream error', { status: 502 });
  } catch {
    // Never let an analytics failure surface to the user.
    return noContent();
  }
}
