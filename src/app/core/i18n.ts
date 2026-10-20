import type { Locale } from '../../types/domain';
import { translator, type TranslationKey } from '../../lib/i18n';
import { ApiFailure } from '../../lib/api';

let current: Locale = 'zh-CN';
export const setLocale = (locale: Locale) => {
  current = locale;
  document.documentElement.lang = locale;
};
export const locale = () => current;
export const zh = () => current === 'zh-CN';
/** Inline bilingual copy keeps each string beside its use. */
export const t = (zhText: string, enText: string) => (current === 'zh-CN' ? zhText : enText);

export function errorMessage(error: unknown) {
  const code = error instanceof ApiFailure ? error.code : 'INTERNAL';
  const tr = translator(current);
  return tr(`error.${code}` as TranslationKey) ?? tr('error.INTERNAL');
}
