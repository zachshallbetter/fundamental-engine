# e2e — the invisible-fields suite

Playwright specs that pin the hand-verified invariants of the twelve example pages at
`/evidence` and `/evidence/<slug>`.

The suite runs against the **built** site (`astro preview` serves `dist/`), so build first:

```sh
pnpm --filter @field-ui/site build   # packages' dist must already be built (pnpm build at the root)
pnpm --filter @field-ui/site test:e2e
```

Every test blocks non-localhost network (see `fixtures.ts`), so the live-data loops fail
politely and the pages stay on their committed snapshots — the chips read "snapshot · …",
which is the designed offline behavior. Reduced motion is NOT emulated: the FLIP paths are
part of what the suite pins.
