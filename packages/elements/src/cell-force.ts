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
  // stream and buoyancy are uniform fields — not distance-gated.
  const uniform = force === 'stream' || force === 'buoyancy';
  if (!uniform && d >= reach) return { ax: 0, ay: 0 };
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
    case 'buoyancy':
      return { ax: 0, ay: -0.12 }; // a steady lift (−y is up)
    case 'gravity': {
      const g = Math.min(0.8, ((reach * reach) / (d * d)) * 0.02); // true-ish 1/d²
      return { ax: ux * g, ay: uy * g };
    }
    case 'spring': {
      const rest = reach * 0.45;
      const s = (d - rest) * 0.025; // pull in past the shell, push out within it
      return { ax: ux * s, ay: uy * s };
    }
    case 'attract':
    default:
      return { ax: ux * f, ay: uy * f };
  }
}
