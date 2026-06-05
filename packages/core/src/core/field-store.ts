/**
 * FieldStore — owns the particle pool and the spatial index (§20.1 foundation).
 *
 * The single home for "all the matter": add/remove particles, rebuild the
 * neighbour index once per frame, and answer `neighbors(p, r)`. Count is the
 * conserved quantity (§2.4) — `size` is the live total.
 */

import type { Particle } from './types.ts';
import { SpatialHash } from './spatial-hash.ts';

export class FieldStore {
  readonly particles: Particle[] = [];
  private readonly hash: SpatialHash<Particle>;

  constructor(cellSize = 64) {
    this.hash = new SpatialHash<Particle>(cellSize);
  }

  get size(): number {
    return this.particles.length;
  }

  add(p: Particle): Particle {
    this.particles.push(p);
    return p;
  }

  /** swap-remove a particle (O(1), order not preserved). */
  remove(p: Particle): void {
    const i = this.particles.indexOf(p);
    if (i < 0) return;
    const last = this.particles.pop();
    if (last && i < this.particles.length) this.particles[i] = last;
  }

  clear(): void {
    this.particles.length = 0;
    this.hash.clear();
  }

  /** rebuild the neighbour index from the current pool (once per frame). */
  reindex(): void {
    this.hash.rebuild(this.particles);
  }

  /** neighbours within `r` of `p`, excluding `p` itself. */
  neighbors(p: Particle, r: number): Particle[] {
    const found = this.hash.near(p.x, p.y, r);
    const out: Particle[] = [];
    for (const n of found) if (n !== p) out.push(n);
    return out;
  }

  /** particles within `r` of an arbitrary point (x, y) — for grid sampling (e.g. the
   *  voronoi render mode), where the query origin is not itself a particle. */
  near(x: number, y: number, r: number): Particle[] {
    return this.hash.near(x, y, r);
  }
}
