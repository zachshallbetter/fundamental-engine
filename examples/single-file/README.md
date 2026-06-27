# single-file

A true no-bundler, no-import-map drop-in. The page loads Fundamental with a
plain `<script>` tag pointing at the pre-bundled single-file IIFE
(`standalone.global.js`), which exposes one global: **`Fundamental`**.

## What it shows

- The `@fundamental-engine/vanilla` standalone build (`dist/standalone.global.js`)
  used straight from a classic script tag.
- `Fundamental.createField(canvas, { render: 'dots' })` — identical API to the
  ESM entry, no modules involved.
- `[data-body="…"]` elements becoming bodies.

## The bundle

`standalone.global.js` here is a verbatim copy of
`@fundamental-engine/vanilla@0.9.0`'s `dist/standalone.global.js`. To refresh it
from npm:

```sh
npm pack @fundamental-engine/vanilla@0.9.0
tar xzf fundamental-engine-vanilla-0.9.0.tgz
cp package/dist/standalone.global.js .
```

(Or load it from a CDN instead:
`<script src="https://esm.sh/@fundamental-engine/vanilla@0.9.0/standalone.global.js"></script>`.)

## Run

Static HTML — serve the directory and open it:

```sh
python3 -m http.server 8000
# then open http://localhost:8000/
```
