# vanilla-cdn

The smallest possible Fundamental app: a single `index.html` that imports
`createField` from [esm.sh](https://esm.sh) at runtime. **No build step, no
install, no bundler.**

## What it shows

- Importing `@fundamental-engine/vanilla@0.9.0` over a CDN (ES module).
- `createField(canvas, { render: 'dots' })` — the one imperative door to start
  the engine on a `<canvas>` you own.
- `[data-body="…"]` elements (a heading, cards, a link) becoming bodies that
  bend the field.

## Run

It's static HTML — open it any way you like:

```sh
# from this directory
python3 -m http.server 8000
# then open http://localhost:8000/
```

Or just open `index.html` in a browser. (A CDN connection is required the first
time so esm.sh can serve the module.)
