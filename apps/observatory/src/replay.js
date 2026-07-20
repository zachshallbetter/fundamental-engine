/**
 * Replay engine — Phase O3.
 *
 * Deterministic replay over a RECORDED run. It holds a cursor into an immutable array of transitions
 * that the runtime already produced; it never advances a contract, never derives state, and cannot
 * modify runtime state because it has no reference to any runtime.
 *
 * Scrubbing to step N shows exactly what was recorded at step N. Replaying twice is identical because
 * nothing is recomputed — a property the capture layer asserts on its side too.
 */

export class Replay {
  #run;
  #index = 0;
  #timer = null;
  #listeners = new Set();

  constructor(run) {
    this.#run = run;
  }

  get run() { return this.#run; }
  get index() { return this.#index; }
  get length() { return this.#run.transitions.length; }
  get playing() { return this.#timer !== null; }
  get transition() { return this.#run.transitions[this.#index]; }

  /** All transitions up to and including the cursor — the history visible "now". */
  get elapsed() { return this.#run.transitions.slice(0, this.#index + 1); }

  /**
   * The reading at the cursor, falling back to the most recent earlier reading. A substrate that only
   * snapshots sometimes leaves gaps; showing the last known reading is faithful, inventing one is not.
   */
  get reading() {
    for (let i = this.#index; i >= 0; i--) {
      const r = this.#run.transitions[i]?.reading;
      if (r) return { reading: r, fromStep: i, stale: i !== this.#index };
    }
    return null;
  }

  onChange(fn) {
    this.#listeners.add(fn);
    return () => this.#listeners.delete(fn);
  }

  #emit() { for (const fn of this.#listeners) fn(this); }

  seek(i) {
    const next = Math.max(0, Math.min(this.length - 1, i | 0));
    if (next === this.#index) return;
    this.#index = next;
    this.#emit();
  }

  step(delta = 1) { this.seek(this.#index + delta); }
  reset() { this.pause(); this.#index = 0; this.#emit(); }

  play(intervalMs = 700) {
    if (this.#timer) return;
    if (this.#index >= this.length - 1) this.#index = 0;
    this.#timer = setInterval(() => {
      if (this.#index >= this.length - 1) { this.pause(); return; }
      this.#index += 1;
      this.#emit();
    }, intervalMs);
    this.#emit();
  }

  pause() {
    if (!this.#timer) return;
    clearInterval(this.#timer);
    this.#timer = null;
    this.#emit();
  }

  toggle() { this.playing ? this.pause() : this.play(); }

  /** Jump to the first transition citing a given evidence id. Returns false if nothing cites it. */
  jumpToEvidence(evidenceId) {
    const i = this.#run.transitions.findIndex((t) => t.evidenceIds.includes(evidenceId));
    if (i < 0) return false;
    this.pause();
    this.seek(i);
    return true;
  }
}
