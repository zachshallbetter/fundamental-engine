/**
 * Off-main-thread render worker. Receives particle data each frame via postMessage,
 * draws to an OffscreenCanvas using the canvas2d API.
 * Protocol: main → worker: { type:'frame', particles: Float32Array, count: number,
 *   W: number, H: number, dpr: number, frameN: number }
 * worker → main: { type:'done', frameN: number }
 */

let ctx: OffscreenCanvasRenderingContext2D | null = null;

self.addEventListener('message', (e: MessageEvent) => {
  const msg = e.data;
  if (msg.type === 'init') {
    ctx = (msg.canvas as OffscreenCanvas).getContext('2d');
    return;
  }
  if (msg.type === 'frame' && ctx) {
    const { particles, count, W, H, dpr, frameN, accent } = msg;
    ctx.clearRect(0, 0, W * dpr, H * dpr);
    ctx.save();
    ctx.scale(dpr, dpr);
    // draw particles: stride 5 [x, y, z, heat, size]
    for (let i = 0; i < count; i++) {
      const base = i * 5;
      const x = particles[base]!;
      const y = particles[base + 1]!;
      const heat = particles[base + 3]!;
      const size = particles[base + 4]!;
      const alpha = 0.4 + heat * 0.6;
      const radius = Math.max(1, size);
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      // simple heat colour: cool = accent, hot = white
      const r = Math.round(80 + heat * 175);
      const g = Math.round(120 + heat * 135);
      const b = Math.round(255 - heat * 80);
      ctx.fillStyle = `rgba(${r},${g},${b},${alpha.toFixed(2)})`;
      ctx.fill();
    }
    ctx.restore();
    self.postMessage({ type: 'done', frameN });
  }
});
