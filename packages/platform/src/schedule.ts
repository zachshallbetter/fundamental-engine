/**
 * FrameScheduler — one shared loop with explicit, ordered phases so the registries never fight each
 * other. Without it, MeasurementRegistry (reads) and FeedbackRegistry (writes) can interleave and
 * thrash layout. With it, every frame walks the same six phases in the same order:
 *
 *   discover → read → compute → state → write → render
 *
 *   1. discover  register/unregister bodies, relationships, visual bindings (structure changes)
 *   2. read      measure the DOM once — snapshot geometry, visibility (the ONLY place layout is read)
 *   3. compute   run field/force/agent logic against the immutable snapshot (no DOM)
 *   4. state     fold results into StateRegistry + thresholds (internal truth, no DOM writes)
 *   5. write     flush state → CSS vars, data attrs, ElementInternals, thresholded events
 *   6. render    draw overlays, field lines, heatmaps from the registries (read-only)
 *
 * The scheduler also enforces the discipline: a read requested during the write phase is a
 * violation. By default violations are recorded (so platform lint can report them); `strict: true`
 * throws instead — useful in tests and dev. The scheduler holds no DOM and is fully testable.
 */
import type { Viewport } from './types.ts';

export const PHASES = ['discover', 'read', 'compute', 'state', 'write', 'render'] as const;
export type Phase = (typeof PHASES)[number];

/** Phases in which reading layout is legal. Reading anywhere else thrashes against pending writes. */
export const READ_PHASES: readonly Phase[] = ['discover', 'read'];

export interface FrameContext {
  /** the frame time (ms). Injectable so frames are deterministic in tests. */
  now: number;
  /** viewport box for visibility math (omitted → registries fall back to `window`). */
  viewport?: Viewport;
  /** the phase currently running. */
  phase: Phase;
  /** monotonically increasing frame counter (starts at 0). */
  frame: number;
}

export type PhaseHandler = (ctx: FrameContext) => void;

export interface PhaseViolation {
  /** the phase that was active when the illegal operation happened. */
  phase: Phase;
  /** the operation that was attempted (e.g. `measure`). */
  op: string;
  /** the phases in which the operation would have been legal. */
  allowed: readonly Phase[];
  frame: number;
  message: string;
}

export interface FrameReport {
  frame: number;
  now: number;
  /** the phases that ran, in order. */
  ran: Phase[];
  /** violations recorded during this frame (empty when clean). */
  violations: PhaseViolation[];
}

export interface SchedulerOptions {
  /** throw on a phase violation instead of recording it (default false). */
  strict?: boolean;
}

export class FrameScheduler {
  private readonly handlers: Map<Phase, PhaseHandler[]> = new Map();
  private readonly strict: boolean;
  private readonly recorded: PhaseViolation[] = [];
  private current: Phase | null = null;
  private count = 0;

  constructor(opts: SchedulerOptions = {}) {
    this.strict = opts.strict ?? false;
    for (const p of PHASES) this.handlers.set(p, []);
  }

  /** Register a handler for a phase. Returns an unsubscribe function. */
  on(phase: Phase, handler: PhaseHandler): () => void {
    const list = this.handlers.get(phase)!;
    list.push(handler);
    return () => {
      const i = list.indexOf(handler);
      if (i >= 0) list.splice(i, 1);
    };
  }

  /** The phase currently executing, or null when no frame is running (e.g. direct unit calls). */
  get phase(): Phase | null {
    return this.current;
  }

  /** How many frames have run. */
  get frame(): number {
    return this.count;
  }

  /**
   * Assert that the current phase is one in which `op` is legal. Outside a frame (`phase === null`)
   * anything is allowed — direct calls in tests/setup are not frame-disciplined. Inside a frame, an
   * out-of-phase call is recorded (or thrown in strict mode).
   */
  assertPhase(allowed: readonly Phase[], op: string): void {
    const phase = this.current;
    if (phase === null) return; // unmanaged call — not part of a scheduled frame
    if (allowed.includes(phase)) return;
    const v: PhaseViolation = {
      phase,
      op,
      allowed,
      frame: this.count,
      message: `"${op}" ran in the ${phase} phase; allowed only in: ${allowed.join(', ')}`,
    };
    if (this.strict) throw new Error(`[Fundamental/platform] ${v.message}`);
    this.recorded.push(v);
  }

  /** A read-phase guard suitable for handing to MeasurementRegistry.setPhaseGuard. */
  readGuard(): (op: string) => void {
    return (op: string) => this.assertPhase(READ_PHASES, op);
  }

  /** Violations recorded so far (across frames, until cleared). */
  violations(): readonly PhaseViolation[] {
    return this.recorded;
  }

  clearViolations(): void {
    this.recorded.length = 0;
  }

  /** Run one frame: every phase, in order, with its handlers. Returns a per-frame report. */
  runFrame(now = 0, viewport?: Viewport): FrameReport {
    const startViolations = this.recorded.length;
    const ran: Phase[] = [];
    for (const phase of PHASES) {
      const list = this.handlers.get(phase)!;
      if (list.length === 0) continue;
      this.current = phase;
      ran.push(phase);
      const ctx: FrameContext = { now, viewport, phase, frame: this.count };
      for (const h of list) h(ctx);
    }
    this.current = null;
    const report: FrameReport = {
      frame: this.count,
      now,
      ran,
      violations: this.recorded.slice(startViolations),
    };
    this.count++;
    return report;
  }
}
