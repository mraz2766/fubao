import geometry from '../../data/china-map.json';
import type { Locale, Trip, Wish } from '../../types/domain';

export function chinaPlaces(trips: Trip[], wishes: Wish[], locale: Locale) {
  const places = new Map<
    string,
    { id: string; name: string; visited: boolean; href: string; point: [number, number] | null }
  >();
  for (const entry of [...trips, ...wishes]) {
    if (entry.location.country_code !== 'CN') continue;
    const visited = 'photos' in entry;
    const id = entry.spot_id ?? entry.location_id;
    if (places.has(id)) continue;
    const { latitude: lat, longitude: lng } = entry.location;
    const point: [number, number] | null =
      lat !== null &&
      lng !== null &&
      Number.isFinite(lat) &&
      Number.isFinite(lng) &&
      Math.abs(lat) < 85.051129 &&
      Math.abs(lng) <= 180
        ? [
            geometry.translate[0]! + (geometry.scale * lng * Math.PI) / 180,
            geometry.translate[1]! -
              geometry.scale * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)),
          ]
        : null;
    places.set(id, {
      id,
      visited,
      point,
      name:
        locale === 'zh-CN' ? entry.location.name_zh || entry.location.name : entry.location.name,
      href: visited
        ? '/travel/' + entry.id
        : entry.spot_id
          ? '/travel?view=discover&spot=' + encodeURIComponent(entry.spot_id)
          : '/travel?view=wishlist',
    });
  }
  return [...places.values()];
}
