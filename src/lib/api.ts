import type { Locale } from '../types/domain';
import { translator, type TranslationKey } from './i18n';
export class ApiFailure extends Error {
  constructor(
    public code: string,
    public fields?: Record<string, string[]>,
  ) {
    super(code);
  }
}
export async function api<T>(
  path: string,
  options: { method?: string; body?: unknown; signal?: AbortSignal } = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      method: options.method ?? 'GET',
      signal: options.signal,
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'X-Fubao-CSRF': '1' },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new ApiFailure('NETWORK');
  }
  const result = (await response.json()) as T & {
    error?: { code?: string; fields?: Record<string, string[]> };
  };
  if (!response.ok) throw new ApiFailure(result.error?.code ?? 'INTERNAL', result.error?.fields);
  return result as T;
}
export function errorText(error: unknown, locale: Locale) {
  const code = error instanceof ApiFailure ? error.code : 'INTERNAL';
  return (
    translator(locale)(`error.${code}` as TranslationKey) ?? translator(locale)('error.INTERNAL')
  );
}
