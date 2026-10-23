import type { Location, Preferences, Trip } from '../../types/domain';
import { locale, t, zh } from './i18n';
import { dayKey, shiftDay } from '../../lib/analytics';
import { locationRegion } from '../../lib/i18n';
import { trainingParts, type TrainingPart } from '../../lib/fitness-recording';

export const parts = trainingParts;
export type Part = TrainingPart;
export const partInfo: Record<Part, { zh: string; en: string; color: string }> = {
  chest: { zh: '胸部', en: 'Chest', color: '#ff5b2e' },
  back: { zh: '背部', en: 'Back', color: '#ff8a3d' },
  legs: { zh: '腿部', en: 'Legs', color: '#ff2d6f' },
  shoulders: { zh: '肩部', en: 'Shoulders', color: '#f2b233' },
  arms: { zh: '手臂', en: 'Arms', color: '#b65cff' },
  core: { zh: '核心', en: 'Core', color: '#2f7cf6' },
  cardio: { zh: '有氧', en: 'Cardio', color: '#0f9b8e' },
  other: { zh: '其他', en: 'Other', color: '#8e8c86' },
};
export const partLabel = (p: string) => {
  const info = partInfo[p as Part];
  return info ? t(info.zh, info.en) : p;
};
/** Server-compatible automatic titles (patches regenerate titles only when they match). */
export const partsTitle = (list: string[]) =>
  list
    .map((p) => (locale() === 'en-US' ? partInfo[p as Part]?.en : partInfo[p as Part]?.zh) ?? p)
    .join(' · ');

export const today = (p: Preferences) => dayKey(new Date(), p.timezone);

export function fmtDate(
  date: string,
  opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' },
) {
  return new Intl.DateTimeFormat(locale(), { timeZone: 'UTC', ...opts }).format(
    new Date(`${date.slice(0, 10)}T12:00:00Z`),
  );
}
export function weekdayShort(date: string) {
  return new Intl.DateTimeFormat(locale(), { weekday: 'narrow', timeZone: 'UTC' }).format(
    new Date(`${date}T12:00:00Z`),
  );
}
export function relativeDay(date: string, todayKey: string) {
  if (date === todayKey) return t('今天', 'Today');
  if (date === shiftDay(todayKey, -1)) return t('昨天', 'Yesterday');
  const sameYear = date.slice(0, 4) === todayKey.slice(0, 4);
  return fmtDate(
    date,
    sameYear
      ? { month: 'short', day: 'numeric', weekday: 'short' }
      : { year: 'numeric', month: 'short', day: 'numeric' },
  );
}
export function fmtDuration(seconds: number | null | undefined) {
  if (!seconds) return '';
  const m = Math.round(seconds / 60);
  if (m < 60) return t(`${m} 分钟`, `${m} min`);
  const h = Math.floor(m / 60),
    r = m % 60;
  return r ? t(`${h} 小时 ${r} 分`, `${h}h ${r}m`) : t(`${h} 小时`, `${h}h`);
}
export const kgTo = (kg: number, unit: Preferences['weightUnit']) =>
  unit === 'lb' ? kg * 2.2046226218 : kg;
export const toKgFrom = (v: number, unit: Preferences['weightUnit']) =>
  unit === 'lb' ? v / 2.2046226218 : v;
export const round1 = (v: number) => Math.round(v * 10) / 10;
export function fmtVolume(kg: number, unit: Preferences['weightUnit']) {
  const v = kgTo(kg, unit);
  if (v >= 10000) return `${round1(v / 1000)}${zh() ? ' 吨' : 't'}`;
  return `${Math.round(v).toLocaleString(locale())} ${unit}`;
}

/* ---------- Places ---------- */
export function placeName(l: Location | undefined | null, trip?: Pick<Trip, 'place_name'>) {
  if (trip?.place_name) return trip.place_name;
  if (!l) return '';
  return zh() ? l.name_zh || l.name : l.name || l.name_zh;
}
export function placeContext(l: Location | undefined | null) {
  if (!l || l.id === 'manual-place') return '';
  const country = zh() ? l.country_name_zh || l.country_name : l.country_name;
  const region = locationRegion(l, locale());
  const parts = l.kind === 'country' ? [] : l.kind === 'region' ? [country] : [region, country];
  return [...new Set(parts.filter(Boolean))].filter((p) => p !== placeName(l)).join(' · ');
}
export function tripDates(trip: Pick<Trip, 'start_date' | 'end_date'>) {
  if (!trip.start_date) return t('未记录日期', 'No date');
  const start = trip.start_date,
    end = trip.end_date;
  const y = { year: 'numeric', month: 'short', day: 'numeric' } as const;
  if (!end || end === start) return fmtDate(start, y);
  if (start.slice(0, 4) === end.slice(0, 4))
    return `${fmtDate(start, { month: 'short', day: 'numeric' })} – ${fmtDate(end, y)}`;
  return `${fmtDate(start, y)} – ${fmtDate(end, y)}`;
}
export function tripDays(trip: Pick<Trip, 'start_date' | 'end_date'>) {
  if (!trip.start_date) return 0;
  return (
    Math.round(
      (Date.parse(trip.end_date ?? trip.start_date) - Date.parse(trip.start_date)) / 86400000,
    ) + 1
  );
}
export const photoUrl = (id: string, variant: 'thumbnail' | 'large' = 'thumbnail') =>
  `/api/media/${id}/${variant}`;
export function flag(code: string) {
  if (!/^[A-Z]{2}$/.test(code)) return '';
  return String.fromCodePoint(...[...code].map((c) => 0x1f1a5 + c.charCodeAt(0)));
}
