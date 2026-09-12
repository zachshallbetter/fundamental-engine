// FIELD CHANNELS — register data you already own as something the field can read.
//
// `addField(name, sampler)` is the open INPUT analog of the bundled output surfaces: instead of
// keeping a parallel grid beside the field and syncing the two by hand, hand the engine a
// `(x, y) => number` and read it back through `sampleField(name, x, y)`. The sampler is PULL-based
// — called on demand, never cached — so the data stays yours and is always current.
//
// An unregistered name reads 0, so a `sampleField` call is always safe.
import { createField, headlessHost, seededRng } from '@fundamental-engine/core';

export interface ChannelResult {
  /** the registered channel's value mid-field. */
  moisture: number;
  /** an unregistered name — safe, reads 0. */
  unregistered: number;
  /** after `handle.set(...)` swapped the sampler live (a season changed the map). */
  afterSwap: number;
  /** after `handle.remove()` — the channel is gone, so it reads 0 again. */
  afterRemove: number;
}

export function runChannels(): ChannelResult {
  const host = headlessHost({ width: 1200, height: 800 });
  const field = createField(undefined as unknown as HTMLCanvasElement, {
    host,
    render: 'none',
    rng: seededRng(5),
  });

  // your data, sampled on the engine's own read path — a dry east, a wet west
  const summer = (x: number, _y: number): number => 1 - x / 1200;
  const winter = (x: number, _y: number): number => Math.min(1, (1 - x / 1200) + 0.4);

  const channel = field.addField('moisture', summer);

  const moisture = Number(field.sampleField('moisture', 300, 400).toFixed(3));
  const unregistered = field.sampleField('not-registered', 300, 400);

  channel.set(winter); // swap the sampler live — nothing to invalidate
  const afterSwap = Number(field.sampleField('moisture', 300, 400).toFixed(3));

  channel.remove();
  const afterRemove = field.sampleField('moisture', 300, 400);

  field.destroy();
  return { moisture, unregistered, afterSwap, afterRemove };
}
