import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { executeSQL, sql, sourceSQL, dryRun } from './data-utils';
const manifest = JSON.parse(await readFile('data/exercise-media-mapping.json', 'utf8')) as {
  repository: string;
  commit: string;
  license: string;
  mappings: { exerciseId: string; sourceId: string; name: string; equipment: string }[];
};
const base = `https://raw.githubusercontent.com/${manifest.repository}/${manifest.commit}/`;
async function download(path: string) {
  const cache = `data/cache/exercise-media/${manifest.commit}/${path}`;
  try {
    return await readFile(cache);
  } catch {
    const response = await fetch(base + path);
    if (!response.ok) throw new Error(`Download ${path}: ${response.status}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    await mkdir(cache.slice(0, cache.lastIndexOf('/')), { recursive: true });
    await writeFile(cache, bytes);
    return bytes;
  }
}
const bytes = await download('dist/exercises.json');
const catalog = JSON.parse(bytes.toString()) as {
  id: string;
  images: string[];
  equipment: string;
}[];
const hash = (b: Buffer) => createHash('sha256').update(b).digest('hex');
const records: Record<
  string,
  { thumbnail: string; images: string[]; attribution: string; sourceId: string; sha256: string[] }
> = {};
const queries: string[] = [];
for (const mapping of manifest.mappings) {
  const exercise = catalog.find((e) => e.id === mapping.sourceId);
  if (!exercise || exercise.images.length < 2)
    throw new Error(`Missing source: ${mapping.sourceId}`);
  const equipment = exercise.equipment === 'body only' ? 'body weight' : exercise.equipment;
  if (equipment !== mapping.equipment) throw new Error(`Equipment mismatch: ${mapping.exerciseId}`);
  const folder = `public/exercises/${mapping.exerciseId}`;
  const images: string[] = [],
    hashes: string[] = [];
  if (!dryRun) await mkdir(folder, { recursive: true });
  for (let i = 0; i < 2; i++) {
    const original = await download(`exercises/${exercise.images[i]}`);
    hashes.push(hash(original));
    const large = await sharp(original)
      .resize({ width: 640, height: 640, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();
    if (!dryRun) await writeFile(`${folder}/${i}.webp`, large);
    if (i === 0 && !dryRun)
      await writeFile(
        `${folder}/thumbnail.webp`,
        await sharp(original).resize(160, 160, { fit: 'inside' }).webp({ quality: 75 }).toBuffer(),
      );
    images.push(`/exercises/${mapping.exerciseId}/${i}.webp`);
  }
  const attribution = `Free Exercise DB · ${manifest.license}`;
  records[mapping.exerciseId] = {
    thumbnail: `/exercises/${mapping.exerciseId}/thumbnail.webp`,
    images,
    attribution,
    sourceId: mapping.sourceId,
    sha256: hashes,
  };
  queries.push(
    `INSERT INTO exercise_media(id,exercise_id,image,animation,attribution,license,approved) VALUES(${['free-' + mapping.exerciseId, mapping.exerciseId, records[mapping.exerciseId].thumbnail, null, attribution, manifest.license, 1].map(sql).join(',')}) ON CONFLICT(id) DO UPDATE SET image=excluded.image,attribution=excluded.attribution,license=excluded.license,approved=1;`,
  );
}
const report = {
  commit: manifest.commit,
  sourceSha256: hash(bytes),
  sourceRecords: catalog.length,
  mapped: manifest.mappings.length,
  records,
};
if (!dryRun)
  await writeFile('src/data/exercise-media.json', JSON.stringify(report, null, 2) + '\n');
await executeSQL(
  [
    ...queries,
    sourceSQL(
      'exercise-media',
      {
        url: base + 'dist/exercises.json',
        commit: manifest.commit,
        sha256: hash(bytes),
        license: manifest.license,
      },
      manifest.mappings.length,
    ),
  ],
  'exercise-media',
);
console.log(
  JSON.stringify({ mapped: manifest.mappings.length, sourceRecords: catalog.length, dryRun }),
);
