import { test as base, expect } from "@playwright/test";

// Determinism: block every request that isn't the local preview server. The example pages'
// live-data loops (OpenAlex, CoinGecko, Stack Exchange, ListenBrainz, …) fail politely and
// the pages stay on their committed snapshots — the designed offline behavior.
export const test = base.extend({
  context: async ({ context }, use) => {
    await context.route("**/*", (route) => {
      const u = new URL(route.request().url());
      if (u.hostname === "localhost" || u.hostname === "127.0.0.1") return route.continue();
      return route.abort();
    });
    await use(context);
  },
});

export { expect };
