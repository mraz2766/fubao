import { writeFile } from 'node:fs/promises';
import { z } from 'zod';
import { source, executeSQL, sql, sourceSQL, dryRun } from './data-utils';
import { importLocationAliases } from './import-location-aliases';
const countryScope = process.argv
  .find((v) => v.startsWith('--country='))
  ?.split('=')[1]
  ?.toUpperCase();
if (countryScope && !/^[A-Z]{2}$/.test(countryScope)) throw new Error('Invalid country code');
const base = z.object({
  id: z.number(),
  name: z.string().min(1),
  latitude: z.union([z.string(), z.number()]).nullish(),
  longitude: z.union([z.string(), z.number()]).nullish(),
  translations: z.preprocess(
    (v) => (Array.isArray(v) && v.length === 0 ? {} : v),
    z.record(z.string(), z.string().nullable()).nullish(),
  ),
  native: z.string().nullish(),
});
const [countrySource, regionSource, citySource] = await Promise.all([
  source('locations', 'json/countries.json'),
  source('locations', 'json/states.json'),
  source('locations', 'json/countries+states+cities.json'),
]);
const countries = z
  .array(base.extend({ iso2: z.string().length(2) }))
  .parse(JSON.parse(countrySource.content));
const regions = z
  .array(base.extend({ country_id: z.number(), country_code: z.string() }))
  .parse(JSON.parse(regionSource.content))
  .filter((r) => !countryScope || r.country_code === countryScope);
const nested = z
  .array(
    z.object({
      id: z.number(),
      iso2: z.string(),
      states: z.array(z.object({ id: z.number(), cities: z.array(base) })),
    }),
  )
  .parse(JSON.parse(citySource.content));
const cities = nested
  .filter((c) => !countryScope || c.iso2 === countryScope)
  .flatMap((country) =>
    country.states.flatMap((state) =>
      state.cities.map((city) => ({
        ...city,
        country_id: country.id,
        country_code: country.iso2,
        state_id: state.id,
      })),
    ),
  );
const countryMap = new Map(countries.map((c) => [c.id, c])),
  regionMap = new Map(regions.map((r) => [r.id, r]));
const normalize = (v: string) =>
  v
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
const numeric = (v: string | number | null | undefined, max: number) => {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) && Math.abs(n) <= max ? n : null;
};
const queries: string[] = [];
const derived: Record<string, unknown>[] = [];
function add(
  row: z.infer<typeof base>,
  kind: 'country' | 'region' | 'city',
  countryId: number,
  regionId?: number,
) {
  const country = countryMap.get(countryId);
  if (!country) throw new Error(`Missing country ${countryId}`);
  const region = regionId ? regionMap.get(regionId) : undefined;
  const id = `${kind}-${row.id}`,
    nameZh = row.translations?.['zh-CN'] ?? row.translations?.['zh'] ?? '';
  const values = [
    id,
    row.id,
    kind,
    kind === 'country' ? null : kind === 'region' ? `country-${countryId}` : `region-${regionId}`,
    country.iso2,
    country.name,
    country.translations?.['zh-CN'] ?? '',
    region?.name ?? (kind === 'region' ? row.name : ''),
    kind === 'city' ? row.name : '',
    row.name,
    nameZh,
    numeric(row.latitude, 90),
    numeric(row.longitude, 180),
    normalize(row.name),
    countrySource.commit,
  ];
  queries.push(
    `INSERT INTO locations(id,source_id,kind,parent_id,country_code,country_name,country_name_zh,region,city,name,name_zh,latitude,longitude,search_name,source_commit) VALUES(${values.map(sql).join(',')}) ON CONFLICT(id) DO UPDATE SET name=excluded.name,name_zh=excluded.name_zh,country_name=excluded.country_name,country_name_zh=excluded.country_name_zh,region=excluded.region,city=excluded.city,latitude=excluded.latitude,longitude=excluded.longitude,search_name=excluded.search_name,source_commit=excluded.source_commit;`,
  );
  const aliases = [...new Set([row.name, nameZh, row.native ?? ''].filter(Boolean).map(normalize))];
  for (const alias of aliases)
    queries.push(
      `INSERT OR IGNORE INTO location_aliases(location_id,alias) VALUES(${sql(id)},${sql(alias)});`,
    );
  derived.push({
    id,
    kind,
    name: row.name,
    name_zh: nameZh,
    country_code: country.iso2,
    region: region?.name ?? '',
    latitude: numeric(row.latitude, 90),
    longitude: numeric(row.longitude, 180),
    aliases,
  });
}
countries.forEach((c) => add(c, 'country', c.id));
regions.forEach((r) => add(r, 'region', r.country_id));
cities.forEach((c) => add(c, 'city', c.country_id, c.state_id));
console.log(
  JSON.stringify({
    countries: countries.length,
    regions: regions.length,
    cities: cities.length,
    commit: countrySource.commit,
    dryRun,
    scope: countryScope ?? 'global',
  }),
);
await executeSQL(
  [
    ...queries,
    sourceSQL('locations-countries', countrySource, countries.length),
    sourceSQL('locations-regions', regionSource, regions.length),
    sourceSQL('locations-cities', citySource, cities.length),
  ],
  'locations',
);
// This distributable contains only derived geographic data, never personal visits or photos.
await writeFile(
  'data/generated/locations-derived.ndjson',
  derived.map((r) => JSON.stringify(r)).join('\n'),
);
await writeFile(
  'data/generated/locations-LICENSE.txt',
  `ODbL-1.0\nData by Countries States Cities Database\nhttps://github.com/dr5hn/countries-states-cities-database\nSource commit: ${countrySource.commit}\nDerived by the scripts/import-locations.ts transformation distributed with Fubao.\n`,
);
await importLocationAliases();
