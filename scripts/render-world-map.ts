import { writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { geoNaturalEarth1, geoPath, type GeoPermissibleObjects } from 'd3-geo';
import world from '../src/data/world.json';
const projection = geoNaturalEarth1().fitExtent(
  [
    [8, 8],
    [792, 382],
  ],
  world as unknown as GeoPermissibleObjects,
);
const path = geoPath(projection).digits(1);
const countries = world.features.map((f) => ({
  code: String(f.properties.code),
  name: String(f.properties.name),
  name_zh: String(f.properties.name_zh),
  path: path(f as unknown as GeoPermissibleObjects) ?? '',
}));
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 390"><defs>${countries.map((f) => `<path id="country-${f.code}" d="${f.path}"/>`).join('')}</defs></svg>`;
const hash = createHash('sha256').update(svg).digest('hex').slice(0, 12);
await mkdir('public/maps', { recursive: true });
await writeFile(`public/maps/world-${hash}.svg`, svg);
await writeFile(
  'src/data/world-paths.json',
  JSON.stringify({ asset: `/maps/world-${hash}.svg`, countries }),
);
console.log(`World geometry: ${Buffer.byteLength(svg)} bytes; ${countries.length} countries`);
