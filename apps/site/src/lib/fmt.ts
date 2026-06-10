// Shared formatters — fourteen Intl/toLocaleString hand-rolls across the example pages.
// Only the genuinely shared shapes live here; page-specific formats (the calendar's
// T− countdown style) stay with their pages.

const INT = new Intl.NumberFormat("en-US");
const USD = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const DATE_MED = new Intl.DateTimeFormat("en", { dateStyle: "medium" });

/** 1234567 → "1,234,567" */
export const fmtInt = (n: number): string => INT.format(n);

/** 61517 → "$61,517.00" */
export const fmtUsd = (n: number): string => USD.format(n);

/** epoch ms / Date → "Jun 10, 2026" */
export const fmtDate = (d: number | string | Date): string => DATE_MED.format(new Date(d));

/**
 * Relative age, the family's compact style: "now" < 60s ≤ "59m" < "23h" < "13d" < "2y".
 * Both arguments in ms; `now` is explicit (pages compare against their snapshot time, not
 * the wall clock — the honesty rule).
 */
export function fmtAgo(atMs: number, nowMs: number): string {
  const s = Math.max(0, Math.round((nowMs - atMs) / 1000));
  if (s < 60) return "now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 365) return `${d}d ago`;
  return `${Math.floor(d / 365)}y ago`;
}
