// A CUSTOM FEEDBACK SINK — send the field's per-body channels somewhere that isn't CSS.
//
// Every feedback write in the engine flows through ONE contract:
//   type FeedbackSink = (el: HTMLElement, channels: FeedbackChannels) => void
// The default (`cssFeedbackSink`) writes `--d` / `--load` / `--lit` / … onto the element. Install
// your own and the same values go wherever you want instead — a store, a socket, a native bridge,
// a test recorder — with no DOM involved.
import { createField, headlessHost, seededRng, type FeedbackChannels } from '@fundamental-engine/core';

export interface SinkResult {
  /** how many times the sink was invoked (once per body per frame it has channels for). */
  writes: number;
  /** the channel names the engine actually populated — the sink's real payload shape. */
  channels: string[];
  /** the last density the sink received. */
  lastDensity: number;
}

export function runCustomSink(): SinkResult {
  const host = headlessHost({ width: 1000, height: 700 });

  let writes = 0;
  let lastDensity = 0;
  const seen = new Set<string>();

  // The sink replaces the CSS write path entirely — nothing is written to any element.
  const field = createField(undefined as unknown as HTMLCanvasElement, {
    host,
    render: 'none',
    density: 0.5,
    rng: seededRng(11),
    feedbackSink: (_el, channels: FeedbackChannels) => {
      writes++;
      for (const [key, value] of Object.entries(channels)) {
        if (value !== undefined) seen.add(key);
      }
      if (channels.density !== undefined) lastDensity = channels.density;
    },
  });

  field.addBody({
    tokens: ['attract', 'sink'],
    strength: 1,
    range: 240,
    rect: () => ({ left: 420, top: 300, width: 160, height: 100 }),
  });

  for (let i = 0; i < 40; i++) host.tick();

  const result: SinkResult = {
    writes,
    channels: [...seen].sort(),
    lastDensity: Number(lastDensity.toFixed(3)),
  };
  field.destroy();
  return result;
}
