import sharp from 'sharp';
import { readFileSync } from 'node:fs';

// Every raster icon comes from public/icon.svg so the home screen, favicon and app stay identical.
const svg = readFileSync('public/icon.svg');
const outputs: [string, number][] = [
  ['public/apple-touch-icon.png', 180],
  ['public/icon-192.png', 192],
  ['public/icon-512.png', 512],
  ['public/favicon.png', 64],
];
for (const [file, size] of outputs)
  await sharp(svg, { density: 384 }).resize(size, size).png({ compressionLevel: 9 }).toFile(file);
console.log(outputs.map(([f, s]) => `${f} ${s}px`).join('\n'));
