# web-component

The plain-HTML web-component path: drop a single `<field-root>` tag on the page
and it becomes the singleton page field. No imperative JavaScript — the only
script line imports the module so the custom element gets registered.

## What it shows

- `<field-root render="dots" accent="…">` from
  `@fundamental-engine/elements@0.9.0`, loaded over a CDN.
- The element scanning the document for `[data-body="…"]` elements and turning
  them into bodies.
- `field-root.particleCount()` available on the element instance once the field
  has booted.

## Run

Static HTML — serve the directory and open it:

```sh
python3 -m http.server 8000
# then open http://localhost:8000/
```

A CDN connection is required the first time so esm.sh can serve the module (it
pulls in `@fundamental-engine/{vanilla,dom,core}` as dependencies).
