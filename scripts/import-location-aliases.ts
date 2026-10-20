import { executeSQL } from './data-utils';
import { locationFixSQL } from './location-fixes';
export async function importLocationAliases() {
  // The source represents China's four direct-administered cities as regions only.
  // Keep those regions and derive stable city-level locations for visit statistics.
  const queries: string[] = [
    `INSERT OR IGNORE INTO locations(id,source_id,kind,parent_id,country_code,country_name,country_name_zh,region,city,name,name_zh,latitude,longitude,search_name,source_commit) SELECT 'city-municipality-'||source_id,source_id,'city',id,country_code,country_name,country_name_zh,name,name,name,name_zh,latitude,longitude,search_name,source_commit FROM locations WHERE country_code='CN' AND kind='region' AND name IN ('Shanghai','Beijing','Tianjin','Chongqing');`,
    `INSERT OR IGNORE INTO location_aliases(location_id,alias) SELECT id,search_name FROM locations WHERE id LIKE 'city-municipality-%';`,
    ...locationFixSQL(),
  ];
  await executeSQL(queries, 'location-aliases');
}
if (process.argv[1]?.endsWith('import-location-aliases.ts')) await importLocationAliases();
