import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const headers = { Origin: 'http://127.0.0.1:4321', 'X-Fubao-CSRF': '1' };
test.beforeEach(async ({ page }) => {
  expect(
    (
      await page.request.post('/api/auth/login', {
        headers,
        data: { username: 'fubao', password: 'fubao' },
      })
    ).ok(),
  ).toBe(true);
});
test('inline workout saves optional fields once and edits without navigation', async ({ page }) => {
  const ids: string[] = [];
  try {
    await page.goto('/fitness');
    await expect(page.getByRole('button', { name: '保存训练', exact: true })).toBeEnabled();
    await expect(page.locator('.section-tabs')).toHaveCount(0);
    await page.getByRole('button', { name: '背部', exact: true }).click();
    await expect(page.getByRole('button', { name: '背部', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    const save = page.waitForResponse(
      (r) => r.url().includes('/api/fitness/sessions/') && r.request().method() === 'PUT',
    );
    await page.getByRole('button', { name: '保存训练', exact: true }).click();
    const response = await save;
    expect(response.ok()).toBe(true);
    const workout = await response.json();
    ids.push(workout.id);
    expect(workout.duration_seconds).toBeNull();
    expect(workout.exercises).toEqual([]);
    expect(workout.status).toBe('completed');
    await expect(page).toHaveURL(/\/fitness$/);
    await expect(page.locator('.journal-success')).toHaveText('已保存');
    await page.locator('.journal-row').filter({ hasText: '背部' }).first().click();
    await expect(page.getByRole('button', { name: '完成编辑', exact: true })).toBeVisible();
    await page.getByRole('button', { name: '添加动作', exact: true }).click();
    await expect(page.getByRole('button', { name: '完成编辑', exact: true })).toBeVisible();
    await expect(
      page.locator('.workout-picker').getByRole('textbox', { name: '搜索', exact: true }),
    ).toBeVisible();
    await page.getByRole('button', { name: '添加动作', exact: true }).click();
    await page.getByRole('button', { name: '完成编辑', exact: true }).click();
    await expect(page.getByRole('button', { name: '保存训练', exact: true })).toBeVisible();
    await page.reload();
    await expect(page.locator('.journal-row').filter({ hasText: '背部' }).first()).toBeVisible();
  } finally {
    for (const id of ids) await page.request.delete(`/api/fitness/sessions/${id}`, { headers });
  }
});
test('main pages are compact, accessible and responsive', async ({ page }) => {
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    for (const path of ['/', '/fitness', '/travel']) {
      await page.goto(path);
      if (path === '/fitness')
        await expect(page.getByRole('button', { name: '保存训练', exact: true })).toBeEnabled();
      if (path === '/travel')
        await expect(page.getByRole('button', { name: '保存旅行', exact: true })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      if (width === 390)
        await page.screenshot({
          path: `output/playwright/inline-${path === '/' ? 'home' : path.slice(1)}.png`,
          fullPage: true,
        });
      if (width === 390) {
        const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
        expect(result.violations).toEqual([]);
      }
    }
  }
});

test('travel saves one photo without dates and updates records in place', async ({
  page,
  request,
}) => {
  let id = '';
  try {
    await page.goto('/travel');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.getByLabel('地点', { exact: true }).fill('shanghai');
    await page
      .getByRole('button')
      .filter({ has: page.getByText('上海', { exact: true }) })
      .first()
      .click();
    await page.locator('input[type=file]').setInputFiles('tests/fixtures/photo.jpg');
    await page.getByLabel('旅行描述', { exact: true }).fill('Inline journal test');
    const button = page.getByRole('button', { name: '保存旅行', exact: true });
    await expect(button).toBeEnabled();
    const response = page.waitForResponse(
      (r) => r.url().endsWith('/api/travel/entries') && r.request().method() === 'POST',
    );
    await button.click();
    const result = await response;
    expect(result.ok()).toBe(true);
    const trip = await result.json();
    id = trip.id;
    expect(trip.start_date).toBeNull();
    expect(trip.photos).toHaveLength(1);
    await expect(page).toHaveURL(/\/travel$/);
    await expect(
      page.locator('.travel-card').filter({ hasText: 'Inline journal test' }),
    ).toBeVisible();
    expect((await request.get(`/api/media/${trip.photos[0].id}/large`)).status()).toBe(404);
    await page.getByRole('button', { name: '查看地图', exact: true }).click();
    await expect(page.locator('.china-map')).toBeVisible();
    await page
      .locator('.travel-card')
      .filter({ hasText: 'Inline journal test' })
      .getByRole('button', { name: '编辑', exact: true })
      .click();
    await expect(page.getByLabel('旅行描述', { exact: true })).toHaveValue('Inline journal test');
    await page.getByLabel('旅行描述', { exact: true }).fill('Edited in place');
    await button.click();
    await expect(page.locator('.travel-card').filter({ hasText: 'Edited in place' })).toHaveCount(
      1,
    );
  } finally {
    if (id) await page.request.delete(`/api/travel/entries/${id}`, { headers });
    await page.request.post('/api/travel/cleanup', { headers, data: {} });
  }
});

test('related exercise selection, optional sets and dated backfill stay in the form', async ({
  page,
}) => {
  let id = '';
  try {
    await page.goto('/fitness');
    await page.getByLabel('选择日期', { exact: true }).fill('2024-02-12');
    await page.getByRole('button', { name: '背部', exact: true }).click();
    await page.getByRole('button', { name: '添加动作', exact: true }).click();
    await expect(
      page.locator('.workout-picker').getByRole('button', { name: '相关动作', exact: true }),
    ).toHaveAttribute('aria-pressed', 'true');
    await page.locator('.workout-picker .exercise-open').first().click();
    await expect(page.locator('.set-exercise')).toHaveCount(1);
    await expect(page.locator('.workout-picker')).toHaveCount(0);
    await page.getByRole('button', { name: '记一组', exact: true }).first().click();
    const response = page.waitForResponse(
      (r) => r.url().includes('/api/fitness/sessions/') && r.request().method() === 'PUT',
    );
    await page.getByRole('button', { name: '保存训练', exact: true }).click();
    const result = await response;
    expect(result.ok()).toBe(true);
    const workout = await result.json();
    id = workout.id;
    expect(workout.workout_date).toBe('2024-02-12');
    expect(workout.exercises[0].sets.filter((s: any) => s.completed)).toHaveLength(1);
    expect(workout.exercises[0].sets[0].weight).toBeNull();
    expect(workout.exercises[0].sets[0].reps).toBeNull();
    await expect(page).toHaveURL(/\/fitness$/);
  } finally {
    if (id) await page.request.delete(`/api/fitness/sessions/${id}`, { headers });
  }
});

test('lost save receipt retries the same workout without losing input', async ({ page }) => {
  let id = '',
    mutation = '',
    dropped = false;
  try {
    await page.goto('/fitness');
    await page.getByRole('button', { name: '背部', exact: true }).click();
    await page.route('**/api/fitness/sessions/*/complete', async (route) => {
      const data = route.request().postDataJSON();
      if (!dropped) {
        id = data.id;
        mutation = data.mutation_id;
        dropped = true;
        expect((await route.fetch()).ok()).toBe(true);
        await route.abort();
      } else {
        expect(data.id).toBe(id);
        expect(data.mutation_id).toBe(mutation);
        await route.continue();
      }
    });
    await page.getByRole('button', { name: '保存训练', exact: true }).click();
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.getByRole('button', { name: '背部', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await page.getByRole('button', { name: '保存训练', exact: true }).click();
    await expect(page.locator('.journal-success')).toBeVisible();
    const day = await (
      await page.request.get(
        `/api/fitness/day?date=${new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Shanghai' })}`,
      )
    ).json();
    expect(day.items.filter((w: any) => w.id === id)).toHaveLength(1);
  } finally {
    if (id) await page.request.delete(`/api/fitness/sessions/${id}`, { headers });
  }
});

test('English and dark reduced-motion forms remain readable on mobile', async ({
  page,
  context,
}) => {
  const prior = await (await page.request.get('/api/settings')).json();
  try {
    await page.request.patch('/api/settings', {
      headers,
      data: { preferences: { theme: 'dark' } },
    });
    await context.addCookies([
      { name: 'fubao.locale', value: 'en-US', url: 'http://127.0.0.1:4321' },
    ]);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 320, height: 844 });
    for (const path of ['/', '/fitness', '/travel']) {
      await page.goto(path);
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      const audit = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
      expect(audit.violations).toEqual([]);
    }
  } finally {
    await page.request.put('/api/settings', { headers, data: prior });
  }
});
