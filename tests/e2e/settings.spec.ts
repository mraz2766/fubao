import { test, expect } from '@playwright/test';
const headers = { Origin: 'http://127.0.0.1:4321', 'X-Fubao-CSRF': '1' };

test('immediate preferences, retry, independent tabs, language and widget persistence in D1', async ({
  page,
  context,
  request,
}) => {
  page.setDefaultTimeout(10000);
  await page.request.post('/api/auth/login', {
    headers,
    data: { username: 'fubao', password: 'fubao' },
  });
  const initial = await (await page.request.get('/api/settings')).json();
  try {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('button', { name: '保存', exact: true })).toHaveCount(0);
    await expect(page.getByText('突出国家', { exact: false })).toHaveCount(0);
    await page.getByRole('button', { name: '深色', exact: true }).click();
    await expect(page.locator('.settings-save-status')).toContainText('已保存');
    expect((await (await page.request.get('/api/settings')).json()).preferences.theme).toBe('dark');
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await page.waitForLoadState('networkidle');
    await page.route('**/api/settings', (route) =>
      route.request().method() === 'PATCH' ? route.abort() : route.continue(),
    );
    await page.getByRole('button', { name: '浅色', exact: true }).click();
    await expect(page.locator('.settings-save-status').getByRole('button')).toBeVisible();
    expect((await (await page.request.get('/api/settings')).json()).preferences.theme).toBe('dark');
    await page.unroute('**/api/settings');
    await page.locator('.settings-save-status').getByRole('button').click();
    await expect(page.locator('.settings-save-status')).toContainText('已保存');
    expect((await (await page.request.get('/api/settings')).json()).preferences.theme).toBe(
      'light',
    );
    const other = await context.newPage();
    await other.goto('/settings');
    await other.waitForLoadState('networkidle');
    for (const p of [page, other])
      await p.locator('.settings-group > summary').filter({ hasText: '通用' }).click();
    await Promise.all([
      page.getByLabel('重量', { exact: true }).selectOption('lb'),
      other.getByLabel('距离', { exact: true }).selectOption('mile'),
    ]);
    await expect(page.locator('.settings-save-status')).toContainText('已保存');
    await expect(other.locator('.settings-save-status')).toContainText('已保存');
    let saved = await (await page.request.get('/api/settings')).json();
    expect(saved.preferences).toMatchObject({
      weightUnit: 'lb',
      distanceUnit: 'mile',
      mapStyle: initial.preferences.mapStyle,
    });
    await other.close();
    await page.locator('.settings-group > summary').filter({ hasText: '首页模块' }).click();
    await page.getByLabel('训练状态', { exact: true }).uncheck();
    await page.getByLabel('训练状态 尺寸', { exact: true }).selectOption('small');
    await expect(page.locator('.settings-save-status')).toContainText('已保存');
    saved = await (await page.request.get('/api/settings')).json();
    expect(saved.widgets.find((w: any) => w.key === 'fitness')).toMatchObject({
      visible: false,
      size: 'small',
    });
    await page.getByRole('button', { name: '上移 旅行足迹', exact: true }).click();
    await expect(page.locator('.settings-save-status')).toContainText('已保存');
    expect((await (await page.request.get('/api/settings')).json()).widgets[0].key).toBe('travel');
    await page.getByLabel('语言', { exact: true }).selectOption('en-US');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en-US');
    await page.waitForLoadState('networkidle');
    expect((await (await page.request.get('/api/settings')).json()).preferences.language).toBe(
      'en-US',
    );
    expect(
      (
        await request.patch('/api/settings', { headers, data: { preferences: { theme: 'dark' } } })
      ).status(),
    ).toBe(401);
    expect(
      (
        await page.request.patch('/api/settings', { data: { preferences: { theme: 'dark' } } })
      ).status(),
    ).toBe(403);
    expect(
      (
        await page.request.patch('/api/settings', { headers, data: { order: ['fitness'] } })
      ).status(),
    ).toBe(400);
  } finally {
    await page.request.put('/api/settings', { headers, data: initial });
    await page.request.post('/api/auth/logout', { headers, data: {} });
  }
});

test('guest preferences persist locally and system theme follows the operating system', async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/settings');
  await page.waitForLoadState('networkidle');
  const writes: string[] = [];
  page.on('request', (r) => {
    if (r.method() === 'PATCH') writes.push(r.url());
  });
  await page.getByRole('button', { name: '深色', exact: true }).click();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: '跟随系统', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(writes).toEqual([]);
});
