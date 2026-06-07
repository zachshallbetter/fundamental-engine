/**
 * Inspection & productization (Phase 8 — testing-and-conformance). The harnesses that make the
 * system observable and regression-safe: deterministic snapshot capture/compare, the performance
 * budget inspector, and the aggregate system report. All pure (snapshot runs the pure simulation),
 * so they double as CI checks and Inspector data sources.
 */
export * from './snapshot.ts';
export * from './budget.ts';
export * from './report.ts';
