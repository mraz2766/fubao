import { writeFile, mkdir } from 'node:fs/promises';
import { source, dryRun } from './data-utils';
import { z } from 'zod';
const s = await source('map', 'geojson/ne_110m_admin_0_countries.geojson');
const collection = z
  .object({
    type: z.literal('FeatureCollection'),
    features: z.array(
      z.object({
        type: z.literal('Feature'),
        properties: z.record(z.string(), z.unknown()),
        geometry: z.object({
          type: z.enum(['Polygon', 'MultiPolygon']),
          coordinates: z.array(z.unknown()),
        }),
      }),
    ),
  })
  .parse(JSON.parse(s.content));
const features = collection.features
  .filter((f) => f.properties.ISO_A3 !== 'ATA')
  .map((f) => ({
    type: f.type,
    properties: {
      code: f.properties.ISO_A2_EH !== '-99' ? f.properties.ISO_A2_EH : f.properties.ISO_A2,
      name: f.properties.NAME_EN ?? f.properties.ADMIN,
      name_zh: f.properties.NAME_ZH ?? f.properties.NAME_EN,
    },
    geometry: f.geometry,
  }));
if (!dryRun) {
  await mkdir('src/data', { recursive: true });
  await writeFile('src/data/world.json', JSON.stringify({ type: 'FeatureCollection', features }));
  await writeFile(
    'data/map-manifest.json',
    JSON.stringify({ ...s, content: undefined, count: features.length }, null, 2) + '\n',
  );
}
console.log(
  `${dryRun ? 'Validated' : 'Saved'} ${features.length} countries; source ${s.commit}; SHA256 ${s.sha256}`,
);

if (!dryRun) await import('./render-world-map');
