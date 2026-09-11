import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const headers = { Origin: 'http://127.0.0.1:4321', 'X-Fubao-CSRF': '1' };
test('domestic scenery, wishlist and visit prefill keep catalog photos separate', async ({
  page,
  request,
}) => {
  page.setDefaultTimeout(10000);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    (
      await page.request.post('/api/auth/login', {
        headers,
        data: { username: 'fubao', password: 'fubao' },
      })
    ).ok(),
  ).toBe(true);
  let wishId: string | undefined;
  try {
    await page.goto('/travel?view=discover');
    await page.getByRole('button', { name: '漓江·阳朔', exact: true }).first().click();
    await expect(page.getByRole('dialog')).toBeVisible();
    const added = await page.getByRole('button', { name: '添加心愿', exact: true }).isVisible();
    if (added) await page.getByRole('button', { name: '添加心愿', exact: true }).click();
    await expect(page.getByRole('button', { name: '已加入想去' })).toBeVisible();
    const wishlist = await (await page.request.get('/api/travel/wishlist')).json();
    const currentWish = wishlist.items.find((w: any) => w.spot_id === 'li-river');
    if (added) wishId = currentWish.id;
    expect(
      (await (await request.get('/api/travel/wishlist')).json()).items.some(
        (w: any) => w.id === currentWish.id,
      ),
    ).toBe(false);
    await page.getByRole('link', { name: '记录旅行', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText('漓江·阳朔', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '保存', exact: true })).toBeDisabled();
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    expect(
      results.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
    ).toEqual([]);
  } finally {
    if (wishId) await page.request.delete(`/api/travel/wishlist/${wishId}`, { headers });
  }
});
