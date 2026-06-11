/**
 * RenderBackend (#373) — the structural drawing seam. The Canvas 2D implementation is exercised
 * against a recording context stub: sizing owns the dpr transform, primitives translate to the
 * expected 2D calls, and degenerate inputs (short polylines) draw nothing. Any future backend
 * (WebGL/WebGPU/offscreen) passes the same shape: these tests document the contract.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canvas2dBackend } from './render-backend.ts';

function recordingCtx(): { calls: string[]; ctx: CanvasRenderingContext2D } {
  const calls: string[] = [];
  const ctx = new Proxy(
    {},
    {
      get(_t, prop: string) {
        if (prop === 'measureText') return (s: string) => (calls.push(`measureText(${s})`), { width: s.length * 6 });
        return (...args: unknown[]) => void calls.push(`${prop}(${args.map((a) => (typeof a === 'number' ? Number(a.toFixed(2)) : a)).join(',')})`);
      },
      set(_t, prop: string, v) {
        calls.push(`${prop}=${v}`);
        return true;
      },
    },
  ) as unknown as CanvasRenderingContext2D;
  return { calls, ctx };
}

const fakeCanvas = (): HTMLCanvasElement => ({ width: 0, height: 0 }) as HTMLCanvasElement;

test('size owns the backing store and the dpr transform; clear covers the css-pixel viewport', () => {
  const { calls, ctx } = recordingCtx();
  const canvas = fakeCanvas();
  const b = canvas2dBackend(canvas, ctx);
  b.size(800, 600, 2);
  assert.equal(canvas.width, 1600);
  assert.equal(canvas.height, 1200);
  assert.ok(calls.includes('setTransform(2,0,0,2,0,0)'));
  b.clear();
  assert.ok(calls.includes('clearRect(0,0,800,600)'));
});

test('segments strokes each packed pair as one move+line inside a single path', () => {
  const { calls, ctx } = recordingCtx();
  const b = canvas2dBackend(fakeCanvas(), ctx);
  b.segments([0, 0, 10, 0, 5, 5, 5, 15], { r: 1, g: 2, b: 3, alpha: 0.5, width: 1.2 });
  assert.ok(calls.includes('strokeStyle=rgba(1,2,3,0.5)'));
  assert.deepEqual(
    calls.filter((c) => c.startsWith('moveTo') || c.startsWith('lineTo')),
    ['moveTo(0,0)', 'lineTo(10,0)', 'moveTo(5,5)', 'lineTo(5,15)'],
  );
  assert.equal(calls.filter((c) => c === 'stroke()').length, 1, 'one batched stroke');
});

test('polyline connects points; fewer than two points draws nothing', () => {
  const { calls, ctx } = recordingCtx();
  const b = canvas2dBackend(fakeCanvas(), ctx);
  b.polyline([0, 0, 4, 4, 8, 0], { r: 0, g: 0, b: 0, alpha: 1, width: 1 });
  assert.deepEqual(
    calls.filter((c) => c.startsWith('moveTo') || c.startsWith('lineTo')),
    ['moveTo(0,0)', 'lineTo(4,4)', 'lineTo(8,0)'],
  );
  calls.length = 0;
  b.polyline([1, 1], { r: 0, g: 0, b: 0, alpha: 1, width: 1 });
  assert.deepEqual(calls, [], 'a single point is not a line');
});

test('rect and text fill with the given color; measureText reports at the chip font', () => {
  const { calls, ctx } = recordingCtx();
  const b = canvas2dBackend(fakeCanvas(), ctx);
  b.rect(10, 20, 30, 14, 9, 9, 9, 0.8);
  assert.ok(calls.includes('fillStyle=rgba(9,9,9,0.8)'));
  assert.ok(calls.includes('fillRect(10,20,30,14)'));
  b.text('d 0.42', 13, 27, 5, 6, 11, 0.92);
  assert.ok(calls.includes('fillText(d 0.42,13,27)'));
  assert.equal(b.measureText('d 0.42'), 36, 'stub width: 6px per char at the chip font');
});
