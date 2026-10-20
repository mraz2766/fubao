import type { Location, Trip, Wish } from '../../types/domain';
import { api } from '../../lib/api';
import { invalidate } from '../core/query';
import spotsJson from '../../data/scenic-spots.json';

export type { Trip, Wish, Location };
export interface AtlasItem {
  id: string;
  country_code: string;
  kind: Location['kind'];
  location_id: string;
  latitude: number | null;
  longitude: number | null;
  name: string;
  name_zh: string;
  start_date: string | null;
  end_date: string | null;
  photo: string | null;
}
export interface Spot {
  id: string;
  name_zh: string;
  name_en: string;
  region: string;
  region_en: string;
  city: string;
  latitude: number;
  longitude: number;
  category: string;
  description_zh: string;
  description_en: string;
  image: {
    src: string;
    thumbnail: string;
    title: string;
    source: string;
    artist: string;
    license: string;
    licenseUrl: string;
    width: number;
    height: number;
  };
}
export const spots = spotsJson as unknown as Spot[];
export const keys = {
  atlas: '/api/travel/atlas',
  entries: (page = 0) => `/api/travel/entries?page=${page}`,
  entry: (id: string) => `/api/travel/entries/${id}`,
  wishlist: '/api/travel/wishlist',
  recent: '/api/travel/recent-locations',
  dashboard: '/api/dashboard',
};
export interface Page<T> {
  items: T[];
  hasMore: boolean;
}
export const refreshTravel = () => invalidate('/api/travel', '/api/dashboard');

export interface TripInput {
  id: string;
  location_id: string;
  spot_id: string | null;
  place_name: string;
  start_date: string | null;
  end_date: string | null;
  description: string;
  tags: string[];
  rating: number | null;
  visibility: 'private' | 'public';
  photo_ids: string[];
  updated_at?: string;
}
export async function saveTrip(input: TripInput) {
  const saved = await api<Trip>('/api/travel/entries', { method: 'POST', body: input });
  refreshTravel();
  return saved;
}
export async function deleteTrip(id: string) {
  await api(`/api/travel/entries/${id}`, { method: 'DELETE' });
  refreshTravel();
}
export async function addWish(location: Location) {
  await api('/api/travel/wishlist', {
    method: 'POST',
    body: {
      id: crypto.randomUUID(),
      location_id: location.id,
      spot_id: location.spot_id ?? null,
      visibility: 'private',
    },
  });
  invalidate(keys.wishlist);
}
export async function removeWish(id: string) {
  await api(`/api/travel/wishlist/${id}`, { method: 'DELETE' });
  invalidate(keys.wishlist);
}
export async function spotLocation(id: string) {
  const { items } = await api<{ items: Location[] }>(
    `/api/locations?spot=${encodeURIComponent(id)}`,
  );
  return items[0]!;
}
export const manualLocation = (name: string): Location => ({
  id: 'manual-place',
  kind: 'region',
  country_code: '',
  country_name: '',
  country_name_zh: '',
  region: '',
  city: '',
  name,
  name_zh: name,
  latitude: null,
  longitude: null,
});
