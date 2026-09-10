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
test('live workout: multi-select, partial autosave, more sets, recovery and completion', async ({
  page,
  request,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  let id = '';
  try {
    await page.goto('/fitness');
    await page.getByRole('button', { name: '开始训练', exact: true }).click();
    await Promise.race([
      page.waitForURL(/\/fitness\/[\w-]+$/),
      page.getByRole('button', { name: '开始另一场训练', exact: true }).waitFor(),
    ]);
    if (await page.getByRole('button', { name: '开始另一场训练', exact: true }).isVisible())
      await page.getByRole('button', { name: '开始另一场训练', exact: true }).click();
    await expect(page).toHaveURL(/\/fitness\/[\w-]+$/);
    id = new URL(page.url()).pathname.split('/').at(-1)!;
    await page.getByRole('button', { name: '添加动作', exact: true }).first().click();
    await page.getByRole('textbox', { name: '搜索', exact: true }).fill('barbell bench press');
    await page.locator('.exercise-open').first().click();
    await page.getByRole('textbox', { name: '搜索', exact: true }).fill('barbell deadlift');
    await page.locator('.exercise-open').filter({ hasText: '杠铃硬拉' }).first().click();
    await page.getByRole('button', { name: '添加已选动作 2' }).click();
    const section = page.locator('.set-exercise').first();
    await section.getByLabel('重量 (kg)', { exact: true }).fill('100');
    await expect(page.getByRole('status')).toHaveText('已保存');
    await page.reload();
    await expect(page.locator('.set-exercise')).toHaveCount(2);
    await expect(section.getByLabel('重量 (kg)', { exact: true })).toHaveValue('100');
    await section.getByLabel('次数', { exact: true }).fill('8');
    await section.getByRole('button', { name: '记一组' }).click();
    await section.locator('.card-heading > details > summary').click();
    await section.getByRole('combobox', { name: '记录方式', exact: true }).selectOption('reps');
    await expect(page.getByRole('status')).toHaveText('已保存');
    await section.getByRole('combobox', { name: '记录方式', exact: true }).selectOption('weight');
    await expect(section.getByLabel('重量 (kg)', { exact: true })).toHaveValue('100');
    await expect(section.getByRole('button', { name: '记一组' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await section.locator('.card-heading > details > summary').click();

    await section.getByRole('button', { name: '沿用上一组', exact: true }).click();
    await expect(section.getByLabel('重量 (kg)', { exact: true }).nth(1)).toHaveValue('100');
    await expect(section.getByRole('button', { name: '记一组' }).nth(1)).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    await page.getByRole('button', { name: '添加动作', exact: true }).click();
    await page.getByRole('textbox', { name: '搜索', exact: true }).fill('push-up');
    await page.locator('.exercise-open').first().click();
    await page.getByRole('button', { name: '添加已选动作 1' }).click();
    await expect(page.locator('.set-exercise')).toHaveCount(3);
    // A failed save must preserve input and expose retry.
    await expect(page.getByRole('status')).toHaveText('已保存');
    await page.route('**/api/fitness/sessions/**', (route) =>
      route.request().method() === 'PUT' ? route.abort() : route.continue(),
    );
    await section.getByLabel('重量 (kg)', { exact: true }).nth(1).fill('110');
    await expect(page.getByRole('status')).toContainText('保存失败');
    await expect(section.getByLabel('重量 (kg)', { exact: true }).nth(1)).toHaveValue('110');
    await page.unroute('**/api/fitness/sessions/**');
    await page.getByRole('button', { name: '重试保存' }).click();
    await expect(page.getByRole('status')).toHaveText('已保存');
    await section.getByRole('button', { name: '记一组' }).nth(1).click();
    await expect(page.getByRole('status')).toHaveText('已保存');
    expect((await request.get(`/api/fitness/sessions/${id}`)).status()).toBe(404);
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
    }
    const violations = (
      await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
    ).violations;
    expect(violations).toEqual([]);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => {
      (document.activeElement as HTMLElement)?.blur();
    });
    await page.screenshot({ path: 'output/playwright/fitness-live-mobile.png', fullPage: true });
    await page.getByRole('button', { name: '完成训练', exact: true }).click();
    await expect(page.locator('.workout-workspace')).toHaveCount(0);
    const saved = await (await page.request.get(`/api/fitness/sessions/${id}`)).json();
    expect(saved.status).toBe('completed');
    expect(saved.exercises[0].sets).toHaveLength(2);
    expect(saved.exercises[0].sets[1].weight).toBe(110);
    expect(Date.parse(saved.end_at)).toBeGreaterThanOrEqual(Date.parse(saved.start_at));
  } finally {
    if (id) await page.request.delete(`/api/fitness/sessions/${id}`, { headers });
  }
});
test('backfill crosses midnight and quick records can gain detailed exercises', async ({
  page,
}) => {
  let id = '';
  try {
    await page.goto('/fitness');
    await page.getByRole('button', { name: '选择日期', exact: true }).click();
    await page.getByLabel('选择日期', { exact: true }).fill('2026-09-08');
    const receipt = page.waitForResponse(
      (r) => r.url().endsWith('/api/fitness/checkin') && r.request().method() === 'POST',
    );
    await page.getByRole('button', { name: '背部', exact: true }).click();
    id = (await (await receipt).json()).id;
    await page.getByRole('button', { name: '补充记录', exact: true }).click();
    await page.locator('summary').filter({ hasText: '补充记录' }).click();
    await page.locator('summary').filter({ hasText: '精确时间' }).click();
    await page.getByLabel('开始时间', { exact: true }).fill('2026-09-08T23:30');
    await page.getByLabel('结束时间', { exact: true }).fill('2026-09-09T00:30');
    await expect(page.locator('.record-heading [role=status]')).toHaveText('已保存');
    await page.getByRole('button', { name: '添加动作', exact: true }).first().click();
    await page.getByRole('textbox', { name: '搜索', exact: true }).fill('barbell deadlift');
    await page.locator('.exercise-open').filter({ hasText: '杠铃硬拉' }).first().click();
    await page.getByRole('button', { name: '添加已选动作 1' }).click();
    await page.getByLabel('重量 (kg)', { exact: true }).fill('120');
    await page.getByLabel('次数', { exact: true }).fill('5');
    await page.getByRole('button', { name: '记一组', exact: true }).click();
    await page.locator('.record-footer').getByRole('button', { name: '保存', exact: true }).click();
    await expect(page.locator('.workout-workspace')).toHaveCount(0);
    const saved = await (await page.request.get(`/api/fitness/sessions/${id}`)).json();
    expect(saved.mode).toBe('detailed');
    expect(saved.exercises[0].sets[0].completed).toBe(true);
    expect(Date.parse(saved.end_at) - Date.parse(saved.start_at)).toBe(3600000);
    expect(saved.start_at).toBe('2026-09-08T15:30:00.000Z');
  } finally {
    if (id) await page.request.delete(`/api/fitness/sessions/${id}`, { headers });
  }
});
test('atomic revision guards, idempotent completion, media and path ownership', async ({
  page,
  request,
}) => {
  const id = crypto.randomUUID(),
    setId = crypto.randomUUID();
  try {
    const exercise = await (await page.request.get('/api/fitness/exercises/0032')).json();
    expect(exercise.image).toContain('/exercises/0032/');
    expect(exercise.images).toHaveLength(2);
    expect((await request.get(exercise.image)).ok()).toBe(true);
    const initial = {
      id,
      title: 'E2E revisions',
      mode: 'detailed',
      status: 'active',
      body_parts: [],
      start_at: '2026-09-08T10:00:00.000Z',
      end_at: null,
      timezone: 'Asia/Shanghai',
      note: '',
      visibility: 'private',
      exercises: [
        {
          id: crypto.randomUUID(),
          exercise_id: '0032',
          recording_type: 'weight',
          sets: [
            {
              id: setId,
              reps: null,
              weight: 100,
              duration: null,
              distance: null,
              rpe: null,
              note: '',
              completed: false,
            },
          ],
        },
      ],
    };
    const created = await page.request.post('/api/fitness/sessions', { headers, data: initial });
    expect(created.ok()).toBe(true);
    const w = await created.json();
    const responses = await Promise.all(
      ['a', 'b'].map((note) =>
        page.request.put(`/api/fitness/sessions/${id}`, { headers, data: { ...w, note } }),
      ),
    );
    expect(responses.map((r) => r.status()).sort()).toEqual([200, 409]);
    let current = await (await page.request.get(`/api/fitness/sessions/${id}`)).json();
    expect(current.exercises[0].sets[0].id).toBe(setId);
    expect(
      (
        await page.request.put('/api/fitness/sessions/wrong-id', { headers, data: current })
      ).status(),
    ).toBe(400);
    current = {
      ...current,
      mutation_id: crypto.randomUUID(),
      end_at: '2026-09-08T11:00:00.000Z',
      exercises: current.exercises.map((e: any) => ({
        ...e,
        sets: e.sets.map((s: any) => ({ ...s, reps: 8, completed: true })),
      })),
    };
    const first = await page.request.post(`/api/fitness/sessions/${id}/complete`, {
      headers,
      data: current,
    });
    expect(first.ok()).toBe(true);
    const second = await page.request.post(`/api/fitness/sessions/${id}/complete`, {
      headers,
      data: current,
    });
    expect(second.ok()).toBe(true);
    expect((await first.json()).revision).toBe((await second.json()).revision);
    expect((await request.get(`/api/fitness/sessions/${id}`)).status()).toBe(404);
  } finally {
    await page.request.delete(`/api/fitness/sessions/${id}`, { headers });
  }
});

test('standalone exercise library joins a workout and supports bilingual responsive themes', async ({
  page,
  context,
}) => {
  let id = '';
  try {
    id = crypto.randomUUID();
    const title = `E2E library target ${id}`;
    expect(
      (
        await page.request.post('/api/fitness/sessions', {
          headers,
          data: {
            id,
            title,
            mode: 'detailed',
            status: 'active',
            body_parts: [],
            start_at: new Date().toISOString(),
            end_at: null,
            timezone: 'Asia/Shanghai',
            note: '',
            visibility: 'private',
            exercises: [],
          },
        })
      ).ok(),
    ).toBe(true);
    await page.goto('/fitness?view=library');
    await page.getByRole('textbox', { name: '搜索', exact: true }).fill('barbell deadlift');
    await page.locator('.exercise-open').filter({ hasText: '杠铃硬拉' }).first().click();
    await expect(page.locator('.exercise-poses img')).toHaveCount(2);
    await page.getByRole('button', { name: '加入训练', exact: true }).click();
    await Promise.race([
      page.waitForURL(`**/fitness/${id}`),
      page.getByRole('button', { name: title, exact: true }).waitFor(),
    ]);
    if (await page.getByRole('button', { name: title, exact: true }).isVisible())
      await page.getByRole('button', { name: title, exact: true }).click();
    await expect(page).toHaveURL(/\/fitness\/[\w-]+$/);
    expect(new URL(page.url()).pathname).toBe(`/fitness/${id}`);
    await expect(page.locator('.set-exercise h3')).toContainText('杠铃硬拉');
    for (const lang of ['zh-CN', 'en-US']) {
      await context.addCookies([
        { name: 'fubao.locale', value: lang, url: 'http://127.0.0.1:4321' },
      ]);
      await page.reload();
      await expect(page.locator('.workout-workspace')).toBeVisible();
      for (const theme of ['light', 'dark'])
        for (const width of [320, 390, 768, 1440]) {
          await page.setViewportSize({ width, height: 900 });
          await page.evaluate((theme) => {
            document.documentElement.dataset.theme = theme;
          }, theme);
          expect(
            await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
          ).toBe(true);
        }
      await page.screenshot({
        path: `output/playwright/fitness-${lang}-desktop.png`,
        fullPage: true,
      });
    }
    const result = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    expect(result.violations).toEqual([]);
  } finally {
    if (id) await page.request.delete(`/api/fitness/sessions/${id}`, { headers });
  }
});

test('discarding a partially saved workout cannot resurrect it; JSON restores it explicitly', async ({
  page,
}) => {
  const id = crypto.randomUUID();
  try {
    const data = {
      id,
      title: 'E2E discard',
      mode: 'detailed',
      status: 'active',
      body_parts: [],
      start_at: new Date().toISOString(),
      end_at: null,
      timezone: 'Asia/Shanghai',
      note: '',
      visibility: 'private',
      exercises: [],
    };
    const created = await page.request.post('/api/fitness/sessions', { headers, data });
    expect(created.ok()).toBe(true);
    const saved = await created.json();
    await page.goto(`/fitness/${id}`);
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: '删除本次训练' }).click();
    await expect(page).toHaveURL('/fitness?view=history');
    expect(
      (await page.request.put(`/api/fitness/sessions/${id}`, { headers, data: saved })).status(),
    ).toBe(404);
    const restored = await page.request.post('/api/data/import', {
      headers,
      data: { kind: 'session', value: saved },
    });
    expect(restored.ok()).toBe(true);
    expect((await page.request.get(`/api/fitness/sessions/${id}`)).ok()).toBe(true);
  } finally {
    await page.request.delete(`/api/fitness/sessions/${id}`, { headers });
  }
});
