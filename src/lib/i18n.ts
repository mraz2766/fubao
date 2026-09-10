import zh from '../locales/zh-CN.json';
import en from '../locales/en-US.json';
import type { Locale } from '../types/domain';
export type TranslationKey = keyof typeof zh;
export function translator(locale: Locale) {
  return (key: TranslationKey): string => (locale === 'en-US' ? en[key] : zh[key]) ?? zh[key];
}
export function dateLabel(
  value: string | Date,
  locale: Locale,
  options: Intl.DateTimeFormatOptions = {},
) {
  return new Intl.DateTimeFormat(locale, options).format(new Date(value));
}
export function exerciseName(exercise: { name_en: string; name_zh: string }, locale: Locale) {
  return locale === 'zh-CN' ? exercise.name_zh || exercise.name_en : exercise.name_en;
}

import taxonomy from '../locales/taxonomy.zh-CN.json';
export function taxonomyLabel(value: string, locale: Locale) {
  return locale === 'zh-CN'
    ? ((taxonomy as Record<string, string>)[value.toLowerCase()] ?? value)
    : value;
}
