// Icon generator — rasterizes public/favicon.svg into the full icon set a modern
// site needs: a legacy favicon.ico (PNG-in-ICO: 16/32/48), an opaque Apple touch
// icon, and PWA icons (transparent "any" + themed "maskable" with a safe zone).
// Source of truth is the SVG; re-run after changing it:  node scripts/gen-icons.mjs
//
// Uses @resvg/resvg-js (already a dep for the OG cards) — no sharp/imagemagick.

import { Resvg } from '@resvg/resvg-js';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const PUBLIC = join(here, '..', 'public');
const BG = '#04050a'; // the site theme-color — opaque tiles need it (iOS flattens alpha to black)

// The inner artwork from favicon.svg (viewBox 0 0 441 441), minus the outer <svg>.
const ART = readFileSync(join(PUBLIC, 'favicon.svg'), 'utf8')
  .replace(/^[\s\S]*?<svg[^>]*>/, '')
  .replace(/<\/svg>\s*$/, '')
  .trim();
const SRC = 100; // source viewBox size (favicon.svg is 0 0 100 100)

/** Build a square SVG of side `s`: optional opaque bg, artwork scaled to `fill`
 *  of the side and centered (so maskable icons keep clear of the safe-zone edge). */
const compose = (s, { bg = false, fill = 0.82 } = {}) => {
  const scale = (fill * s) / SRC;
  const off = (s - fill * s) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">${
    bg ? `<rect width="${s}" height="${s}" rx="${Math.round(s * 0.0)}" fill="${BG}"/>` : ''
  }<g transform="translate(${off} ${off}) scale(${scale})">${ART}</g></svg>`;
};

const png = (svg, size) =>
  new Resvg(svg, { fitTo: { mode: 'width', value: size } }).render().asPng();

const write = (name, buf) => {
  writeFileSync(join(PUBLIC, name), buf);
  console.log(`  ✓ ${name} (${buf.length.toLocaleString()} bytes)`);
};

// PNG-in-ICO container (supported by every browser since IE11/Vista). Each entry
// is a 16-byte directory record pointing at an embedded PNG blob.
const buildIco = (entries) => {
  const head = Buffer.alloc(6);
  head.writeUInt16LE(0, 0); // reserved
  head.writeUInt16LE(1, 2); // type: icon
  head.writeUInt16LE(entries.length, 4);
  const dir = Buffer.alloc(16 * entries.length);
  let offset = 6 + dir.length;
  entries.forEach((e, i) => {
    const b = dir.subarray(i * 16);
    b.writeUInt8(e.size >= 256 ? 0 : e.size, 0); // width (0 ⇒ 256)
    b.writeUInt8(e.size >= 256 ? 0 : e.size, 1); // height
    b.writeUInt8(0, 2); // palette
    b.writeUInt8(0, 3); // reserved
    b.writeUInt16LE(1, 4); // color planes
    b.writeUInt16LE(32, 6); // bits per pixel
    b.writeUInt32LE(e.data.length, 8);
    b.writeUInt32LE(offset, 12);
    offset += e.data.length;
  });
  return Buffer.concat([head, dir, ...entries.map((e) => e.data)]);
};

console.log('Generating icons from favicon.svg…');

// Apple touch icon — opaque, generous fill, iOS rounds the corners itself.
write('apple-touch-icon.png', png(compose(180, { bg: true, fill: 0.72 }), 180));

// PWA "any" icons — transparent, the blue strokes read on light or dark.
write('icon-192.png', png(compose(192, { fill: 0.86 }), 192));
write('icon-512.png', png(compose(512, { fill: 0.86 }), 512));

// PWA "maskable" icons — opaque bg, artwork kept inside the central 80% safe zone.
write('icon-192-maskable.png', png(compose(192, { bg: true, fill: 0.6 }), 192));
write('icon-512-maskable.png', png(compose(512, { bg: true, fill: 0.6 }), 512));

// Safari pinned-tab monochrome mask + a 32px PNG some crawlers still want.
write('favicon-32.png', png(compose(32, { fill: 0.86 }), 32));

// Legacy favicon.ico — 16/32/48 transparent PNGs in one container.
const ico = buildIco(
  [16, 32, 48].map((size) => ({ size, data: png(compose(size, { fill: 0.86 }), size) })),
);
write('favicon.ico', ico);

console.log('Done.');
