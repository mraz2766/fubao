import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { expect, it, vi } from 'vitest';
const source = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');
function worker(offline = new Response('Offline', { headers: { 'Content-Type': 'text/html' } })) {
  const listeners = new Map<string, (event: any) => void>();
  const fetch = vi.fn().mockRejectedValue(new TypeError('offline'));
  const caches = { match: vi.fn().mockResolvedValue(offline), open: vi.fn() };
  runInNewContext(source, {
    self: {
      location: { origin: 'https://fubao.example' },
      addEventListener: (name: string, handler: (event: any) => void) =>
        listeners.set(name, handler),
    },
    URL,
    Response,
    fetch,
    caches,
  });
  return { listeners, fetch, caches };
}
it('serves a fresh offline response even when Workers Assets cached an HTML redirect', async () => {
  const cached = new Response('<h1>Offline</h1>', { headers: { 'Content-Type': 'text/html' } });
  Object.defineProperty(cached, 'redirected', { value: true });
  const { listeners } = worker(cached);
  let result: Promise<Response> | undefined;
  listeners.get('fetch')!({
    request: {
      method: 'GET',
      url: 'https://fubao.example/fitness',
      mode: 'navigate',
      redirect: 'manual',
    },
    respondWith: (p: Promise<Response>) => {
      result = p;
    },
  });
  const response = await result!;
  expect(response.redirected).toBe(false);
  expect(response.status).toBe(200);
  expect(await response.text()).toContain('Offline');
});
it('does not intercept private media, API requests, writes or cross-origin resources', () => {
  const { listeners, caches, fetch } = worker();
  const respondWith = vi.fn();
  for (const [url, method] of [
    ['https://fubao.example/api/fitness/sessions', 'GET'],
    ['https://fubao.example/api/media/private/large', 'GET'],
    ['https://fubao.example/api/travel/entries', 'POST'],
    ['https://other.example/_astro/app.js', 'GET'],
  ])
    listeners.get('fetch')!({ request: { url, method, mode: 'cors' }, respondWith });
  expect(respondWith).not.toHaveBeenCalled();
  expect(caches.open).not.toHaveBeenCalled();
  expect(fetch).not.toHaveBeenCalled();
});
