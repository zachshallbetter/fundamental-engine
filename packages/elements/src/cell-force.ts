/**
 * The Field Cell's in-frame force math (§25.1) — a deliberately simplified,
 * centre-of-frame model for demos. NOT the canonical force math (§6); the cell is
 * a poster engine. `dx,dy` point from the particle TO the frame centre.
 */
export function cellForce(
  force: string,
  dx: number,
  dy: number,
  reach: number
): { ax: number; ay: number } {
  const d = Math.hypot(dx, dy) || 1;
  if (force !== 'stream' && d >= reach) return { ax: 0, ay: 0 };
  const ux = dx / d;
  const uy = dy / d;
  const f = (1 - Math.min(d, reach) / reach) * 0.4;
  switch (force) {
    case 'repel':
      return { ax: -ux * f, ay: -uy * f };
    case 'vortex':
      return { ax: -uy * f, ay: ux * f };
    case 'stream':
      return { ax: 0.12, ay: 0 };
    case 'attract':
    default:
      return { ax: ux * f, ay: uy * f };
  }
}
