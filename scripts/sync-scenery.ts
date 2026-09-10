import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
const file = 'src/data/scenic-spots.json';
const spots = JSON.parse(await readFile(file, 'utf8')) as {
  id: string;
  image: {
    url: string;
    source_sha256: string;
    src: string;
    thumbnail: string;
    width: number;
    height: number;
  };
}[];
await mkdir('data/cache', { recursive: true });
await mkdir('public/scenery', { recursive: true });
for (const spot of spots) {
  const path = `data/cache/${spot.id}.jpg`;
  let source: Buffer;
  try {
    source = await readFile(path);
  } catch {
    const response = await fetch(spot.image.url);
    if (!response.ok) throw new Error(`${spot.id}: ${response.status}`);
    source = Buffer.from(await response.arrayBuffer());
    await writeFile(path, source);
  }
  if (createHash('sha256').update(source).digest('hex') !== spot.image.source_sha256)
    throw new Error(
      `${spot.id}: source changed; review image and license before updating its checksum`,
    );
  const image = await sharp(source)
    .resize({ width: 1440, withoutEnlargement: true })
    .webp({ quality: 82 })
    .toFile(`public${spot.image.src}`);
  await sharp(source)
    .resize({ width: 640, withoutEnlargement: true })
    .webp({ quality: 77 })
    .toFile(`public${spot.image.thumbnail}`);
  spot.image.width = image.width;
  spot.image.height = image.height;
}
await writeFile(file, JSON.stringify(spots, null, 2) + '\n');
console.log(`Verified and optimized ${spots.length} licensed photographs`);
