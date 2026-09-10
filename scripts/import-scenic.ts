import { readFile } from 'node:fs/promises';
import { executeSQL, sql } from './data-utils';
const spots = JSON.parse(await readFile('src/data/scenic-spots.json', 'utf8')) as {
  id: string;
  name_zh: string;
  name_en: string;
  city: string;
  region_en: string;
  latitude: number;
  longitude: number;
}[];
const queries = spots.map(
  (s) =>
    `INSERT INTO scenic_spots(id,location_id,name_zh,name_en,latitude,longitude) SELECT ${sql(s.id)},id,${sql(s.name_zh)},${sql(s.name_en)},${s.latitude},${s.longitude} FROM locations WHERE country_code='CN' AND ((kind='city' AND name=${sql(s.city)}) OR (kind='region' AND name LIKE ${sql(s.region_en + '%')})) ORDER BY CASE kind WHEN 'city' THEN 0 ELSE 1 END LIMIT 1 ON CONFLICT(id) DO UPDATE SET location_id=excluded.location_id,name_zh=excluded.name_zh,name_en=excluded.name_en,latitude=excluded.latitude,longitude=excluded.longitude;`,
);
await executeSQL(queries, 'scenic-spots');
