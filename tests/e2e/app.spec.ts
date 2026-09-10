import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const headers = { Origin: 'http://127.0.0.1:4321', 'X-Fubao-CSRF': '1' };
test('public navigation, mobile layout and accessibility', async ({ page }) => {
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await expect(page.getByRole('heading', { name: '今日', exact: true })).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  for (const url of ['/fitness', '/travel', '/settings', '/login']) {
    await page.goto(url);
    await page.waitForLoadState('networkidle');
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    expect(results.violations).toEqual([]);
  }
});
test('owner quick check-in remains private until published', async ({ page, request }) => {
  await page.goto('/login');
  await page.getByLabel('用户名', { exact: true }).fill('fubao');
  await page.getByLabel('密码', { exact: true }).fill('fubao');
  await page.getByRole('button', { name: '进入 Fubao' }).click();
  await expect(page).toHaveURL('/');
  await page.goto('/fitness');
  const receipt = page.waitForResponse(
    (r) => r.url().endsWith('/api/fitness/checkin') && r.request().method() === 'POST',
  );
  await page.getByRole('button', { name: '背部', exact: true }).click();
  const saved = await (await receipt).json(),
    id = saved.id;
  try {
    expect(saved.time_precision).toBe('date');
    expect(saved.end_at).toBeNull();
    expect(saved.duration_seconds).toBeNull();
    expect((await request.get(`/api/fitness/sessions/${id}`)).status()).toBe(404);
    await page.getByRole('button', { name: '补充记录', exact: true }).click();
    await page.locator('summary').filter({ hasText: '可见范围' }).click();
    await page.getByLabel('可见范围').selectOption('public');
    await page.locator('.record-footer').getByRole('button', { name: '保存', exact: true }).click();
    await expect(page.locator('.workout-workspace')).toHaveCount(0);
    expect((await request.get(`/api/fitness/sessions/${id}`)).status()).toBe(200);
  } finally {
    await page.request.delete(`/api/fitness/sessions/${id}`, { headers });
  }
});
test('photo upload creates a private trip and protects direct photo URLs', async ({
  page,
  request,
}) => {
  const login = await page.request.post('/api/auth/login', {
    headers,
    data: { username: 'fubao', password: 'fubao' },
  });
  expect(login.ok()).toBe(true);
  await page.goto('/travel?new=1');
  await page.getByLabel('地点', { exact: true }).fill('Shanghai');
  await page
    .getByRole('button')
    .filter({ has: page.getByText('上海', { exact: true }) })
    .first()
    .click();
  const png = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 900;
    canvas.height = 600;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#48634c';
    ctx.fillRect(0, 0, 900, 600);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  await page.locator('input[type=file]').setInputFiles({
    name: 'test-memory.png',
    mimeType: 'image/png',
    buffer: Buffer.from(png, 'base64'),
  });
  await expect(page.getByRole('button', { name: '保存', exact: true })).toBeEnabled({
    timeout: 30000,
  });
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page).toHaveURL(/\/travel\/[a-f0-9-]+$/);
  const id = new URL(page.url()).pathname.split('/').at(-1)!;
  try {
    const trip = await (await page.request.get(`/api/travel/entries/${id}`)).json();
    expect((await request.get(`/api/media/${trip.photos[0].id}/large`)).status()).toBe(404);
    expect((await page.request.get(`/api/media/${trip.photos[0].id}/large`)).status()).toBe(200);
    await page.getByRole('button', { name: '上海', exact: true }).first().click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    let current = trip;
    for (const visibility of ['public', 'private']) {
      const response = await page.request.put(`/api/travel/entries/${id}`, {
        headers,
        data: {
          ...current,
          visibility,
          photo_ids: current.photos.map((p: { id: string }) => p.id),
        },
      });
      expect(response.ok()).toBe(true);
      current = await response.json();
      expect((await request.get(`/api/media/${trip.photos[0].id}/large`)).status()).toBe(
        visibility === 'public' ? 200 : 404,
      );
    }
  } finally {
    await page.request.delete(`/api/travel/entries/${id}`, { headers });
    await page.request.post('/api/travel/cleanup', { headers, data: {} });
  }
});
test('English and Chinese, both themes, responsive pages and reduced motion', async ({
  page,
  context,
}) => {
  test.setTimeout(180000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const locale of ['zh-CN', 'en-US']) {
    for (const theme of ['light', 'dark']) {
      await context.addCookies([
        { name: 'fubao.locale', value: locale, url: 'http://127.0.0.1:4321' },
        {
          name: 'fubao.display',
          value: encodeURIComponent(JSON.stringify({ theme })),
          url: 'http://127.0.0.1:4321',
        },
      ]);
      for (const width of [320, 390, 768, 1024, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        for (const url of ['/', '/fitness', '/travel', '/settings']) {
          await page.goto(url);
          await page.waitForLoadState('networkidle');
          expect(
            await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
            `${locale} ${theme} ${width} ${url}`,
          ).toBe(true);
          expect(await page.locator('html').getAttribute('lang')).toBe(locale);
        }
      }
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze();
      expect(
        results.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
      ).toEqual([]);
      await page.goto('/');
      await page.screenshot({
        path: `output/playwright/home-${locale}-${theme}-desktop.png`,
        fullPage: true,
      });
      await page.setViewportSize({ width: 390, height: 844 });
      await page.screenshot({
        path: `output/playwright/home-${locale}-${theme}-mobile.png`,
        fullPage: true,
      });
    }
  }
});
