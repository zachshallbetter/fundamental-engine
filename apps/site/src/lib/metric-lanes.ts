// Recipe-metric documentation helpers. A recipe lists the metric lanes it drives, but not all lanes
// are produced the same way — and a lane the platform never writes (and the host never supplies) is
// inert. `classifyMetric` (from @fundamental-engine/platform) makes the split; these wrap it for the recipe
// pages so an author sees, per metric, whether its --field-<m> lane is live by default or needs the
// host to ground it. Mirrors the guard `lintInertFeedback` checks at runtime.
import { classifyMetric, type MetricSupport } from '@fundamental-engine/platform';

export { classifyMetric, type MetricSupport };

/** Short tag shown beside a metric group on the recipe pages. */
export const SUPPORT_LABEL: Record<MetricSupport, string> = {
  computed: 'live',
  'supplied-only': 'supplied',
  designed: 'host-supplied',
};

/** Long description (the badge tooltip + the recipe-page legend). */
export const SUPPORT_DESC: Record<MetricSupport, string> = {
  computed: 'computed every frame by the platform (proximity · engagement · relationships · age)',
  'supplied-only':
    'written only when the host supplies it — the engine never invents confidence/risk',
  designed:
    'a semantic lane — drive it with data-field-<metric> (or a domain model); without that its --field-<metric> stays inert',
};

/** A per-metric tooltip: "memory — computed every frame…". */
export const metricTitle = (m: string): string => `${m} — ${SUPPORT_DESC[classifyMetric(m)]}`;

/** The recipe's metric names that are designed lanes (host-supplied, else inert). */
export const designedMetrics = (metrics: readonly string[]): string[] =>
  metrics.filter((m) => classifyMetric(m) === 'designed');
