import type { Locale, Trip } from '../types/domain';
export function tripName(trip: Pick<Trip, 'place_name' | 'location'>, locale: Locale) {
  return (
    trip.place_name ||
    (locale === 'zh-CN' ? trip.location.name_zh || trip.location.name : trip.location.name)
  );
}
