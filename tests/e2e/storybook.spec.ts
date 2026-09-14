import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const headers = { Origin: 'http://127.0.0.1:4321', 'X-Fubao-CSRF': '1' };
test('whole-card navigation and photo-first journal remain accessible with real records', async ({
  page,
  request,
}) => {
  let tripId = '';
  const workoutId = crypto.randomUUID();
  try {
    expect(
      (
        await page.request.post('/api/auth/login', {
          headers,
          data: { username: 'fubao', password: 'fubao' },
        })
      ).ok(),
    ).toBe(true);
    const date = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Shanghai' });
    expect(
      (
        await page.request.post('/api/fitness/checkin', {
          headers,
          data: { id: workoutId, mutation_id: crypto.randomUUID(), date, part: 'back' },
        })
      ).ok(),
    ).toBe(true);
    await page.goto('/travel');
    await page.getByLabel('地点', { exact: true }).fill('hangzhou');
    await page.locator('.location-results button').first().click();
    await page.locator('input[type=file]').setInputFiles('public/scenery/west-lake.webp');
    await page.getByLabel('旅行描述', { exact: true }).fill('湖边散步，慢慢看风景。');
    const response = page.waitForResponse(
      (r) => r.url().endsWith('/api/travel/entries') && r.request().method() === 'POST',
    );
    await page.getByRole('button', { name: '保存旅行', exact: true }).click();
    const saved = await response;
    expect(saved.ok()).toBe(true);
    const trip = await saved.json();
    tripId = trip.id;
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/');
      await expect(page.locator('.home-life-card')).toHaveCount(2);
      await expect(page.locator('.home-life-card a,.home-life-card button')).toHaveCount(0);
      await page.waitForFunction(() =>
        document
          .getAnimations()
          .every((a) => a.playState !== 'running' || a.effect?.getTiming().iterations === Infinity),
      );
      await page.screenshot({ path: `output/playwright/story-home-${width}.png`, fullPage: true });
      expect(
        (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations,
      ).toEqual([]);
      await page.locator('.dashboard-fitness').click();
      await expect(page.getByRole('button', { name: '保存训练', exact: true })).toBeVisible();
      await page.waitForFunction(() =>
        document
          .getAnimations()
          .every((a) => a.playState !== 'running' || a.effect?.getTiming().iterations === Infinity),
      );
      await page.screenshot({
        path: `output/playwright/story-fitness-${width}.png`,
        fullPage: true,
      });
      await page.goto('/travel');
      expect(
        await page
          .locator('.travel-grid')
          .evaluate(
            (el) =>
              !!(
                el.compareDocumentPosition(document.querySelector('#record')!) &
                Node.DOCUMENT_POSITION_FOLLOWING
              ),
          ),
      ).toBe(true);
      await page.waitForFunction(() =>
        document
          .getAnimations()
          .every((a) => a.playState !== 'running' || a.effect?.getTiming().iterations === Infinity),
      );
      await page.screenshot({
        path: `output/playwright/story-travel-${width}.png`,
        fullPage: true,
      });
    }
    expect((await request.get(`/api/travel/entries/${tripId}`)).status()).toBe(404);
    expect((await request.get(`/api/media/${trip.photos[0].id}/thumbnail`)).status()).toBe(404);
  } finally {
    if (tripId) await page.request.delete(`/api/travel/entries/${tripId}`, { headers });
    await page.request.delete(`/api/fitness/sessions/${workoutId}`, { headers });
    await page.request.post('/api/travel/cleanup', { headers, data: {} });
  }
});

test('visible optional timestamps allow an overnight workout without another panel', async ({
  page,
}) => {
  let id = '';
  try {
    await page.request.post('/api/auth/login', {
      headers,
      data: { username: 'fubao', password: 'fubao' },
    });
    await page.goto('/fitness');
    await page.getByLabel('开始时间', { exact: true }).fill('2024-02-12T23:30');
    await page.getByLabel('结束时间', { exact: true }).fill('2024-02-13T00:20');
    await page.getByRole('button', { name: '背部', exact: true }).click();
    const response = page.waitForResponse(
      (r) => r.url().includes('/api/fitness/sessions/') && r.request().method() === 'PUT',
    );
    await page.getByRole('button', { name: '保存训练', exact: true }).click();
    const result = await response;
    expect(result.ok()).toBe(true);
    const saved = await result.json();
    id = saved.id;
    expect(saved.time_precision).toBe('exact');
    expect(Date.parse(saved.end_at) - Date.parse(saved.start_at)).toBe(50 * 60 * 1000);
    await expect(page).toHaveURL(/\/fitness$/);
  } finally {
    if (id) await page.request.delete(`/api/fitness/sessions/${id}`, { headers });
  }
});

test('shared paper theme keeps secondary pages keyboard-readable on small screens', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 844 });
  for (const path of ['/settings', '/login', '/about', '/fitness?view=library']) {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    expect(
      (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations,
    ).toEqual([]);
  }
});
