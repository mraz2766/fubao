import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const headers = { Origin: 'http://127.0.0.1:4321', 'X-Fubao-CSRF': '1' };

test('populated home and domestic travel remain compact across all page families', async ({
  page,
  context,
  request,
}) => {
  test.setTimeout(180000);
  page.setDefaultTimeout(10000);
  await page.request.post('/api/auth/login', {
    headers,
    data: { username: 'fubao', password: 'fubao' },
  });
  const settings = await (await page.request.get('/api/settings')).json();
  const workoutId = crypto.randomUUID();
  let tripId: string | undefined;
  try {
    await page.request.put('/api/settings', {
      headers,
      data: {
        ...settings,
        preferences: { ...settings.preferences, theme: 'light', language: 'zh-CN' },
        widgets: ['fitness', 'travel', 'weekly', 'recent'].map((key, order) => ({
          key,
          order,
          size: 'medium',
          visible: true,
        })),
      },
    });
    const date = new Intl.DateTimeFormat('en-CA', {
      timeZone: settings.preferences.timezone,
    }).format(new Date());
    await page.request.post('/api/fitness/checkin', {
      headers,
      data: { id: workoutId, mutation_id: crypto.randomUUID(), date, part: 'back' },
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/travel?new=1');
    await page.getByLabel('地点', { exact: true }).fill('shanghai');
    await page
      .getByRole('button')
      .filter({ has: page.getByText('上海', { exact: true }) })
      .first()
      .click();
    await page
      .getByRole('dialog')
      .locator('input[type=file]')
      .setInputFiles('public/scenery/li-river-small.webp');
    await expect(page.getByRole('button', { name: '保存', exact: true })).toBeEnabled();
    await page.getByRole('button', { name: '保存', exact: true }).click();
    await expect(page).toHaveURL(/\/travel\/[a-f0-9-]+$/);
    tripId = new URL(page.url()).pathname.split('/').at(-1);
    expect((await request.get('/api/travel/entries/' + tripId)).status()).toBe(404);
    await page.goto('/');
    await expect(page.locator('.sidebar')).toBeHidden();
    await expect(page.locator('.dashboard-fitness')).toBeInViewport({ ratio: 1 });
    const cover = await page.locator('.dashboard-photo img').boundingBox();
    expect(cover).not.toBeNull();
    expect(cover!.y).toBeLessThan(680);
    expect(await page.locator('.progress-ring').count()).toBe(0);
    await page.screenshot({
      path: 'output/playwright/neutral-home-populated-mobile.png',
      fullPage: true,
    });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.reload();
    await expect(page.locator('.sidebar')).toBeVisible();
    await page.screenshot({
      path: 'output/playwright/neutral-home-populated-desktop.png',
      fullPage: true,
    });

    await page.goto('/travel?view=map');
    await expect(page.locator('.map-place-list').getByRole('link', { name: /上海/ })).toBeVisible();
    expect(await page.locator('.china-map svg a').count()).toBeGreaterThan(0);
    // Actual cities are plotted; unrelated catalog destinations aren't added to personal footprints.
    const wishes = await (await page.request.get('/api/travel/wishlist')).json();
    await expect(
      page.locator('.map-place-list').getByText('漓江·阳朔', { exact: true }),
    ).toHaveCount(wishes.items.some((w: { spot_id?: string }) => w.spot_id === 'li-river') ? 1 : 0);
    await page.screenshot({ path: 'output/playwright/neutral-map.png', fullPage: true });

    const urls = [
      '/fitness',
      '/fitness?view=history',
      '/fitness?view=library',
      '/fitness?view=templates',
      '/fitness?view=analytics',
      '/fitness/' + workoutId,
      '/travel',
      '/travel?view=photos',
      '/travel?view=map',
      '/travel?view=wishlist',
      '/travel?view=discover',
      '/travel/' + tripId,
      '/settings',
      '/about',
    ];
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      for (const url of urls) {
        await page.goto(url);
        await page.waitForLoadState('networkidle');
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
          width + ' ' + url,
        ).toBe(true);
      }
    }
    for (const theme of ['light', 'dark']) {
      await page.request.patch('/api/settings', { headers, data: { preferences: { theme } } });
      for (const lang of ['zh-CN', 'en-US']) {
        await context.addCookies([
          { name: 'fubao.locale', value: lang, url: 'http://127.0.0.1:4321' },
        ]);
        for (const url of [
          '/',
          '/fitness?view=library',
          '/travel?view=map',
          '/settings',
          '/about',
        ]) {
          await page.goto(url);
          await page.waitForLoadState('networkidle');
          const results = await new AxeBuilder({ page })
            .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
            .analyze();
          expect(
            results.violations.map((v) => ({ id: v.id, targets: v.nodes.map((n) => n.target) })),
            theme + ' ' + lang + ' ' + url,
          ).toEqual([]);
        }
      }
    }
    await context.addCookies([
      { name: 'fubao.locale', value: 'zh-CN', url: 'http://127.0.0.1:4321' },
    ]);
    await page.setViewportSize({ width: 390, height: 844 });
    for (const [path, name] of [
      ['/', 'home-dark'],
      ['/fitness', 'fitness'],
      ['/travel', 'travel'],
      ['/settings', 'settings'],
    ]) {
      await page.goto(path!);
      await page.waitForLoadState('networkidle');
      await page.screenshot({
        path: 'output/playwright/neutral-' + name + '-mobile.png',
        fullPage: true,
      });
    }
  } finally {
    await page.request.delete('/api/fitness/sessions/' + workoutId, { headers });
    if (tripId) await page.request.delete('/api/travel/entries/' + tripId, { headers });
    await page.request.post('/api/travel/cleanup', { headers, data: {} });
    await page.request.put('/api/settings', { headers, data: settings });
    await page.request.post('/api/auth/logout', { headers, data: {} });
  }
});
