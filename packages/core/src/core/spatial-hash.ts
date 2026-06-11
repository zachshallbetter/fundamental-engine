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

  constructor(cellSize = 64) {
    this.cell = cellSize > 0 ? cellSize : 64;
  }

  private key(cx: number, cy: number): number {
    // pack two signed cell coords into one number (offset to keep non-negative).
    return (cx + 0x8000) * 0x10000 + (cy + 0x8000);
  }

  clear(): void {
    this.bins.clear();
  }

  insert(item: T): void {
    const k = this.key(
      Math.floor(item.x / this.cell),
      Math.floor(item.y / this.cell)
    );
    const bin = this.bins.get(k);
    if (bin) bin.push(item);
    else this.bins.set(k, [item]);
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
