import { test, expect } from '@playwright/test';
import { gzipSync } from 'node:zlib';
import { writeFile } from 'node:fs/promises';
test('mobile app shell JavaScript budget and controlled loading metrics', async ({
  page,
  context,
}) => {
  const cdp = await context.newCDPSession(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 150,
    downloadThroughput: 200000,
    uploadThroughput: 93750,
  });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await page.addInitScript(() => {
    (window as any).__vitals = { lcp: 0, cls: 0 };
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) (window as any).__vitals.lcp = e.startTime;
    }).observe({ type: 'largest-contentful-paint', buffered: true });
    new PerformanceObserver((list) => {
      for (const e of list.getEntries() as any)
        if (!e.hadRecentInput) (window as any).__vitals.cls += e.value;
    }).observe({ type: 'layout-shift', buffered: true });
  });
  const scripts: Promise<number>[] = [];
  page.on('response', (response) => {
    if (response.request().resourceType() === 'script')
      scripts.push(response.body().then((body) => gzipSync(body).length));
  });
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  const metrics = await page.evaluate(() => (window as any).__vitals);
  const inline = await page.locator('script:not([src])').allTextContents();
  const javascriptGzipBytes =
    (await Promise.all(scripts)).reduce((a, b) => a + b, 0) +
    gzipSync(Buffer.from(inline.join('\n'))).length;
  const result = {
    ...metrics,
    javascriptGzipBytes,
    viewport: '390x844',
    cpuThrottle: 4,
    latencyMs: 150,
    downloadBytesPerSecond: 200000,
    note: 'Local Workers preview, empty database view; not field INP or a physical device result.',
  };
  await writeFile('output/playwright/performance.json', JSON.stringify(result, null, 2));
  expect(javascriptGzipBytes).toBeLessThan(150 * 1024);
  expect(metrics.cls).toBeLessThanOrEqual(0.1);
});

test('deferred map and thumbnail-only discovery avoid unnecessary first-screen downloads', async ({
  page,
}) => {
  const urls: string[] = [];
  page.on('request', (r) => urls.push(r.url()));
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  expect(urls.some((url) => url.includes('/maps/'))).toBe(false);
  await page.locator('.dashboard-map summary').click();
  await expect.poll(() => urls.some((url) => url.includes('/maps/'))).toBe(true);
  const unloaded = await page.locator('use[data-map-href]').count();
  expect(unloaded).toBe(0);
  urls.length = 0;
  await page.goto('/travel');
  await page.waitForLoadState('networkidle');
  const photos = urls.filter((url) => url.includes('/scenery/'));
  expect(photos.length).toBeGreaterThan(0);
  expect(photos.every((url) => url.endsWith('-small.webp'))).toBe(true);
});
