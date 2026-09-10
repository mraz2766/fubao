import type { Location } from '../../types/domain';
import { all, first } from '../db';
import { HttpError } from '../http';
export async function getLocation(id: string) {
  return first<Location>(
    'SELECT id,kind,country_code,country_name,country_name_zh,region,city,name,name_zh,latitude,longitude FROM locations WHERE id=?',
    id,
  );
}
export async function searchLocations(params: URLSearchParams) {
  const spotId = params.get('spot');
  if (spotId) {
    const item = await first<Location>(
      'SELECT l.*,s.id spot_id,s.name_zh,s.name_en name,s.latitude,s.longitude FROM scenic_spots s JOIN locations l ON l.id=s.location_id WHERE s.id=?',
      spotId,
    );
    if (!item) throw new HttpError(404, 'NOT_FOUND');
    return { items: [item] };
  }
  const q = (params.get('q') ?? '')
    .trim()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .slice(0, 100);
  if (!q) return { items: [] };
  const preferCountry = (params.get('preferCountry') ?? '').toUpperCase();
  if (preferCountry && !/^[A-Z]{2}$/.test(preferCountry)) throw new HttpError(400, 'INVALID_INPUT');
  const limit = Math.max(1, Math.min(50, Number(params.get('limit')) || 20));
  const escaped = q.replace(/[\\%_]/g, '\\$&');
  const items = await all<Location>(
    `SELECT DISTINCT l.id,l.kind,l.country_code,l.country_name,l.country_name_zh,l.region,l.city,l.name,l.name_zh,l.latitude,l.longitude FROM location_aliases a JOIN locations l ON l.id=a.location_id WHERE a.alias LIKE ? ESCAPE '\\' ORDER BY CASE WHEN a.alias=? THEN 0 ELSE 1 END,CASE WHEN l.country_code=? THEN 0 ELSE 1 END,CASE l.kind WHEN 'city' THEN 0 WHEN 'region' THEN 1 ELSE 2 END,l.name LIMIT ?`,
    escaped + '%',
    q,
    preferCountry,
    limit,
  );
  const spots = await all<Location>(
    'SELECT l.*,s.id spot_id,s.name_zh,s.name_en name,s.latitude,s.longitude FROM scenic_spots s JOIN locations l ON l.id=s.location_id WHERE s.name_zh LIKE ? OR s.name_en LIKE ? LIMIT 8',
    '%' + escaped + '%',
    '%' + escaped + '%',
  );
  return { items: [...spots, ...items].slice(0, limit) };
}
export async function nearbyLocations(params: URLSearchParams) {
  const lat = Number(params.get('lat')),
    lng = Number(params.get('lng'));
  if (
    !params.has('lat') ||
    !params.has('lng') ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    Math.abs(lat) > 90 ||
    Math.abs(lng) > 180
  )
    throw new HttpError(400, 'INVALID_INPUT');
  const candidates = await all<Location>(
    `SELECT id,kind,country_code,country_name,country_name_zh,region,city,name,name_zh,latitude,longitude FROM locations WHERE kind='city' AND latitude BETWEEN ? AND ? AND longitude BETWEEN ? AND ? ORDER BY ((latitude-?)*(latitude-?)+(longitude-?)*(longitude-?)) LIMIT 50`,
    lat - 1,
    lat + 1,
    lng - 1,
    lng + 1,
    lat,
    lat,
    lng,
    lng,
  );
  const distance = (l: Location) => {
    const rad = Math.PI / 180,
      a = (l.latitude! - lat) * rad,
      b = (l.longitude! - lng) * rad;
    return (
      2 *
      6371 *
      Math.asin(
        Math.sqrt(
          Math.sin(a / 2) ** 2 +
            Math.cos(lat * rad) * Math.cos(l.latitude! * rad) * Math.sin(b / 2) ** 2,
        ),
      )
    );
  };
  return {
    items: candidates
      .map((l) => ({ ...l, distance_km: distance(l) }))
      .filter((l) => l.distance_km <= 50)
      .sort((a, b) => a.distance_km - b.distance_km)
      .slice(0, 5),
  };
}

export function exportLocations() {
  let cursor = '';
  let started = false;
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        if (!started) {
          started = true;
          controller.enqueue(
            encoder.encode(
              JSON.stringify({
                type: 'metadata',
                license: 'ODbL-1.0',
                attribution: 'Data by Countries States Cities Database',
                source: 'https://github.com/dr5hn/countries-states-cities-database',
                transformation: 'scripts/import-locations.ts',
              }) + '\n',
            ),
          );
          return;
        }
        const rows = await all<Location & { source_commit: string; aliases: string }>(
          `SELECT l.id,l.kind,l.country_code,l.country_name,l.country_name_zh,l.region,l.city,l.name,l.name_zh,l.latitude,l.longitude,l.source_commit,(SELECT json_group_array(alias) FROM location_aliases a WHERE a.location_id=l.id) aliases FROM locations l WHERE l.id>? ORDER BY l.id LIMIT 5000`,
          cursor,
        );
        if (!rows.length) {
          controller.close();
          return;
        }
        cursor = rows[rows.length - 1].id;
        controller.enqueue(
          encoder.encode(
            rows.map((r) => JSON.stringify({ ...r, aliases: JSON.parse(r.aliases) })).join('\n') +
              '\n',
          ),
        );
      } catch (error) {
        controller.error(error);
      }
    },
  });
  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Content-Disposition': 'attachment; filename="fubao-locations-ODbL.ndjson"',
      'Cache-Control': 'no-store',
    },
  });
}
