/**
 * A uniform-grid spatial hash for neighbour queries — the index that makes
 * particle↔particle forces (§20.1 class [B]) O(n·k) instead of O(n²).
 *
 * Rebuilt each frame from the live particle pool; query with `near(x, y, r)`.
 * Dependency-free.
 */

export interface Point {
  x: number;
  y: number;
  /** optional z lane (z-axis.md) — undefined reads as 0 (the flat plane). */
  z?: number;
}

export class SpatialHash<T extends Point> {
  private readonly cell: number;
  private readonly bins = new Map<number, T[]>();
  /**
   * Bin arrays retired by `clear()` — held for reuse so a `rebuild()` that re-populates the same
   * (or a similar) set of cells does not allocate a fresh array per cell every frame. The index is
   * rebuilt each frame (field-store `reindex`), so without this the GC churns one array per non-empty
   * cell per frame at high particle counts. Query behaviour is unchanged: a bin is only ever exposed
   * once it holds live items, and `clear()` empties every live bin before any are handed out.
   */
  private readonly freeBins: T[][] = [];

  constructor(cellSize = 64) {
    this.cell = cellSize > 0 ? cellSize : 64;
  }

  private key(cx: number, cy: number): number {
    // pack two signed cell coords into one number (offset to keep non-negative).
    return (cx + 0x8000) * 0x10000 + (cy + 0x8000);
  }

  clear(): void {
    // Retain the arrays: empty each live bin (length = 0 keeps the backing store) and move it to the
    // free-list, then drop the map entries. Next rebuild pulls from the free-list before allocating.
    for (const bin of this.bins.values()) {
      bin.length = 0;
      this.freeBins.push(bin);
    }
    this.bins.clear();
  }

  insert(item: T): void {
    const k = this.key(
      Math.floor(item.x / this.cell),
      Math.floor(item.y / this.cell)
    );
    const bin = this.bins.get(k);
    if (bin) {
      bin.push(item);
    } else {
      const fresh = this.freeBins.pop();
      if (fresh) {
        fresh.push(item);
        this.bins.set(k, fresh);
      } else {
        this.bins.set(k, [item]);
      }
    }
  }

  rebuild(items: readonly T[]): void {
    this.clear();
    for (const it of items) this.insert(it);
  }

  /**
   * Items within radius `r` of (x, y, z), filtered by TRUE (3D) distance. Bins stay
   * planar — items at any z share their (x, y) cell — which over-collects candidates
   * in a deep volume but never returns a wrong result; the z² term below is the
   * contract. `z` defaults to 0, so flat-field callers are byte-identical.
   */
  near(x: number, y: number, r: number, z = 0): T[] {
    const out: T[] = [];
    const r2 = r * r;
    const minCx = Math.floor((x - r) / this.cell);
    const maxCx = Math.floor((x + r) / this.cell);
    const minCy = Math.floor((y - r) / this.cell);
    const maxCy = Math.floor((y + r) / this.cell);
    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cy = minCy; cy <= maxCy; cy++) {
        const bin = this.bins.get(this.key(cx, cy));
        if (!bin) continue;
        for (const it of bin) {
          const dx = it.x - x;
          const dy = it.y - y;
          const dz = (it.z ?? 0) - z;
          if (dx * dx + dy * dy + dz * dz <= r2) out.push(it);
        }
      }
    }
    return out;
  }
}
