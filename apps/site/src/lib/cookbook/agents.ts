// AGENTS WITHOUT THREE.JS — an engine-stepped participant you drive anything with.
//
// `addAgent` is usually met through `@fundamental-engine/three`, where it binds a mesh. But the
// agent lane is core, not Three: give it a position and a `report` callback and the engine
// integrates it under the net field every frame, handing you its live particle. Drive a mesh, an
// SVG node, a native view, a robot — or nothing at all, and just read where the field takes it.
import { createField, headlessHost, seededRng } from '@fundamental-engine/core';

export interface AgentResult {
  /** how many times `report` fired — once per frame. */
  reports: number;
  /** the agent's straight-line distance from the attractor at the start. */
  startDistance: number;
  /** …and at the end: the field pulled it in. */
  endDistance: number;
  /** it genuinely moved under the force, not by assignment. */
  movedTowardAttractor: boolean;
}

const distance = (ax: number, ay: number, bx: number, by: number): number =>
  Math.round(Math.hypot(ax - bx, ay - by));

export function runAgent(): AgentResult {
  const host = headlessHost({ width: 1000, height: 700 });
  const field = createField(undefined as unknown as HTMLCanvasElement, {
    host,
    render: 'none',
    density: 0.2,
    rng: seededRng(17),
  });

  // something for the agent to fall toward
  const ATTRACT_X = 500;
  const ATTRACT_Y = 350;
  field.addBody({
    tokens: ['attract'],
    strength: 6,
    range: 900,
    rect: () => ({ left: ATTRACT_X - 40, top: ATTRACT_Y - 40, width: 80, height: 80 }),
  });

  let reports = 0;
  let lastX = 120;
  let lastY = 120;
  const agent = field.addAgent({
    x: 120,
    y: 120,
    mass: 1,
    maxSpeed: 6,
    report: (p) => {
      reports++;
      lastX = p.x;
      lastY = p.y;
    },
  });

  const startDistance = distance(120, 120, ATTRACT_X, ATTRACT_Y);
  for (let i = 0; i < 120; i++) host.tick();
  const endDistance = distance(lastX, lastY, ATTRACT_X, ATTRACT_Y);

  agent.remove();
  field.destroy();
  return {
    reports,
    startDistance,
    endDistance,
    movedTowardAttractor: endDistance < startDistance,
  };
}
