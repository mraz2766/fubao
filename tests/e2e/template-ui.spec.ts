import { test, expect } from '@playwright/test';
const headers = { Origin: 'http://127.0.0.1:4321', 'X-Fubao-CSRF': '1' };
test('mobile template form copies previous weight and opens an active workout', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.request.post('/api/auth/login', {
    headers,
    data: { username: 'fubao', password: 'fubao' },
  });
  let workoutId: string | undefined;
  let templateId: string | undefined;
  const name = `E2E template ${Date.now()}`;
  try {
    await page.goto('/fitness?view=templates');
    await page.getByRole('button', { name: '新建模板' }).click();
    await page.getByLabel('模板名称').fill(name);
    await page.getByRole('button', { name: '添加动作', exact: true }).click();
    await page.getByRole('textbox', { name: '搜索', exact: true }).fill('deadlift');
    await page
      .getByRole('button', { name: /^添加 / })
      .first()
      .click();
    await page.getByLabel('次数', { exact: true }).fill('8');
    await page.getByLabel('重量 kg', { exact: true }).fill('100');
    await page.getByRole('button', { name: '下一组', exact: true }).click();
    await expect(page.getByLabel('重量 kg', { exact: true }).nth(1)).toHaveValue('100');
    await page.getByRole('button', { name: '保存', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    const templates = await (await page.request.get('/api/fitness/templates')).json();
    templateId = templates.items.find((t: any) => t.name === name).id;
    await page
      .locator('section.card')
      .filter({ has: page.getByRole('heading', { name, exact: true }) })
      .getByRole('button', { name: '开始训练' })
      .click();
    await expect(page).toHaveURL(/\/fitness\/[a-f0-9-]+$/);
    workoutId = new URL(page.url()).pathname.split('/').at(-1);
    await expect(page.locator('.workout-workspace')).toBeVisible();
    const workout = await (await page.request.get(`/api/fitness/sessions/${workoutId}`)).json();
    expect(workout.status).toBe('active');
    expect(workout.exercises[0].sets).toHaveLength(2);
    expect(workout.exercises[0].sets[1].weight).toBe(100);
  } finally {
    if (!templateId) {
      const templates = await (await page.request.get('/api/fitness/templates')).json();
      templateId = templates.items.find((t: any) => t.name === name)?.id;
    }
    if (workoutId) await page.request.delete(`/api/fitness/sessions/${workoutId}`, { headers });
    if (templateId) await page.request.delete(`/api/fitness/templates/${templateId}`, { headers });
  }
});
