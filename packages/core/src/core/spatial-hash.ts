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

  /** items within radius `r` of (x, y), filtered by true distance. */
  near(x: number, y: number, r: number): T[] {
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
          if (dx * dx + dy * dy <= r2) out.push(it);
        }
      }
    }
    return out;
  }
}
