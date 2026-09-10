import { geoNaturalEarth1, geoPath, type GeoPermissibleObjects } from 'd3-geo';
import world from '../../data/world.json';
import type { Locale, Trip } from '../../types/domain';
const projection = geoNaturalEarth1().fitExtent(
  [
    [8, 8],
    [792, 382],
  ],
  world as unknown as GeoPermissibleObjects,
);
const path = geoPath(projection);
export const mapCountries = world.features.map((f) => ({
  code: String(f.properties.code),
  name: String(f.properties.name),
  name_zh: String(f.properties.name_zh ?? f.properties.name),
  path: path(f as unknown as GeoPermissibleObjects) ?? '',
}));
export function mapEntries(trips: Trip[], locale: Locale) {
  return trips.map((t) => {
    const l = t.location,
      point =
        l.longitude !== null && l.latitude !== null ? projection([l.longitude, l.latitude]) : null;
    return {
      id: t.id,
      code: l.country_code,
      city: locale === 'zh-CN' ? l.name_zh || l.name : l.name,
      latitude: l.latitude,
      longitude: l.longitude,
      x: point?.[0] ?? null,
      y: point?.[1] ?? null,
      photoId: t.photos[0]?.id,
    };
  });
}
