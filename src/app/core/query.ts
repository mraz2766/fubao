import { useEffect, useState } from 'react';
import { api } from '../../lib/api';

/** Tiny stale-while-revalidate cache so stacked screens re-open instantly. */
interface Entry {
  data?: unknown;
  error?: unknown;
  promise?: Promise<unknown>;
  stale: boolean;
}
const cache = new Map<string, Entry>();
const listeners = new Map<string, Set<() => void>>();
const fetchers = new Map<string, () => Promise<unknown>>();

function emit(key: string) {
  listeners.get(key)?.forEach((fn) => fn());
}
function load(key: string) {
  const entry = cache.get(key) ?? { stale: true };
  if (entry.promise) return entry.promise;
  const fetcher = fetchers.get(key) ?? (() => api(key));
  entry.promise = fetcher()
    .then((data) => cache.set(key, { data, stale: false }))
    .catch((error) => cache.set(key, { data: entry.data, error, stale: false }))
    .finally(() => emit(key));
  cache.set(key, entry);
  return entry.promise;
}

export function useQuery<T>(key: string | null, fetcher?: () => Promise<T>) {
  const [, force] = useState(0);
  if (key && fetcher) fetchers.set(key, fetcher);
  useEffect(() => {
    if (!key) return;
    const fn = () => force((n) => n + 1);
    const set = listeners.get(key) ?? new Set();
    set.add(fn);
    listeners.set(key, set);
    const entry = cache.get(key);
    if (!entry || entry.stale) void load(key);
    return () => {
      set.delete(fn);
    };
  }, [key]);
  const entry = key ? cache.get(key) : undefined;
  return {
    data: entry?.data as T | undefined,
    error: entry?.data === undefined ? entry?.error : undefined,
    loading: !!key && entry?.data === undefined && !entry?.error,
    reload: () => key && refetch(key),
  };
}
function refetch(key: string) {
  const entry = cache.get(key);
  cache.set(key, { data: entry?.data, stale: true });
  if (listeners.get(key)?.size) void load(key);
}
/** Marks matching keys stale and refetches the ones on screen. */
export function invalidate(...prefixes: string[]) {
  for (const key of [...cache.keys()]) if (prefixes.some((p) => key.startsWith(p))) refetch(key);
}
export function setQueryData<T>(key: string, update: (old: T | undefined) => T) {
  const entry = cache.get(key);
  cache.set(key, { data: update(entry?.data as T | undefined), stale: false });
  emit(key);
}
export function clearQueries() {
  cache.clear();
}
